const dayjs = require('dayjs');
const { SlashCommandBuilder, PermissionsBitField, InteractionContextType, MessageFlags } = require('discord.js');
const { Moderation } = require('../../utils')

async function ban(interaction, member, options, ms = null, replyAndSend = 1) {
    const { GuildSchema } = process.mongo
    const unbanDate = ms ? dayjs().add(ms, 'ms') : null
    const unbanString = unbanDate ? `Разбан <t:${unbanDate.unix()}:R>` : ``
    if (replyAndSend)
        await member.send(`Вас забанили ${ms ? '' : 'навсегда '}на сервере "${interaction.guild.name}"\n\nКем: <@${interaction.user.id}>\nПричина: ${options.getString('reason')}\n${unbanString}`).catch(() => { })
    member.ban({ reason: options.getString('reason') })
    const banData = await GuildSchema.findOne({ Guild: interaction.guild.id, Bans: { $elemMatch: { user: member.id } } }, { "Bans.$": 1 })
    if (!banData) {
        if (ms)
            await GuildSchema.updateOne({ Guild: interaction.guild.id }, { $push: { Bans: { user: member.id, unban: unbanDate.toDate() } } })
    } else {
        if (ms)
            await GuildSchema.updateOne({ Guild: interaction.guild.id, Bans: { $elemMatch: { user: member.id } } }, { $set: { "Bans.$[]": { user: member.id, unban: unbanDate.toDate() } } })
        else {
            await GuildSchema.updateOne({ Guild: interaction.guild.id }, { $pull: { Bans: { user: member.id } } })
        }
    }
    if (replyAndSend)
        await interaction.reply({ content: `Пользователь <@${member.id}> был забанен${ms ? `. ${unbanString}.` : ' навсегда.'}[⠀](https://media1.tenor.com/m/inFUO9hugS8AAAAd/danganronpa-monokuma.gif)`, flags: MessageFlags.Ephemeral })
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Даёт бан указанному пользователю.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
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
                .setDescription("Продолжительность бана в формате [число][первая буква единицы времени] либо 'перм'")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setNameLocalization('ru', 'причина')
                .setDescription("Причина бана.")
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
        const logArgs = [interaction, 'Блокировка', `<@${interaction.user.id}> забанил <@${member.id}>`, options]
        if (!member) {
            return await interaction.reply({ content: `Не удалось получить информацию о пользователе. Возможно он уже забанен либо вышел.`, flags: MessageFlags.Ephemeral })
        }
        const ms = Moderation.parseMSeconds(options.getString('duration'))
        if (member.id === interaction.applicationId) {
            return await interaction.reply({ content: "https://tenor.com/view/nope-team-fortress2-tf2-engineer-engineer-tf2-gif-24716491", flags: MessageFlags.Ephemeral })
        }
        if (member.user.bot) {
            return await interaction.reply({ content: `Вы действительно хотите наказать бота?`, flags: MessageFlags.Ephemeral })
        }
        if (!member.moderatable) {
            return await interaction.reply({ content: `У бота нет прав на блокировку этого пользователя.`, flags: MessageFlags.Ephemeral })
        }
        if (!ms) {
                if (!['perm', 'перм'].includes(options.getString('duration')))
                return await interaction.reply({ content: "Ошибка в аргументе продолжительности.", flags: MessageFlags.Ephemeral })
            else {
                ban(interaction, member, options)
                return Moderation.log(...logArgs, { duration: 'навсегда', id: member.id, color: 'D10000', iconURL: 'https://i.imgur.com/07XrUj8.png' })
            }
        }
        if (ms < 60_000) {
            return await interaction.reply({ content: "Продолжительность бана не может быть менее минуты.", flags: MessageFlags.Ephemeral })
        }
        try {
            ban(interaction, member, options, ms)
            return Moderation.log(...logArgs, { duration: Moderation.humanize(ms), id: member.id, color: 'D10000', iconURL: 'https://i.imgur.com/07XrUj8.png' })
        } catch (e) {
            console.error(e)
        }
    },
    ban
};