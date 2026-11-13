// Fields that define a command's "identity". Only the keys actually present on
// the locally-built command are compared, so the extra/default fields Discord
// adds to its response (id, version, integration_types, nsfw, ...) do not
// cause a false "changed" on every startup.
const COMMAND_KEYS = [
	'type',
	'name',
	'description',
	'nsfw',
	'default_member_permissions',
	'dm_permission',
	'name_localizations',
	'description_localizations',
	'contexts',
	'integration_types',
	'options',
]

const OPTION_KEYS = [
	'type',
	'name',
	'description',
	'required',
	'autocomplete',
	'choices',
	'options',
	'channel_types',
	'file_types',
	'min_value',
	'max_value',
	'min_length',
	'max_length',
	'name_localizations',
	'description_localizations',
]

// Fields holding a set of numbers, whose order must not matter.
const SET_FIELDS = new Set(['contexts', 'integration_types', 'channel_types', 'file_types'])
// Localization maps default to `{}` and may be missing on either side.
const LOCALIZATION_FIELDS = new Set(['name_localizations', 'description_localizations'])

function stableStringify(value) {
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`
	}
	if (value && typeof value === 'object') {
		return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
	}
	return JSON.stringify(value)
}

function asSortedNumbers(value) {
	return (value ?? []).map(Number).sort((a, b) => a - b)
}

function choicesEqual(template, source) {
	if (!Array.isArray(source) || template.length !== source.length) return false

	const byName = new Map(source.map(choice => [choice.name, choice]))
	for (const choice of template) {
		const existing = byName.get(choice.name)
		if (!existing || existing.value !== choice.value) return false
		if (stableStringify(choice.name_localizations ?? {}) !== stableStringify(existing.name_localizations ?? {})) return false
	}
	return true
}

function optionsEqual(template, source) {
	if (!Array.isArray(source) || template.length !== source.length) return false

	const byName = new Map(source.map(option => [option.name, option]))
	for (const option of template) {
		const existing = byName.get(option.name)
		if (!existing || !matchFields(option, existing, OPTION_KEYS)) return false
	}
	return true
}

/**
 * Compare a single field of a locally-built command (template) against the same
 * field of the command Discord returned (source).
 */
function fieldEqual(key, template, source) {
	if (LOCALIZATION_FIELDS.has(key)) {
		return stableStringify(template ?? {}) === stableStringify(source ?? {})
	}
	if (SET_FIELDS.has(key)) {
		return stableStringify(asSortedNumbers(template)) === stableStringify(asSortedNumbers(source))
	}
	if (key === 'default_member_permissions') {
		return String(template) === String(source)
	}
	if (key === 'options') {
		return optionsEqual(template, source ?? [])
	}
	if (key === 'choices') {
		return choicesEqual(template, source)
	}
	return template === source
}

/** Compare every key present on `template`, ignoring the keys it omits. */
function matchFields(template, source, keys) {
	for (const key of keys) {
		// The command builders emit keys with `undefined` values for anything not
		// set (e.g. `contexts` on a command that never called setContexts), so
		// `undefined` means "not specified" and must not be compared.
		if (template[key] === undefined) continue
		if (!fieldEqual(key, template[key], source?.[key])) return false
	}
	return true
}

/** Whether the set Discord currently has matches the set we want to register. */
function commandsEqual(current, desired) {
	if (!Array.isArray(current) || current.length !== desired.length) return false

	const byName = new Map(current.map(command => [command.name, command]))
	for (const command of desired) {
		const existing = byName.get(command.name)
		if (!existing || !matchFields(command, existing, COMMAND_KEYS)) return false
	}
	return true
}

/** Human-readable summary of how the registered set differs from the desired one. */
function describeChanges(current, desired) {
	const list = Array.isArray(current) ? current : []
	const currentByName = new Map(list.map(command => [command.name, command]))
	const desiredNames = new Set(desired.map(command => command.name))

	return {
		added: desired.filter(command => !currentByName.has(command.name)).map(command => command.name),
		removed: list.filter(command => !desiredNames.has(command.name)).map(command => command.name),
		changed: desired
			.filter(command => {
				const existing = currentByName.get(command.name)
				return existing && !matchFields(command, existing, COMMAND_KEYS)
			})
			.map(command => command.name),
	}
}

module.exports = (clientId) => {
	const { REST, Routes } = require('discord.js');
	const guildId = process.env.GUILD_ID
	const token = process.env.TOKEN
	const fs = require('node:fs');
	const path = require('node:path');

	// Command ids by name, used to build clickable </command:id> mentions.
	// Defined up-front so consumers (e.g. voiceStateUpdate) never read it
	// while undefined.
	process.disCmds = {}

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

	function indexCommandIds(list) {
		// Добавим идшники команд в процесс, чтобы легче было потом ссылаться на них в пингах.
		process.disCmds = {}
		list.forEach(cmd => {
			process.disCmds[cmd.name] = cmd.id
		});
	}

	// and deploy your commands!
	return (async () => {
		try {
			const route = guildId
				? Routes.applicationGuildCommands(clientId, guildId)
				: Routes.applicationCommands(clientId)
			const scope = guildId ? `guild ${guildId}` : 'global'

			// Compare with what Discord already has and only write when the
			// definition actually changed, instead of re-sending every command on
			// every startup. The PUT below still replaces the whole set atomically.
			const current = await rest.get(route)

			if (commandsEqual(current, commands)) {
				console.log(`Application (/) commands already up to date for ${scope}; skipping registration.`)
				indexCommandIds(current)
				return
			}

			const changes = describeChanges(current, commands)
			console.log(`Updating application (/) commands for ${scope}:`, changes)
			if (!guildId) {
				console.log('Note: global commands can take up to an hour to appear (and the Discord client may need a reload). Set GUILD_ID for instant guild commands.')
			}

			const data = await rest.put(route, { body: commands })

			// Clear commands left over in the other scope so they don't show up
			// twice (a global and a guild command with the same name coexist).
			if (guildId) {
				const globals = await rest.get(Routes.applicationCommands(clientId))
				if (globals.length) {
					await rest.put(Routes.applicationCommands(clientId), { body: [] })
					console.log('Cleared leftover global application (/) commands.')
				}
			}

			if (Object.keys(commandsExclusive).length > 0) {
				for (const [key, value] of Object.entries(commandsExclusive)) {
					const guildData = await rest.put(
						Routes.applicationGuildCommands(clientId, key),
						{ body: value },
					);

					console.log(`Successfully reloaded ${guildData.length} application (/) exclusive commands for guild ${key}.`);
				};
			}

			indexCommandIds(data)
			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			console.error('[deploy-commands] Failed to register application commands:', error);
		}
	})();
}
