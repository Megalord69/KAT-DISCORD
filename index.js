// 1. Keep-Alive Web Server (For Render/UptimeRobot)
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Kat is staring at the wall.'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running.'));

// 2. Bot Dependencies
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
// 🚨 CUSTOM EMOJI SETUP 🚨
const CUSTOM_EMOJI_FULL = "<:trolololol:1483541283715682455>";
const CUSTOM_EMOJI_ID = "1483541324866125855"; 
// ==========================================

// 3. Kat's Brain (System Instructions)
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

client.on("ready", () => console.log(`${client.user.tag} is online. meow or whatever.`));

client.on("messageCreate", async (message) => {
    // Ignore other bots completely
    if (message.author.bot) return;

    // --- WAKE UP LOGIC ---
    // Check if the user is replying directly to Kat
    let isReplyToBot = false;
    if (message.reference) {
        try {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMessage.author.id === client.user.id) {
                isReplyToBot = true;
            }
        } catch (err) {
            console.log("Could not fetch the replied message.");
        }
    }

    const isMentioned = message.mentions.has(client.user);
    const containsName = message.content.toLowerCase().includes("kat");

    // If Kat wasn't mentioned, named, or replied to, go back to sleep
    if (!isMentioned && !containsName && !isReplyToBot) return;

    // --- REACTION ---
    try {
        await message.react(CUSTOM_EMOJI_ID); 
    } catch (error) {
        console.log(`Emoji reaction failed. Error: ${error.message}`);
    }

    // Clean up the @mention from the prompt so Kat just reads the text
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) return message.reply("what.");

    try {
        await message.channel.sendTyping();
        
        // --- MEMORY / CONTEXT FETCHING ---
        // Fetch the 5 messages immediately BEFORE this current one
        const fetchedMessages = await message.channel.messages.fetch({ limit: 5, before: message.id });
        
        // Convert Discord's weird collection to a normal array and reverse it (oldest -> newest)
        const messageArray = Array.from(fetchedMessages.values()).reverse();
        
        let chatHistory = "--- WHAT HAPPENED IN THE CHAT JUST NOW ---\n";
        
        messageArray.forEach(m => {
            // Skip empty messages (like just images)
            if (!m.content) return; 
            
            // Clean up IDs so Kat doesn't read <@12345> out loud
            const cleanContent = m.content.replace(/<@!?\d+>/g, '[Someone]');
            
            // Tell Kat if she said it, or if a human said it
            const senderName = m.author.id === client.user.id ? "Kat (You)" : m.author.username;
            chatHistory += `${senderName}: "${cleanContent}"\n`;
        });
        chatHistory += "------------------------------------------\n";

        // --- TAGGING DIRECTORY ---
        let mentionDirectory = "";
        if (message.mentions.users.size > 0) {
            mentionDirectory = "Other people mentioned in this message (if you want to troll them):\n";
            message.mentions.users.forEach(user => {
                if (user.id !== client.user.id) {
                    mentionDirectory += `- ${user.username}: to tag them, type exactly <@${user.id}>\n`;
                }
            });
        }

        // --- THE FINAL MASTER PROMPT ---
        const model = genAI.getGenerativeModel(botConfig);
        const contextualPrompt = `
        ${chatHistory}
        
        The user talking to you right now is "${message.author.username}". 
        To tag them directly, type exactly: <@${message.author.id}>
        
        ${mentionDirectory}
        
        Their current message to you: "${prompt}"
        
        Based on the chat history and their message, give your deadpan Kat response.
        `;

        const result = await model.generateContent(contextualPrompt);
        const response = await result.response;
        let text = response.text();

        // --- SENDING THE MESSAGE ---
        // Split if over 2000 characters (Discord limit)
        if (text.length > 2000) {
            const chunks = text.match(/[\s\S]{1,2000}/g);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            message.reply(text);
        }

    } catch (error) {
        console.error("Kat Error:", error);
        message.reply("my brain broke. try again later.");
    }
});

client.login(process.env.DISCORD_API_KEY);
