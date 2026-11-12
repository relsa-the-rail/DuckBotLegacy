const dayjs = require('dayjs');
const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, DiscordjsErrorCodes, InteractionContextType, MessageFlags } = require('discord.js');
const { Moderation } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unbanid')
        .setDescription('Разблокировка пользователя по ID.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
        .setContexts([InteractionContextType.Guild])
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID Пользователя, которого нужно разбанить.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("note")
                .setNameLocalization('ru', 'заметка')
                .setDescription("Примечание или описание ситуации.")
                .setRequired(false)
        ),
    async execute(interaction) {
        const interId = 'md'
        const options = interaction.options
        const userId = options.getString('id')
        const collectorFilter = (i) => { return ((i.user.id === interaction.user.id) && (i.customId.split(":")[0] === interId)) }
        const { GuildSchema } = process.mongo
        try {
            guildBan = await interaction.guild.bans.fetch({ user: userId, force: true })
        } catch (e) {
            if (e.code === 50035) {
                return await interaction.reply({ content: `Неправильный ID.`, flags: MessageFlags.Ephemeral })
            }
            if (e.code === 10026) {
                return await interaction.reply({ content: 'Пользователя не найдено в списке банов.', flags: MessageFlags.Ephemeral });
            }
            return console.error(e)
        }
        const banData = await GuildSchema.findOne({ Guild: interaction.guild.id, Bans: { $elemMatch: { user: userId } } }, { "Bans.$": 1 })
        const content = banData ? `Разбан этого пользователя произойдёт <t:${dayjs(banData.Bans[0].unban).unix()}:R>.\nВы уверены, что хотите разбанить досрочно?` : `Пользователь забанен навсегда.\nВы уверены в своем решении?`
        const question = await interaction.reply({
            content: content, components: [
                new ActionRowBuilder({
                    components: [
                        new ButtonBuilder({ custom_id: `${interId}:confirmBan`, label: `Да`, style: ButtonStyle.Danger }),
                        new ButtonBuilder({ custom_id: `${interId}:declineBan`, label: `Нет`, style: ButtonStyle.Secondary })
                    ]
                })
            ], flags: MessageFlags.Ephemeral, fetchReply: true
        })
        try {
            const response = await question.awaitMessageComponent({ filter: collectorFilter, time: 20_000 })
            const customId = response.customId.split(":")
            switch (customId[1]) {
                case "confirmBan":
                    await interaction.guild.bans.remove(userId)
                    if (!banData)
                        await GuildSchema.updateOne({ Guild: interaction.guild.id }, { $pull: { Bans: { user: userId } } })
                    await response.update({ content: `Пользователь разбанен.`, flags: MessageFlags.Ephemeral, components: [] })
                    Moderation.log(interaction, 'Разблокировка по ID', `<@${interaction.user.id}> разблокировал <@${userId}>.`, options, { id: userId, color: '00D12E', iconURL: 'https://i.imgur.com/UxWrpkr.png' })
                    return
                case "declineBan":
                    return await interaction.deleteReply()
            }
        } catch (e) {
            if (e.code === DiscordjsErrorCodes.InteractionCollectorError)
                await interaction.editReply({ content: 'Действие отменено.', components: [] });
            else
                console.error(e)
        }
    },
};