const { SlashCommandBuilder, PermissionsBitField, InteractionContextType, MessageFlags } = require('discord.js');
const { Moderation } = require('../../utils');
const dayjs = require('dayjs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Даёт таймаут указанному пользователю.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.MuteMembers)
        .setContexts([InteractionContextType.Guild])
        .addUserOption(option =>
            option
                .setName("user")
                .setNameLocalization('ru', 'пользователь')
                .setDescription("Пользователь, которого нужно наказать.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duration")
                .setNameLocalization('ru', 'длительность')
                .setDescription("Продолжительность мута в формате [число][первая буква единицы времени].")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setNameLocalization('ru', 'причина')
                .setDescription("Причина мута.")
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
        const options = interaction.options
        const member = options.getMember('user')
        if (!member) {
            return await interaction.reply({ content: `Не удалось получить информацию о пользователе.`, flags: MessageFlags.Ephemeral })
        }
        ms = Moderation.parseMSeconds(options.getString('duration'))
        if (member.id === interaction.applicationId) {
            return await interaction.reply({ content: "https://media1.tenor.com/m/hghruQWRyi0AAAAC/jojo-i-refuse.gif", flags: MessageFlags.Ephemeral })
        }
        if (member.user.bot) {
            return await interaction.reply({ content: `Вы действительно хотите наказать бота?`, flags: MessageFlags.Ephemeral })
        }
        if (!ms) {
            return await interaction.reply({ content: "Ошибка в аргументе продолжительности.", flags: MessageFlags.Ephemeral })
        }
        // https://discord.com/developers/docs/resources/guild#modify-guild-member-json-params:~:text=(up%20to%2028%20days%20in%20the%20future)
        if (ms > 2419200000) {
            return await interaction.reply({ content: `Вы привысили лимит дискорда. Тайм-аут можно выдать не больше чем на 28 дней.`, flags: MessageFlags.Ephemeral })
        }
        if (!member.moderatable) {
            return await interaction.reply({ content: `У бота нет прав на тайм-аут этого пользователя.`, flags: MessageFlags.Ephemeral })
        }
        try {
            member.timeout(ms, options.getString('reason'))
            await interaction.reply({ content: `Пользователю <@${member.id}> был выдан тайм-аут на ${Moderation.humanize(ms)}.`, flags: MessageFlags.Ephemeral })
            await member.send(`Вам был выдан тайм-аут на сервере "${interaction.guild.name}"\n\nКем: <@${interaction.user.id}>\nПричина: ${options.getString('reason')}\nСнятие ограничений <t:${dayjs().add(ms, 'ms').unix()}:R>`).catch(() => { })
            Moderation.log(interaction, 'Выдача тайм-аута', `<@${interaction.user.id}> выдал тайм-аут пользователю <@${member.id}>`, options, { duration: Moderation.humanize(ms), id: member.id, color: 'E86F00', iconURL: 'https://i.imgur.com/axN5LZU.png' })
        } catch (e) {
            console.error(e)
        }
    },
};