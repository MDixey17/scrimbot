import selfcore from "selfcore";
import ENV from "./config.json";
import { Sequelize } from "sequelize";
import { Client, GatewayIntentBits, Events, Collection, EmbedBuilder } from "discord.js";
import { LFS_COMMAND } from "./commands/lfs.js";
import { RESET_COMMAND } from "./commands/reset.js";

const client = new selfcore();
const gateway = new selfcore.Gateway(ENV.GATEWAY_TOKEN);

// Connect to Discord
const discord_client = new Client({ intents: [GatewayIntentBits.Guilds]});
discord_client.commands = new Collection();

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

// Remove old scrimmages from the database
async function removeScrims() {
    await ScrimData.sync();
    const today = new Date();
    const todayDD = Number(String(today.getDate()).padStart(2, '0'));
    const todayMM = Number(String(today.getMonth() + 1).padStart(2, '0'));
    const todayYYYY = today.getFullYear();
    let allScrims = await ScrimData.findAll();
    let scrimsToDelete = []; // createdAt
    let deleteCount = 0;
    allScrims.forEach(scrim => {
        const t = new Date(scrim.createdAt);
        const tDD = Number(String(t.getDate()).padStart(2, '0'));
        const tMM = Number(String(t.getMonth() + 1).padStart(2, '0'));
        const tYYYY = t.getFullYear();
        // Get the dd value of both today and t
        /**
         * If difference of today - (t + scrim.day) <= 0 --> Don't delete
         * Else --> Mark it to be deleted
         */

        // EDGE CASE: New Month or New Year
        if (tDD > todayDD) { 
            // Is this a new month
            if (tMM < todayMM) {
                // Yes, this is a new month so our if statement needs to account for at least 27 days
                if ((tDD + scrim.day) - todayDD > 25) {
                    scrimsToDelete.push(scrim.createdAt);
                }
            }
            else {
                // Is this a new year
                if (tYYYY < todayYYYY) {
                    // Yes, this is a new year
                    if ((tDD + scrim.day) - todayDD > 28) {
                        scrimsToDelete.push(scrim.createdAt);
                    }
                }
                else {
                    // This is weird, log it and return
                    console.log(`Found weird date:\nEntry createdAt: ${tMM}-${tDD}-${tYYYY}\nToday's Date: ${todayMM}-${todayDD}-${todayYYYY}`);
                    return;
                }
            }
        }
        else {
            // We can proceed with the general case
            if (todayDD - (tDD + scrim.day) > 0) {
                scrimsToDelete.push(scrim.createdAt);
            }
        }

    });

    for (let i = 0; i < scrimsToDelete.length; i++) {
        const numRowsDeleted = await ScrimData.destroy({ where: {createdAt: scrimsToDelete[i] }});
        deleteCount += numRowsDeleted;
    }

    console.log('Scrimmages Removed:', deleteCount);
}

async function checkDuplicates(contact, mmrRange, time, timezone, day) {
    await ScrimData.sync();
    let allScrims = await ScrimData.findAll();
    allScrims.forEach(scrim => {
        if (scrim.contact === contact && scrim.mmr_range === mmrRange && scrim.time === time && scrim.timezone === timezone && scrim.day === day) {
            return true; // Found a duplicate LFS message, so we DO NOT want to add it
        }
    });
    return false; // Not a duplicate LFS message
}

