import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import moment from 'moment/min/moment-with-locales.js';

import progress from '../modules/progress-shard.mjs';
import gameData from '../modules/game-data.mjs';
import translations, { getFixedT, getCommandLocalizations } from '../modules/translations.mjs';

const MAX_ITEMS = 2;

const defaultFunction = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get an item\'s info about usage for quests, hideout, crafts, and barters')
        .setNameLocalizations(getCommandLocalizations('info'))
        .setDescriptionLocalizations(getCommandLocalizations('info_desc'))
        .addStringOption(option => {
            return option.setName('name')
                .setDescription('Item name to search for')
                .setNameLocalizations(getCommandLocalizations('name'))
                .setDescriptionLocalizations(getCommandLocalizations('name_search_desc'))
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
        const matchedItems = items.filter(i => i.name.toLowerCase().includes(searchString.toLowerCase()));

        if (matchedItems.length === 0) {
            return interaction.editReply({
                content: t('Found no results for "{{searchString}}"', {
                    searchString: searchString
                }),
                ephemeral: true,
            });
        }

        let embeds = [];

        for (const item of matchedItems) {
            if (item.shortName.toLowerCase() === searchString) {
                matchedItems.length = 0;
                matchedItems.push(item);
                break;
            }
        }
        for (let i = 0; i < matchedItems.length; i = i + 1) {
            const item = matchedItems[i];
            const embed = new EmbedBuilder();

            let body = `\n`;
            embed.setTitle(item.name);
            embed.setURL(item.link);
            moment.locale(interaction.locale);
            embed.setFooter({text: `🕑 ${t('Last Updated')}: ${moment(item.updated).fromNow()}`});

            const prog = await progress.getSafeProgress(interaction.user.id);

            embed.setThumbnail(item.iconLink);

            //gives the quests the items are needed for and how many FIR/not
            let tasksString = '';
            for (const t of item.usedInTasks) {
                const task = tasks.find(tk => tk.id === t.id);
                let count = 0;
                let fir = false;

                for (const o of t.objectives){
                    if (typeof o.item !== 'undefined' && o.item.id === item.id && o.type !== 'findItem'){
                        count += o.count;
                        fir =  o.foundInRaid;
                    }

                }
                tasksString += task.name;
                tasksString += ' (';
                tasksString += count;
                if (fir === true){
                    tasksString += ' FIR';
                }
                tasksString += ')'
                tasksString += '\n'
                
            }
            if (tasksString !== ''){
                const title = "Quests"
                embed.addFields({name: title, value: tasksString});
            }
            

    

            //gives the hideout and level the items are needed for
            let hideoutString = '';
            for (const h of stations){
                for (const l of h.levels){
                    for (const i of l.itemRequirements){
                        if (i.item.id === item.id){
                            const hideoutName = h.name;
                            const hideoutLevel = l.level;
                            const hideoutCount = i.count;
                            hideoutString += hideoutCount;
                            hideoutString += " needed for ";
                            hideoutString += hideoutName;
                            hideoutString += " L";
                            hideoutString += hideoutLevel;
                            hideoutString += '\n';
                        }
                    }
                }
            }
            if (hideoutString !== ''){
                const title = "Hideout"
                embed.addFields({name: title, value: hideoutString});
            }

           


            // Add the item description
            embed.setDescription(body);

            embeds.push(embed);

            if (i >= MAX_ITEMS - 1) {
                break;
            }
        }

        if (MAX_ITEMS < matchedItems.length) {
            const ending = new EmbedBuilder();

            ending.setTitle("+" + (matchedItems.length - MAX_ITEMS) + ` ${t('more')}`);
            ending.setURL("https://tarkov.dev/?search=" + encodeURIComponent(searchString));

            let otheritems = '';
            for (let i = MAX_ITEMS; i < matchedItems.length; i = i + 1) {
                const item = matchedItems[i];
                const itemname = `[${matchedItems[i].name}](${matchedItems[i].link})`;

                if (itemname.length + 2 + otheritems.length > 2048) {
                    ending.setFooter({text: `${matchedItems.length-i} ${t('additional results not shown.')}`});

                    break;
                }

                otheritems += itemname + "\n";
            }

            ending.setDescription(otheritems);

            embeds.push(ending);
        }

        return interaction.editReply({ embeds: embeds });
    },
    examples: [
        '/$t(info) gas analyzer'
    ]
};

export default defaultFunction;


            
