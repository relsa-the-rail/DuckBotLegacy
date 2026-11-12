const { Events } = require('discord.js')
const { Parties } = require('../utils')

module.exports = {
    name: Events.ThreadDelete,
    execute: async (thread) => {
        await Parties.checkOne({ "PartiesThread": thread.id })
        await Parties.checkOneParty(thread.id)
    }
}