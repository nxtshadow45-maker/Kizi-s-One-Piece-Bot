import { ChannelType, MessageFlags } from 'discord.js';
import { isStaff } from '../../services/berryRpg.js';
import { MAX_CHANNELS_PER_DELETE } from '../../commands/Tools/delete.js';

const THREAD_TYPES = new Set([
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
]);

const DELETABLE_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildCategory,
  ...THREAD_TYPES,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

function selectedChannelIdsFromMessage(message) {
  return [...new Set(
    [...(message?.content || '').matchAll(/<#(\d{17,20})>/g)].map(match => match[1]),
  )];
}

function ownerCanUse(interaction, ownerId) {
  return Boolean(
    interaction.guild
    && ownerId
    && interaction.user.id === ownerId
    && isStaff(interaction),
  );
}

async function cancelDelete(interaction, ownerId) {
  if (!ownerCanUse(interaction, ownerId)) {
    return interaction.reply({
      content: 'This delete selection is not available to you.',
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.update({
    content: 'Deletion cancelled. No channels or Forum posts were deleted.',
    components: [],
    allowedMentions: { parse: [] },
  });
}

async function confirmDelete(interaction, ownerId) {
  if (!ownerCanUse(interaction, ownerId)) {
    return interaction.reply({
      content: 'This delete selection is not available to you.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const selectedIds = selectedChannelIdsFromMessage(interaction.message);
  if (selectedIds.length < 1 || selectedIds.length > MAX_CHANNELS_PER_DELETE) {
    return interaction.update({
      content: 'The selection expired or was invalid. Run /kizidelete again.',
      components: [],
      allowedMentions: { parse: [] },
    });
  }

  // Remove the confirm button before starting any deletes, preventing double-clicks.
  await interaction.update({
    content: 'Deleting ' + selectedIds.length + ' selected channel(s) or Forum post(s)…',
    components: [],
    allowedMentions: { parse: [] },
  });

  const targets = [];
  const failures = [];

  for (const id of selectedIds) {
    try {
      const channel = interaction.guild.channels.resolve(id)
        || await interaction.client.channels.fetch(id);
      if (
        !channel
        || channel.guildId !== interaction.guildId
        || !DELETABLE_CHANNEL_TYPES.has(channel.type)
      ) {
        failures.push(id);
        continue;
      }
      targets.push(channel);
    } catch {
      failures.push(id);
    }
  }

  // Remove Forum posts and threads before their parent channels if both were selected.
  targets.sort((left, right) => Number(THREAD_TYPES.has(right.type)) - Number(THREAD_TYPES.has(left.type)));

  const deleted = [];
  for (const channel of targets) {
    try {
      await channel.delete('Deleted by ' + interaction.user.tag + ' using /kizidelete');
      deleted.push(channel.name || channel.id);
    } catch {
      failures.push(channel.name || channel.id);
    }
  }

  const lines = ['Deleted ' + deleted.length + ' of ' + selectedIds.length + ' selected item(s).'];
  if (deleted.length) {
    lines.push('Deleted: ' + deleted.map(name => '**' + name + '**').join(', '));
  }
  if (failures.length) {
    lines.push('Could not delete: ' + failures.map(name => '**' + name + '**').join(', ') +
      '. Check the bot’s Manage Channels and Manage Threads permissions.');
  }

  return interaction.editReply({
    content: lines.join('\n'),
    components: [],
    allowedMentions: { parse: [] },
  });
}

export default [
  {
    name: 'delete_channels_confirm',
    execute: confirmDelete,
  },
  {
    name: 'delete_channels_cancel',
    execute: cancelDelete,
  },
];
