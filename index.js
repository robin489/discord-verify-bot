require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();

/* =========================
   SAFE START (NO CRASH)
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
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`🤖 Bot connecté: ${client.user.tag}`);
});

client.login(TOKEN).catch(err => {
  console.log("❌ Erreur login bot:", err.message);
});

/* =========================
   EXPRESS MIDDLEWARE
========================= */

app.use(express.static("public"));
app.use(express.json());

/* =========================
   LOGIN DISCORD
========================= */

app.get("/auth/discord", (req, res) => {

  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify%20guilds.join`;

  res.redirect(url);

});

/* =========================
   CALLBACK DISCORD
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

    // 👉 redirection vers page verify
    res.redirect(`/verify.html?user=${user.id}`);

  } catch (err) {
    console.log("❌ CALLBACK ERROR:", err.response?.data || err.message);
    res.send("Erreur OAuth Discord");
  }

});

/* =========================
   VERIFY SYSTEM
========================= */

app.post("/api/verify", async (req, res) => {

  try {

    const userId = req.body.userId;

    if (!userId) return res.status(400).send("User manquant");

    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);

    await member.roles.add(process.env.ROLE_ID);

    console.log(`✔ Role donné à ${userId}`);

    // 👉 SALON VERIFY SAFE
    const channel = await guild.channels.fetch(process.env.VERIFY_CHANNEL_ID).catch(() => null);

    if (channel) {
      await channel.send(`✔ <@${userId}> a été vérifié avec succès`);
      console.log("✔ Message envoyé salon verify");
    } else {
      console.log("❌ Salon VERIFY introuvable");
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