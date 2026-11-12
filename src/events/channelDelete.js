const { Events } = require('discord.js')
const { Parties } = require('../utils')
const { VoiceChannels } = require('../utils')

async function checkPersonalVoice(channel, guildData) {
    if (channel?.parentId != guildData.VoiceCategory) return
    if (channel.id == guildData.VoiceCreate || channel.id == guildData.VoiceCreateClosed) return

    const textChannel = await VoiceChannels.GetTextChannel(channel, guildData)
    if (!textChannel) return
    try {
        await textChannel.delete()
    } catch (e) {
        return console.error(e)
    }
    VoiceChannels.VoiceLog(channel, 'Удаление канала (через контекстное меню)', '', { iconURL: `https://i.imgur.com/Nk7j0Si.png`, color: `#DE0000` })
}

module.exports = {
    name: Events.ChannelDelete,
    execute: async (channel) => {
        const { GuildSchema } = process.mongo;
        const guildData = await GuildSchema.findOne({ Guild: channel.guild.id })
        await Parties.checkOne({ "Settings.PartiesChannel": channel.id })
        checkPersonalVoice(channel, guildData)
    }
}