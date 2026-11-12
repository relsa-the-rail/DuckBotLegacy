const { ActionRowBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, DiscordjsErrorCodes, MentionableSelectMenuBuilder, WebhookClient, PermissionsBitField, Collection, MessageFlags } = require('discord.js');
const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const isBetween = require('dayjs/plugin/isBetween')
dayjs.extend(customParseFormat)
dayjs.extend(isBetween)
const fs = require('fs')
const path = require('path')
const adjectives = fs.readFileSync(path.join(__dirname, '..', 'bigstrings', 'adjectives.txt')).toString('utf-8').split('\n')
const nouns = fs.readFileSync(path.join(__dirname, '..', 'bigstrings', 'nouns.txt')).toString('utf-8').split('\n')

const interId = 'pt'

defaultValues = { activityName: "", participantsNumber: "", date: "", requirement: "", tip: "" }

/**
 * 
 * @param {{activityName: String, participantsNumber: String, date: String, requirement: String, tip: String}} values 
 * @returns 
 */
function formComponents(values = defaultValues) {
    return [
        new ActionRowBuilder({ components: [new TextInputBuilder({ value: values.activityName }).setCustomId('activityName').setLabel('Название активности').setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true)] }),
        new ActionRowBuilder({ components: [new TextInputBuilder({ value: values.date }).setCustomId('date').setLabel('Дата и время сбора [дд.мм.гггг чч:мм +/-ч]').setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(true)] }),
        new ActionRowBuilder({ components: [new TextInputBuilder({ value: values.participantsNumber }).setCustomId('participantsNumber').setLabel('Количество участников').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false)] }),
        new ActionRowBuilder({ components: [new TextInputBuilder({ value: values.requirement }).setCustomId('requirement').setLabel('Требования').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(false)] }),
        new ActionRowBuilder({ components: [new TextInputBuilder({ value: values.tip }).setCustomId('tip').setLabel('Примечание').setStyle(TextInputStyle.Paragraph).setMaxLength(200).setRequired(false)] })
    ]
}

/**
 * 
 * @param {Array.<String>} inputPartNumber 
 */
function validatePartNumber(inputPartNumber) {
    if (!inputPartNumber[0]) {
        return ""
    }
    if (inputPartNumber.length > 2) {
        throw "Ошибка в количестве участников. Попробуйте снова."
    }
    const numbers = []
    inputPartNumber.forEach((number) => {
        const numberInt = parseInt(number)
        if (isNaN(numberInt)) {
            throw "Ошибка в количестве участников. Попробуйте снова."
        }
        numbers.push(numberInt)
    })
    if (numbers.length === 1) {
        return `не более ${numbers[0]}`
    }
    if (numbers[0] < 1 && numbers[1] < 1) {
        throw `Минимум и максимум не могут быть одновременно 0. Попробуйте снова.`
    }
    if (numbers[0] === 0 || numbers[0] === numbers[1]) {
        return `не более ${numbers[1]}`
    }
    if (numbers[1] === 0) {
        return `не менее ${numbers[0]}`
    }
    if (numbers[0] > numbers[1]) {
        throw `Минимальное количество не может быть больше максимального. Попробуйте снова.`
    }
    return `${numbers[0]} - ${numbers[1]}`

}

/**
 * 
 * @param {Array.<String>} inputDate 
 * @returns {dayjs.Dayjs}
 */
function validateDate(inputDate) {
    if (inputDate.length < 2 || inputDate.length > 3) {
        throw "Что-то пропущено/лишнее в дате сбора. Попробуйте снова."
    }
    let offset = inputDate.length < 3 ? 0 : parseInt(inputDate[2])
    if (isNaN(offset)) {
        throw "Разница с МСК указана неправильно. Попробуйте снова."
    }
    if (offset > 9 || offset < -15) {
        throw "Вы указали несуществующий часовой пояс в дате сбора. Попробуйте снова."
    }
    date = dayjs(`${inputDate[0]} ${inputDate[1]}`, 'DD-MM-YYYY HH:mm')
    offset = -offset - 3
    date = date.add(offset, 'hours')
    if (!(date.isValid())) {
        throw "Дата сбора указана неверно."
    }
    if (date.isBefore(new Date())) {
        throw "Вы что, из прошлого? Укажите дату сбора правильно."
    }
    if (!(date.isBetween(dayjs(), dayjs().add(1, 'month')))) {
        throw "Вы не можете запланировать дату сбора за более чем месяц."
    }
    return date
}

