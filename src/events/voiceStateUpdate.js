const { EmbedBuilder, Events, ChannelType, PermissionFlagsBits, SlashCommandSubcommandBuilder } = require('discord.js');
const { VoiceChannels } = require('../utils');
const VoiceCmd = require('../commands/utility/voice')

function VoiceCommandsList()
{
	let voiceCmdBuilder = VoiceCmd.data
	let voiceCmdId = process.disCmds.voice
	let text = `## Список команд:`
	voiceCmdBuilder.options.forEach(subcmd => {
		if (!subcmd instanceof SlashCommandSubcommandBuilder)
			return

		text += `\n1. </voice ${subcmd.name}:${voiceCmdId}> - ${subcmd.description}`
	})

	return text
}

async function CreateVoice(oldState, newState, guildData) {
	let member = newState.member
	let guild = newState.guild
	let newChannel = newState.channel

	if (newChannel != guildData.VoiceCreate && newChannel != guildData.VoiceCreateClosed)
		return false

	let denyPerms = [
		PermissionFlagsBits.CreateInstantInvite,
		PermissionFlagsBits.ManageChannels,
		PermissionFlagsBits.MuteMembers,
		PermissionFlagsBits.DeafenMembers,
		PermissionFlagsBits.MoveMembers,
		PermissionFlagsBits.ManageRoles,
		PermissionFlagsBits.ManageWebhooks
	]

	let isClosed = (newChannel == guildData.VoiceCreateClosed)

	try {
		let permissionOverwrites = [
			{
				id: guild.id,
				deny: denyPerms,
				allow: [PermissionFlagsBits.Connect]
			},
			{
				id: member.id,
				allow: [
					PermissionFlagsBits.ManageChannels,
					PermissionFlagsBits.MoveMembers,
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.Connect,
				],
			}
		]
		if (guildData.Settings.RegRole) {
			permissionOverwrites[0].deny.push(PermissionFlagsBits.ViewChannel)
			let id = permissionOverwrites.push({
				id: guildData.Settings.RegRole,
				allow: [
					PermissionFlagsBits.Connect
				]
			})
			if (isClosed)
				permissionOverwrites[id - 1].deny = [PermissionFlagsBits.ViewChannel]
			else
				permissionOverwrites[id - 1].allow.push(PermissionFlagsBits.ViewChannel)
		}
		else if (isClosed) {
			permissionOverwrites[0].deny.push(PermissionFlagsBits.ViewChannel)
		}
		let voiceChannel = await guild.channels.create({ name: `Комната ${member.displayName || "???"}`, parent: guildData.VoiceCategory, type: ChannelType.GuildVoice, permissionOverwrites })
		// await VoiceChannels.VoiceEmojiName(voiceChannel)

		let textChannel = await guild.channels.create({
			name: 'меню комнаты', parent: guildData.VoiceTextCategory, type: ChannelType.GuildText, permissionOverwrites: [
				{
					id: guild.id,
					deny: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
					]
				},
				{
					id: member.id,
					allow: [
						PermissionFlagsBits.ViewChannel,
					],
				}
			], topic: voiceChannel.id
		})

		const embed = new EmbedBuilder()
			.setColor(0x00FFFF)
			.setTitle('Управление личной комнатой')
			.setDescription(`Подготовка меню...\nСоздатель: <@${member.id}>`)
			.setTimestamp(Date.now())

		await textChannel.send({ embeds: [embed], allowedMentions: { repliedUser: false } })
		VoiceChannels.UpdateMenu(textChannel, voiceChannel)

		await textChannel.send( VoiceCommandsList() )

		member.voice.setChannel(voiceChannel)
		VoiceChannels.VoiceLog(voiceChannel, 'Создание комнаты', `Создатель: <@${member.id}>`, { iconURL: `https://i.imgur.com/Regjkt7.png`, color: `#0BDE00` })

		return true
	} catch (e) {
		console.error(e)
		return false
	}
}

async function JoinVoice(oldState, newState, guildData) {
	let member = newState.member
	let channel = newState.channel

	if (channel?.parentId != guildData.VoiceCategory) return false
	if (channel.id == guildData.VoiceCreate || channel.id == guildData.VoiceCreateClosed) return false
	if (member.id == VoiceChannels.GetOwner(channel)) return false

	channel.send({ content: `<@${member.id}> присоединился к каналу.`, allowedMentions: { repliedUser: false } })
	VoiceChannels.VoiceLog(channel, 'Присоединение к каналу', `Участник: <@${member.id}>`, { iconURL: `https://i.imgur.com/w1MM8oi.png`, color: `#009858` })
}

async function LeaveVoice(oldState, newState, guildData) {
	let member = newState.member
	let channel = oldState.channel

	if (channel?.parentId != guildData.VoiceCategory) return false
	if (channel.id == guildData.VoiceCreate || channel.id == guildData.VoiceCreateClosed) return false

	let textChannel = await VoiceChannels.GetTextChannel(channel, guildData)
	try {
		channel = await channel.fetch()
		let channelMembers = channel.members.filter(m => !m.user.bot)
		if (channelMembers.size <= 0) {
			VoiceChannels.VoiceLog(channel, 'Удаление канала', '', { iconURL: `https://i.imgur.com/Nk7j0Si.png`, color: `#DE0000` })

			textChannel.delete('Владелец покинул канал.');
			channel.delete('Владелец покинул канал.');
			return true
		}

		let voiceOwner = VoiceChannels.GetOwner(channel)
		let isVoiceOwner = member.id == voiceOwner

		if (isVoiceOwner) {
			await VoiceChannels.RandomOwner(channel, textChannel, channelMembers, guildData)
			return true
		}

		channel.send({ content: `<@${member.id}> покинул канал.`, allowedMentions: { repliedUser: false } });
		VoiceChannels.VoiceLog(channel, 'Отключение от канала', `Участник: <@${member.id}>`, { iconURL: `https://i.imgur.com/Tr9tWIZ.png`, color: `#980000` })

		return true
	} catch (e) {
		console.error(e)
		return false
	}
}

module.exports = {
	name: Events.VoiceStateUpdate,
	execute: async (oldState, newState) => {
		const { GuildSchema } = process.mongo;

		let guildId = newState.guild.id
		let guildData = await GuildSchema.findOne({ Guild: guildId })
		if (!guildData) return

		let newChannel = newState.channel
		let oldChannel = oldState.channel

		let member = newState.member
		if (!member || member.user.bot || newChannel?.id == oldChannel?.id)
			return

		CreateVoice(oldState, newState, guildData)
		JoinVoice(oldState, newState, guildData)
		LeaveVoice(oldState, newState, guildData)
	}
}