// Get the number of days if a day of the week is given
function getNumDays(inputDay) {
    const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const today = new Date();
    const todayWeekday = weekdays[today.getDay()];
    // CASE: 6 Days
    if ((inputDay === 'sunday' && todayWeekday === 'Monday') || (inputDay === 'monday' && todayWeekday === 'Tuesday') || (inputDay === 'tuesday' && todayWeekday === 'Wednesday') || (inputDay === 'wednesday' && todayWeekday === 'Thursday') || (inputDay === 'thursday' && todayWeekday === 'Friday') || (inputDay === 'friday' && todayWeekday === 'Saturday') || (inputDay === 'saturday' && todayWeekday === 'Sunday')) {
        return 6;
    }
    // CASE: 5 Days
    else if ((inputDay === 'sunday' && todayWeekday === 'Tuesday') || (inputDay === 'monday' && todayWeekday === 'Wednesday') || (inputDay === 'tuesday' && todayWeekday === 'Thursday') || (inputDay === 'wednesday' && todayWeekday === 'Friday') || (inputDay === 'thursday' && todayWeekday === 'Saturday') || (inputDay === 'friday' && todayWeekday === 'Sunday') || (inputDay === 'saturday' && todayWeekday === 'Monday')) {
        return 5;
    }
    // CASE: 4 Days
    else if ((inputDay === 'sunday' && todayWeekday === 'Wednesday') || (inputDay === 'monday' && todayWeekday === 'Thursday') || (inputDay === 'tuesday' && todayWeekday === 'Friday') || (inputDay === 'wednesday' && todayWeekday === 'Saturday') || (inputDay === 'thursday' && todayWeekday === 'Sunday') || (inputDay === 'friday' && todayWeekday === 'Monday') || (inputDay === 'saturday' && todayWeekday === 'Tuesday')) {
        return 4;
    }
    // CASE: 3 Days
    else if ((inputDay === 'sunday' && todayWeekday === 'Thursday') || (inputDay === 'monday' && todayWeekday === 'Friday') || (inputDay === 'tuesday' && todayWeekday === 'Saturday') || (inputDay === 'wednesday' && todayWeekday === 'Sunday') || (inputDay === 'thursday' && todayWeekday === 'Monday') || (inputDay === 'friday' && todayWeekday === 'Tuesday') || (inputDay === 'saturday' && todayWeekday === 'Wednesday')) {
        return 3;
    }
    // CASE: 2 Days
    else if ((inputDay === 'sunday' && todayWeekday === 'Friday') || (inputDay === 'monday' && todayWeekday === 'Saturday') || (inputDay === 'tuesday' && todayWeekday === 'Sunday') || (inputDay === 'wednesday' && todayWeekday === 'Monday') || (inputDay === 'thursday' && todayWeekday === 'Tuesday') || (inputDay === 'friday' && todayWeekday === 'Wednesday') || (inputDay === 'saturday' && todayWeekday === 'Thursday')) {
        return 2;
    }
    // CASE: 1 Day
    else if ((inputDay === 'sunday' && todayWeekday === 'Saturday') || (inputDay === 'monday' && todayWeekday === 'Sunday') || (inputDay === 'tuesday' && todayWeekday === 'Monday') || (inputDay === 'wednesday' && todayWeekday === 'Tuesday') || (inputDay === 'thursday' && todayWeekday === 'Wednesday') || (inputDay === 'friday' && todayWeekday === 'Thursday') || (inputDay === 'saturday' && todayWeekday === 'Friday')) {
        return 1;
    } 
    return 0;
}

// Parse the data received from the selfcore listener
async function parse(msg, author) {
    // Refer to lfs-messages.txt for in-depth approach behind this function
    // Define variables for our database
    let min_mmr = '';
    let max_mmr = '';
    let time = '';
    let timezone = '';
    let date = 0;
    let mmr_range = '';

    /**
     * Here are some common examples of messages
     * LFS 1800+ 9pm EST (CASE 1)
     * LFS 1800-1900 7pm EST (CASE 2)
     * LFS 1400 4pm PST (CASE 3)
     */
    if (msg.includes('+')) {
        // We are safe to assume the max_mmr is infinite
        max_mmr = "+";
        let plusIndex = msg.indexOf("+");
        min_mmr = msg.substring(plusIndex - 4, plusIndex);
        // Check if this substring contains ONLY numbers
        if (!(/^\d+$/.test(min_mmr))) {
            // We need to find the non-digit characters using common cases
            // CASE: 2k
            if (min_mmr.includes('k')) {
                let kIndex = min_mmr.indexOf('k');
                min_mmr = String(Number(min_mmr.substring(kIndex - 1, kIndex)) * 1000);
            }
        }
    }
    else if (msg.includes('-')) {
        // Get the count of - in the string
        let dashCount = (msg.match(/-/g) || []).length;
        if (dashCount === 1) {
            // Confirm that this is the MMR Range and NOT the Time Range
            // Check the next 4 characters and confirm they are all digits
            let dashIndex = msg.indexOf('-');
            if (/^\d+$/.test(msg.substring(dashIndex + 1, dashIndex + 5))) { //1400-1700
                min_mmr = msg.substring(dashIndex - 4, dashIndex);
                max_mmr = msg.substring(dashIndex + 1, dashIndex + 5);
            }
        }
        // else if (dashCount === 2) {

        // }
        else {
            console.log('Unrecognized message input! Returning....');
            return;
        }
    }
    else {
        // MOST COMMON EXAMPLE: LFS MMR TIME TIMEZONE DATE
        // Split on the spaces
        let msgPieces = msg.split(' '); // [LFS, MMR, TIME, TIMEZONE, DATE]
        for (let i = 1; i < msgPieces.length; i++) {
            if (/^\d+$/.test(msgPieces[i])) {
                // MMR
                mmr_range = msgPieces[i];
                break;
            }
        }
    }

    // Get the timezone
    if (timezone === '') {
        if (msg.includes('est')) {
            timezone = 'est';
        }
        else if (msg.includes('cst')) {
            timezone = 'cst';
        }
        else if (msg.includes('pst')) {
            timezone = 'pst';
        }
    }

    // Get Time
    if (time === '') {
        if (!msg.includes(':')) {
            if (msg.includes('pm')) {
                let pmIndex = msg.indexOf('pm');
                // Check if hour is 2 digits
                if (/^\d+$/.test(msg.substring(pmIndex - 2, pmIndex))) {
                    // This is 2 digits
                    time = msg.substring(pmIndex - 2, pmIndex + 2);
                }
                else {
                    // This is 1 digit
                    time = msg.substring(pmIndex - 1, pmIndex + 2);
                }
            }
            else if (msg.includes('am')) {
                let amIndex = msg.indexOf('am');
                // Check if hour is 2 digits
                if (/^\d+$/.test(msg.substring(amIndex - 2, amIndex))) {
                    // This is 2 digits
                    time = msg.substring(amIndex - 2, amIndex + 2);
                }
                else {
                    // This is 1 digit
                    time = msg.substring(amIndex - 1, amIndex + 2);
                }
            }
        }
    }

    // Get Day
    if (msg.includes('rn') || msg.includes('now')) {
        date = 0;
    }
    else if (msg.includes('tonight')) {
        date = 0;
    }
    else if (msg.includes('tomorrow') || msg.includes('tom')) {
        date = 1;
    }
    else if (msg.includes('monday')) {
        date = getNumDays('monday');
    }
    else if (msg.includes('tuesday')) {
        date = getNumDays('tuesday');
    }
    else if (msg.includes('wednesday')) {
        date = getNumDays('wednesday');
    }
    else if (msg.includes('thursday')) {
        date = getNumDays('thursday');
    }
    else if (msg.includes('friday')) {
        date = getNumDays('friday');
    }
    else if (msg.includes('saturday')) {
        date = getNumDays('saturday');
    }
    else if (msg.includes('sunday')) {
        date = getNumDays('sunday');
    }

    // Compute actual MMR Range
    if (min_mmr !== '' && max_mmr !== '' && mmr_range === '') {
        if (max_mmr === "+") {
            mmr_range = min_mmr + "+";
        }
        else {
            mmr_range = min_mmr + "-" + max_mmr;
        }
    }

    // Strategy: post these to the Bot Test Server to see what kind of formats are not working
    // Check all variables
    if (mmr_range !== '' && time !== '' && timezone !== '') {
        if (!(await checkDuplicates(author, mmr_range, time, timezone, date))) {
            // Add to database
            await ScrimData.sync();
            const scrim = await ScrimData.create({
                contact: author,
                mmr_range: mmr_range,
                time: time,
                timezone: timezone,
                day: date,
            });
        }
        else {
            console.log('Found duplicate scrim. Ignoring!');
        }
    }
    else {
        // Post msg to private Discord
        client.sendWebhook(ENV.WEBHOOK_LINK, msg);
    }


}

