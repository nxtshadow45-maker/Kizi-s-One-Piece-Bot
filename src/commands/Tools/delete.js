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
const MAX_CHANNELS_PER_DELETE = 5;

export default {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete selected server channels or Forum posts.')
    .addSubcommand(sub => sub
      .setName('channels')
      .setDescription('Choose up to five channels or Forum posts to delete.')),

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
      .setPlaceholder('Choose up to 5 channels, categories, or Forum posts')
      .setMinValues(1)
      .setMaxValues(MAX_CHANNELS_PER_DELETE)
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES);

    return interaction.reply({
      content: 'Select up to **5** channels, categories, or Forum posts. Review the list before confirming. Deleting a category leaves its child channels in the server without a category.',
      components: [new ActionRowBuilder().addComponents(selector)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};

export { MAX_CHANNELS_PER_DELETE };
