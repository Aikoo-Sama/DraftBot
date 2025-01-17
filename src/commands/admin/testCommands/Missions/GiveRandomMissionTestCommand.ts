import {MissionsController} from "../../../../core/missions/MissionsController";
import {format} from "../../../../core/utils/StringFormatter";
import {Missions} from "../../../../core/database/game/models/Mission";
import {MissionDifficulty} from "../../../../core/missions/MissionDifficulty";
import {CommandInteraction} from "discord.js";
import {Constants} from "../../../../core/Constants";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";
import {MissionSlots} from "../../../../core/database/game/models/MissionSlot";

export const commandInfo: ITestCommand = {
	name: "giveRandomMission",
	aliases: ["grm"],
	commandFormat: "<difficulty>",
	typeWaited: {
		difficulty: Constants.TEST_VAR_TYPES.STRING
	},
	messageWhenExecuted: "Vous avez reçu la mission suivante:\n**Description :** {desc}\n**Objectif :** {objective}",
	description: "Donne une mission aléatoire",
	commandTestShouldReply: true,
	execute: null // Defined later
};

/**
 * Give a random mission
 * @param language
 * @param interaction
 * @param args
 */
const giveRandomMissionTestCommand = async (language: string, interaction: CommandInteraction, args: string[]): Promise<string> => {

	const [player] = await Players.getOrRegister(interaction.user.id);
	if (!player.hasEmptyMissionSlot(await MissionSlots.getOfPlayer(player.id))) {
		throw new Error("Les slots de mission du joueur sont tous pleins");
	}
	const difficulty = args[0];
	if (!difficulty || difficulty !== "e" && difficulty !== "m" && difficulty !== "h") {
		throw new Error("Difficulté incorrecte, elle doit être easy (e), medium (m) ou hard (h)");
	}
	const missionSlot = await MissionsController.addRandomMissionToPlayer(player,
		difficulty === "e" ? MissionDifficulty.EASY : difficulty === "m" ? MissionDifficulty.MEDIUM : MissionDifficulty.HARD);
	const mission = await Missions.getById(missionSlot.missionId);

	return format(commandInfo.messageWhenExecuted, {
		desc: await mission.formatDescription(missionSlot.missionObjective, missionSlot.missionVariant, language, null),
		objective: missionSlot.missionObjective
	});
};

commandInfo.execute = giveRandomMissionTestCommand;