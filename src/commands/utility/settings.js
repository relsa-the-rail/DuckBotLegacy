const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { Settings } = require('../../utils')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Настройки сервера.')
        .setDefaultMemberPermissions(0)
        .setContexts([InteractionContextType.Guild]),
    async execute(interaction) {
        const { GuildSchema } = process.mongo;

        const guildId = interaction.guild.id
        const guildData = await GuildSchema.findOne({ Guild: guildId })

        const { embed, rows } = Settings.Components(guildData.Settings, interaction.guild)

        await interaction.reply({ embeds: [embed], components: rows, flags: MessageFlags.Ephemeral })
    },
};