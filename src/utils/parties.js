const fs = require('fs');
const path = require('path');
const partyFAQString = fs.readFileSync(path.join(__dirname, '..', 'bigstrings', 'partyfaq.md')).toString('utf-8');

module.exports = {
    checkMany: async (client) => {
        const { GuildSchema } = process.mongo;
        const guildData = await GuildSchema.find({ PartiesThread: { $exists: true } })
        const promises = []

        guildData.forEach(async (guildData) => {
            promises.push(client.guilds.fetch(guildData.Guild).then(
                async (guild) => {
                    const threadChannel = guild.channels.cache.find(channel => channel.id === guildData.PartiesThread)
                    if (!threadChannel) {
                        return guild.id
                    } else {
                        try {
                            starterMessage = await threadChannel.fetchStarterMessage()
                            if (starterMessage.content !== partyFAQString) {
                                await starterMessage.edit(partyFAQString)
                            }
                        } catch (e) {
                            if (e.code === 10008) return guild.id
                            console.error(e)
                        }
                    }
                }
            ))
        })
        Promise.all(promises).then(async values => {
            const filteredValues = values.filter(values => values !== undefined)
            if (filteredValues.length > 0) {
                await GuildSchema.updateMany({ Guild: { $in: filteredValues } }, {
                    $unset: {
                        "PartiesThread": "",
                        "Settings.PartiesChannel": ""
                    }
                })
            }
        })
    },
    checkOne: async (filter) => {
        const { GuildSchema } = process.mongo;
        const guildData = await GuildSchema.findOne(filter)
        if (guildData) {
            await GuildSchema.updateOne(filter, {
                $unset: {
                    "PartiesThread": "",
                    "Settings.PartiesChannel": ""
                }
            })
        }
    },
    checkOneParty: async (threadId) => {
        const { PartySchema } = process.mongo
        const partyData = await PartySchema.findOne({ ThreadId: threadId })
        if (partyData) {
            await PartySchema.deleteOne({ ThreadId: threadId })
        }
    },
    checkAllParties: async (client) => {
        const { PartySchema } = process.mongo
        const partiesData = await PartySchema.find({ ThreadId: { $exists: true } })
        const promises = []
        partiesData.forEach((partyData) => {
            promises.push(client.channels.fetch(partyData.ThreadId).then(() => { return }).catch((e) => {
                if (e.code === 10003)
                    return partyData.ThreadId
            }))
        })
        Promise.all(promises).then(async (values) => {
            const filteredValues = values.filter(value => value !== undefined)
            if (filteredValues.length > 0) {
                await PartySchema.deleteMany({ ThreadId: { $in: filteredValues } })
            }
        }
        )
    },
    partyFAQString
}