/**
 * @param {object} values
 * @param {String} stringInvites
 * @param {String} userId
 * @param {dayjs} date 
 */
function messageParty(values, stringInvites, partNum, userId, date, roleId = null) {
    return `* \`👑 Организатор:\` <@${userId}>\n` +
        (roleId ? `* \`🚩 Роль участников:\` <@&${roleId}>\n` : ``) +
        (`* \`👥 Количество участников:\` ${partNum ? partNum : `без ограничений`}\n`) +
        `* \`🕐 Дата и время сбора:\` <t:${date.unix()}>\n` +
        (values.requirement.length > 0 ? `* \`⚠️ Требования:\` ${escapeFormat(values.requirement)}\n` : '') +
        (stringInvites.length > 0 ? `* \`✉️ Приглашаю:\` ${stringInvites}\n` : '') +
        (values.tip.length > 0 ? `* \`📝 Примечание:\` ${escapeFormat(values.tip)}` : '')
}

/**
 * @param {Collection|Array.<String>} users 
 * @param {Collection|Array.<String>} roles
 * @param {string} excludeId
 * @returns {mentions.<{stringInvites: string, userMentions: Array.<String>, roleMentions: Array.<String>}>} 
 */
function mentionsGen(users, roles, excludeId) {
    stringInvites = ""
    const userMentions = []
    const roleMentions = []

    if (typeof roles !== 'undefined') {
        roles.forEach((role) => {
            const roleId = typeof role === 'string' ? role : role.id
            stringInvites += `<@&${roleId}> `
            roleMentions.push(roleId)
        })
    }

    if (typeof users !== 'undefined') {
        users.forEach((user) => {
            const userId = typeof user === 'string' ? user : user.id
            if (userId === excludeId) return
            stringInvites += `<@${userId}> `
            userMentions.push(userId)
        })
    }
    return { stringInvites, userMentions, roleMentions }
}

