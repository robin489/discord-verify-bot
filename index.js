require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const app = express();

/* =========================
   CONFIG
========================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;
const REDIRECT_URI = process.env.REDIRECT_URI;
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;
const VERIFY_URL = process.env.VERIFY_URL || "https://discord-verify-bot-ruwm.onrender.com/auth/discord";
const UNVERIFIED_ROLE_NAME = process.env.UNVERIFIED_ROLE_NAME || "Unverified";
const STORE_FILE = path.join(__dirname, "verified.json");

const requiredEnv = {
  TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  GUILD_ID,
  REDIRECT_URI,
  VERIFY_CHANNEL_ID,
  ROLE_ID,
};

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) console.log(`⚠ ${key} manquant dans le .env`);
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { verifyMessages: {} };
    const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8") || "{}");
    return {
      verifyMessages: data.verifyMessages || {},
    };
  } catch (err) {
    console.log("⚠ Impossible de lire verified.json:", err.message);
    return { verifyMessages: {} };
  }
}

function saveStore() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

const store = loadStore();

async function deleteVerifyMessage(guild, userId) {
  const messageId = store.verifyMessages[userId];
  if (!messageId) return;

  try {
    const channel = await guild.channels.fetch(VERIFY_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (msg) await msg.delete();

    delete store.verifyMessages[userId];
    saveStore();
    console.log(`🗑 Message verify supprimé pour ${userId}`);
  } catch (err) {
    console.log("⚠ Delete message error:", err.message);
  }
}

function buildVerifyPanel(member) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("NEXORA • Vérification")
    .setDescription(
      `Bienvenue ${member} !\n\n` +
      "Pour accéder au serveur, lance la vérification Discord ci-dessous.\n" +
      "Une fois validé, ton rôle sera attribué automatiquement et ce message sera supprimé."
    )
    .addFields(
      {
        name: "🔐 Sécurité",
        value: "Connexion OAuth2 Discord officielle, aucune information sensible demandée.",
        inline: false,
      },
      {
        name: "✅ Après validation",
        value: "Le rôle vérifié est ajouté et le salon devient accessible.",
        inline: false,
      }
    )
    .setFooter({ text: "Nexora Verify • Accès sécurisé" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Vérifier mon compte")
      .setEmoji("🔐")
      .setStyle(ButtonStyle.Link)
      .setURL(VERIFY_URL)
  );

  return { embeds: [embed], components: [row] };
}

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`🤖 Bot connecté: ${client.user.tag}`);
});

client.login(TOKEN).catch((err) => {
  console.log("❌ Bot login error:", err.message);
});

/* =========================
   EXPRESS
========================= */

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/verify.html", (req, res) => {
  res.sendFile(path.join(__dirname, "verify.html"));
});

app.get("/", (req, res) => {
  res.redirect("/auth/discord");
});

/* =========================
   JOIN SYSTEM + STORE MESSAGE
========================= */

client.on("guildMemberAdd", async (member) => {
  try {
    const guild = member.guild;

    const unverifiedRole = guild.roles.cache.find((r) => r.name === UNVERIFIED_ROLE_NAME);
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);

    const channel = await guild.channels.fetch(VERIFY_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    await deleteVerifyMessage(guild, member.id);

    const msg = await channel.send(buildVerifyPanel(member));

    store.verifyMessages[member.id] = msg.id;
    saveStore();

    console.log("✔ Message verify envoyé:", msg.id);
  } catch (err) {
    console.log("JOIN ERROR:", err.message);
  }
});

/* =========================
   DISCORD LOGIN
========================= */

app.get("/auth/discord", (req, res) => {
  const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=identify`;

  res.redirect(url);
});

/* =========================
   CALLBACK
========================= */

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("❌ Code manquant");

  try {
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;
    res.redirect(`/verify.html?user=${user.id}`);
  } catch (err) {
    console.log("❌ CALLBACK ERROR:", err.response?.data || err.message);
    res.status(500).send("Erreur OAuth Discord");
  }
});

/* =========================
   VERIFY SYSTEM + DELETE MESSAGE
========================= */

app.post("/api/verify", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ ok: false, message: "User manquant" });

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return res.status(404).json({
        ok: false,
        message: "Tu dois être présent sur le serveur avant de te vérifier.",
      });
    }

    const verifiedRole = await guild.roles.fetch(ROLE_ID).catch(() => null);
    if (!verifiedRole) {
      return res.status(500).json({ ok: false, message: "Rôle vérifié introuvable." });
    }

    const unverifiedRole = guild.roles.cache.find((r) => r.name === UNVERIFIED_ROLE_NAME);
    if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(() => null);

    await member.roles.add(verifiedRole);
    await deleteVerifyMessage(guild, userId);

    console.log(`✔ Verified: ${userId}`);

    const channel = await guild.channels.fetch(VERIFY_CHANNEL_ID).catch(() => null);
    if (channel) {
      const confirm = await channel.send(`✅ <@${userId}> a été vérifié avec succès.`).catch(() => null);
      if (confirm) setTimeout(() => confirm.delete().catch(() => null), 7000);
    }

    res.json({ ok: true, message: "Vérification réussie. Tu peux retourner sur Discord." });
  } catch (err) {
    console.log("❌ VERIFY ERROR:", err.response?.data || err.message);
    res.status(500).json({ ok: false, message: "Erreur pendant la vérification." });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur port ${PORT}`);
});
