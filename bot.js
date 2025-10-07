// bot.js
import { Client, GatewayIntentBits, Partials, Collection, Events } from "discord.js";
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import crypto from "crypto";
import { execute as setupVerifyExecute, data as setupVerifyData } from "./commands/setupverify.js";

dotenv.config();

// ---- Discord Client ----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.commands = new Collection();
client.commands.set(setupVerifyData.name, { execute: setupVerifyExecute });

// ---- In-memory token store ----
// Map: token => { userId, expiresAt }
const tokenStore = new Map();
// helper: create token
function createTokenForUser(userId) {
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minuten
  tokenStore.set(token, { userId, expiresAt });
  return token;
}
// clean expired tokens every minute
setInterval(() => {
  const now = Date.now();
  for (const [t, info] of tokenStore.entries()) {
    if (info.expiresAt <= now) tokenStore.delete(t);
  }
}, 60 * 1000);

// ---- Express Webserver ----
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("website"));

// Serve index and captcha pages from website folder (static)
// POST /verify - handle captcha + token check
app.post("/verify", async (req, res) => {
  const { "g-recaptcha-response": captcha, user_id, token } = req.body;

  if (!captcha) return res.status(400).send("Captcha missing.");
  if (!user_id || !token) return res.status(400).send("Missing user_id or token.");

  // token validation
  const info = tokenStore.get(token);
  if (!info) return res.status(400).send("Invalid or expired token.");
  if (info.userId !== user_id) return res.status(400).send("Token does not match user.");

  // verify captcha with Google
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${captcha}`;
  const response = await fetch(verifyUrl, { method: "POST" });
  const data = await response.json();
  if (!data.success) return res.status(400).send("Captcha verification failed.");

  // All good: assign role
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(user_id).catch(() => null);
    if (!member) return res.status(400).send("User not found on the server.");
    await member.roles.add(process.env.ROLE_ID);
    // delete token so it cannot be reused
    tokenStore.delete(token);
    return res.send("✅ Verification successful! You may now return to Discord.");
  } catch (err) {
    console.error("Error assigning role:", err);
    res.status(500).send("Server error while assigning role.");
  }
});

// ---- Discord Events & interaction handling ----
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  // Slash command handling
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Error while executing command.", ephemeral: true });
    }
  }

  // Button interaction (from the setup embed)
  if (interaction.isButton() && interaction.customId === "verify_button") {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const avatar = interaction.user.displayAvatarURL({ extension: "png", size: 256 });

    // create token and store it
    const token = createTokenForUser(userId);

    // Build link with encoded params (username and avatar encoded)
    const base = process.env.WEB_BASE || `http://localhost:${process.env.PORT || 3000}`;
    const link = `${base}/?id=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;

    // Send ephemeral reply with the link (English)
    await interaction.reply({
      content: `🔗 Click the link to start verification:\n${link}\n\nThis link expires in 10 minutes.`,
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN);

// start express
app.listen(process.env.PORT || 3000, () =>
  console.log(`🌐 Website running on http://localhost:${process.env.PORT || 3000}`)
);
