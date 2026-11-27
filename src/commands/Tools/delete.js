import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { isStaff } from '../../services/berryRpg.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const MAX_CHANNELS_PER_DELETE = 5;
const DELETABLE_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildCategory,
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

const CHANNEL_OPTION_NAMES = ['channel1', 'channel2', 'channel3', 'channel4', 'channel5'];

export default {
  data: new SlashCommandBuilder()
    .setName('kizidelete')
    .setDescription('Delete five selected server channels or Forum posts.')
    .addStringOption(option => option
      .setName('action')
      .setDescription('Choose the action to run')
      .addChoices({ name: 'Delete selected', value: 'delete' })
      .setRequired(true))
    .addChannelOption(option => option
      .setName('channel1')
      .setDescription('First channel or Forum post')
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('channel2')
      .setDescription('Second channel or Forum post')
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('channel3')
      .setDescription('Third channel or Forum post')
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('channel4')
      .setDescription('Fourth channel or Forum post')
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('channel5')
      .setDescription('Fifth channel or Forum post')
      .addChannelTypes(...DELETABLE_CHANNEL_TYPES)
      .setRequired(true)),

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

    if (interaction.options.getString('action') !== 'delete') {
      return interaction.reply({
        content: 'Choose the delete action.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedChannels = CHANNEL_OPTION_NAMES
      .map(name => interaction.options.getChannel(name))
      .filter(Boolean);
    const selectedIds = selectedChannels.map(channel => channel.id);

    if (
      selectedChannels.length !== MAX_CHANNELS_PER_DELETE
      || new Set(selectedIds).size !== MAX_CHANNELS_PER_DELETE
    ) {
      return interaction.reply({
        content: 'Choose five different channels or Forum posts before submitting.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const invalidChannels = selectedChannels.filter(channel =>
      channel.guildId !== interaction.guildId || !DELETABLE_CHANNEL_TYPES.has(channel.type)
    );
    if (invalidChannels.length) {
      return interaction.reply({
        content: 'Choose five channels or Forum posts from this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral })) {
      return;
    }

    const targets = [...selectedChannels].sort(
      (left, right) => Number(DELETABLE_CHANNEL_TYPES.has(right.type) && (
        right.isThread?.() || right.type === ChannelType.AnnouncementThread
        || right.type === ChannelType.PublicThread || right.type === ChannelType.PrivateThread
      )) - Number(DELETABLE_CHANNEL_TYPES.has(left.type) && (
        left.isThread?.() || left.type === ChannelType.AnnouncementThread
        || left.type === ChannelType.PublicThread || left.type === ChannelType.PrivateThread
      )),
    );
    const deleted = [];
    const failures = [];

    for (const channel of targets) {
      try {
        await channel.delete('Deleted by ' + interaction.user.tag + ' using /kizidelete');
        deleted.push(channel.name || channel.id);
      } catch {
        failures.push(channel.name || channel.id);
      }
    }

    const lines = ['Deleted ' + deleted.length + ' of ' + MAX_CHANNELS_PER_DELETE + ' selected items.'];
    if (deleted.length) {
      lines.push('Deleted: ' + deleted.map(name => '**' + name + '**').join(', '));
    }
    if (failures.length) {
      lines.push('Could not delete: ' + failures.map(name => '**' + name + '**').join(', ') +
        '. Check the bot’s Manage Channels and Manage Threads permissions.');
    }

    return interaction.editReply({
      content: lines.join('\n'),
      allowedMentions: { parse: [] },
    });
  },
};

export { MAX_CHANNELS_PER_DELETE };
