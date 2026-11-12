const { Events, MessageFlags } = require('discord.js');

async function sendMessage(text, interaction) {
	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: text, flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
		}
	} catch (e) {
		console.error(e)
	}
}

const reservedIds = ['md']

module.exports = {
	name: Events.InteractionCreate,
	execute: async (interaction) => {

		let command
		if (interaction.isChatInputCommand()) {
			command = interaction.client.commands.get(interaction.commandName);
			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				await sendMessage(`Команда \`${interaction.commandName}\` не найдена!`, interaction)
				return;
			}
		}
		else if (interaction.isAutocomplete()) {
			command = interaction.client.commands.get(interaction.commandName);
			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
				return;
			}

			try {
				await command.autocomplete(interaction);
				return;
			} catch (error) {
				console.error(error);
				return;	
			}
		}
		else {
			let id = interaction.customId.split(":")
			if (reservedIds.includes(id[0])) { return }
			command = interaction.client.interactions.get(id[0]);
			if (!command) {
				console.error(`No interaction matching ${interaction.customId} was found.`);
				await sendMessage(`Действие \`${interaction.customId}\` не найдено!`, interaction)
				return;
			}
		}

		if (command.exclusive && command.exclusive != interaction.guildId) {
			return false;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			await sendMessage("Ошибка при выполнении этого взаимодействия!", interaction)
		}
	}
}
