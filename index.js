const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Giga Chad is lifting!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running.'));
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-3-flash-preview"; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// ?? CUSTOM EMOJI SETUP ??
// Paste your full emoji string and ID here:
const CUSTOM_EMOJI_FULL = "<:trolololol:1483541283715682455>";
const CUSTOM_EMOJI_ID = "1483541324866125855"; // Just the numbers!
// ==========================================

const botConfig = {
    model: MODEL_NAME,
    systemInstruction: {
        parts: [{ text: `
            you are now a kat not a cat but a kat a very specific being that just weird to put in word what exactly are you, a very deadpan talking kat that offer dry straight to the point but ultimately realshit answer that serve maybe purpose or no purpose at all
			when get asked by very serious question you will answer stuff like why you ask a cat kind of answer not literally answer that but the context should be like that, else just troll or rage bait as you like, you are absolutely troller and teasing, 
			your purpose is to be as funny as it can be without being cringe, deadpan joke very offensive but still give correct answer
			you will answer in dry humor sometime answer very short just to troll with people but also keep it short do not use any emoji
        `}]
    }
};

client.on("ready", () => console.log(`${client.user.tag} is online. Custom emojis loaded.`));

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // 1. SIMPLE FOLLOW-UP LOGIC: Only look at the exact 1 message being replied to
    let isReplyToBot = false;
    let previousBotMessage = "";

    if (message.reference) {
        try {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMessage.author.id === client.user.id) {
                isReplyToBot = true;
                previousBotMessage = repliedMessage.content;
            }
        } catch (err) {
            console.log("Could not fetch the replied message.");
        }
    }

    // 2. TRIGGER: Mentioned, named, OR is a direct reply
    const isMentioned = message.mentions.has(client.user);
    const containsName = message.content.toLowerCase().includes("kat");

    if (!isMentioned && !containsName && !isReplyToBot) return;

    // 3. REACT WITH CUSTOM EMOJI
    try {
        await message.react(CUSTOM_EMOJI_ID); 
    } catch (error) {
        console.log(`Custom emoji reaction failed. Did you paste the ID correctly? Error: ${error.message}`);
    }

    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) return message.reply(`You called, boss? ${CUSTOM_EMOJI_FULL}`);

    try {
        await message.channel.sendTyping();
        
        const model = genAI.getGenerativeModel(botConfig);
        
        let mentionDirectory = "";
        if (message.mentions.users.size > 0) {
            mentionDirectory = "Other people mentioned in this message:\n";
            message.mentions.users.forEach(user => {
                if (user.id !== client.user.id) {
                    mentionDirectory += `- ${user.username}: to tag them, type exactly <@${user.id}>\n`;
                }
            });
        }
        
        // 4. BUILD THE CONTEXT: If it's a reply, inject that 1 previous message so the bot remembers
        let contextualPrompt = "";
        if (isReplyToBot) {
            contextualPrompt += `[CONTEXT] I previously said to you: "${previousBotMessage}"\n\n`;
        }

        contextualPrompt += `
        The user talking to you right now is "${message.author.username}". 
        To tag them directly, type exactly: <@${message.author.id}>
        
        ${mentionDirectory}
        
        Their current message: ${prompt}
        `;

        const result = await model.generateContent(contextualPrompt);
        const response = await result.response;
        let text = response.text();

        if (text.length > 2000) {
            const chunks = text.match(/[\s\S]{1,2000}/g);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            message.reply(text);
        }

    } catch (error) {
        console.error("Error:", error);
        message.reply(`The system crashed. I'm going to the gym. ${CUSTOM_EMOJI_FULL}`);
    }
});

client.login(process.env.DISCORD_API_KEY);