const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('try')
		.setDescription('РП: Попробовать выполнить действие')
		.addStringOption(option =>
			option
				.setName('text')
				.setDescription('Что пытаетесь сделать?')
				.setRequired(true)),
	async execute(interaction) {
		let text = interaction.options.getString('text')
		let success = Math.round(Math.random()) == 1

		await interaction.reply(`${text} (${success ? "Удачно" : "Неудачно"})`)
	},
};