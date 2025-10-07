import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { data as setupVerifyData } from "./commands/setupverify.js";
dotenv.config();

const commands = [setupVerifyData.toJSON()];
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log("📡 Slash-Commands werden registriert...");
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log("✅ Slash-Commands erfolgreich registriert!");
} catch (err) {
  console.error(err);
}
