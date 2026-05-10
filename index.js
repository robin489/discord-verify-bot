app.post("/api/verify", async (req, res) => {

  try {

    const userId = req.body.userId;
    if (!userId) return res.status(400).send("User manquant");

    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);

    // 🔒 ANTI DOUBLE VERIFY
    if (member.roles.cache.has(process.env.ROLE_ID)) {
      return res.send("Déjà vérifié ✔");
    }

    await member.roles.add(process.env.ROLE_ID);
    console.log(`✔ Role donné à ${userId}`);

    // 📢 SALON VERIFY (EMBED PRO)
    const channel = await guild.channels.fetch(process.env.VERIFY_CHANNEL_ID).catch(() => null);

    if (channel) {

      const { EmbedBuilder } = require("discord.js");

      const embed = new EmbedBuilder()
        .setTitle("✔ Nouveau utilisateur vérifié")
        .setDescription(`<@${userId}> a été vérifié avec succès`)
        .setColor(0x00ff99)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      console.log("✔ Log embed envoyé");
    } else {
      console.log("❌ Salon VERIFY introuvable");
    }

    res.send("OK");

  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    res.status(500).send("Erreur verification");
  }

});