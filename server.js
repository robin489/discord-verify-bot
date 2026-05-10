require("dotenv").config();

const express = require("express");
const axios = require("axios");
const path = require("path");

const { Client, GatewayIntentBits } = require("discord.js");

const app = express();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.login(process.env.TOKEN);

app.use(express.static("public"));

/* LOGIN DISCORD */

app.get("/auth/discord", (req, res) => {

  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=identify guilds.join`;

  res.redirect(redirect);

});

/* CALLBACK */

app.get("/callback", async (req, res) => {

  const code = req.query.code;

  try {

    /* Token OAuth */

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
          "Content-Type":
          "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    /* Infos user */

    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const user = userResponse.data;

    /* Serveur */

    const guild = await client.guilds.fetch(
      process.env.GUILD_ID
    );

    /* Membre */

    const member = await guild.members.fetch(user.id);

    /* Ajout rôle */

    await member.roles.add(process.env.ROLE_ID);

    console.log(`Role ajouté à ${user.username}`);

    res.send(`
      <h1 style="color:lime;font-family:sans-serif;">
      Vérification réussie ✔
      </h1>
    `);

  } catch (err) {

    console.log(err);

    res.send("Erreur vérification");

  }

});

app.listen(3000, () => {
  console.log("Serveur lancé sur port 3000");
});