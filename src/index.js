require('dotenv').config()

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const token = process.env.TOKEN;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates,
	],
	rest: {
		rejectOnRateLimit: (info) => { 
			return info.route == "/channels/:id";
		},
	},
});


client.commands = new Collection();
const commandFoldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandFoldersPath);
for (const folder of commandFolders) {
	const commandsPath = path.join(commandFoldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		if (file === 'eval.js' && (!process.env.DEV_ID)) {
			continue
		}
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}


const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}


client.interactions = new Collection();
const interactionsPath = path.join(__dirname, 'interactions');
const interactionsFiles = fs.readdirSync(interactionsPath).filter(file => file.endsWith('.js'));
for (const file of interactionsFiles) {
	const filePath = path.join(interactionsPath, file);
	const interaction = require(filePath);

	if ('id' in interaction && 'execute' in interaction) {
		client.interactions.set(interaction.id, interaction)
	} else {
		console.log(`[WARNING] The interaction at ${filePath} is missing a required "id" or "execute" property.`);
	}
}


client.login(token);

// Graceful shutdown so `docker compose stop`/`down` and Ctrl+C exit cleanly.
for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, async () => {
		console.log(`Received ${signal}, shutting down...`);
		await client.destroy();
		process.exit(0);
	});
}
