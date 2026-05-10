require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();

/* SAFE CHECK ENV */
if (!process.env.TOKEN) {
  console.error("❌ TOKEN manquant dans .env");
  process.exit(1);
}

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  console.error("❌ CLIENT_ID ou CLIENT_SECRET manquant");
  process.exit(1);
}

if (!process.env.REDIRECT_URI) {
  console.error("❌ REDIRECT_URI manquant");
  process.exit(1);
}

/* DISCORD BOT */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`🤖 Bot connecté: ${client.user.tag}`);
});

client.login(process.env.TOKEN);

/* MIDDLEWARE */
app.use(express.static("public"));
app.use(express.json());

/* LOGIN DISCORD */
app.get("/auth/discord", (req, res) => {

  const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=identify%20guilds.join`;

  res.redirect(url);

});

/* CALLBACK (NO ROLE HERE) */
app.get("/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("❌ Code manquant");
  }

  try {

    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
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

    // 👉 page Nexora
    res.redirect(`/verify.html?user=${user.id}`);

  } catch (err) {
    console.error("❌ CALLBACK ERROR:", err.response?.data || err.message);
    res.send("Erreur OAuth Discord");
  }

});

/* VERIFY MANUELLE + LOG SALON (FIXED) */
app.post("/api/verify", async (req, res) => {

  try {

    const userId = req.body.userId;

    if (!userId) return res.status(400).send("User manquant");

    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);

    // 👉 add role
    await member.roles.add(process.env.ROLE_ID);

    console.log(`✔ Role donné à ${userId}`);

    // 👉 LOG SALON VERIFY (FIX IMPORTANT)
    const channel = guild.channels.cache.get(process.env.VERIFY_CHANNEL_ID);

    if (!channel) {
      console.log("❌ Salon VERIFY introuvable");
    } else {
      await channel.send(`✔ <@${userId}> a été vérifié avec succès`);
      console.log("✔ Message envoyé salon verify");
    }

    res.send("Utilisateur vérifié ✔");

  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    res.status(500).send("Erreur verification");
  }

});

/* START SERVER */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur port ${PORT}`);
});