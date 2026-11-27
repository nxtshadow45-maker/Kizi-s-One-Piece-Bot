import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { isStaff } from '../../services/berryRpg.js';
import { MAX_CHANNELS_PER_DELETE } from '../../commands/Tools/delete.js';

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

function buildComponents(ownerId, selectedIds) {
  const selector = new ChannelSelectMenuBuilder()
    .setCustomId('delete_channels_select:' + ownerId)
    .setPlaceholder('Update selected channels, categories, or Forum posts')
    .setMinValues(1)
    .setMaxValues(MAX_CHANNELS_PER_DELETE)
    .addChannelTypes(...DELETABLE_CHANNEL_TYPES);

  if (selectedIds.length) {
    selector.setDefaultChannels(...selectedIds);
  }

  return [
    new ActionRowBuilder().addComponents(selector),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('delete_channels_confirm:' + ownerId)
        .setLabel('Delete selected')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('delete_channels_cancel:' + ownerId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export default {
  name: 'delete_channels_select',

  async execute(interaction, _client, [ownerId]) {
    if (!interaction.guild || !ownerId || interaction.user.id !== ownerId || !isStaff(interaction)) {
      return interaction.reply({
        content: 'This delete selection is not available to you.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedIds = [...new Set(interaction.values || [])];
    if (selectedIds.length < 1 || selectedIds.length > MAX_CHANNELS_PER_DELETE) {
      return interaction.reply({
        content: 'Choose between one and sixteen channels, categories, or Forum posts.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const list = selectedIds.map(id => '• <#' + id + '>');

    return interaction.update({
      content: '**Review before deleting** (' + selectedIds.length + '/' + MAX_CHANNELS_PER_DELETE + ' selected)\n' +
        'This permanently deletes each selected channel or Forum post and its contents. Deleting a category leaves its child channels in the server without a category:\n' +
        list.join('\n'),
      components: buildComponents(ownerId, selectedIds),
      allowedMentions: { parse: [] },
    });
  },
};
