import {
  PermissionFlagsBits,
  CommandInteraction,
  ActionRowBuilder,
  ColorResolvable,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  ChannelType,
  Events,
} from 'discord.js';
import {
  isTicketBlacklisted,
  blacklistCheck,
  cleanMessage,
  generateID,
  writeAt,
  toFixed,
} from '../functions/helper.js';
import { eventMessage, errorMessage } from '../functions/logger.js';
import { other, discord, api } from '../../config.json';
import { readFileSync } from 'fs';

export const name = Events.InteractionCreate;

export const execute = async (interaction: CommandInteraction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        try {
          let commandString = await interaction.commandName;
          if (interaction.options) {
            if (interaction.options._group) {
              commandString += ` ${await interaction.options.getSubcommandGroup()}`;
            }
            if (interaction.options._subcommand) {
              commandString += ` ${await interaction.options.getSubcommand()}`;
            }
            for (const option of interaction.options._hoistedOptions) {
              if (option.value && option.name) {
                commandString += ` ${option.name}: ${option.value}`;
              }
            }
          }
          eventMessage(
            `Interaction Event trigged by ${
              interaction.user.discriminator == '0'
                ? interaction.user.username
                : `${interaction.user.username}#${interaction.user.discriminator}`
            } (${interaction.user.id}) ran command ${commandString} in ${interaction.guild.id} in ${
              interaction.channel.id
            }`
          );
        } catch (error) {
          const errorIdLogger = generateID(other.errorIdLength);
          errorMessage(`Error ID: ${errorIdLogger}`);
          errorMessage(error);
        }
        if (
          other.devMode &&
          !(await interaction.guild.members.fetch(interaction.user)).roles.cache.has(discord.roles.dev)
        ) {
          throw new Error('No Perms');
        }
        try {
          if (!discord.channels.noCommandTracking.includes(interaction.channel.id)) {
            const userData = JSON.parse(readFileSync('data/userData.json'));
            let data;
            if (userData[interaction.user.id]) {
              data = {
                commandsRun: userData[interaction.user.id].commandsRun + 1,
                firstCommand: userData[interaction.user.id].firstCommand,
                lastUpdated: toFixed(new Date().getTime() / 1000, 0),
                commands: userData[interaction.user.id].commands,
              };
              const commands = data.commands;
              if (commands[interaction.commandName]) {
                commands[interaction.commandName]++;
              } else {
                commands[interaction.commandName] = 1;
              }
              await writeAt('data/userData.json', interaction.user.id, data);
            } else {
              data = {
                commandsRun: 1,
                firstCommand: toFixed(new Date().getTime() / 1000, 0),
                lastUpdated: toFixed(new Date().getTime() / 1000, 0),
                commands: { [interaction.commandName]: 1 },
              };
              await writeAt('data/userData.json', interaction.user.id, data);
            }
          }
        } catch (error) {
          const errorIdLogUserData = generateID(other.errorIdLength);
          errorMessage(`Error ID: ${errorIdLogUserData}`);
          errorMessage(error);
        }
        try {
          const blacklistTest = await blacklistCheck(interaction.user.id);
          if (blacklistTest) {
            const blacklisted = new EmbedBuilder()
              .setColor(other.colors.red.hex as ColorResolvable)
              .setDescription('You are blacklisted')
              .setFooter({
                text: `by @kathund | ${discord.supportInvite} for support`,
                iconURL: other.logo,
              });
            return await interaction.reply({ embeds: [blacklisted], ephemeral: true });
          }
          await command.execute(interaction);
        } catch (error) {
          const errorIdBlacklistCheck = generateID(other.errorIdLength);
          errorMessage(`Error ID: ${errorIdBlacklistCheck}`);
          errorMessage(error);
          const errorEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('An error occurred')
            .setDescription(
              `Use </report-bug:${
                discord.commands['report-bug']
              }> to report it\nError id - ${errorIdBlacklistCheck}\nError Info - \`${cleanMessage(error)}\``
            )
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });
          const supportDisc = new ButtonBuilder()
            .setLabel('Support Discord')
            .setURL(discord.supportInvite)
            .setStyle(ButtonStyle.Link);
          const row = new ActionRowBuilder().addComponents(supportDisc);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], rows: [row], ephemeral: true });
          } else {
            await interaction.reply({ embeds: [errorEmbed], rows: [row], ephemeral: true });
          }
        }
      } catch (error) {
        const errorIdCheck = generateID(other.errorIdLength);
        errorMessage(`Error ID: ${errorIdCheck}`);
        errorMessage(error);
        const errorEmbed = new EmbedBuilder()
          .setColor(other.colors.red.hex as ColorResolvable)
          .setTitle('An error occurred')
          .setDescription(
            `Use </report-bug:${
              discord.commands['report-bug']
            }> to report it\nError id - ${errorIdCheck}\nError Info - \`${cleanMessage(error)}\``
          )
          .setFooter({
            text: `by @kathund | ${discord.supportInvite} for support`,
            iconURL: other.logo,
          });
        const supportDisc = new ButtonBuilder()
          .setLabel('Support Discord')
          .setURL(discord.supportInvite)
          .setStyle(ButtonStyle.Link);
        const row = new ActionRowBuilder().addComponents(supportDisc);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], rows: [row], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], rows: [row], ephemeral: true });
        }
      }
    } else if (interaction.isButton()) {
      try {
        eventMessage(
          `Interaction Event trigged by ${
            interaction.user.discriminator == '0'
              ? interaction.user.username
              : `${interaction.user.username}#${interaction.user.discriminator}`
          } (${interaction.user.id}) clicked button ${interaction.customId} in ${interaction.guild.id} in ${
            interaction.channel.id
          } at ${interaction.message.id}`
        );
        const tickets = JSON.parse(readFileSync('data/tickets.json'));
        if (interaction.customId === 'TICKET_OPEN') {
          await interaction.deferReply({ ephemeral: true });
          const reason = 'No reason provided';
          const ticketId = generateID(other.ticketIdLength).toLowerCase();
          const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}-${ticketId}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id: interaction.user.id,
                allow: [
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.AddReactions,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
              {
                id: interaction.guild.roles.everyone.id,
                deny: [
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.AddReactions,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
              {
                id: discord.roles.dev,
                allow: [
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.AddReactions,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
              {
                id: discord.roles.admin,
                allow: [
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.AddReactions,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
              {
                id: discord.roles.mod,
                allow: [
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.AddReactions,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
            ],
          });

          await writeAt('data/tickets.json', ticketId, {
            user: interaction.user.id,
            username: interaction.user.username,
            channel: channel.id,
            channelName: `ticket-${interaction.user.username}-${ticketId}`,
            ticketId: ticketId,
            reason: reason,
            createdAt: toFixed(new Date().getTime() / 1000, 0),
          });
          await writeAt('data/tickets.json', 'total', tickets.total + 1);

          const ticketEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Opened')
            .setDescription(`Ticket opened by ${interaction.user.tag} (${interaction.user.id})`)
            .addFields({
              name: 'Reason',
              value: reason,
              inline: false,
            })
            .setTimestamp()
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });

          const ticketCloseButton = new ButtonBuilder()
            .setLabel('Close Ticket')
            .setCustomId(`TICKET_CLOSE_${channel.id}_${interaction.user.id}_${ticketId}`)
            .setStyle(ButtonStyle.Danger);

          const ticketCloseAndBan = new ButtonBuilder()
            .setLabel('Close Ticket and Ban User')
            .setCustomId(`TICKET_BAN_CLOSE_${channel.id}_${interaction.user.id}_${ticketId}`)
            .setStyle(ButtonStyle.Danger);

          const row = new ActionRowBuilder().addComponents(ticketCloseButton, ticketCloseAndBan);

          await channel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [row] });
          await channel.send({ content: `<@&${discord.roles.mod}>` });
          const ticketChannelMessages = await channel.messages.fetch();
          ticketChannelMessages.forEach(async (message) => {
            if (!message.author.id === interaction.client.user.id) return;
            if (message.content === `<@&${discord.roles.mod}>`) return await message.delete();
            if (message.content === `<@${interaction.user.id}>`) return await message.pin();
          });
          const ticketOpenedEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Opened')
            .setDescription(`Your ticket has been opened in <#${channel.id}>`);
          await interaction.followUp({ embeds: [ticketOpenedEmbed], ephemeral: true });
        } else if (interaction.customId.includes('TICKET_CLOSE_')) {
          const channelId = interaction.customId.split('_')[2];
          let hasPerms = false;
          if (interaction.channel.id !== channelId) return;
          if (interaction.member.roles.cache.has(discord.roles.dev)) hasPerms = true;
          if (interaction.member.roles.cache.has(discord.roles.admin)) hasPerms = true;
          if (interaction.member.roles.cache.has(discord.roles.mod)) hasPerms = true;
          if (!hasPerms) throw new Error('You do not have permission to use this command');
          const reason = 'No reason provided';
          if (!interaction.channel.name.includes('ticket-')) throw new Error('This is not a ticket channel');
          const ticketId = interaction.customId.split('_')[4];
          const ticket = tickets[ticketId];
          const messages = await interaction.channel.messages.fetch();
          let changed = [];
          messages.forEach((message) => {
            changed.push({
              timestamp: message.createdTimestamp,
              content: message.content,
              user: message.author.id,
              username: message.author.username,
            });
          });
          changed = changed.sort((a, b) => a.timestamp - b.timestamp);
          const data = {
            ticket: {
              id: ticketId,
              opened: {
                timestamp: ticket.createdAt,
                reason: ticket.reason,
                by: {
                  id: ticket.user,
                  username: ticket.username,
                },
              },
              closed: {
                by: {
                  id: interaction.user.id,
                  username: interaction.user.username,
                },
                reason: reason,
                timestamp: toFixed(new Date().getTime() / 1000, 0),
              },
            },
            messages: changed,
          };
          const res = await fetch(`${api.transcripts.url}/transcript/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', key: api.transcripts.key },
            body: JSON.stringify(data),
          });
          if (res.status != 201) throw new Error('Error creating transcript');
          if (!ticket) throw new Error('Ticket not found? Please report this!');
          await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
          const userCloseEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Closed')
            .setDescription(`Your ticket has been closed by <@${interaction.user.id}>`)
            .addFields(
              {
                name: 'Reason',
                value: reason,
                inline: false,
              },
              {
                name: 'Ticket ID',
                value: ticketId,
                inline: true,
              },
              {
                name: 'Ticket Opened',
                value: `<t:${ticket.createdAt}:R>`,
                inline: true,
              },
              {
                name: 'Ticket Opened By',
                value: `${ticketId}`,
                inline: true,
              },
              {
                name: 'Transcript',
                value: `https://tickets.kath.lol/${ticketId}.txt`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });

          const closedLoggingEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Closed')
            .setDescription(`Ticket closed by <@${interaction.user.id}>`)
            .addFields(
              {
                name: 'Reason',
                value: reason,
                inline: false,
              },
              {
                name: 'Ticket ID',
                value: ticketId,
                inline: true,
              },
              {
                name: 'Ticket Opened',
                value: `<t:${ticket.createdAt}:R>`,
                inline: true,
              },
              {
                name: 'Ticket Opened By',
                value: `<@${ticket.user}>`,
                inline: true,
              },
              {
                name: 'Transcript',
                value: `https://tickets.kath.lol/${ticketId}.txt`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });
          const loggingChannel = interaction.guild.channels.cache.get(discord.channels.ticketLogging);
          if (!loggingChannel) throw new Error('Ticket logging channel not found? Please report this!');
          await loggingChannel.send({ embeds: [closedLoggingEmbed] });
          await interaction.client.users.send(ticket.user, { embeds: [userCloseEmbed] });
          await interaction.channel.delete();
        } else if (interaction.customId.includes('TICKET_BAN_CLOSE_')) {
          const channelId = interaction.customId.split('_')[3];
          const userId = interaction.customId.split('_')[4];
          let hasPerms = false;
          if (interaction.channel.id !== channelId) return;
          if (interaction.member.roles.cache.has(discord.roles.dev)) hasPerms = true;
          if (interaction.member.roles.cache.has(discord.roles.admin)) hasPerms = true;
          if (interaction.member.roles.cache.has(discord.roles.mod)) hasPerms = true;
          if (!hasPerms) throw new Error('You do not have permission to use this command');
          const reason = 'No reason provided';
          if (!interaction.channel.name.includes('ticket-')) throw new Error('This is not a ticket channel');
          const ticketBlacklist = tickets.blacklist;
          if (isTicketBlacklisted(userId, ticketBlacklist)) {
            throw new Error('User already blacklisted from tickets');
          }
          ticketBlacklist.push({
            user: userId,
            reason: reason,
            blacklistedAt: toFixed(new Date().getTime() / 1000, 0),
          });
          await writeAt('data/tickets.json', 'blacklist', ticketBlacklist);

          const userBanEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Blacklisted')
            .setDescription(`Successfully blacklisted <@${userId}> from tickets`)
            .setTimestamp()
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });

          await interaction.reply({ embeds: [userBanEmbed], ephemeral: true });

          const ticketId = interaction.customId.split('_')[5];
          const ticket = tickets[ticketId];
          if (!ticket) throw new Error('Ticket not found? Please report this!');
          const messages = await interaction.channel.messages.fetch();
          let changed = [];
          messages.forEach((message) => {
            changed.push({
              timestamp: message.createdTimestamp,
              content: message.content,
              user: message.author.id,
              username: message.author.username,
            });
          });
          changed = changed.sort((a, b) => a.timestamp - b.timestamp);
          const data = {
            ticket: {
              id: ticketId,
              opened: {
                timestamp: ticket.createdAt,
                reason: ticket.reason,
                by: {
                  id: ticket.user,
                  username: ticket.username,
                },
              },
              closed: {
                by: {
                  id: interaction.user.id,
                  username: interaction.user.username,
                },
                reason: reason,
                timestamp: toFixed(new Date().getTime() / 1000, 0),
              },
            },
            messages: changed,
          };
          const res = await fetch(`${api.transcripts.url}/transcript/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', key: api.transcripts.key },
            body: JSON.stringify(data),
          });
          if (res.status != 201) throw new Error('Error creating transcript');
          await interaction.followUp({ content: 'Closing ticket...', ephemeral: true });
          const userCloseEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Closed')
            .setDescription(`Your ticket has been closed by <@${interaction.user.id}>`)
            .addFields(
              {
                name: 'Reason',
                value: reason,
                inline: false,
              },
              {
                name: 'Ticket ID',
                value: ticketId,
                inline: true,
              },
              {
                name: 'Ticket Opened',
                value: `<t:${ticket.createdAt}:R>`,
                inline: true,
              },
              {
                name: 'Ticket Opened By',
                value: `${ticketId}`,
                inline: true,
              },
              {
                name: 'Transcript',
                value: `https://tickets.kath.lol/${ticketId}.txt`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });

          const closedLoggingEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('Ticket Closed')
            .setDescription(`Ticket closed by <@${interaction.user.id}>`)
            .addFields(
              {
                name: 'Reason',
                value: reason,
                inline: false,
              },
              {
                name: 'Ticket ID',
                value: ticketId,
                inline: true,
              },
              {
                name: 'Ticket Opened',
                value: `<t:${ticket.createdAt}:R>`,
                inline: true,
              },
              {
                name: 'Ticket Opened By',
                value: `<@${ticket.user}>`,
                inline: true,
              },
              {
                name: 'Transcript',
                value: `https://tickets.kath.lol/${ticketId}.txt`,
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });
          const loggingChannel = interaction.guild.channels.cache.get(discord.channels.ticketLogging);
          if (!loggingChannel) throw new Error('Ticket logging channel not found? Please report this!');
          await loggingChannel.send({ embeds: [closedLoggingEmbed] });
          await interaction.client.users.send(ticket.user, { embeds: [userCloseEmbed] });
          await interaction.channel.delete();
        }
      } catch (error) {
        if (String(error).includes('NO_ERROR_ID_')) {
          errorMessage(error);
          const errorEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('An error occurred')
            .setDescription(`Error Info - \`${cleanMessage(error)}\``)
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });
          const supportDisc = new ButtonBuilder()
            .setLabel('Support Discord')
            .setURL(discord.supportInvite)
            .setStyle(ButtonStyle.Link);
          const row = new ActionRowBuilder().addComponents(supportDisc);
          await interaction.reply({ embeds: [errorEmbed], rows: [row] });
          if (interaction.replied || interaction.deferred) {
            return await interaction.followUp({ embeds: [errorEmbed], rows: [row], ephemeral: true });
          } else {
            return await interaction.reply({ embeds: [errorEmbed], rows: [row], ephemeral: true });
          }
        } else {
          const errorIdButtons = generateID(other.errorIdLength);
          errorMessage(`Error Id - ${errorIdButtons}`);
          errorMessage(error);
          const errorEmbed = new EmbedBuilder()
            .setColor(other.colors.red.hex as ColorResolvable)
            .setTitle('An error occurred')
            .setDescription(
              `Use </report-bug:${
                discord.commands['report-bug']
              }> to report it\nError id - ${errorIdButtons}\nError Info - \`${cleanMessage(error)}\``
            )
            .setFooter({
              text: `by @kathund | ${discord.supportInvite} for support`,
              iconURL: other.logo,
            });
          const supportDisc = new ButtonBuilder()
            .setLabel('Support Discord')
            .setURL(discord.supportInvite)
            .setStyle(ButtonStyle.Link);
          const row = new ActionRowBuilder().addComponents(supportDisc);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], rows: [row], ephemeral: true });
          } else {
            await interaction.reply({ embeds: [errorEmbed], rows: [row], ephemeral: true });
          }
        }
      }
    }
  } catch (error) {
    const errorId = generateID(other.errorIdLength);
    errorMessage(`Error Id - ${errorId}`);
    errorMessage(error);
  }
};