const replacements = [
    [/\*/g, '\\*', 'asterisks'],
    [/_/g, '\\_', 'underscores'],
    [/`/g, '\\`', 'codeblocks'],
    [/\n/g, ` `, 'line-breaks']
]

function escapeFormat(string, skips = []) {
    return replacements.reduce(function (string, replacement) {
        var name = replacement[2]
        return name && skips.indexOf(name) !== -1
            ? string
            : string.replace(replacement[0], replacement[1])
    }, string)
}

const joinCd = new Map()

function randomRole() {
    randomName = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)].toLowerCase()}`
    let R = Math.floor((Math.random() * 127) + 127);
    let G = Math.floor((Math.random() * 127) + 127);
    let B = Math.floor((Math.random() * 127) + 127);
    let rgb = (R << 16) + (G << 8) + B;
    randomColor = rgb.toString(16)
    return { randomName, randomColor }
}

module.exports = {
    id: interId,
    execute: async (interaction) => {
        const customId = interaction.customId.split(":")
        const collectorFilter = (i) => { return ((i.user.id === interaction.user.id) && (i.customId.split(":")[0] === interId)) }
        const { GuildSchema, PartySchema } = process.mongo;
        const guildData = await GuildSchema.findOne({ Guild: interaction.guild.id })
        const webhookClient = new WebhookClient({ id: guildData.PartiesWebhookId, token: guildData.PartiesWebhookToken })
        const timerMSeconds = 120_000
        if (customId[0] !== interId) { return }
        const guildWebhook = await interaction.guild.fetchWebhooks().then(webhooks => webhooks.find((webhook) => webhook.id === guildData.PartiesWebhookId))
        if (typeof guildWebhook === 'undefined') {
            interaction.reply({ content: "Вебхук не найден. Переназначте форум в настройках.", flags: MessageFlags.Ephemeral })
            return
        }
        if (guildWebhook.channelId !== interaction.channel?.parent?.id) {
            guildWebhook.edit({ channel: interaction.channel.parent })
        }
        // Перед созданием party
        switch (customId[1]) {
            case "start":
                interaction.showModal(new ModalBuilder({
                    title: "Поиск компании", custom_id: `${interId}:modal`, components: formComponents()
                }))
                return
            case "modal":
                const values = {}
                interaction.fields.fields.map((field) => { Object.assign(values, { [field.customId]: field.value }) })
                const restartRow = new ActionRowBuilder({ components: [new ButtonBuilder({ custom_id: `${interId}:restart`, label: "Попробовать снова", style: ButtonStyle.Secondary })] })
                const inputDate = values.date.split(" ")
                let date
                let partNum
                try {
                    partNum = validatePartNumber(values.participantsNumber.split("-"))
                    date = validateDate(inputDate)
                } catch (e) {
                    if (typeof e != 'string') {
                        console.error(e)
                    }
                    const retryResponse = await interaction.reply({ content: typeof e === 'string' ? e : "Что-то пошло не так :/", flags: MessageFlags.Ephemeral, components: [restartRow], fetchReply: true })
                    await retryResponse.awaitMessageComponent({ filter: collectorFilter, time: 300_000 }).then((confirmation) => {
                        interaction.deleteReply()
                        const customId = confirmation.customId.split(":")
                        if (customId[1] === 'restart') {

                            confirmation.showModal(new ModalBuilder({
                                title: "Поиск компании", custom_id: `${interId}:modal`, components: formComponents(values)
                            }))
                        }
                        }).catch(async (e) => {
                        await interaction.editReply({ content: typeof e === 'string' ? e : "Что-то пошло не так :/", flags: MessageFlags.Ephemeral, components: [] })
                        if (typeof e != 'string') {
                            console.error(e)
                        }
                    })
                    return
                }
                const checkInfoResponse = await interaction.reply({
                    content: `Проверьте введённые данные. Диалог закроется <t:${dayjs().add(timerMSeconds, 'milliseconds').unix()}:R>.`, flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder({
                        fields: [{ name: "Название активности", value: values.activityName },
                        { name: "Количество участников", value: partNum < 1 ? "_без ограничений_" : partNum },
                        { name: "Дата и время сбора", value: `<t:${date.unix()}>` },
                        { name: "Требования", value: values.requirement.length < 1 ? '_не указано_' : escapeFormat(values.requirement) },
                        { name: "Примечание", value: values.tip.length < 1 ? '_не указано_' : escapeFormat(values.tip) }]
                    })], components: [
                        new ActionRowBuilder({
                            components: [new ButtonBuilder({ label: "Подтвердить", custom_id: `${interId}:accept`, style: ButtonStyle.Success }),
                            new ButtonBuilder({ label: "Попробовать снова", custom_id: `${interId}:retry`, style: ButtonStyle.Secondary }),
                            new ButtonBuilder({ label: "Отменить", custom_id: `${interId}:cancel`, style: ButtonStyle.Danger })]
                        })
                    ], fetchReply: true
                })
                await checkInfoResponse.awaitMessageComponent({ filter: collectorFilter, time: timerMSeconds }).then(async (confirmation) => {
                    const customId = confirmation.customId.split(":")
                    switch (customId[1]) {
                        case 'accept':
                            const tags = confirmation.channel.parent.availableTags
                            let tagConfirmation
                            let forumTag = null
                            if (tags.length > 0) {
                                const tagsSelect = new StringSelectMenuBuilder().setCustomId(`${interId}:tag`).setMaxValues(1)
                                tags.forEach((tag) => {
                                    const optionTag = new StringSelectMenuOptionBuilder().setLabel(tag.name).setValue(tag.id)
                                    if (tag.emoji) {
                                        optionTag.setEmoji(tag.emoji.id == null ? tag.emoji.name : tag.emoji.id)
                                    }
                                    tagsSelect.addOptions(optionTag)
                                })
                                const tagResponse = await confirmation.update({
                                    content: `Выберите соответствующий тег для вашей активности. Диалог закроется <t:${dayjs().add(timerMSeconds, 'milliseconds').unix()}:R>.`, components: [
                                        new ActionRowBuilder({ components: [tagsSelect] })
                                    ], embeds: [], fetchReply: true
                                })
                                tagConfirmation = await tagResponse.awaitMessageComponent({ filter: collectorFilter, time: timerMSeconds })
                                forumTag = tagConfirmation.values[0]

                            } else {
                                tagConfirmation = confirmation
                            }
                                const inviteResponse = await tagConfirmation.update({
                                content: `Выберите тех, кого вы хотели бы пригласить. Диалог закроется <t:${dayjs().add(timerMSeconds, 'milliseconds').unix()}:R>.`, components: [
                                    new ActionRowBuilder({
                                        components: [
                                            new MentionableSelectMenuBuilder({ custom_id: `${interId}:invite`, max_values: 10 })
                                        ]
                                    }),
                                    new ActionRowBuilder({
                                        components: [
                                            new ButtonBuilder({ custom_id: `${interId}:skipInvite`, label: "Пропустить", style: ButtonStyle.Secondary })
                                        ]
                                    })
                                ], embeds: []
                            })
                            const inviteConfirmation = await inviteResponse.awaitMessageComponent({ filter: collectorFilter, time: timerMSeconds })

                            const { stringInvites, userMentions, roleMentions } = mentionsGen(inviteConfirmation.users, inviteConfirmation.roles, inviteConfirmation.user.id)

                            const { randomName, randomColor } = randomRole()
                            const partyRole = await inviteConfirmation.guild.roles.create({ name: randomName, mentionable: true, color: randomColor })
                            inviteConfirmation.member.roles.add(partyRole)

                            await webhookClient.send({
                                threadName: values.activityName, username: inviteConfirmation.member.nickname ? `${inviteConfirmation.member.nickname} (${inviteConfirmation.user.username})` : `${inviteConfirmation.user.username}`,
                                avatarURL: inviteConfirmation.user.avatarURL(),
                                content: messageParty(values, stringInvites, partNum, inviteConfirmation.user.id, date, partyRole.id),
                                components: [
                                    new ActionRowBuilder({
                                        components: [
                                            new ButtonBuilder({ customId: `${interId}:joinOrLeave`, label: "Участвовать/выйти", style: ButtonStyle.Primary }),
                                            new ButtonBuilder({ custom_id: `${interId}:deleteParty`, label: "Удалить", style: ButtonStyle.Danger }),
                                            new ButtonBuilder({ custom_id: `${interId}:editParty`, label: "Редактировать", style: ButtonStyle.Secondary }),
                                            new ButtonBuilder({ custom_id: `${interId}:finishParty`, label: "Завершено", style: ButtonStyle.Success })
                                        ]
                                    })]
                            })
                                .then(async (thread) => {
                                    if (forumTag != null) {
                                        inviteConfirmation.channel.parent.threads.fetch(thread.id).then(channel => channel.setAppliedTags([forumTag]))
                                    }
                                    await inviteConfirmation.update({ content: `Канал создан: <#${thread.id}>\nИспользуйте роль <@&${partyRole.id}> чтобы пинговать участников.\nЖелаю хорошего совместного времяпровождения!`, components: [] })
                                    const { PartySchema } = process.mongo;
                                    await PartySchema.create({
                                        ThreadId: thread.id,
                                        CreatorId: inviteConfirmation.user.id,
                                        StartDate: date,
                                        InputValues: values,
                                        PartNum: partNum,
                                        UserMentionsId: userMentions,
                                        RoleMentionsId: roleMentions,
                                        PartyRole: partyRole.id
                                    })

                                }).catch(async (e) => {
                                    await inviteConfirmation.update({ content: 'Произошла ошибка во время создания канала.', components: [] })
                                    console.error(e)
                                })
                            break
                        case 'retry':
                            confirmation.showModal(new ModalBuilder({
                                title: "Поиск компании", custom_id: `${interId}:modal`, components: formComponents(values)
                            }))
                        case 'cancel':
                            interaction.deleteReply()
                            break
                    }

                    }).catch(async (e) => {
                    if (e.code === DiscordjsErrorCodes.InteractionCollectorError)
                        await interaction.editReply({ content: 'Вы настолько долго не отвечали, что бот пошел спать.', components: [], embeds: [] });
                    else
                        console.error(e)
                })
                return
        }
        // После создания party
        const partyData = await PartySchema.findOne({ ThreadId: interaction.channel.id })
        switch (customId[1]) {
            case "deleteParty":
                if (partyData && partyData.CreatorId === interaction.user.id || interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    const deleteResponse = await interaction.reply({
                        content: "Вы точно хотите удалить?", components: [
                            new ActionRowBuilder({
                                components: [
                                    new ButtonBuilder({ custom_id: `${interId}:deleteConfirm`, label: 'Удалить', style: ButtonStyle.Danger }),
                                    new ButtonBuilder({ custom_id: `${interId}:deleteCancel`, label: 'Отменить', style: ButtonStyle.Secondary })
                                ]
                            })
                        ], flags: MessageFlags.Ephemeral, fetchReply: true
                    })
                    try {
                        const deleteConfirmation = await deleteResponse.awaitMessageComponent({ filter: collectorFilter, time: 30_000 })
                        const customId = deleteConfirmation.customId.split(":")
                        if (customId[1] === 'deleteConfirm') {
                            deleteConfirmation.channel.delete()
                            if (partyData.PartyRole) deleteConfirmation.guild.roles.delete(partyData.PartyRole).catch(() => { })
                            await PartySchema.deleteOne({ ThreadId: interaction.channel.id })
                            return
                        }
                        if (customId[1] === 'deleteCancel') {
                            return interaction.deleteReply()
                        }
                    } catch (e) {
                        if (e.code === DiscordjsErrorCodes.InteractionCollectorError)
                            await interaction.deleteReply()
                        else
                            console.error(e)
                    }
                    } else {
                    interaction.reply({ content: "У вас нет прав для этого.", flags: MessageFlags.Ephemeral })
                }
                return
            case "finishParty":
                if (partyData && partyData.CreatorId === interaction.user.id || interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    const finishResponse = await interaction.reply({
                        content: "Вы уверены? Это действие необратимо.", components: [
                            new ActionRowBuilder({
                                components: [
                                    new ButtonBuilder({ custom_id: `${interId}:finishConfirm`, label: 'Да', style: ButtonStyle.Success }),
                                    new ButtonBuilder({ custom_id: `${interId}:finishCancel`, label: 'Нет', style: ButtonStyle.Secondary })
                                ]
                            })
                        ], flags: MessageFlags.Ephemeral, fetchReply: true
                    })
                    try {
                        const finishConfirmation = await finishResponse.awaitMessageComponent({ filter: collectorFilter, time: 30_000 })
                        const customId = finishConfirmation.customId.split(":")
                        if (customId[1] === 'finishConfirm') {
                            webhookClient.editMessage(interaction.message, {
                                content:
                                    messageParty(partyData.InputValues, mentionsGen(partyData.UserMentionsId, partyData.RoleMentionsId, finishConfirmation.user.id), partyData.PartNum, finishConfirmation.user.id, dayjs(partyData.StartDate)),
                                components: [], threadId: interaction.channel.id
                            })
                            interaction.deleteReply()
                            finishConfirmation.channel.setLocked(true)
                            if (partyData.PartyRole) finishConfirmation.guild.roles.delete(partyData.PartyRole).catch(() => { })
                            await PartySchema.deleteOne({ ThreadId: interaction.channel.id })
                        }
                        if (customId[1] === 'finishCancel') {
                            interaction.deleteReply()
                        }
                    } catch (e) {
                        if (e.code === DiscordjsErrorCodes.InteractionCollectorError)
                            await interaction.deleteReply()
                        else
                            console.error(e)
                    }
                } else {
                    interaction.reply({ content: "У вас нет прав для этого.", flags: MessageFlags.Ephemeral })
                }
                return
            case "editParty":
                if (partyData && partyData.CreatorId === interaction.user.id || interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    interaction.showModal(new ModalBuilder({
                        title: "Редактирование", custom_id: `${interId}:editModal`, components: formComponents(partyData.InputValues)
                    }))
                } else {
                    interaction.reply({ content: "У вас нет прав для этого.", flags: MessageFlags.Ephemeral })
                }
                return
            case "editModal":
                const values = {}
                interaction.fields.fields.map((field) => { Object.assign(values, { [field.customId]: field.value }) })
                let date
                let partNum
                try {
                    partNum = validatePartNumber(values.participantsNumber.split("-"))
                    date = validateDate(values.date.split(" "))
                } catch (e) {
                    if (typeof e !== 'string') {
                        console.error(e)
                    }
                    await interaction.reply({ content: typeof e === 'string' ? e : "Что-то пошло не так :/", flags: MessageFlags.Ephemeral })
                    return
                }
                const mentionsResponse = await interaction.reply({
                    content: `Выберите тех, кого приглашаете. Диалог закроется <t:${dayjs().add(timerMSeconds, 'milliseconds').unix()}:R>.`, components: [
                        new ActionRowBuilder({
                            components: [
                                new MentionableSelectMenuBuilder({ custom_id: `${interId}:editInvite`, max_values: 10 }).addDefaultUsers(partyData.UserMentionsId).addDefaultRoles(partyData.RoleMentionsId)
                            ]
                        }),
                        new ActionRowBuilder({
                            components: [
                                new ButtonBuilder({ custom_id: `${interId}:skipEditInvite`, label: "Пропустить", style: ButtonStyle.Secondary }),
                                new ButtonBuilder({ custom_id: `${interId}:wipeEditInvite`, label: "Стереть", style: ButtonStyle.Danger })
                            ]
                        })
                    ], fetchReply: true, flags: MessageFlags.Ephemeral
                })
                try {
                    const mentionsConfirmation = await mentionsResponse.awaitMessageComponent({ filter: collectorFilter, time: timerMSeconds })
                    const customId = mentionsConfirmation.customId.split(":")
                    let mentions
                    switch (customId[1]) {
                        case 'wipeEditInvite':
                            mentions = mentionsGen(undefined, undefined, mentionsConfirmation.user.id)
                            break
                        case 'editInvite':
                            mentions = mentionsGen(mentionsConfirmation.users, mentionsConfirmation.roles, mentionsConfirmation.user.id)
                            break
                        case 'skipEditInvite':
                            mentions = mentionsGen(partyData.UserMentionsId, partyData.RoleMentionsId, mentionsConfirmation.user.id)
                            break
                    }
                    partyData.InputValues = values
                    partyData.StartDate = date
                    partyData.PartNum = partNum
                    partyData.UserMentionsId = mentions.userMentions
                    partyData.RoleMentionsId = mentions.roleMentions
                    partyData.save()

                    const postScriptumEdit = mentionsConfirmation.user.id !== partyData.CreatorId ? `\n*Сообщение отредактировано пользователем* <@${mentionsConfirmation.user.id}>` : ``

                    webhookClient.editMessage(interaction.message, {
                        content: messageParty(values, mentions.stringInvites, partNum, partyData.CreatorId, date, partyData.PartyRole) + postScriptumEdit, threadId: interaction.channel.id,
                    }).then(() => {
                        mentionsConfirmation.channel.edit({ name: values.activityName })
                    })
                    mentionsConfirmation.update({ content: "Отредактировано.", components: [] })

                } catch (e) {
                    if (e.code === DiscordjsErrorCodes.InteractionCollectorError)
                        await interaction.editReply({ content: 'Вы настолько долго не отвечали, что бот пошел спать.', components: [], embeds: [] });
                    else
                        console.error(e)
                }
                return
            case "joinOrLeave":
                if (interaction.user.id === partyData.CreatorId) return interaction.reply({ content: "Вы не можете уйти, являясь организатором.", flags: MessageFlags.Ephemeral })
                if (joinCd.has(interaction.user.id + interaction.channel.id)) return interaction.reply({ content: "Попробуйте снова через какое-то время.", flags: MessageFlags.Ephemeral })
                joinCd.set(interaction.user.id + interaction.channel.id, setTimeout(() => { joinCd.delete(interaction.user.id + interaction.channel.id) }, 60_000))
                await interaction.deferReply({ flags: MessageFlags.Ephemeral })
                memberData = await interaction.guild.members.fetch({ user: interaction.member.id, force: true })
                try {
                    if (!memberData.roles.cache.hasAny(partyData.PartyRole)) {
                        await memberData.roles.add(partyData.PartyRole)
                        interaction.deleteReply()
                        interaction.channel.send(`<@${memberData.id}> присоединился к нашей компании!`)
                    } else {
                        await memberData.roles.remove(partyData.PartyRole)
                        interaction.deleteReply()
                        await interaction.channel.send(`<@${memberData.id}> ушел из нашей компании!`)
                        interaction.channel.members.remove(memberData.id)
                    }
                } catch (e) {
                    if (e.code === 10011) return interaction.editReply('Не удалось добавить/удалить роль. Возможно она удалена.')
                    interaction.editReply('Не удалось добавить/удалить роль.')
                    console.error(e)
                }
                return

        }
    }
}