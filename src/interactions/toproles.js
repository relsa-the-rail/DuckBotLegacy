const { EmbedBuilder, MessageFlags } = require("discord.js")

function embedTop(roles) {
    const embed = new EmbedBuilder({ title: `Топ-${roles.size || roles.length} ролей` })
    let i = 1
    let desc = ''
    roles.sort((a, b) => b.members.size - a.members.size).map(role => {
        desc += `${i++}. <@&${role.id}>: **${role.members.size} 👤**\n`
    })
    embed.setDescription(desc)
    return embed
}

const interId = "tr"
module.exports = {
    id: interId,
    execute: async (interaction) => {
        const customId = interaction.customId.split(":")
        await interaction.guild.members.fetch({ force: true })
        if (customId[1] === 'selected') {
            interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embedTop(interaction.roles)] })
        }
        if (customId[1] === 'all') {
            const { GuildSchema } = process.mongo
            const { RoleDividers } = await GuildSchema.findOne({ Guild: interaction.guild.id }, { RoleDividers: 1 })
            let roles = interaction.guild.roles.cache.sort((a, b) => b.members.size - a.members.size).filter(role => role.id !== interaction.guild.id)
            if (RoleDividers.length) roles = roles.filter(role => !RoleDividers.includes(role.id))
            interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embedTop(roles.first(10))] })
        }
    }
}