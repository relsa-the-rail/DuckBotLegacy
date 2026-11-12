const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { VoiceChannels } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('voice')
		.setDescription('Взаимодействие с личным каналом.')
		.setContexts([InteractionContextType.Guild])
		.addSubcommand(subcommand =>
			subcommand
				.setName('unlock')
				.setDescription('Открыть личный канал.'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('lock')
				.setDescription('Закрыть личный канал.'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('hide')
				.setDescription('Скрыть личный канал.'))
		.addSubcommand(subcommand => 
			subcommand
				.setName('invite')
				.setDescription('Пригласить пользователя в личный канал')
				.addUserOption(option => option.setName('target').setDescription('Пользователь').setRequired(true))
				.addBooleanOption(option => option.setName('ping').setDescription('Нужно ли оповещать о приглашении? (деф. Да)')))
		.addSubcommand(subcommand =>
			subcommand
				.setName('ban')
				.setDescription('Забанить пользователя, что ограничит ему доступ к личному каналу.')
				.addUserOption(option => option.setName('target').setDescription('Пользователь').setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('kick')
				.setDescription('Выгнать пользователя из личного канала.')
				.addUserOption(option => option.setName('target').setDescription('Пользователь').setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('owner')
				.setDescription('Передать права владельца на личный канал.')
				.addUserOption(option => option.setName('target').setDescription('Пользователь').setRequired(true)))
		.addSubcommand(subcommand => 
			subcommand
				.setName('name')
				.setDescription('Изменить название личного канала.')
				.addStringOption(option => option.setName('name').setDescription('Новое название').setMaxLength(100).setRequired(true)))
		.addSubcommand(subcommand => 
			subcommand
				.setName('nsfw')
				.setDescription('Изменить возрастное ограничение в личном канале.')
				.addBooleanOption(option => option.setName('state').setDescription('Включить возрастное ограничение?').setRequired(true)))
		.addSubcommand(subcommand => 
			subcommand
				.setName('bitrate')
				.setDescription('Изменить битрейт личного канала.')
				.addIntegerOption(option => option.setName('bitrate').setDescription('Новое значение битрейта (деф. 64)').setMinValue(8).setMaxValue(96).setRequired(true)))
		.addSubcommand(subcommand => 
			subcommand
				.setName('limit')
				.setDescription('Изменить лимит пользователей в личном канале.')
				.addIntegerOption(option => option.setName('limit').setDescription('Новое значение лимита (0 - выкл)').setMinValue(0).setMaxValue(99).setRequired(true)))
		.addSubcommand(subcommand => 
			subcommand
				.setName('region')
				.setDescription('Изменить регион личного канала.')
				.addStringOption(option => option.setName('region').setDescription('Новый регион (auto - Автовыбор)').setAutocomplete(true).setRequired(true))),
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name !== 'region') return;

		let val = focusedOption.value.toLowerCase()
		const choices = [{id: "auto", name: "Автоматический выбор"}, ...process.disClient.voiceRegions.values()];
		const filtered = choices.filter(choice => choice.name.toLowerCase().includes(val) || choice.id.toLowerCase().includes(val));
		await interaction.respond(
			filtered.map(choice => ({ name: choice.name, value: choice.id }))
		);
	},
	async execute(interaction) {
		let member = interaction.member;
		let state = member.voice;
		let channel = state && state.channel
		if (!channel)
			return await interaction.reply({ content: `Вы не находитесь в голосовых чатах.`, flags: MessageFlags.Ephemeral });

		let isVoice = await VoiceChannels.IsVoiceChannel(channel)
		if (!isVoice)
			return await interaction.reply({ content: `Вы не находитесь в личном канале.`, flags: MessageFlags.Ephemeral });

		let ownerId = VoiceChannels.GetOwner(channel)
		if (member.id != ownerId)
			return await interaction.reply({ content: `Вы не владелеете личным каналом.`, flags: MessageFlags.Ephemeral });


		let cmd = interaction.options.getSubcommand();
		switch(cmd)
		{
			case "hide":
			case "lock":
			case "unlock":
				await VoiceChannels.Commands.SetVoiceState(interaction, channel, cmd);
				return;

			case "invite":
				let bool = interaction.options.getBoolean('ping') ?? true
				await VoiceChannels.Commands.VoiceInvite(interaction, channel, interaction.options.getMember('target'), bool)
				break;
			case "ban":
				await VoiceChannels.Commands.VoiceBan(interaction, channel, interaction.options.getMember('target'))
				break;
			case "kick":
				await VoiceChannels.Commands.VoiceKick(interaction, channel, interaction.options.getMember('target'))
				break;
			case "owner":
				await VoiceChannels.Commands.SetVoiceOwner(interaction, channel, interaction.options.getMember('target'))
				break;
			case "name":
				await VoiceChannels.Commands.SetVoiceName(interaction, channel, interaction.options.getString('name'))
				break;
			case "nsfw":
				await VoiceChannels.Commands.SetVoiceNsfw(interaction, channel, interaction.options.getBoolean('state'))
				break;
			case "bitrate":
				await VoiceChannels.Commands.SetVoiceBitrate(interaction, channel, interaction.options.getInteger('bitrate'))
				break;
			case "limit":
				await VoiceChannels.Commands.SetVoiceUserLimit(interaction, channel, interaction.options.getInteger('limit'))
				break;
			case "region":
				await VoiceChannels.Commands.SetVoiceRegion(interaction, channel, interaction.options.getString('region'))
				break;
		}
	}
};
