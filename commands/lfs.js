import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Sequelize } from "sequelize";

// Connect to database
const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'scrims.sqlite',
});

const ScrimData = sequelize.define('scrim_data', {
    contact: {
        type: Sequelize.STRING,
    },
    mmr_range: {
        type: Sequelize.STRING,
    },
    time: {
        type: Sequelize.STRING,
    },
    timezone: {
        type: Sequelize.STRING,
    },
    day: {
        type: Sequelize.INTEGER,
    }
});

function removeUnique(arr, minCount) {
    let map = new Map();
    arr.forEach(e => map.set(e, (map.get(e) || 0) + 1));
    return arr.filter(e => map.get(e) > minCount);
}

export const LFS_COMMAND = {
    data: new SlashCommandBuilder()
        .setName('lfs')
        .setDescription('Look for scrimmages in the database. The more parameters passed in, the more precise the results.')
        .addStringOption(option => 
            option.setName('mmr_range')
                .setDescription('The MMR Range in one of the three formats (1) XXXX (2) XXXX-YYYY (3) XXXX+')
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('time')
                .setDescription('The time the scrimmage will take place in a format such as 7pm')
                .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('timezone')
                .setDescription('Your timezone so the search is the most accurate')
                .setRequired(false)
        )
        .addIntegerOption(option => 
            option.setName('day')
                .setDescription('Number of days from TODAY the scrim will take place (0 = today, 1 = tomorrow, etc.)')
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();
        await ScrimData.sync();
        // Error Embed in case we detect bad input
        const errorEmbed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle("ScrimBot - Bad Input")
            .setDescription("Detected bad input. Please try again!");
        // Get inputs and check input formats
        // Remember that we structured the database to always be our format
        const mmrRange = interaction.options.getString('mmr_range');
        let mmrCase = -1; // 1 = +, 2 = -, 3 = exact
        let minMMR = -1;
        let maxMMR = -1;
        let inputCount = 0;
        if (mmrRange) {
            inputCount += 1;
            if (mmrRange.includes('+')) {
                mmrCase = 1;
                minMMR = Number(mmrRange.substring(mmrRange.indexOf('+') - 4, mmrRange.indexOf('+')));
                maxMMR = 9999;
            }
            else if (mmrRange.includes('-')) {
                mmrCase = 2;
                minMMR = Number(mmrRange.substring(mmrRange.indexOf('-') - 4, mmrRange.indexOf('-')));
                maxMMR = Number(mmrRange.substring(mmrRange.indexOf('-') + 1, mmrRange.indexOf('-') + 5));
            }
            else {
                mmrCase = 3;
                // Check to make sure this is only digits
                if (/^\d+$/.test(mmrRange)) {
                    minMMR = Number(mmrRange);
                    maxMMR = Number(mmrRange);
                }
                else {
                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }
            }
        }

        const timeInput = interaction.options.getString('time');
        let hourVal = -1;
        let moa = '';
        if (timeInput) {
            inputCount += 1;
            if ((timeInput.includes('am') || timeInput.includes('pm')) && !timeInput.includes(':')) {
                if (timeInput.includes('am')) {
                    moa = 'am';
                }
                else if (timeInput.includes('pm')) {
                    moa = 'pm';
                }

                if ((timeInput.length === 4 && !/^\d+$/.test(timeInput.substring(0, 2))) || (timeInput.length === 3 && !/^\d+$/.test(timeInput.substring(0, 1)))) {
                    // Bad input
                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }
                else {
                    if (timeInput.length === 4 && /^\d+$/.test(timeInput.substring(0, 2))) {
                        hourVal = Number(timeInput.substring(0, 2));
                    }
                    else if (timeInput.length === 3 && /^\d+$/.test(timeInput.substring(0, 1))) {
                        hourVal = Number(timeInput.substring(0, 1));
                    }
                    else {
                        // Bad input
                        await interaction.editReply({ embeds: [errorEmbed] });
                        return;
                    }
                }
            }
            else {
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
        }

        const timeZoneInput = interaction.options.getString('timezone');
        if (timeZoneInput) {
            inputCount += 1;
            if (timeZoneInput !== 'est' || !timeZoneInput !== 'cst' || timeZoneInput !== 'pst') {
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
        }
        
        const daysInput = interaction.options.getInteger('day');
        if (daysInput) {
            inputCount += 1;
            if (daysInput < 0 || daysInput > 1) {
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
        }

        /**
         * All inputs checked, reaching here means that we are good to proceed based on info that we have.
         * We can get all the data that we have stored, then take the data that matches the user's input
         * and push it to an array that can be converted to an Embedded Message
         */
        let allScrims = await ScrimData.findAll();
        let obtainedData = [];
        let today = new Date();
        allScrims.forEach(scrim => {
            if (mmrRange) {
                // Convert MMR Range to Numbers so we can see if user input matches range
                // We have minMMR and maxMMR already set so we convert scrim.mmr_range and do the comparisons
                if (scrim.mmr_range.includes('+')) {
                    if (minMMR >= Number(scrim.mmr_range.substring(0, scrim.mmr_range.indexOf('+')))) {
                        obtainedData.push(scrim);
                    }
                }
                else if (scrim.mmr_range.includes('-')) {
                    if (minMMR >= Number(scrim.mmr_range.substring(0, scrim.mmr_range.indexOf('-'))) && maxMMR <= Number(scrim.mmr_range.substring(scrim.mmr_range.indexOf('-') + 1))) {
                        obtainedData.push(scrim);
                    }
                }
                else {
                    if (minMMR === Number(scrim.mmr_range)) {
                        obtainedData.push(scrim);
                    }
                }
            }
            if (timeInput) {
                // Convert hour value and compare
                if (timeZoneInput) {
                    let hourDiff = 0;
                    if (scrim.timezone === 'pst') {
                        if (timeZoneInput === 'pst') {
                            hourDiff = 0;
                        }
                        else if (timeZoneInput === 'cst') {
                            hourDiff = 1;
                        }
                        else if (timeZoneInput === 'est') {
                            hourDiff = 3;
                        }
                    }
                    else if (scrim.timezone === 'cst') {
                        if (timeZoneInput === 'pst') {
                            hourDiff = -2;
                        }
                        else if (timeZoneInput === 'cst') {
                            hourDiff = 0;
                        }
                        else if (timeZoneInput === 'est') {
                            hourDiff = 1;
                        }
                    }
                    else if (scrim.timezone === 'est') {
                        if (timeZoneInput === 'pst') {
                            hourDiff = -3;
                        }
                        else if (timeZoneInput === 'cst') {
                            hourDiff = -1;
                        }
                        else if (timeZoneInput === 'est') {
                            hourDiff = 0;
                        }
                    }

                    if (scrim.time.length === 4) {
                        if (hourVal === Number(scrim.time.substring(0, 2)) + hourDiff && moa === scrim.time.substring(2)) {
                            obtainedData.push(scrim);
                        }
                    }
                    else if (scrim.time.length === 3) {
                        if (hourVal === Number(scrim.time.substring(0, 1)) + hourDiff && moa === scrim.time.substring(1)) {
                            obtainedData.push(scrim);
                        }
                    }
                }
                else {
                    if (scrim.time.length === 4) {
                        if (hourVal === Number(scrim.time.substring(0, 2)) && moa === scrim.time.substring(2)) {
                            obtainedData.push(scrim);
                        }
                    }
                    else if (scrim.time.length === 3) {
                        if (hourVal === Number(scrim.time.substring(0, 1)) && moa === scrim.time.substring(1)) {
                            obtainedData.push(scrim);
                        }
                    }
                }
            }
            if (daysInput) {
                let t = new Date(scrim.createdAt);
                const diffTime = Math.abs(today - t);
                const numDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (daysInput - scrim.day === numDays) {
                    obtainedData.push(scrim);
                }
            }
        });

        if (inputCount > 0) {
            obtainedData = removeUnique(obtainedData, inputCount);
        }
        else {
            obtainedData = allScrims;
        }
        // Create return embed with the description being the found scrimmages
        const maxCharMessage = '\nTo refine the search, please provide more information for what scrimmage you are looking for!\n';
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('ScrimBot - Found Scrimmages');
        let descString = '';
        for (let i = 0; i < obtainedData.length; i++) {
            if (descString.length + maxCharMessage.length + 100 < 4050) {
                descString += "**" + String(obtainedData[i].mmr_range) + '** Scrimmage\n*Contact:* ' + String(obtainedData[i].contact) + '\n\n';
            }
            else {
                descString += maxCharMessage;
                break;
            }
        }

        embed.setDescription(descString);
        await interaction.editReply({embeds: [embed]});
    }
};