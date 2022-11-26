import selfcore from "selfcore";
import { CCA_SCRIM_ID, SIXMANS_SCRIM_ID, NACE_SCRIM_ID, BOT_TOKEN, GATEWAY_TOKEN } from "./config.json";

const client = new selfcore();
const gateway = new selfcore.Gateway(GATEWAY_TOKEN);

function parse(msg, author) {
    // Refer to lfs-messages.txt for in-depth approach behind this function
    // Define variables for our database
    let min_mmr = '';
    let max_mmr = '';
    let time = '';
    let timezone = '';
    let date = -1;
    let mmr_range = '';

    /**
     * Here are some common examples of messages
     * LFS 1800+ 9pm EST (CASE 1)
     * LFS 1800-1900 7pm EST (CASE 2)
     * LFS 1400 4pm PST (CASE 3)
     */
    // Check for +
    if (msg.includes('+')) {
        // We are safe to assume the max_mmr is infinite & the min_mmr are the 4 digits that precede the +
        max_mmr = "+";
        let plusIndex = msg.indexOf("+");
        min_mmr = msg.substring(plusIndex - 4, plusIndex);
        // Check if this substring contains ONLY numbers
        if (!(/^\d+$/.test(min_mmr))) {
            // We need to find the non-digit characters using common cases
            // CASE 1: 2k
            if (min_mmr.includes('k')) {
                let kIndex = min_mmr.indexOf('k');
                min_mmr = String(Number(min_mmr.substring(kIndex - 1, kIndex)) * 1000);
            }
            // CASE 2: min_mmr < 1000
            // NOTE: For now, this does NOT seem common enough to implement. This can be done at a later date
            // TODO: Find the time information
        }
    }
    else if (msg.includes('-')) {
        // Get the count of - in the string
        let dashCount = (msg.match(/-/g) || []).length;
        if (dashCount === 1) {
            // TODO
            // Confirm that this is the MMR Range and NOT the Time Range
            // Check the next 4 characters and confirm they are all digits
        }
        else {
            console.log('Unrecognized message input! Returning....');
            return;
        }
    }
    else {
        // TODO
        // MOST COMMON EXAMPLE: LFS MMR TIME DATE
        // Split on the spaces
    }

    // TODO: Return & Indicate bad input
    // Strategy: post these to the Bot Test Server to see what kind of formats are not working

}

gateway.on("message", msg => {
    let content = ''
    // CCA Discord
    if (msg.channel_id === CCA_SCRIM_ID) {
        content = msg.content ? msg.content : 'Message in CCA Discord was Embedded Message';
    }

    // RL 6mans NA
    else if (msg.channel_id === SIXMANS_SCRIM_ID) {
        content = msg.content ? msg.content : 'Message in RL 6mans NA Discord was Embedded Message';
    }

    // NACE
    else if (msg.channel_id === NACE_SCRIM_ID) {
        content = msg.content ? msg.content : 'Message in NACE Starleague Discord was Embedded Message';
    }

    if (content !== '') {
        // We found a message from one of the channels we are monitoring
        // See if it contains LFS before proceeding
        if (content.includes('LFS')) {
            // We know this message is LFS, so pass it to our parse function
            parse(content.toLowerCase(), msg.author);
        }
    }
    client.sendWebhook("https://discord.com/api/webhooks/1044425117641494618/lMSYrsrrHaalPHPsZO4zcL6ZWD44kJbd-rIFPE5jZmk-BRsvWQ6j-oYARcabKKkiDpPY", content);

});