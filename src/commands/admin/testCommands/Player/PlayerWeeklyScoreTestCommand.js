import {Entities} from "../../../../core/models/Entity";

module.exports.commandInfo = {
	name: "playerweeklyscore",
	aliases: ["weeklyscore"],
	commandFormat: "<weeklyscore>",
	typeWaited: {
		weeklyscore: typeVariable.INTEGER
	},
	messageWhenExecuted: "Vous avez maintenant {weeklyscore} points de la semaine !",
	description: "Mets le score de la semaine de votre joueur à la valeur donnée"
};

/**
 * Set the weeklyscore of the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const playerWeeklyScoreTestCommand = async (language, interaction, args) => {
	const [entity] = await Entities.getOrRegister(interaction.user.id);
	entity.Player.weeklyScore = parseInt(args[0], 10);
	await entity.Player.save();

	return format(module.exports.commandInfo.messageWhenExecuted, {weeklyscore: entity.Player.weeklyScore});
};

module.exports.execute = playerWeeklyScoreTestCommand;