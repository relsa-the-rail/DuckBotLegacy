const { Events } = require('discord.js')
const { VoiceChannels } = require('../utils')

module.exports = {
	name: Events.ChannelUpdate,
	execute: async (oldChannel, newChannel) => {
		const { GuildSchema } = process.mongo;
		let guildId = oldChannel.guild.id
		let guildData = await GuildSchema.findOne({ Guild: guildId })
		if (!guildData) return
		if (!await VoiceChannels.IsVoiceChannel(newChannel)) return

		if (oldChannel.name != newChannel.name) {
			VoiceChannels.VoiceLog(newChannel, "Смена названия", `Старое название: ${oldChannel.name}`, { iconURL: `https://i.imgur.com/NeCLhK3.png`, color: `#FFB800` })
			// VoiceChannels.VoiceEmojiName(newChannel)
		}
	}
}