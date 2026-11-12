async function setRoles(member, roles, role, index) {
    try {
        if (member.roles.cache.size <= 2) {
            if (member.roles.cache.find(memberRole => role.id === memberRole.id)) {
                await member.roles.remove(role)
            }
            return
        }
        mostHighRole = member.roles.highest
        mostLowRole = member.roles.cache.filter(role => role.id !== member.guild.id && !roles.includes(role)).sort((a, b) => b.position - a.position).last()
        for (let i = index + 1; index < roles.length; index++) {
            const element = roles[i];
            if (!element) continue
            const between = member.roles.cache.filter(memberRole => (memberRole.position < element.position) && (role.position < memberRole.position) && !roles.includes(memberRole))
            if (between.size < 1) {
                return await member.roles.remove(role)
            }

        }

        if (mostHighRole.position > role.position && role.position > mostLowRole.position && (mostHighRole !== roles[index + 1] || mostLowRole !== roles[index - 1] || mostLowRole.id !== member.guild.id)) {
            await member.roles.add(role)
        } else {
            await member.roles.remove(role)
        }
    } catch (e) {
        if (e.code === 50013) return
        console.error(e)
    }

}

async function fetchRoles(guild) {
    const { GuildSchema } = process.mongo
    const guildData = await GuildSchema.findOne({ Guild: guild.id })
    if (!guildData.RoleDividers) return false
    const roles = []
    const deletedRoles = []
    for (let i = 0; i < guildData.RoleDividers.length; i++) {
        const element = guildData.RoleDividers[i];
        let role = await guild.roles.fetch(element)
        if (role)
            roles.push(role)
        else
            deletedRoles.push(element)
    }
    if (roles.length && roles.length !== guildData.RoleDividers.length)
        await GuildSchema.updateOne({ Guild: guild.id }, { '$pull': { RoleDividers: { '$in': deletedRoles } }, '$set': { 'Settings.RoleDividersCount': roles.length.toString() } })
    if (!roles.length)
        await GuildSchema.updateOne({ Guild: guild.id }, { '$unset': { RoleDividers: '', 'Settings.RoleDividersCount': '' } })
    return roles
}

module.exports = {
    massiveReassign: async (guild) => {
        const roles = await fetchRoles(guild)
        if (!roles.length) return
        const guildMembers = await guild.members.fetch()
        roles.sort((a, b) => a.position - b.position).forEach((role, index) => {
            guildMembers.each(member => {
                setRoles(member, roles, role, index)
            })
        })
    },
    guildMemberReassign: async (member) => {
        const roles = await fetchRoles(member.guild)
        if (!roles.length) return
        roles.sort((a, b) => a.position - b.position).forEach((role, index) => {
            setRoles(member, roles, role, index)
        })
    },
    fetchRoles
}