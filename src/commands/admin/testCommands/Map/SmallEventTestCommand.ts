import {CommandInteraction} from "discord.js";
import {format} from "../../../../core/utils/StringFormatter";
import {Constants} from "../../../../core/Constants";
import {ITestCommand} from "../../../../core/CommandsTest";
import {CommandsManager} from "../../../CommandsManager";
import {Data} from "../../../../core/Data";
import {Players} from "../../../../core/database/game/models/Player";

const smallEventsModules = Data.getKeys("smallEvents");

const strings = ["Force un type de mini event parmis ceux-ci :"];
smallEventsModules
	.forEach(seName => {
		strings.push(`- ${seName}`);
	});

export const commandInfo: ITestCommand = {
	name: "smallEvent",
	commandFormat: "<seName>",
	typeWaited: {
		seName: Constants.TEST_VAR_TYPES.STRING
	},
	messageWhenExecuted: "Mini event `{name}` forcé !",
	description: strings.join("\n"),
	commandTestShouldReply: false,
	execute: null // Defined later
};

/**
 * Force a small event with a given event name
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const smallEventTestCommand = async (language: string, interaction: CommandInteraction, args: string[]): Promise<string> => {
	if (!smallEventsModules.includes(args[0])) {
		throw new Error(`Erreur smallEvent : le mini-event ${args[0]} n'existe pas. Veuillez vous référer à la commande "test help smallEvent" pour plus d'informations`);
	}
	const [player] = await Players.getOrRegister(interaction.user.id);
	await CommandsManager.executeCommandWithParameters("report", interaction, language, player, null, args[0]);
	return format(commandInfo.messageWhenExecuted, {name: args[0]});
};

commandInfo.execute = smallEventTestCommand;