import selfcore from "selfcore";
import { CCA_SCRIM_ID, SIXMANS_SCRIM_ID, NACE_SCRIM_ID, BOT_TOKEN, GATEWAY_TOKEN } from "./config.json";

const client = new selfcore();
const gateway = new selfcore.Gateway(GATEWAY_TOKEN);

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

    client.sendWebhook("https://discord.com/api/webhooks/1044425117641494618/lMSYrsrrHaalPHPsZO4zcL6ZWD44kJbd-rIFPE5jZmk-BRsvWQ6j-oYARcabKKkiDpPY", content);

});