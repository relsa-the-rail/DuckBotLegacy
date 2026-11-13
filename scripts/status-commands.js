require('dotenv').config()

const { REST, Routes } = require('discord.js')

const token = process.env.TOKEN
if (!token) {
	console.error('TOKEN is not set (check .env).')
	process.exit(1)
}

const forceRegister = process.argv.includes('--register')
const asJson = process.argv.includes('--json')

async function list(rest, label, route) {
	const commands = await rest.get(route)
	console.log(`${label}: ${commands.length} command(s)`)
	for (const command of commands) {
		console.log(`  - ${command.name} (id ${command.id}, v${command.version})`)
	}
	if (asJson) console.log(JSON.stringify(commands, null, 2))
	return commands
}

async function main() {
	const rest = new REST().setToken(token)

	// /applications/@me gives us the application id without needing the client.
	const app = await rest.get(Routes.currentApplication())
	console.log(`Application: ${app.name} (id ${app.id})`)

	await list(rest, '\nGlobal commands', Routes.applicationCommands(app.id))

	const guilds = await rest.get(Routes.userGuilds())
	console.log(`\nGuilds: ${guilds.length}`)
	for (const guild of guilds) {
		const commands = await rest.get(Routes.applicationGuildCommands(app.id, guild.id))
		const names = commands.length ? ' -> ' + commands.map(command => command.name).join(', ') : ''
		console.log(`  ${guild.name} (${guild.id}): ${commands.length} guild command(s)${names}`)
	}

	if (forceRegister) {
		console.log('\nForcing a re-registration via deploy-commands...')
		await require('../src/deploy-commands')(app.id)
	}

	console.log('\nDone.')
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
