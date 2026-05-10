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

/* DISCORD CLIENT */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
});

client.login(process.env.TOKEN);

/* STATIC FILES */
app.use(express.static("public"));

/* LOGIN DISCORD */
app.get("/auth/discord", (req, res) => {

  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=identify%20guilds.join`;

  res.redirect(redirect);

});

/* CALLBACK */
app.get("/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.send("❌ Code manquant (OAuth Discord)");
  }

  try {

    /* TOKEN */
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

    /* USER INFO */
    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const user = userResponse.data;

    /* GUILD */
    const guild = await client.guilds.fetch(process.env.GUILD_ID);

    const member = await guild.members.fetch(user.id);

    /* ROLE ADD */
    await member.roles.add(process.env.ROLE_ID);

    console.log(`✅ Role ajouté à ${user.username}`);

    res.send(`
      <h1 style="color:lime;font-family:sans-serif;">
        Vérification réussie ✔
      </h1>
    `);

  } catch (err) {

    console.error("❌ CALLBACK ERROR:");
    console.error(err.response?.data || err.message);

    res.send("❌ Erreur vérification (regarde logs Render)");
  }

});

/* PORT RENDER SAFE */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur port ${PORT}`);
});