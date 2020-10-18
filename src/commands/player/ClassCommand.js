/**
 * Select a class
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
async function ClassCommand(language, message, args) {
    let [entity] = await Entities.getOrRegister(message.author.id); //Loading player

    if ((await canPerformCommand(message, language, PERMISSION.ROLE.ALL, [EFFECT.BABY, EFFECT.DEAD, EFFECT.LOCKED], entity, CLASS.REQUIRED_LEVEL)) !== true) {
        return;
    }
    if (await sendBlockedError(message.author, message.channel, language)) {
        return;
    }

    addBlockedPlayer(entity.discordUser_id, 'class');

    const classTranslations = JsonReader.commands.class.getTranslation(language);

    let classesLineDisplay = new Array();
    let allClasses = await Classes.findAll();
    for (let k = 0; k < allClasses.length; k++) {
        classesLineDisplay.push(allClasses[k].toString(language, entity.Player.level))
    }

    //Creating class message
    const classMessage = await message.channel.send(
        new discord.MessageEmbed()
            .setColor(JsonReader.bot.embed.default)
            .setTitle(classTranslations.title)
            .addField(
                classTranslations.desc, classesLineDisplay.join("\n") +
            format(classTranslations.moneyQuantity, {
                money: entity.Player.money,
            }))
    );

    const filterConfirm = (reaction, user) => {
        return (user.id === entity.discordUser_id && reaction.me);
    };

    const collector = classMessage.createReactionCollector(filterConfirm, { time: 120000, max: 1 });

    //Fetch the choice from the user
    collector.on("end", async (reaction) => {
        if (!reaction.first()) { //the user is afk
            removeBlockedPlayer(entity.discordUser_id);
            return;
        }
        if (reaction.first().emoji.name === MENU_REACTION.DENY) {
            removeBlockedPlayer(entity.discordUser_id);
            sendErrorMessage(message.author, message.channel, language, JsonReader.commands.class.getTranslation(language).error.leaveClass);
            return;
        }

        const potion = dailyPotion.get("potion");
        const potionPrice = dailyPotion.get("price");
        if (classItems.has(reaction.first().emoji.name)) {
            const item = classItems.get(reaction.first().emoji.name);
            if (canBuy(item.price, entity.Player)) {
                await confirmPurchase(classMessage, language, item.name, item.price, item.info, entity, message.author, item);
            } else {
                sendErrorMessage(message.author, message.channel, language,
                    format(JsonReader.commands.class.getTranslation(language).error.cannotBuy, {
                        missingMoney: item.price - entity.Player.money,
                    }));
                removeBlockedPlayer(entity.discordUser_id);
            }
        } else if (
            potion.getEmoji() === reaction.first().emoji.id ||
            potion.getEmoji() === reaction.first().emoji.name ||
            SHOP.POTION_REPLACEMENT === reaction.first().emoji.name ||
            SHOP.POTION_REPLACEMENT === reaction.first().id
        ) {
            if (canBuy(potionPrice, entity.Player)) {
                await confirmPurchase(classMessage, language,
                    potion.toString(language),
                    potionPrice,
                    JsonReader.commands.class.getTranslation(language).potion.info,
                    entity,
                    message.author,
                    dailyPotion
                );
            } else {
                sendErrorMessage(message.author, message.channel, language, format(
                    JsonReader.commands.class.getTranslation(language).error.cannotBuy, {
                    missingMoney: potionPrice - entity.Player.money,
                }
                ));
                removeBlockedPlayer(entity.discordUser_id);
            }
        }
    });

    //Adding reactions
    for (let k = 0; k < allClasses.length; k++) {
        await classMessage.react(allClasses[k].emoji);
    }
    classMessage.react(MENU_REACTION.DENY)
}


/**
 * @param {*} message - The message where the react event trigerred
 * @param {*} reaction - The reaction
 */
async function sellItem(message, reaction, language, entity, customer, selectedItem) {
    [entity] = await Entities.getOrRegister(entity.discordUser_id);
    const classTranslations = JsonReader.commands.class.getTranslation(language);
    if (selectedItem.name) {
        //This is not a potion
        if (
            selectedItem.name === classTranslations.permanentItems.randomItem.name
        ) {
            await giveRandomItem(customer, message.channel, language, entity);
        } else if (
            selectedItem.name === classTranslations.permanentItems.healAlterations.name
        ) {
            if (entity.currentEffectFinished()) {
                return sendErrorMessage(customer, message.channel, language, JsonReader.commands.class.getTranslation(language).error.nothingToHeal);
            }
            healAlterations(message, language, entity, customer, selectedItem);
        } else if (
            selectedItem.name === classTranslations.permanentItems.regen.name
        ) {
            regenPlayer(message, language, entity, customer, selectedItem);
        } else if (
            selectedItem.name === classTranslations.permanentItems.badge.name
        ) {
            let success = giveMoneyMouthBadge(message, language, entity, customer, selectedItem);
            if (!success) {
                return;
            }
        } else if (
            selectedItem.name === classTranslations.permanentItems.guildXp.name
        ) {
            if (!await giveGuildXp(message, language, entity, customer, selectedItem))
                return;//if no guild, no need to proceed
        }
        entity.Player.addMoney(-selectedItem.price); //Remove money
    } else {
        giveDailyPotion(message, language, entity, customer, selectedItem);
    }

    await Promise.all([
        entity.save(),
        entity.Player.save(),
        entity.Player.Inventory.save(),
    ]);
}

/**
 * @param {*} name - The item name
 * @param {*} price - The item price
 * @param {*} info - The info to display while trying to buy the item
 */
