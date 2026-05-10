require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const express = require('express');
const axios = require('axios');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();

app.use(express.static('public'));

let currentUser = null;

client.once('ready', () => {
  console.log(`${client.user.tag} connecté`);
});

client.on('guildMemberAdd', async (member) => {

  const channel = member.guild.channels.cache.find(
    c => c.name === 'verify'
  );

  if (!channel) return;

  const verifyButton = new ButtonBuilder()
    .setLabel('Verify')
    .setStyle(ButtonStyle.Link)
    .setURL(
      `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`
    );

  const row = new ActionRowBuilder()
    .addComponents(verifyButton);

  channel.send({
    content: `${member} clique sur Verify.`,
    components: [row]
  });
});

app.get('/callback', async (req, res) => {

  const code = req.query.code;

  try {

    const params = new URLSearchParams();

    params.append(
      'client_id',
      process.env.CLIENT_ID
    );

    params.append(
      'client_secret',
      process.env.CLIENT_SECRET
    );

    params.append(
      'grant_type',
      'authorization_code'
    );

    params.append(
      'code',
      code
    );

    params.append(
      'redirect_uri',
      process.env.REDIRECT_URI
    );

    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      params,
      {
        headers: {
          'Content-Type':
          'application/x-www-form-urlencoded'
        }
      }
    );

    const userResponse = await axios.get(
      'https://discord.com/api/users/@me',
      {
        headers: {
          Authorization:
          `Bearer ${tokenResponse.data.access_token}`
        }
      }
    );

    currentUser = userResponse.data.id;

    res.sendFile(
      __dirname + '/public/verify.html'
    );

  } catch (err) {

    console.log(err);

    res.send('Erreur');
  }
});

app.get('/finalverify', async (req, res) => {

  try {

    if (!currentUser) {
      return res.send(
        'Erreur utilisateur'
      );
    }

    const verified = JSON.parse(
      fs.readFileSync('verified.json')
    );

    if (verified.includes(currentUser)) {

      return res.send(
        'Compte déjà vérifié'
      );
    }

    verified.push(currentUser);

    fs.writeFileSync(
      'verified.json',
      JSON.stringify(verified, null, 2)
    );

    const guild =
    client.guilds.cache.get(
      process.env.GUILD_ID
    );

    const member =
    await guild.members.fetch(currentUser);

    const role =
    guild.roles.cache.find(
      r => r.name === 'Vérifié'
    );

    if (role) {

      await member.roles.add(role);
    }

    res.send(
      'Verification réussie'
    );

  } catch (err) {

    console.log(err);

    res.send('Erreur');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Serveur web lancé');
});

client.login(process.env.TOKEN);