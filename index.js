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

// Helper function to turn Discord images into "AI Vision" data
async function fetchImageForAI(url, mimeType) {
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return {
            inlineData: {
                data: Buffer.from(buffer).toString("base64"),
                mimeType: mimeType
            }
        };
    } catch (e) {
        console.log("Failed to fetch image:", e.message);
        return null;
    }
}

// 3. Kat's Brain (System Instructions + Web Search Tool)
const botConfig = {
    model: MODEL_NAME,
    systemInstruction: {
        parts: [{ text: `

        `}]
    },
    // This tiny line is what gives her access to the entire live internet!
    tools: [{ googleSearch: {} }] 
};

client.on("ready", () => console.log(`${client.user.tag} is online. vision and web search active.`));

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // --- WAKE UP LOGIC ---
    let isReplyToBot = false;
    if (message.reference) {
        try {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMessage.author.id === client.user.id) {
                isReplyToBot = true;
            }
        } catch (err) {}
    }

    const isMentioned = message.mentions.has(client.user);
    const containsName = message.content.toLowerCase().includes("kat");

    if (!isMentioned && !containsName && !isReplyToBot) return;

    // --- REACTION ---
    try {
        await message.react(CUSTOM_EMOJI_ID); 
    } catch (error) {}

    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt && message.attachments.size === 0) return message.reply("what.");

    try {
        await message.channel.sendTyping();
        
        // --- MEMORY & VISION PROCESSING ---
        // Fetch the 5 messages immediately BEFORE this current one
        const fetchedMessages = await message.channel.messages.fetch({ limit: 5, before: message.id });
        const messageArray = Array.from(fetchedMessages.values()).reverse();
        
        let chatHistory = "--- RECENT CHAT HISTORY ---\n";
        let imageParts = []; // This will hold the images we find

        // Process the past 5 messages
        for (const m of messageArray) {
            if (m.content) {
                const cleanContent = m.content.replace(/<@!?\d+>/g, '[Someone]');
                const senderName = m.author.id === client.user.id ? "Kat (You)" : m.author.username;
                chatHistory += `${senderName}: "${cleanContent}"\n`;
            }
            
            // Check if past messages had images
            for (const [id, attachment] of m.attachments) {
                if (attachment.contentType && attachment.contentType.startsWith("image/")) {
                    chatHistory += `[${m.author.username} uploaded an image here]\n`;
                    const aiImage = await fetchImageForAI(attachment.url, attachment.contentType);
                    if (aiImage) imageParts.push(aiImage);
                }
            }
        }
        chatHistory += "---------------------------\n";

        // Check the CURRENT message for images too
        for (const [id, attachment] of message.attachments) {
            if (attachment.contentType && attachment.contentType.startsWith("image/")) {
                chatHistory += `[${message.author.username} attached an image to their current message]\n`;
                const aiImage = await fetchImageForAI(attachment.url, attachment.contentType);
                if (aiImage) imageParts.push(aiImage);
            }
        }

        // --- TAGGING DIRECTORY ---
        let mentionDirectory = "";
        if (message.mentions.users.size > 0) {
            mentionDirectory = "Other people mentioned:\n";
            message.mentions.users.forEach(user => {
                if (user.id !== client.user.id) {
                    mentionDirectory += `- ${user.username}: type <@${user.id}>\n`;
                }
            });
        }

        // --- COMPILE THE PROMPT ---
        const contextualPrompt = `
        ${chatHistory}
        
        The user talking to you is "${message.author.username}". 
        To tag them directly, type exactly: <@${message.author.id}>
        
        ${mentionDirectory}
        
        Their current message to you: "${prompt}"
        `;

        const model = genAI.getGenerativeModel(botConfig);
        
        // We send an array containing the text AND any images we found
        const finalPayload = [contextualPrompt, ...imageParts];

        const result = await model.generateContent(finalPayload);
        const response = await result.response;
        let text = response.text();

        // --- SENDING THE MESSAGE ---
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
        message.reply("stupid server lagged try again.");
    }
});

client.login(process.env.DISCORD_API_KEY);
