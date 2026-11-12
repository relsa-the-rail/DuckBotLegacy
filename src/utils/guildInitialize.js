const { ChannelType, PermissionFlagsBits, Guild } = require("discord.js");
const Settings = require('./settings');
const VoiceChannels = require('./voiceChannels');

/**
 * Создать личные комнаты, если их нет
 * @param {Guild} guild
 */
async function VoiceChannel(guild) {
	const { GuildSchema } = process.mongo

	try {
		let voiceCat = null
		let voiceTexCat = null
		let voiceCreateChn = null
		let voiceCreateCloseChn = null

		const guildData = await GuildSchema.findOne({ Guild: guild.id })
		if (guildData) {
			try {
				if (!guildData.VoiceCategory)
					throw "No Data";

				voiceCat = await guild.channels.fetch(guildData.VoiceCategory)
			} catch (e) {
				voiceCat = null
			}

			try {
				if (!guildData.VoiceTextCategory)
					throw "No Data";

				voiceTexCat = await guild.channels.fetch(guildData.VoiceTextCategory)
			} catch (e) {
				voiceTexCat = null
			}

			try {
				if (!guildData.VoiceCreate)
					throw "No Data";

				voiceCreateChn = await guild.channels.fetch(guildData.VoiceCreate)

				if (!voiceCat || voiceCreateChn.parentId != voiceCat.id) {
					voiceCreateChn?.delete()
					voiceCreateChn = null
				}
			} catch (e) {
				voiceCreateChn = null
			}

			try {
				if (!guildData.VoiceCreateClosed)
					throw "No Data";

				voiceCreateCloseChn = await guild.channels.fetch(guildData.VoiceCreateClosed)

				if (!voiceCat || voiceCreateCloseChn.parentId != voiceCat.id) {
					voiceCreateCloseChn?.delete()
					voiceCreateCloseChn = null
				}
			} catch (e) {
				voiceCreateCloseChn = null
			}
		}

		let deny = [{
			id: guild.id,
			allow: [PermissionFlagsBits.ViewChannel],
		}]
		if (guildData.RegRole) {
			deny.push({
				id: guildData.RegRole,
				allow: [PermissionFlagsBits.ViewChannel],
			})
		}

		voiceCat = voiceCat || await guild.channels.create({
			name: 'DuckBot: Личные комнаты', type: ChannelType.GuildCategory, position: 2, deny
		})
		voiceTexCat = voiceTexCat || await guild.channels.create({
			name: 'DuckBot: Меню личных комнат', type: ChannelType.GuildCategory, position: 1, deny
		})
		voiceCreateChn = voiceCreateChn || await guild.channels.create({ name: 'Создать комнату', parent: voiceCat, type: ChannelType.GuildVoice, position: 1 })
		voiceCreateCloseChn = voiceCreateCloseChn || await guild.channels.create({ name: 'Создать скрытую комнату', parent: voiceCat, type: ChannelType.GuildVoice, position: 2 })

		guildData.VoiceCategory = voiceCat.id
		guildData.VoiceTextCategory = voiceTexCat.id
		guildData.VoiceCreate = voiceCreateChn.id
		guildData.VoiceCreateClosed = voiceCreateCloseChn.id

		await guildData.save()

		// let owner = await guild.fetchOwner()
		// owner.send(`Приветствую, я DuckBot. Я создал для вас категорию с личными каналами. Она сейчас скрыта от посторонних глаз, дабы вы могли настроить всё.`)
	} catch (e) {
		console.error(e)
		return false
	}

	return true
}

/**
 * Удалить личные комнаты, если в них нет пользователей
 * @param {Guild} guild 
 */
async function VoiceChannelsFix(guild) {
	const { GuildSchema } = process.mongo;

	try {
		let voiceCat = null
		let voiceTexCat = null

		const guildData = await GuildSchema.findOne({ Guild: guild.id })
		if (!guildData)
			throw "No guild data!"

		voiceCat = await guild.channels.fetch(guildData.VoiceCategory)
		voiceTexCat = await guild.channels.fetch(guildData.VoiceTextCategory)

		voiceCat.children.cache.each(channel => {
			if (channel.id == guildData.VoiceCreate || channel.id == guildData.VoiceCreateClosed)
				return;

			if (channel.members.size == 0) {
				VoiceChannels.VoiceLog(channel, 'Удаление канала', '', { iconURL: `https://i.imgur.com/Nk7j0Si.png`, color: `#DE0000` })
				channel.delete('Участников не осталось')
				return
			}

			let ownerId = VoiceChannels.GetOwner(channel)
			if (channel.members.has(ownerId))
				return;

			VoiceChannels.RandomOwner(channel)
		})

		voiceTexCat.children.cache.each(channel => {
			if (!voiceCat.children.cache.has(channel.topic))
				channel.delete('Привязанного канала нет')
		})
	} catch (e) {
		console.error(e)
		return false
	}

	return true
}

/**
 * Создать в бд запись для настроек и отправить их владельцу, если записи не было
 * @param {Guild} guild
 */
async function _settings(guild) {
	const { GuildSchema } = process.mongo;

	try {
		const guildData = await GuildSchema.findOne({ Guild: guild.id })
		if (guildData.Settings)
			return true

		guildData.Settings = { Version: 1 }
		await guildData.save()

		let owner = await guild.fetchOwner()
		owner.send({
			content: "Добрый день! Спасибо, что используете DuckBot на своём сервере! Чтобы его настроить, воспльзуйтесь командой /settings"
		})
	} catch (e) {
		console.error(e)
	}

	return true
}

module.exports = {
	VoiceChannel,
	Settings: _settings,

	/**
	 * @param {Guild} guild
	 */
	All: async (guild) => {
		const { GuildSchema } = process.mongo

		try {
			const guildData = await GuildSchema.findOne({ Guild: guild.id })
			if (!guildData) {
				await GuildSchema.create({
					Guild: guild.id,
					DataVersion: 2,
					Warnings: Array[null],
					Bans: Array[null]
				})
			}
			if (guildData.DataVersion < 2) {
				guildData.DataVersion = 2
				guildData.Warnings = Array[null]
				guildData.Bans = Array[null]
				guildData.save()
			}

			if (await VoiceChannel(guild))
				VoiceChannelsFix(guild)

			await _settings(guild)
			return true
		} catch (e) {
			console.error(e)
			return false
		}
	},
}