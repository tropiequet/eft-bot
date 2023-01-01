import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import moment from 'moment/min/moment-with-locales.js';

import progress from '../modules/progress-shard.mjs';
import gameData from '../modules/game-data.mjs';
import translations, { getFixedT, getCommandLocalizations } from '../modules/translations.mjs';

const MAX_ITEMS = 2;

const defaultFunction = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('Get info about a quest')
        .setNameLocalizations(getCommandLocalizations('quest'))
        .setDescriptionLocalizations(getCommandLocalizations('quest_desc'))
        .addStringOption(option => {
            return option.setName('name')
                .setDescription('Quest name to search for')
                .setNameLocalizations(getCommandLocalizations('name'))
                .setDescriptionLocalizations(getCommandLocalizations('quest_search_desc'))
                .setAutocomplete(true)
                .setRequired(true);
        }),

    async execute(interaction) {
        await interaction.deferReply();
        const t = getFixedT(interaction.locale);
        // Get the search string from the user invoked command
        const searchString = interaction.options.getString('name');

        const [ items, traders, stations, barters, crafts, tasks ] = await Promise.all([
            gameData.items.getAll(interaction.locale),
            gameData.traders.getAll(interaction.locale),
            gameData.hideout.getAll(interaction.locale),
            gameData.barters.getAll(),
            gameData.crafts.getAll(),
            gameData.tasks.getAll(), //added this and tasks above in const[]
        ]);
        const matchedQuests = tasks.filter(t => t.name.toLowerCase().includes(searchString.toLowerCase()));

        if (matchedQuests.length === 0) {
            return interaction.editReply({
                content: t('Found no results for "{{searchString}}"', {
                    searchString: searchString
                }),
                ephemeral: true,
            });
        }

        let embeds = [];

        for (const quest of matchedQuests) {
            if (quest.name.toLowerCase() === searchString) {
                matchedQuests.length = 0;
                matchedQuests.push(quest);
                break;
            }
        }
        for (let i = 0; i < matchedQuests.length; i = i + 1) {
            const quest = matchedQuests[i];
            const embed = new EmbedBuilder();

            let body = `\n`;
            embed.setTitle(quest.name);
            embed.setURL(quest.wikiLink);
            moment.locale(interaction.locale);
            embed.setFooter({text: `🕑 ${t('Last Updated')}: ${moment(quest.updated).fromNow()}`});

            const prog = await progress.getSafeProgress(interaction.user.id);

            embed.setThumbnail(quest.iconLink);

            let title = '';


            const traderName = quest.trader.name;
            title = 'Given By'

            embed.addFields({name: title, value: traderName, inline: true});

            if (quest.map !== null){
                const questLocation = quest.map.name;
                title = 'Location'
    
                embed.addFields({name: title, value: questLocation, inline: true});
            }
            
            title = "Level Required";
            const minPlayerLevel = (quest.minPlayerLevel).toString();

            embed.addFields({name: title, value: minPlayerLevel, inline: true});

            title = "Objectives";
            let obj = '';

            for (const o of quest.objectives){
                obj += '• ';
                obj += o.description;

                if (o.count !== undefined){
                    obj += ' ('
                    obj += o.count;
                    obj += ')\n'
                }else{
                    obj +='\n'
                }
                
            }
            

            embed.addFields({name: title, value: obj});



            if (quest.neededKeys.length !== 0){
                title = "Required Keys"
                let keyString = '';
    
                for (const k of quest.neededKeys){
                    for (const key of k.keys){
                        keyString += '• ';
                        keyString += key.name;
                        keyString += '\n'
                    }   
                }
    
                embed.addFields({name: title, value: keyString});
            }

            const finishRewards = quest.finishRewards;
            let rewards = ''
            title = 'Rewards'

            if (quest.experience !== 0){
                rewards += '• +';
                rewards += quest.experience;
                rewards += " EXP\n"

            }
            
            if (finishRewards.traderStanding.length !== 0){
                for (const t of finishRewards.traderStanding){
                    const trader = t.trader.name;
                    const xp = t.standing;
                    rewards += '• ';
                    rewards += trader;
                    rewards += ' Rep +';
                    rewards += xp;
                    rewards += '\n'
                }
            }

            if (finishRewards.items.length !==0){
                for (const i of finishRewards.items){
                    const name = i.item.name;
                    const count = i.count;
                    rewards += '• ';
                    rewards += count;
                    rewards += ' ';
                    rewards += name;
                    rewards += '\n'
                }
            }


            if (finishRewards.offerUnlock.length !== 0){
                for (const o of finishRewards.offerUnlock){
                    const trader = o.trader.name;
                    const level = o.level;
                    const item = o.item.name;
                    rewards += '• Unlocks purchase of ';
                    rewards += item;
                    rewards += ' at ';
                    rewards += trader;
                    rewards += " L";
                    rewards += level;
                    rewards += '\n'
                }
            }

            embed.addFields({name: title, value: rewards});
           



            
            
            
            

            



            








            
           


            // Add the item description
            embed.setDescription(body);

            embeds.push(embed);

            if (i >= MAX_ITEMS - 1) {
                break;
            }
        }

        if (MAX_ITEMS < matchedQuests.length) {
            const ending = new EmbedBuilder();

            ending.setTitle("+" + (matchedQuests.length - MAX_ITEMS) + ` ${t('more')}`);
            ending.setURL("https://tarkov.dev/?search=" + encodeURIComponent(searchString));

            let otheritems = '';
            for (let i = MAX_ITEMS; i < matchedQuests.length; i = i + 1) {
                const quest = matchedQuests[i];
                const questname = `[${matchedQuests[i].name}](${matchedQuests[i].link})`;

                if (questname.length + 2 + otheritems.length > 2048) {
                    ending.setFooter({text: `${matchedQuests.length-i} ${t('additional results not shown.')}`});

                    break;
                }

                otheritems += questname + "\n";
            }

            ending.setDescription(otheritems);

            embeds.push(ending);
        }

        return interaction.editReply({ embeds: embeds });
    },
    examples: [
        '/$t(quest) Shooter Born in Heaven'
    ]
};

export default defaultFunction;


            
