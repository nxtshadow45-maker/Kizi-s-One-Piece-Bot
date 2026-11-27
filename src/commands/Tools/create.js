import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { isStaff } from '../../services/berryRpg.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// These guards stop repeated or overlapping requests inside one bot process.
const activeForumCreationKeys = new Set();
const activeForumCreationInteractions = new Set();

async function replyEphemeral(interaction, content) {
  const options = {
    content,
    allowedMentions: { parse: [] },
  };

  if (interaction.deferred || interaction.replied) {
    return InteractionHelper.safeEditReply(interaction, options);
  }

  return InteractionHelper.safeReply(interaction, {
    ...options,
    flags: MessageFlags.Ephemeral,
  });
}

function getRequestedForums(channels, categoryId, requestedNames, initialChannelIds) {
  const requestedNameSet = new Set(requestedNames);
  const forumsByName = new Map();

  for (const channel of channels.values()) {
    if (
      channel?.type !== ChannelType.GuildForum
      || channel.parentId !== categoryId
      || initialChannelIds.has(channel.id)
    ) {
      continue;
    }

    const normalizedName = channel.name.toLowerCase();
    if (!requestedNameSet.has(normalizedName)) {
      continue;
    }

    const matches = forumsByName.get(normalizedName) || [];
    matches.push(channel);
    forumsByName.set(normalizedName, matches);
  }

  return forumsByName;
}

export default {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create server resources.')
    .addSubcommand(sub => sub.setName('forum').setDescription('Create up to five Forums in a server category.')
      .addChannelOption(option => option.setName('category')
        .setDescription('Category where the new Forums will be placed')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true))
      .addStringOption(option => option.setName('names')
        .setDescription('Enter 1–5 Forum names, separated by commas or new lines')
        .setMaxLength(2000)
        .setRequired(true))),

  async execute(interaction) {
    if (!isStaff(interaction)) {
      return interaction.reply({
        content: 'This command requires the Admin role.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const category = interaction.options.getChannel('category');
    if (!interaction.guild || !category || category.type !== ChannelType.GuildCategory || category.guildId !== interaction.guildId) {
      return interaction.reply({
        content: 'Choose a category from this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const rawNames = interaction.options.getString('names') || '';
    const names = rawNames.split(/[,\n]/).map(name => name.trim()).filter(Boolean);
    if (names.length < 1 || names.length > 5) {
      return interaction.reply({
        content: 'Enter between one and five Forum names, separated by commas or new lines.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const tooLong = names.find(name => name.length > 100);
    if (tooLong) {
      return interaction.reply({
        content: 'Each Forum name must be 100 characters or fewer.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const normalizedNames = names.map(name => name.toLowerCase());
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      return interaction.reply({
        content: 'Each Forum name must be different.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // A duplicate delivery of the same interaction must not run channel creation twice.
    if (activeForumCreationInteractions.has(interaction.id)) {
      return;
    }

    activeForumCreationInteractions.add(interaction.id);
    const lockKeys = normalizedNames.map(name => interaction.guildId + ':' + category.id + ':' + name);

    if (lockKeys.some(key => activeForumCreationKeys.has(key))) {
      try {
        await replyEphemeral(interaction, 'A Forum with one of those names is already being created in this category. Please wait a moment and try again.');
      } finally {
        activeForumCreationInteractions.delete(interaction.id);
      }
      return;
    }

    lockKeys.forEach(key => activeForumCreationKeys.add(key));

    try {
      // Acknowledge before network calls so Discord's short interaction deadline is met.
      if (!await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral })) {
        return;
      }

      const initialChannels = await interaction.guild.channels.fetch();
      const initialChannelIds = new Set(initialChannels.keys());
      const existingForums = [...initialChannels.values()].filter(channel =>
        channel?.type === ChannelType.GuildForum && channel.parentId === category.id
      );
      const existingNames = names.filter(name =>
        existingForums.some(forum => forum.name.toLowerCase() === name.toLowerCase())
      );

      if (existingNames.length) {
        const existingMentions = existingForums
          .filter(forum => existingNames.some(name => name.toLowerCase() === forum.name.toLowerCase()))
          .map(forum => '<#' + forum.id + '>');

        await replyEphemeral(
          interaction,
          'Forum(s) with these names already exist in **' + category.name + '**: ' +
            existingMentions.join(', ') + '. Nothing was created.',
        );
        return;
      }

      const failed = [];
      const createdChannelIds = new Set();
      for (const name of names) {
        try {
          const createdChannel = await interaction.guild.channels.create({
            name,
            type: ChannelType.GuildForum,
            parent: category.id,
            reason: 'Created by ' + interaction.user.tag + ' using /create forum (interaction ' + interaction.id + ')',
          });
          createdChannelIds.add(createdChannel.id);
        } catch {
          failed.push(name);
        }
      }

      // Different bot instances cannot share the in-memory lock. Reconcile the
      // requested names after creating. Delete only extra matching Forums that
      // this execution successfully created, never a pre-existing or unrelated channel.
      let finalChannels = await interaction.guild.channels.fetch();
      for (let pass = 0; pass < 3; pass += 1) {
        const forumsByName = getRequestedForums(finalChannels, category.id, normalizedNames, initialChannelIds);
        const duplicates = [...forumsByName.values()]
          .filter(forums => forums.length > 1)
          .flatMap(forums => forums
            .sort((left, right) =>
              left.createdTimestamp - right.createdTimestamp || left.id.localeCompare(right.id)
            )
            .slice(1)
            .filter(channel => createdChannelIds.has(channel.id)));

        if (!duplicates.length) {
          break;
        }

        for (const duplicate of duplicates) {
          await duplicate.delete('Removed duplicate Forum created by /create forum interaction ' + interaction.id)
            .catch(() => {});
        }

        finalChannels = await interaction.guild.channels.fetch();
      }

      const finalForumsByName = getRequestedForums(finalChannels, category.id, normalizedNames, initialChannelIds);
      const createdForums = names
        .map(name => finalForumsByName.get(name.toLowerCase())?.[0])
        .filter(Boolean);
      const createdNames = new Set(createdForums.map(forum => forum.name.toLowerCase()));
      const failedNames = names.filter(name => !createdNames.has(name.toLowerCase()));
      const remainingDuplicates = [...finalForumsByName.values()].filter(forums => forums.length > 1);

      const lines = [];
      if (createdForums.length) {
        lines.push('🏴‍☠️ Created ' + createdForums.length + ' Forum(s) in **' + category.name + '**:');
        lines.push(createdForums.map(forum => '• <#' + forum.id + '>').join('\n'));
      }
      if (failedNames.length) {
        lines.push('Could not confirm creation of: ' + failedNames.map(name => '**' + name + '**').join(', ') +
          '. Check the bot’s channel permissions and the category’s capacity.');
      }
      if (remainingDuplicates.length) {
        lines.push('Some duplicate Forums could not be removed. The bot needs permission to manage channels.');
      }

      await replyEphemeral(interaction, lines.join('\n') || 'No Forums were created.');
    } catch {
      await replyEphemeral(interaction, 'Forum creation could not be completed. Please check the bot’s channel permissions and try again.');
      return;
    } finally {
      lockKeys.forEach(key => activeForumCreationKeys.delete(key));
      activeForumCreationInteractions.delete(interaction.id);
    }
  },
};
