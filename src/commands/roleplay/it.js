const { SlashCommandBuilder, InteractionContextType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('it')
		.setDescription('РП: Действие от третьего лица')
		.setContexts([InteractionContextType.Guild])
		.addStringOption(option =>
			option
				.setName('text')
				.setDescription('Действие')
				.setRequired(true)),
	async execute(interaction) {
		let text = interaction.options.getString('text')
		await interaction.reply(`Где-то ${text}`)
	},
};