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

/**
 * Read every command file and split the SlashCommandBuilder#toJSON() output into
 * the shared set and the per-guild "exclusive" sets. Used both for deployment
 * and by scripts/status-commands.js so the desired set can be reported without
 * duplicating this logic.
 */
function collectCommands() {
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

	return { commands, commandsExclusive }
}

module.exports = (clientId) => {
	const { REST, Routes, RateLimitError } = require('discord.js');
	const guildId = process.env.GUILD_ID
	const token = process.env.TOKEN

	// Command ids by name, used to build clickable </command:id> mentions.
	// Defined up-front so consumers (e.g. voiceStateUpdate) never read it
	// while undefined.
	process.disCmds = {}

	const { commands, commandsExclusive } = collectCommands()

	// Reject on rate limit instead of letting the REST client silently sleep and
	// retry: a global 429 can stall for a long time, and since deploy runs before
	// the rest of ClientReady, a hidden wait would freeze startup. Rejecting turns
	// it into a RateLimitError we can log and recover from.
	const rest = new REST({ rejectOnRateLimit: () => true }).setToken(token);

	function indexCommandIds(list) {
		// Добавим идшники команд в процесс, чтобы легче было потом ссылаться на них в пингах.
		process.disCmds = {}
		list.forEach(cmd => {
			process.disCmds[cmd.name] = cmd.id
		});
	}

	// Remove leftovers from the *other* scope. A global command and a guild
	// command with the same name coexist in the picker, so registering in one
	// scope has to drop the same-named commands from the other.
	async function clearOtherScope() {
		if (guildId) {
			// Guild scope is active: wipe the global set (as before).
			const globals = await rest.get(Routes.applicationCommands(clientId))
			if (globals.length) {
				await rest.put(Routes.applicationCommands(clientId), { body: [] })
				console.log('Cleared leftover global application (/) commands.')
			}
			return
		}

		// Global scope is active: drop guild commands that shadow a global one.
		const names = new Set(commands.map(command => command.name))
		const guilds = await rest.get(Routes.userGuilds())
		for (const guild of guilds) {
			const guildCommands = await rest.get(Routes.applicationGuildCommands(clientId, guild.id))
			const duplicates = guildCommands.filter(command => names.has(command.name))
			if (!duplicates.length) continue

			for (const duplicate of duplicates) {
				await rest.delete(Routes.applicationGuildCommand(clientId, guild.id, duplicate.id))
			}
			console.log(`Cleared ${duplicates.length} leftover guild command(s) in ${guild.name} (${guild.id}): ${duplicates.map(command => command.name).join(', ')}`)
		}
	}

	/**
	 * Discord rate-limits global command writes far more strictly than guild
	 * ones. Report it clearly and, when the wait looks sane, retry in the
	 * background so a long wait doesn't block startup and the set still lands
	 * without a restart.
	 */
	function handleRateLimit(route, body, scope, error) {
		const waitMs = Number(error.timeToReset) || Number(error.retryAfter) || 0
		const seconds = Math.ceil(waitMs / 1000)
		console.warn(`[deploy-commands] Rate limited while registering ${scope} commands (429${error.global ? ' global' : ''}); Discord asked to retry in ~${seconds}s. Leaving the current set untouched.`)

		// Only schedule a deferred retry for the global scope (guild writes are not
		// this constrained) and only when the wait is within a reasonable window.
		if (guildId || !(waitMs > 0) || waitMs > 60 * 60 * 1000) {
			if (!guildId && waitMs > 60 * 60 * 1000) {
				console.warn('[deploy-commands] Retry window is over an hour; not scheduling a deferred retry. Restart once the limit resets.')
			}
			return
		}

		const timer = setTimeout(async () => {
			try {
				const data = await rest.put(route, { body })
				indexCommandIds(data)
				console.log(`[deploy-commands] Deferred registration for ${scope} succeeded (${data.length} commands).`)
			} catch (retryError) {
				console.error('[deploy-commands] Deferred command registration failed:', retryError)
			}
		}, waitMs + 1000)
		// Don't keep a one-shot script (npm run commands --register) alive for it.
		timer.unref?.()
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

			let data = current
			let activeUpToDate = commandsEqual(current, commands)

			if (activeUpToDate) {
				console.log(`Application (/) commands already up to date for ${scope}; skipping registration.`)
			} else {
				console.log(`Updating application (/) commands for ${scope}:`, describeChanges(current, commands))
				if (!guildId) {
					console.log('Note: global commands can take up to an hour to appear (and the Discord client may need a reload). Set GUILD_ID for instant guild commands.')
				}

				try {
					data = await rest.put(route, { body: commands })
					activeUpToDate = true
				} catch (error) {
					if (error instanceof RateLimitError) {
						handleRateLimit(route, commands, scope, error)
						data = current
					} else {
						throw error
					}
				}
			}

			// Only reconcile the other scope once the active one is known good, so a
			// failed (e.g. rate-limited) write never deletes the working commands.
			if (activeUpToDate) {
				await clearOtherScope()

				if (Object.keys(commandsExclusive).length > 0) {
					for (const [key, value] of Object.entries(commandsExclusive)) {
						const guildData = await rest.put(
							Routes.applicationGuildCommands(clientId, key),
							{ body: value },
						);

						console.log(`Successfully reloaded ${guildData.length} application (/) exclusive commands for guild ${key}.`);
					};
				}
			}

			indexCommandIds(data)
			if (activeUpToDate) {
				console.log(`Application (/) commands in ${scope} are up to date (${data.length}).`);
			}
		} catch (error) {
			if (error instanceof RateLimitError) {
				console.warn(`[deploy-commands] Rate limited while registering commands (429${error.global ? ' global' : ''}); the current set is left as-is.`)
			} else {
				console.error('[deploy-commands] Failed to register application commands:', error);
			}
		}
	})();
}

// Exposed so diagnostics (scripts/status-commands.js) can report the set the bot
// would deploy without duplicating the discovery logic.
module.exports.collectCommands = collectCommands
