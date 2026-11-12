const { Events } = require('discord.js')
const { RoleDividers } = require('../utils')

module.exports = {
    name: Events.GuildRoleDelete,
    execute: async (role) => {
        RoleDividers.fetchRoles(role.guild)
    }
}