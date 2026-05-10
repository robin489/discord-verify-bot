require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();

/* =========================
   SAFE ENV CHECK
========================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

if (!TOKEN) console.log("⚠ TOKEN manquant");
if (!CLIENT_ID) console.log("⚠ CLIENT_ID manquant");
if (!CLIENT_SECRET) console.log("⚠ CLIENT_SECRET manquant");
if (!REDIRECT_URI) console.log("⚠ REDIRECT_URI manquant");

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`🤖 Bot connecté: ${client.user.tag}`);
});

client.login(TOKEN).catch(err => {
  console.log("❌ Bot login error:", err.message);
});

/* =========================
   EXPRESS
========================= */

app.use(express.static("public"));
app.use(express.json());

/* =========================
   JOIN SYSTEM + STORE MESSAGE
========================= */

client.on("guildMemberAdd", async (member) => {

  try {

    const guild = member.guild;

    const unverifiedRole = guild.roles.cache.find(r => r.name === "Unverified");
    if (unverifiedRole) await member.roles.add(unverifiedRole);

    const channel = guild.channels.cache.get(process.env.VERIFY_CHANNEL_ID);

    if (channel) {

      const msg = await channel.send(
        `👋 Bienvenue <@${member.id}> !\n\n` +
        `🔐 Pour accéder au serveur, vérifie-toi ici :\n` +
        `👉 https://discord-verify-bot-ruwm.onrender.com/auth/discord`
      );

      // 👉 STOCKAGE DU MESSAGE
      global.verifyMessages = global.verifyMessages || {};
      global.verifyMessages[member.id] = msg.id;

      console.log("✔ Message verify envoyé:", msg.id);
    }

  } catch (err) {
    console.log("JOIN ERROR:", err.message);
  }

});

/* =========================
   DISCORD LOGIN
========================= */

app.get("/auth/discord", (req, res) => {

  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify%20guilds.join`;

  res.redirect(url);

});

/* =========================
   CALLBACK
========================= */

app.get("/callback", async (req, res) => {

  const code = req.query.code;
  if (!code) return res.send("❌ Code manquant");

  try {

    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        scope: "identify guilds.join"
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const user = userResponse.data;

    res.redirect(`/verify.html?user=${user.id}`);

  } catch (err) {
    console.log("❌ CALLBACK ERROR:", err.response?.data || err.message);
    res.send("Erreur OAuth Discord");
  }

});

/* =========================
   VERIFY SYSTEM + DELETE MESSAGE
========================= */

app.post("/api/verify", async (req, res) => {

  try {

    const userId = req.body.userId;
    if (!userId) return res.status(400).send("User manquant");

    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);

    // 👉 REMOVE UNVERIFIED
    const unverifiedRole = guild.roles.cache.find(r => r.name === "Unverified");
    if (unverifiedRole) await member.roles.remove(unverifiedRole);

    // 👉 ADD VERIFIED
    await member.roles.add(process.env.ROLE_ID);

    console.log(`✔ Verified: ${userId}`);

    // 👉 DELETE MESSAGE
    const channel = guild.channels.cache.get(process.env.VERIFY_CHANNEL_ID);
    const messageId = global.verifyMessages?.[userId];

    if (channel && messageId) {
      try {
        const msg = await channel.messages.fetch(messageId);
        await msg.delete();
        console.log("🗑 Message verify supprimé");
      } catch (e) {
        console.log("⚠ Delete message error:", e.message);
      }
    }

    // 👉 CONFIRM MESSAGE
    if (channel) {
      channel.send(`✔ <@${userId}> a été vérifié avec succès`);
    }

    res.send("OK");

  } catch (err) {
    console.log("❌ VERIFY ERROR:", err.message);
    res.status(500).send("Erreur verification");
  }

});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur port ${PORT}`);
});