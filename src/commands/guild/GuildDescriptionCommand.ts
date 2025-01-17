import {CommandInteraction} from "discord.js";
import {replyErrorMessage, sendErrorMessage} from "../../core/utils/ErrorUtils";
import Guild, {Guilds} from "../../core/database/game/models/Guild";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {ICommand} from "../ICommand";
import {SlashCommandBuilder} from "@discordjs/builders";
import {Constants} from "../../core/Constants";
import {checkNameString} from "../../core/utils/StringUtils";
import {TranslationModule, Translations} from "../../core/Translations";
import {DraftBotValidateReactionMessage} from "../../core/messages/DraftBotValidateReactionMessage";
import {BlockingUtils} from "../../core/utils/BlockingUtils";
import {BlockingConstants} from "../../core/constants/BlockingConstants";
import {draftBotInstance} from "../../core/bot";
import {EffectsConstants} from "../../core/constants/EffectsConstants";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import Player from "../../core/database/game/models/Player";
import {GuildConstants} from "../../core/constants/GuildConstants";

/**
 * Create validation message to change guild description
 * @param player
 * @param guild
 * @param askedDescription - New description asked by the user
 * @param interaction - Discord Object
 * @param guildDescriptionModule
 */
function endCallbackGuildCreateValidationMessage(
	player: Player,
	guild: Guild,
	askedDescription: string,
	interaction: CommandInteraction,
	guildDescriptionModule: TranslationModule): (validateMessage: DraftBotValidateReactionMessage) => Promise<void> {
	return async (validateMessage: DraftBotValidateReactionMessage): Promise<void> => {
		BlockingUtils.unblockPlayer(player.discordUserId, BlockingConstants.REASONS.GUILD_DESCRIPTION);
		if (validateMessage.isValidated()) {
			guild.guildDescription = askedDescription;
			await Promise.all([
				player.save(),
				guild.save()
			]);

			draftBotInstance.logsDatabase.logGuildDescriptionChange(player.discordUserId, guild).then();

			await interaction.followUp({
				embeds: [new DraftBotEmbed()
					.formatAuthor(guildDescriptionModule.get("changeDescriptionTitle"), interaction.user)
					.setDescription(guildDescriptionModule.get("editSuccessTitle"))]
			});
			return;
		}

		// Cancel the creation
		await sendErrorMessage(interaction.user, interaction, guildDescriptionModule.language, guildDescriptionModule.get("editCancelled"), true);
	};
}

/**
 * Create validation message to change guild description
 * @param interaction
 * @param endCallback - Function called when user respond to validation message
 * @param askedDescription - The description asked by the user
 * @param player
 * @param guildDescriptionModule
 */
async function createValidationEmbedGuildDesc(
	interaction: CommandInteraction,
	endCallback: (validateMessage: DraftBotValidateReactionMessage) => Promise<void>,
	askedDescription: string,
	player: Player,
	guildDescriptionModule: TranslationModule
): Promise<void> {
	await new DraftBotValidateReactionMessage(interaction.user, endCallback)
		.formatAuthor(guildDescriptionModule.get("changeDescriptionTitle"), interaction.user)
		.setDescription(
			guildDescriptionModule.format("changeDescriptionConfirm",
				{
					description: askedDescription
				}
			))
		.setFooter({text: guildDescriptionModule.get("changeDescriptionFooter")})
		.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(player.discordUserId, BlockingConstants.REASONS.GUILD_DESCRIPTION, collector));

}

/**
 * Change guild description
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 * @param player
 */
async function executeCommand(interaction: CommandInteraction, language: string, player: Player): Promise<void> {
	const guild = await Guilds.getById(player.guildId);
	const guildDescriptionModule = Translations.getModule("commands.guildDescription", language);

	const guildDescription = interaction.options.get(Translations.getModule("commands.guildDescription", Constants.LANGUAGE.ENGLISH).get("optionDescriptionName")).value as string;

	if (!checkNameString(guildDescription, GuildConstants.DESCRIPTION_LENGTH_RANGE)) {
		await replyErrorMessage(
			interaction,
			language,
			guildDescriptionModule.format("invalidDescription", {
				min: GuildConstants.DESCRIPTION_LENGTH_RANGE.MIN,
				max: GuildConstants.DESCRIPTION_LENGTH_RANGE.MAX
			})
		);
		return;
	}

	const endCallback = endCallbackGuildCreateValidationMessage(player, guild, guildDescription, interaction, guildDescriptionModule);

	await createValidationEmbedGuildDesc(interaction, endCallback, guildDescription, player, guildDescriptionModule);

}

const currentCommandFrenchTranslations = Translations.getModule("commands.guildDescription", Constants.LANGUAGE.FRENCH);
const currentCommandEnglishTranslations = Translations.getModule("commands.guildDescription", Constants.LANGUAGE.ENGLISH);
export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand(currentCommandFrenchTranslations, currentCommandEnglishTranslations)
		.addStringOption(option => option.setName(currentCommandEnglishTranslations.get("optionDescriptionName"))
			.setNameLocalizations({
				fr: currentCommandFrenchTranslations.get("optionDescriptionName")
			})
			.setDescription(currentCommandEnglishTranslations.get("optionDescriptionDescription"))
			.setDescriptionLocalizations({
				fr: currentCommandFrenchTranslations.get("optionDescriptionDescription")
			})
			.setRequired(true)) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		allowEffects: null,
		requiredLevel: null,
		disallowEffects: [EffectsConstants.EMOJI_TEXT.BABY, EffectsConstants.EMOJI_TEXT.DEAD],
		guildPermissions: GuildConstants.PERMISSION_LEVEL.ELDER,
		guildRequired: true,
		userPermission: null
	},
	mainGuildCommand: false,
	slashCommandPermissions: null
};