async function confirmPurchase(message, language, name, price, info, entity, customer, selectedItem) {
    const confirmEmbed = new discord.MessageEmbed()
        .setColor(JsonReader.bot.embed.default)
        .setAuthor(
            format(JsonReader.commands.class.getTranslation(language).confirm, {
                pseudo: customer.username,
            }),
            customer.displayAvatarURL()
        )
        .setDescription(
            "\n\u200b\n" +
            format(JsonReader.commands.class.getTranslation(language).display, {
                name: name,
                price: price,
            }) +
            info
        );

    const confirmMessage = await message.channel.send(confirmEmbed);
    const filterConfirm = (reaction, user) => {
        return ((reaction.emoji.name === MENU_REACTION.ACCEPT || reaction.emoji.name === MENU_REACTION.DENY) && user.id === entity.discordUser_id);
    };

    const collector = confirmMessage.createReactionCollector(filterConfirm, {
        time: 120000,
        max: 1,
    });

    collector.on("end", async (reaction) => {
        removeBlockedPlayer(entity.discordUser_id);
        //confirmMessage.delete(); for now we'll keep the messages
        if (reaction.first()) {
            if (reaction.first().emoji.name === MENU_REACTION.ACCEPT) {
                reaction.first().message.delete();
                return sellItem(message, reaction, language, entity, customer, selectedItem);
            }
        }
        sendErrorMessage(customer, message.channel, language, JsonReader.commands.class.getTranslation(language).error.canceledPurchase);
    });

    await Promise.all([
        confirmMessage.react(MENU_REACTION.ACCEPT),
        confirmMessage.react(MENU_REACTION.DENY),
    ]);
}

/**
 * @param {*} price - The item price
 */
const canBuy = function (price, player) {
    return player.money >= price;
};

/********************************************************** GIVE FUNCTIONS **********************************************************/

/**
 * Give the daily potion to player
 */
function giveDailyPotion(message, language, entity, customer, dailyPotion) {
    entity.Player.Inventory.giveObject(
        dailyPotion.get("potion").id,
        ITEMTYPE.POTION
    ); //Give potion
    entity.Player.addMoney(-dailyPotion.get("price")); //Remove money
    entity.Player.Inventory.save(); //Save
    entity.Player.save(); //Save
    message.channel.send(
        new discord.MessageEmbed()
            .setColor(JsonReader.bot.embed.default)
            .setAuthor(
                format(JsonReader.commands.class.getTranslation(language).potion.give, {
                    pseudo: customer.username,
                }),
                customer.displayAvatarURL()
            )
            .setDescription(
                "\n\n" + dailyPotion.get("potion").toString(language)
            )
    );
}

/**
 * Clear all player alterations
 */
function healAlterations(message, language, entity, customer, selectedItem) {
    if (entity.effect !== EFFECT.DEAD && entity.effect !== EFFECT.LOCKED) {
        entity.effect = EFFECT.SMILEY;
        entity.Player.lastReportAt = new Date(message.createdTimestamp);
    }
    message.channel.send(
        new discord.MessageEmbed()
            .setColor(JsonReader.bot.embed.default)
            .setAuthor(
                format(JsonReader.commands.class.getTranslation(language).success, {
                    pseudo: customer.username,
                }),
                customer.displayAvatarURL()
            )
            .setDescription("\n\n" + selectedItem.give)
    );
}

/**
 * Completely restore player life
 */
function regenPlayer(message, language, entity, customer, selectedItem) {
    entity.setHealth(entity.maxHealth); //Heal Player
    message.channel.send(
        new discord.MessageEmbed()
            .setColor(JsonReader.bot.embed.default)
            .setAuthor(
                format(JsonReader.commands.class.getTranslation(language).success, {
                    pseudo: customer.username,
                }),
                customer.displayAvatarURL()
            )
            .setDescription("\n\n" + selectedItem.give)
    );
}

/**
 * Give "MoneyMouth" badge to the player
 */
function giveMoneyMouthBadge(message, language, entity, customer, selectedItem) {
    if (entity.Player.hasBadge("🤑")) {
        sendErrorMessage(customer, message.channel, language, JsonReader.commands.class.getTranslation(language).error.alreadyHasItem);
        return false;
    } else {
        entity.Player.addBadge("🤑"); //Give badge
        message.channel.send(
            new discord.MessageEmbed()
                .setColor(JsonReader.bot.embed.default)
                .setAuthor(
                    format(selectedItem.give, {
                        pseudo: customer.username,
                    }),
                    customer.displayAvatarURL()
                )
                .setDescription("\n\n" + selectedItem.name)
        );
        return true;
    }
}

/**
 * Give guild xp
 */
async function giveGuildXp(message, language, entity, customer, selectedItem) {
    try {
        const guild = await Guilds.getById(entity.Player.guild_id);
        const toAdd = randInt(50, 450);
        guild.addExperience(toAdd); //Add xp
        await guild.levelUpIfNeeded(message.channel, language);
        await guild.save();
        message.channel.send(
            new discord.MessageEmbed()
                .setColor(JsonReader.bot.embed.default)
                .setAuthor(
                    format(JsonReader.commands.class.getTranslation(language).success, {
                        pseudo: customer.username,
                    }),
                    customer.displayAvatarURL()
                )
                .setDescription(
                    "\n\n" +
                    format(selectedItem.give, {
                        experience: toAdd,
                    })
                )
        );
        return true
    } catch (err) {
        sendErrorMessage(customer, message.channel, language, JsonReader.commands.guild.getTranslation(language).noGuildException);
        return false;
    }
}

module.exports = {
    commands: [
        {
            name: 'class',
            func: ClassCommand,
            aliases: ['c']
        }
    ]
};