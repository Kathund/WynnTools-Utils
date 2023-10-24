import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } from 'discord.js';
import { generateID, cleanMessage } from '../../functions/helper.js';
import { errorMessage } from '../../functions/logger.js';
import { discord, other } from '../../../config.json';
import { version } from '../../../package.json';

export const data = new SlashCommandBuilder()
  .setName('about')
  .setDescription('Shows info about the bot')
  .setDMPermission(false);
export async function execute(interaction) {
  try {
    const support = new ButtonBuilder().setLabel('support').setURL(discord.supportInvite).setStyle(ButtonStyle.Link);
    const invite = new ButtonBuilder().setLabel('invite').setURL(discord.botInvite).setStyle(ButtonStyle.Link);
    const source = new ButtonBuilder()
      .setLabel('source')
      .setURL('https://github.com/Kathund/WynnTools')
      .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder().addComponents(support, invite, source);
    var embed = new EmbedBuilder()
      .setTitle(`WynnTools Utils Stats`)
      .setColor(other.colors.green.hex)
      .setTimestamp()
      .setDescription(
        'WynnTools - A bot that does stuff with the wynncraft api - The Only bot that uses images **that i have seen**'
      )
      .addFields({
        name: 'General',
        value: `<:Dev:1130772126769631272> Developer - \`@kathund\`\n<:bullet:1064700156789927936> Version \`${version}\`\nUptime - <t:${global.uptime}:R>`,
        inline: true,
      })
      .setFooter({
        text: `by @kathund | ${discord.supportInvite} for support`,
        iconURL: other.logo,
      });
    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    var errorId = generateID(other.errorIdLength);
    errorMessage(`Error Id - ${errorId}`);
    errorMessage(error);
    const errorEmbed = new EmbedBuilder()
      .setColor(other.colors.red.hex)
      .setTitle('An error occurred')
      .setDescription(
        `Use </report-bug:${
          discord.commands['report-bug']
        }> to report it\nError id - ${errorId}\nError Info - \`${cleanMessage(error)}\``
      )
      .setFooter({ text: `by @kathund | ${discord.supportInvite} for support`, iconURL: other.logo });
    const supportDisc = new ButtonBuilder()
      .setLabel('Support Discord')
      .setURL(discord.supportInvite)
      .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder().addComponents(supportDisc);
    await interaction.reply({ embeds: [errorEmbed], rows: [row] });
  }
}
