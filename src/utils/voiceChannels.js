const { EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

/* ========================================================================== */
/*                              UTILITY FUNCTIONS                             */
/* ========================================================================== */
async function IsVoiceChannel(channel) {
	const { GuildSchema } = process.mongo;

	let guildId = channel.guild.id
	let guildData = await GuildSchema.findOne({ Guild: guildId })
	if (!guildData) return false

	return channel.parentId == guildData.VoiceCategory
}

function GetOwner(channel) {
	let perms = channel.permissionOverwrites.cache
	let owner = perms.find(p => p.allow.has(PermissionFlagsBits.ManageChannels))
	owner = owner?.id

	return owner
}

async function GetTextChannel(channel, guildData) {
	if (!guildData) {
		const { GuildSchema } = process.mongo;

		guildData = await GuildSchema.findOne({ Guild: channel.guild.id })
		if (!guildData) return false
	}

	let channels = await channel.guild.channels.fetch()
	return channels.find(chn => chn.parentId == guildData.VoiceTextCategory && chn.topic == channel.id) || false
}

async function GetVoiceChannel(channel) {
	return await channel.guild.channels.fetch(channel.topic)
}

async function UpdateMenu(channel, voiceChannel) {
	channel = channel || voiceChannel && await GetTextChannel(voiceChannel)
	voiceChannel = voiceChannel || channel && await GetVoiceChannel(channel)

	const guild = channel.guild
	let messages = await channel.messages.fetch()
	let menu = messages.filter(msg => msg.content == "")
	menu = menu.first()

	const { GuildSchema } = process.mongo;
	let guildData = await GuildSchema.findOne({ Guild: guild.id })
	if (!guildData) return false

	const embed = menu.embeds[0];
	const creatorId = embed.description.match(/Создатель: <@([0-9]+)*?>+/i)
	const ownerId = GetOwner(voiceChannel)

	const voicePerms = voiceChannel.permissionOverwrites.cache
	const everyoneId = guildData.Settings.RegRole || guild.id
	const everyonePerms = voicePerms.find(p => p.id == everyoneId)

	const isHidden = everyonePerms?.deny.has(PermissionFlagsBits.ViewChannel)
	const isClosed = everyonePerms?.deny.has(PermissionFlagsBits.Connect)

	let channelStatus = 'Канал сейчас открыт. Приходят все!'
	if (isHidden)
		channelStatus = 'Канал сейчас скрыт. Только вы и администрация.'
	else if (isClosed)
		channelStatus = 'Канал сейчас закрыт. Пусть все увидят, как вы тут закрылись.'

	// BUTTONS
	let buttons = []
	let buttons2 = []
	if (isClosed || isHidden) {
		buttons.push(new ButtonBuilder()
			.setCustomId('voice:unlock')
			.setLabel('Открыть')
			.setEmoji('🔓')
			.setStyle(ButtonStyle.Success))
	}

	if (!isClosed) {
		buttons.push(new ButtonBuilder()
			.setCustomId('voice:lock')
			.setLabel('Закрыть')
			.setEmoji('🔒')
			.setStyle(ButtonStyle.Danger))
	}

	if (!isHidden) {
		buttons.push(new ButtonBuilder()
			.setCustomId('voice:hide')
			.setLabel('Спрятать')
			.setEmoji('🚷')
			.setStyle(ButtonStyle.Secondary))
	}

	buttons.push(new ButtonBuilder()
		.setCustomId('voice:owner')
		.setLabel('Сменить владельца')
		.setEmoji('👑')
		.setStyle(ButtonStyle.Primary))

	// row 2
	buttons2.push(new ButtonBuilder()
		.setCustomId('voice:name')
		.setLabel('Изменить название')
		.setEmoji('📝')
		.setStyle(ButtonStyle.Primary))

	buttons2.push(new ButtonBuilder()
		.setCustomId('voice:limit')
		.setLabel('Изменить лимит пользователей')
		.setEmoji('🤸🏻')
		.setStyle(ButtonStyle.Primary))

	buttons2.push(new ButtonBuilder()
		.setCustomId('voice:nsfw')
		.setLabel('Переключить возрастное ограничение')
		.setEmoji('🔞')
		.setStyle(ButtonStyle.Primary))

	buttons2.push(new ButtonBuilder()
		.setCustomId('voice:br')
		.setLabel('Изменить битрейт')
		.setEmoji('🎚️')
		.setStyle(ButtonStyle.Primary))

	buttons2.push(new ButtonBuilder()
		.setCustomId('voice:region')
		.setLabel('Изменить регион канала')
		.setEmoji('🗺️')
		.setStyle(ButtonStyle.Primary))
	// BUTTONS END

	const regions = channel.guild.client.voiceRegions;

	const newEmbed = EmbedBuilder.from(embed)
		.setDescription(`Комната: <#${channel.topic}>
			Владелец: <@${ownerId}>
			Создатель: <@${creatorId[1]}>

			Регион: ${regions?.get(voiceChannel.rtcRegion)?.name || voiceChannel.rtcRegion || "Автоматический выбор"}
			Битрейт: ${voiceChannel.bitrate / 1000} kbps
			Возрастное ограничение: ${voiceChannel.nsfw ? "✅" : "❎"}

			${channelStatus}`)

	const row = new ActionRowBuilder()
		.addComponents(buttons)
	const row2 = new ActionRowBuilder()
		.addComponents(buttons2)

	menu.edit({ embeds: [newEmbed], components: [row, row2] })
}

async function RandomOwner(channel, textChannel, channelMembers, guildData) {
	if (!guildData) {
		const { GuildSchema } = process.mongo;

		guildData = await GuildSchema.findOne({ Guild: channel.guild.id })
		if (!guildData) return false
	}

	try {
		textChannel = textChannel || await GetTextChannel(channel, guildData)
		channelMembers = channelMembers || channel.members

		const oldOwnerId = GetOwner(channel);
		const oldOwner = await channel.guild.members.fetch(oldOwnerId);
		const newOwner = channelMembers.random();

		await channel.permissionOverwrites.edit(newOwner.id, {
			ManageChannels: true,
			MoveMembers: true,
			ViewChannel: true,
			Connect: true
		})
		await channel.permissionOverwrites.edit(oldOwner.id, {
			ManageChannels: null,
			MoveMembers: null,
			Connect: null,
		})
		await textChannel.permissionOverwrites.edit(newOwner.id, {
			ViewChannel: true,
		})
		await textChannel.permissionOverwrites.edit(oldOwner.id, {
			ViewChannel: null,
		})

		UpdateMenu(textChannel, channel)
		channel.send({ content: `<@${oldOwner.id}> покинул канал. Канал передан <@${newOwner.id}>`, allowedMentions: { users: [newOwner.id] } });
		VoiceLog(channel, 'Отключение от канала', `Участник: <@${oldOwner.id}>\nНовый владелец: <@${newOwner.id}>`, { iconURL: `https://i.imgur.com/Tr9tWIZ.png`, color: `#980000` })
	} catch (e) {
		console.error(e)
		return false
	}

	return true
}

let logChannel
async function VoiceLog(channel, title, desc = '', options = {}) {
	if (!channel)
		return;

	try {
		const { GuildSchema } = process.mongo;
		const guildData = await GuildSchema.findOne({ Guild: channel.guild.id })
		if (!guildData || !guildData.Settings.VoiceLogs) return false

		if (!logChannel || logChannel?.id != guildData.Settings.VoiceLogs) {
			logChannel = await channel.guild.channels.fetch(guildData.Settings.VoiceLogs)
		}

		const embed = new EmbedBuilder()
			.setColor(options.color ? options.color : null)
			.setAuthor({ name: title, iconURL: options.iconURL ? options.iconURL : null })
			.setDescription(`Канал: [${channel.name}](${channel.url})\n${desc}`)
			.setFooter({ text: channel.id, iconURL: `https://i.imgur.com/tVIEu1F.png` })
			.setTimestamp(Date.now())

		await logChannel.send({ embeds: [embed], allowedMentions: { repliedUser: false } })
	} catch (e) {
		console.error(e)
	}
}

const emojiRegex = /([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g;
const stateEmojis = {
	'hide': "👻",
	"lock": "🔒",
	"unlock": "🔓",
}
async function VoiceEmojiName(channel) {
	try {
		const oldName = channel.name
		let name = channel.name

		let emojiPos = name.search(emojiRegex)
		let emoji = emojiPos > -1 && name.match(emojiRegex)[0]
		if (emojiPos == 0 && Object.values(stateEmojis).includes(emoji)) {
			name = name.substring(emoji.length).trim()
		}

		const voicePerms = channel.permissionOverwrites.cache
		const everyonePerms = voicePerms.find(p => p.id == channel.guild.id)

		const isHidden = everyonePerms?.deny.has(PermissionFlagsBits.ViewChannel)
		const isClosed = everyonePerms?.deny.has(PermissionFlagsBits.Connect)

		let nameEmoji = stateEmojis.unlock
		if (isHidden)
			nameEmoji = stateEmojis.hide
		else if (isClosed)
			nameEmoji = stateEmojis.lock

		name = `${nameEmoji} ${name}`
		if (oldName != name) {
			await channel.edit({ name })
		}
	} catch (e) {
		console.error(e)
		return false
	}

	return true
}

/* ========================================================================== */
/*                                  COMMANDS                                  */
/* ========================================================================== */
const stateText = {
	"hide": "скрыт",
	"lock": "закрыт",
	"unlock": "открыт",
}
async function SetVoiceState(interaction, voiceChannel, newState) {
	let guild = voiceChannel.guild
	let newPerms = {
		ViewChannel: true,
		Connect: true,
	}

	switch (newState) {
		case "lock":
			newPerms.Connect = false
			break;
		case "hide":
			newPerms.ViewChannel = false
			break;
	}

	const { GuildSchema } = process.mongo;
	let guildData = await GuildSchema.findOne({ Guild: guild.id })
	if (!guildData) return false
	const everyoneId = guildData.Settings.RegRole || guild.id

	await voiceChannel.permissionOverwrites.edit(everyoneId, newPerms)
	await UpdateMenu(false, voiceChannel)
	await interaction.reply({ content: `Канал теперь ${stateText[newState]}.`, flags: MessageFlags.Ephemeral })
	// await VoiceEmojiName(voiceChannel)
	VoiceLog(voiceChannel, 'Изменение канала', `Видимость канала: ${stateText[newState]}`, { iconURL: `https://i.imgur.com/KXzPGrU.png`, color: `#47C8FF` })
	return true
}

async function SetVoiceOwner(interaction, voiceChannel, newOwner) {
	if (!newOwner.voice || newOwner.voice.channelId != voiceChannel.id) {
		await interaction.reply({ content: `Пользователь должен находиться в этом личном канале.`, flags: MessageFlags.Ephemeral })
		return true
	}

	let voiceOwner = GetOwner(voiceChannel)
	if (voiceOwner == newOwner.id) {
		await interaction.reply({ content: `Этот пользователь уже владелеет этим каналов.`, flags: MessageFlags.Ephemeral })
		return true
	}

	await voiceChannel.permissionOverwrites.edit(newOwner.id, {
		ManageChannels: true,
		MoveMembers: true,
		ViewChannel: true,
		Connect: true
	})
	await voiceChannel.permissionOverwrites.edit(voiceOwner, {
		ManageChannels: null,
		MoveMembers: null,
		Connect: null,
	})

	try {
		await interaction.reply({ content: `Канал передан <@${newOwner.id}>.`, flags: MessageFlags.Ephemeral })
	} catch (e) { }

	let textChannel = await GetTextChannel(voiceChannel)
	await textChannel.permissionOverwrites.edit(newOwner.id, {
		ViewChannel: true,
	})
	await textChannel.permissionOverwrites.edit(voiceOwner, {
		ViewChannel: null,
	})


	await UpdateMenu(textChannel, voiceChannel)
	await voiceChannel.send({ content: `Канал передан <@${newOwner.id}>.`, allowedMentions: { users: [newOwner.id] } })
	VoiceLog(voiceChannel, 'Передача канала', `Новый владелец: <@${newOwner.id}>`, { iconURL: `https://i.imgur.com/lw7Bghn.png`, color: `#FF6B00` })
	return true
}

async function VoiceInvite(interaction, voiceChannel, member, ping) {
	if (member.user.bot) {
		await interaction.reply({ content: `Нельзя приглашать ботов 💀`, flags: MessageFlags.Ephemeral })
		return true
	}

	if (member.voice?.channelId == voiceChannel.id) {
		await interaction.reply({ content: `Пользователь <@${member.id}> уже здесь.`, flags: MessageFlags.Ephemeral })
		return true
	}

	let memberPerms = voiceChannel.permissionOverwrites.cache.get(member.id)
	if (memberPerms?.allow.has(PermissionFlagsBits.ViewChannel)) {
		await voiceChannel.send({ content: `Пользователь <@${member.id}> уже имеет доступ к каналу.`, allowedMentions: { users: [member.id] } })
		return false
	}

	voiceChannel.permissionOverwrites.create(member.id, {
		Connect: true,
		ViewChannel: true,
	})

	if (ping)
		member.user.send(`<@${interaction.user.id}> приглашает Вас в канал <#${voiceChannel.id}>!`).catch(e => console.error(e))

	await interaction.reply({ content: `<@${member.id}> был приглашен в канал.`, allowedMentions: { users: [member.id] }, flags: MessageFlags.Ephemeral })
	VoiceLog(voiceChannel, 'Приглашение в канал', `Приглашен: <@${member.id}>`, { iconURL: `https://i.imgur.com/d9o4bPm.png`, color: `#8CDC26` })
	return true
}

async function VoiceBan(interaction, voiceChannel, member) {
	let voiceOwner = GetOwner(voiceChannel)
	if (voiceOwner == member.id) {
		await interaction.reply({ content: `Вы не можете забанить владельца.`, flags: MessageFlags.Ephemeral })
		return true
	}

	let memberPerms = voiceChannel.permissionOverwrites.cache.get(member.id)
	let isBanned = memberPerms?.deny.has(PermissionFlagsBits.ViewChannel) || false
	voiceChannel.permissionOverwrites.create(member.id, {
		Connect: null,
		ViewChannel: isBanned,
	})

	if (!isBanned && voiceChannel.members.has(member.id))
		member.voice.disconnect("Забанен в этом канале.")

	await interaction.reply({ content: `<@${member.id}> был ${isBanned ? "разбанен" : "забанен"}.`, allowedMentions: { users: [member.id] }, flags: MessageFlags.Ephemeral })
	VoiceLog(voiceChannel, 'Бан в канале', `<@${member.id}> был ${isBanned ? "разбанен" : "забанен"}`, { iconURL: isBanned ? `https://i.imgur.com/H0JFOah.png` : `https://i.imgur.com/L5EWJTe.png`, color: isBanned ? `#00D12E` : `#D10000` })
	return true
}

async function VoiceKick(interaction, voiceChannel, member) {
	if (!member.voice || member.voice.channelId != voiceChannel.id) {
		await interaction.reply({ content: `Пользователь должен находиться в этом личном канале.`, flags: MessageFlags.Ephemeral })
		return true
	}

	let voiceOwner = GetOwner(voiceChannel)
	if (voiceOwner == member.id) {
		await interaction.reply({ content: `Вы не можете выгнать владельца.`, flags: MessageFlags.Ephemeral })
		return true
	}

	member.voice.disconnect("Кикнут из канала.")

	await interaction.reply({ content: `Кикаем <@${member.id}>.`, allowedMentions: { users: [member.id] }, flags: MessageFlags.Ephemeral })
	VoiceLog(voiceChannel, 'Кик в канале', `Участник: <@${member.id}>`, { iconURL: `https://i.imgur.com/p7Fx3sA.png`, color: `#D10000` })
	return true
}

async function SetVoiceName(interaction, voiceChannel, name) {
	name = name && name.trim()
	if (!name || name == "") {
		await interaction.reply({ content: `Ошибка! Пустое название канала.`, flags: MessageFlags.Ephemeral })
		return false
	}

	try {
		await voiceChannel.edit({ name })
	} catch (e) {
		await interaction.reply({ content: `Не удалось изменить название. Попробуйте позже!`, flags: MessageFlags.Ephemeral })
		return false
	}
	await interaction.reply({ content: `Новое название канала: \`${name}\``, flags: MessageFlags.Ephemeral })
	return true
}

async function SetVoiceNsfw(interaction, voiceChannel, nsfw) {
	await voiceChannel.edit({ nsfw })
	await UpdateMenu(false, voiceChannel)
	await interaction.reply({ content: `Возрастное ограничение ${nsfw ? "включено" : "выключено"}`, flags: MessageFlags.Ephemeral })
	return true
}

async function SetVoiceBitrate(interaction, voiceChannel, bitrate) {
	bitrate = Math.max(Math.min(bitrate, 96), 8)

	await voiceChannel.edit({ bitrate: bitrate * 1000 })
	await UpdateMenu(false, voiceChannel)
	await interaction.reply({ content: `Битрейт теперь: ${bitrate} kbps`, flags: MessageFlags.Ephemeral })
	return true
}

async function SetVoiceUserLimit(interaction, voiceChannel, userLimit) {
	userLimit = Math.max(Math.min(userLimit, 99), 0)
	await voiceChannel.edit({ userLimit })

	let content = userLimit > 0 ? `Установлен лимит пользователей: ${userLimit}` : `Лимит пользователей убран`
	await interaction.reply({ content, flags: MessageFlags.Ephemeral })

	return true
}

async function SetVoiceRegion(interaction, voiceChannel, rtcRegion)
{
	let client = interaction.client
	let regions = client.voiceRegions
	if (!regions || regions.size == 0)
	{
		await interaction.reply({
			content: 'Список регионов недоступен. Пожалуйста, попробуйте позже.',
			flags: MessageFlags.Ephemeral,
		});
		return false
	}

	if (!regions.has(rtcRegion) && rtcRegion != "auto")
	{
		await interaction.reply({
			content: 'Указан неверный регион.',
			flags: MessageFlags.Ephemeral,
		});
		return false
	}

	rtcRegion = rtcRegion == "auto" ? null : rtcRegion
	await voiceChannel.edit({rtcRegion})
	await UpdateMenu(false, voiceChannel)
	await interaction.reply({ content: `Регион теперь: ${regions.get(rtcRegion)?.name || "Автоматический выбор"}`, flags: MessageFlags.Ephemeral })
	return true
}

/* ========================================================================== */
/*                                   EXPORT                                   */
/* ========================================================================== */
module.exports = {
	IsVoiceChannel,
	GetOwner,
	GetTextChannel,
	GetVoiceChannel,
	RandomOwner,
	UpdateMenu,
	VoiceLog,
	VoiceEmojiName,

	Commands: {
		SetVoiceState,
		SetVoiceOwner,
		VoiceInvite,
		VoiceBan,
		VoiceKick,
		SetVoiceName,
		SetVoiceNsfw,
		SetVoiceBitrate,
		SetVoiceUserLimit,
		SetVoiceRegion,
	},
}