// Listen to messages in each of the servers
gateway.on("message", msg => {
    let content = ''
    // // CCA Discord
    // if (msg.channel_id === ENV.CCA_SCRIM_ID) {
    //     content = msg.content ? msg.content : 'Message in CCA Discord was Embedded Message';
    // }

    // // RL 6mans NA
    // else if (msg.channel_id === ENV.SIXMANS_SCRIM_ID) {
    //     content = msg.content ? msg.content : 'Message in RL 6mans NA Discord was Embedded Message';
    // }

    // // NACE
    // else if (msg.channel_id === ENV.NACE_SCRIM_ID) {
    //     content = msg.content ? msg.content : 'Message in NACE Starleague Discord was Embedded Message';
    // }

    // TEST SERVER
    if (msg.channel_id === ENV.TEST_SERVER_ID) {
        content = msg.content ? msg.content : 'Message in Test Server Discord was Embedded Message';
    }

    if (content !== '') {
        // We found a message from one of the channels we are monitoring
        // See if it contains LFS before proceeding
        if (content.toLowerCase().includes('lfs')) {
            // We know this message is LFS, so pass it to our parse function
            try {
                parse(content.toLowerCase(), msg.author.username + "#" + msg.author.discriminator);
            } catch (err) {
                console.log(err);
            }
            
        }
    }
});

// Trigger when the bot is ready
discord_client.once('ready', async () => {
    console.log('ScrimBot online!');
});

// Handle Commands
discord_client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    // Remove all old scrimmages from the database
    await removeScrims();

    // Make sure commands are only executed via the #lf-scrim channel
    if (interaction.channel.name !== "lf-scrim") {
        const channelEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('ScrimBot - Wrong Channel')
            .setDescription('Please use the #lf-scrim channel')
        await interaction.reply({ embeds: [channelEmbed] });
        return;
    }

    try {
        if (interaction.commandName === 'lfs') {
            await LFS_COMMAND.execute(interaction);
        }
        else if (interaction.commandName === 'reset') {
            await RESET_COMMAND.execute(interaction);
        }
        else {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
    } catch (err) {
        console.error(err);
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('ScrimBot - Error')
            .setDescription('There was an error while executing this command!');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true});
    }
})

// Log in to Discord
discord_client.login(ENV.BOT_TOKEN);