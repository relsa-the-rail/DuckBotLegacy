const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js')
const { VoiceChannels } = require('../utils');

const interId = "voice"
module.exports = {
	id: interId,
	execute: async (interaction) => {
		const customId = interaction.customId.split(":")
		if (customId.length < 2) { return }

		let textChannel = interaction.channel
		let voiceChannel = await VoiceChannels.GetVoiceChannel(textChannel)

		switch(customId[1])
		{
			case "hide":
			case "lock":
			case "unlock":
				await VoiceChannels.Commands.SetVoiceState(interaction, voiceChannel, customId[1]);
				break;
			case "owner":
				if (customId[2] == "select")
				{
					let newOwnerId = interaction.values[0]
					let newOwner = await interaction.guild.members.fetch(newOwnerId)
					await VoiceChannels.Commands.SetVoiceOwner(interaction, voiceChannel, newOwner)

					return
				}

				const select = new StringSelectMenuBuilder()
					.setCustomId('voice:owner:select')
					.setPlaceholder('Участники...')

				let owner = VoiceChannels.GetOwner(voiceChannel)
				voiceChannel.members.each(member => {
					if (member.id == owner)
						return

					select.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel(member.displayName)
							.setValue(member.id)
					)
				});

				if (select.options.length == 0)
				{
					await interaction.reply({
						content: 'В личном канале недостаточно человек для передачи прав.',
						flags: MessageFlags.Ephemeral,
					});
					return
				}

				const row = new ActionRowBuilder()
					.addComponents(select);

				await interaction.reply({
					content: 'Выберите нового владельца',
					components: [row],
					flags: MessageFlags.Ephemeral,
				});

				break;
			case "name":
				if (customId[2] == "set")
				{
					await VoiceChannels.Commands.SetVoiceName(interaction, voiceChannel, interaction.fields.getTextInputValue('name'))

					return
				}

				let nameModal = new ModalBuilder()
					.setCustomId(`${interId}:name:set`)
					.setTitle('Изменение названия личной комнаты');

				let nameInput = new TextInputBuilder()
					.setCustomId('name')
					.setLabel("Название личного канала")
					.setStyle(TextInputStyle.Short)
					.setValue(voiceChannel.name)
					.setMaxLength(100)
					.setRequired(true);

				nameModal.addComponents(new ActionRowBuilder()
					.addComponents(nameInput));

				await interaction.showModal(nameModal);
				break;
			case "nsfw":
				await VoiceChannels.Commands.SetVoiceNsfw(interaction, voiceChannel, !voiceChannel.nsfw)
				break;
			case "br":
				if (customId[2] == "set")
				{
					let num = interaction.fields.getTextInputValue('br')
						num = parseInt(num) || 64

					await VoiceChannels.Commands.SetVoiceBitrate(interaction, voiceChannel, num)
					return
				}

				let brModal = new ModalBuilder()
					.setCustomId(`${interId}:br:set`)
					.setTitle('Изменение битрейта личной комнаты');

				let brInput = new TextInputBuilder()
					.setCustomId('br')
					.setLabel("Число от 8 до 96. (деф. 64)")
					.setStyle(TextInputStyle.Short)
					.setValue(`${voiceChannel.bitrate / 1000}`)
					.setMaxLength(2)
					.setRequired(true);

				brModal.addComponents(new ActionRowBuilder()
					.addComponents(brInput));

				await interaction.showModal(brModal);
				break;
			case "limit":
				if (customId[2] == "set")
				{
					let num = interaction.fields.getTextInputValue('limit')
						num = parseInt(num) ?? 0

					await VoiceChannels.Commands.SetVoiceUserLimit(interaction, voiceChannel, num)
					return
				}

				let limitModal = new ModalBuilder()
					.setCustomId(`${interId}:limit:set`)
					.setTitle('Изменение лимита в личной комнате');

				let limitInput = new TextInputBuilder()
					.setCustomId('limit')
					.setLabel("Число от 0 до 99. (0 - выкл)")
					.setStyle(TextInputStyle.Short)
					.setValue(`${voiceChannel.userLimit || 0}`)
					.setMaxLength(2)
					.setRequired(true);

				limitModal.addComponents(new ActionRowBuilder()
					.addComponents(limitInput));

				await interaction.showModal(limitModal);
				break;
			case "region":
				if (customId[2] == "set")
				{
					let region = interaction.fields.getStringSelectValues('region')[0] || "auto"

					await VoiceChannels.Commands.SetVoiceRegion(interaction, voiceChannel, region)
					return
				}

				let regions = interaction.client.voiceRegions
				if (!regions || regions.size == 0)
				{
					await interaction.reply({
						content: 'Список регионов недоступен. Пожалуйста, попробуйте позже.',
						flags: MessageFlags.Ephemeral,
					});
					return
				}

				let regionModal = new ModalBuilder()
					.setCustomId(`${interId}:region:set`)
					.setTitle('Изменение региона личной комнаты');

				const regionSelect = new StringSelectMenuBuilder()
					.setCustomId('region')
					.setPlaceholder('Регион...')

				regionSelect.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel("Автоматический выбор")
						.setValue("auto")
						.setDefault(voiceChannel.rtcRegion === null)
				)

				regions.forEach(region => {
					regionSelect.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel(region.name)
							.setValue(region.id)
							.setDefault(voiceChannel.rtcRegion === region.id)
					)
				});

				const regionsLabel = new LabelBuilder()
					.setLabel("Выберите регион")
					.setStringSelectMenuComponent(regionSelect);

				regionModal.addComponents(regionsLabel);

				await interaction.showModal(regionModal);
				break;

			default:
				throw "Unknown type"
		}
	},
}