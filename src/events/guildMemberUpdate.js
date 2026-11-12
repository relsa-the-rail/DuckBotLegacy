const { Events } = require('discord.js')
const { RoleDividers } = require('../utils')

module.exports = {
    name: Events.GuildMemberUpdate,
    execute: async (oldMember, newMember) => {
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            RoleDividers.guildMemberReassign(newMember)
        }
    }
}