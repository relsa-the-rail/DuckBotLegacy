const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('РП: Кинуть кубик')
		.addIntegerOption(option =>
			option
				.setName('max')
				.setDescription('Сколько граней у кубика? (деф. 100)')),
	async execute(interaction) {
		let max = interaction.options.getInteger('max') || 100
		let result = Math.ceil(Math.random() * max)

		await interaction.reply(`Граней на кубике: ${max}.\nВыпало: ${result}`)
	},
};