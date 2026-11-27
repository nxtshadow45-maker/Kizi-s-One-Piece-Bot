import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { isStaff } from '../../services/berryRpg.js';

const DELETABLE_CHANNEL_TYPES = [
  ChannelType.GuildCategory,
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
];
const MAX_CHANNELS_PER_DELETE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName('kizidelete')
    .setDescription('Select up to ten channels or Forum posts to review and delete.'),

  async execute(interaction) {
    if (!isStaff(interaction)) {
      return interaction.reply({
        content: 'This command requires the Admin role.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: 'Use this command in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const selector = new ChannelSelectMenuBuilder()
      .setCustomId('delete_channels_select:' + interaction.user.id)
      .setPlaceholder('Choose up to 10 items')
      .setMinValues(1)
      .setMaxValues(MAX_CHANNELS_PER_DELETE)
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES);

    return interaction.reply({
      content: 'Use the picker below to choose up to **10** different channels, categories, or Forum posts. Review your selection, then confirm deletion. Deleting a category leaves its child channels in the server without a category.',
      components: [new ActionRowBuilder().addComponents(selector)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};

export { MAX_CHANNELS_PER_DELETE };
