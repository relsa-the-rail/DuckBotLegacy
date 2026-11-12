module.exports = (clientId) => {
	const { REST, Routes } = require('discord.js');
	const guildId = process.env.GUILD_ID
	const token = process.env.TOKEN
	const fs = require('node:fs');
	const path = require('node:path');

	const commandsExclusive = {};
	const commands = [];
	// Grab all the command folders from the commands directory you created earlier
	const foldersPath = path.join(__dirname, 'commands');
	const commandFolders = fs.readdirSync(foldersPath);

	for (const folder of commandFolders) {
		// Grab all the command files from the commands directory you created earlier
		const commandsPath = path.join(foldersPath, folder);
		const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
		// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
		for (const file of commandFiles) {
			if (file === 'eval.js' && (!process.env.DEV_ID)) {
				continue
			}
			const filePath = path.join(commandsPath, file);
			const command = require(filePath);
			if ('data' in command && 'execute' in command) {
				if (command.exclusive) {
					commandsExclusive[command.exclusive] = commandsExclusive[command.exclusive] || []
					commandsExclusive[command.exclusive].push(command.data.toJSON());
				}
				else
					commands.push(command.data.toJSON());
			} else {
				console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
			}
		}
	}

	// Construct and prepare an instance of the REST module
	const rest = new REST().setToken(token);

	// and deploy your commands!
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);

			await rest.put(
				Routes.applicationCommands(clientId),
				{ body: [] },
			)

			try {
				if (Object.keys(commandsExclusive).length > 0) {
					for (const [key, value] of Object.entries(commandsExclusive)) {
						const guildData = await rest.put(
							Routes.applicationGuildCommands(clientId, key),
							{ body: value },
						);

						console.log(`Successfully reloaded ${guildData.length} application (/) exclusive commands for guild ${key}.`);
					};
				}
			} catch (e) { }

			// The put method is used to fully refresh all commands in the guild with the current set
			const data = guildId ? await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands },
			) : await rest.put(
				Routes.applicationCommands(clientId),
				{ body: commands },
			);
			
			// Добавим идшники команд в процесс, чтобы легче было потом ссылаться на них в пингах.
			process.disCmds = {}
			data.forEach(cmd => {
				process.disCmds[cmd.name] = cmd.id
			});

			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			// And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
}