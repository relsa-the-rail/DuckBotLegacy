const { SlashCommandBuilder, PermissionsBitField, InteractionContextType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getwarns')
        .setDescription('Узнать количество варнов у пользователя.')
        .setContexts([InteractionContextType.Guild])
        .addUserOption(option =>
            option
                .setName("user")
                .setNameLocalization('ru', 'пользователь')
                .setDescription("Пользователь, у которого вы хотите узнать количество варнов.")
                .setRequired(true)
        ),
    async execute(interaction) {
        const options = interaction.options
        const member = options.getMember('user')
        if (!member) {
            return await interaction.reply({ content: `Не удалось получить информацию о пользователе.`, flags: MessageFlags.Ephemeral })
        }
        const { GuildSchema } = process.mongo
        if (member.user.bot) {
            return await interaction.reply({ content: `У ботов не могут быть никаких варнов.`, flags: MessageFlags.Ephemeral })
        }
        try {
            warnData = await GuildSchema.findOne({ Guild: interaction.guild.id, Warnings: { $elemMatch: { user: member.id } } }, { "Warnings.$": 1 })
            if (!warnData) {
                await interaction.reply({ content: `У пользователя <@${member.id}> нету никаких варнов.`, flags: MessageFlags.Ephemeral })
            } else {
                await interaction.reply({ content: `У пользователя <@${member.id}> такое количество варнов: ${warnData.Warnings[0].counter}`, flags: MessageFlags.Ephemeral })
            }
        } catch (e) {
            console.error(e)
        }
    },
};