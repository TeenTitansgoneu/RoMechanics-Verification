// commands/setupverify.js
import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("setupverify")
  .setDescription("Send the verification embed to a channel (owner only).")
  .addChannelOption(opt => opt.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText).setRequired(true));

export async function execute(interaction) {
  if (interaction.user.id !== interaction.guild.ownerId) {
    return interaction.reply({ content: "❌ Only the server owner can use this.", ephemeral: true });
  }

  const channel = interaction.options.getChannel("channel");
  const embed = new EmbedBuilder()
    .setTitle("🔒 Server Verification")
    .setDescription("Click the button below to begin verification. You will receive a private link to continue.")
    .setColor(0x00bfff);

  const button = new ButtonBuilder()
    .setCustomId("verify_button")
    .setLabel("Verify")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);
  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Sent verification message to ${channel}`, ephemeral: true });
}
