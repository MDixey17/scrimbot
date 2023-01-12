import ENV from "./config.json" assert { type: "json" };
import { Sequelize } from "sequelize";
import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  EmbedBuilder,
} from "discord.js";
import { LFS_COMMAND } from "./commands/lfs.js";
import { RESET_COMMAND } from "./commands/reset.js";
import WebSocket from "ws";

const initialUrl = "wss://gateway.discord.gg";
let url = initialUrl,
  session_id = "";
let ws; // = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
let interval = 0,
  seq = -1;

let payload = {
  op: 2,
  d: {
    token: ENV.GATEWAY_TOKEN,
    intents: 33280,
    properties: {
      $os: "linux",
      $browser: "chrome",
      $device: "chrome",
    },
  },
};

const heartbeat = (ms) => {
  return setInterval(() => {
    ws.send(JSON.stringify({ op: 1, d: null }));
  }, ms);
};

const initializeWebsocket = () => {
  if (ws && ws.readyState !== 3) ws.close();

  let wasReady = false;

  ws = new WebSocket(url + "/?v=10&encoding=json");

  ws.on("open", function open() {
    if (url !== initialUrl) {
      const resumePayload = {
        op: 6,
        d: {
          token: ENV.GATEWAY_TOKEN,
          session_id,
          seq,
        },
      };

      ws.send(JSON.stringify(resumePayload));
    }
  });

  ws.on("error", function error(e) {
    //console.log(e);
  });

  ws.on("close", function close() {
    if (wasReady) console.log("Gateway connection closed, trying to reconnect");

    setTimeout(() => {
      initializeWebsocket();
    }, 2500);
  });

  // Listen to messages in each of the servers
  ws.on("message", function incoming(data) {
    let p = JSON.parse(data);
    const { t, op, d, s } = p;

    switch (op) {
      case 10:
        const { heartbeat_interval } = d;
        interval = heartbeat(heartbeat_interval);
        wasReady = true;

        // Only send IDENTIFY payload on a new connection, NOT on resume (causes a disconnect)
        if (url === initialUrl) ws.send(JSON.stringify(payload));
        break;
      case 0:
        seq = s;
        break;
    }

    switch (t) {
      case "READY":
        console.log("Gateway connection ready!");
        url = d.resume_gateway_url;
        session_id = d.session_id;
        break;

      case "RESUMED":
        console.log("Gateway connection resumed!");
        break;

      case "MESSAGE_CREATE":
        let author = d.author.username;
        let disc = d.author.discriminator;
        let content = d.content;
        //console.log(`${author}#${disc}: ${content}`);
        let msg_channel_id = d.channel_id;
        if (
          msg_channel_id === ENV.CCA_SCRIM_ID ||
          msg_channel_id === ENV.NACE_SCRIM_ID ||
          msg_channel_id === ENV.SIXMANS_SCRIM_ID ||
          msg_channel_id === ENV.TEST_SERVER_ID
        ) {
          try {
            if (content.toLowerCase().includes("lfs")) {
              if (msg_channel_id === ENV.CCA_SCRIM_ID) {
                // console.log(`Found message in CCA Scrimmage Channel - ${author}#${disc}: ${content}`);
                discord_client.channels.cache
                  .get(ENV.MISSED_SCRIM_ID)
                  .send("Found message in CCA Scrimmage Channel");
                parse(content.toLowerCase(), author + "#" + disc);
              } else if (msg_channel_id === ENV.NACE_SCRIM_ID) {
                // console.log(`Found message in NACE Scrimmage Channel - ${author}#${disc}: ${content}`);
                discord_client.channels.cache
                  .get(ENV.MISSED_SCRIM_ID)
                  .send("Found message in NACE Scrimmage Channel");
                parse(content.toLowerCase(), author + "#" + disc);
              } else if (msg_channel_id === ENV.SIXMANS_SCRIM_ID) {
                //console.log('Found message in RL 6mans Scrimmage Channel');
                discord_client.channels.cache
                  .get(ENV.MISSED_SCRIM_ID)
                  .send("Found message in RL 6mans Scrimmage Channel");
                parse(content.toLowerCase(), author + "#" + disc);
              } else if (msg_channel_id === ENV.TEST_SERVER_ID) {
                //console.log('Found message in Test Server Channel');
                parse(content.toLowerCase(), author + "#" + disc);
              }
            }
            else if (d.embeds.length > 0) {
              // Check to make sure its from a server we recognize
              // 6mans
              if (msg_channel_id === ENV.SIXMANS_SCRIM_ID) {
                discord_client.channels.cache
                  .get(ENV.MISSED_SCRIM_ID)
                  .send("Found EMBEDDED message in RL 6mans Scrimmage Channel");
                parseEmbeds(d.embeds);
              }
            }
          } catch (err) {
            console.log(err);
          }
        }
        break;
    }
  });
};

initializeWebsocket();

// Connect to Discord
const discord_client = new Client({ intents: [GatewayIntentBits.Guilds] });
discord_client.commands = new Collection();

// Connect to database
const sequelize = new Sequelize("database", "user", "password", {
  host: "localhost",
  dialect: "sqlite",
  logging: false,
  storage: "scrims.sqlite",
});

const ScrimData = sequelize.define("scrim_data", {
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
  },
});

// Remove old scrimmages from the database
async function removeScrims() {
  await ScrimData.sync();
  const today = new Date();
  //today.setHours(today.getHours() - 6);
  const todayDD = Number(String(today.getDate()).padStart(2, "0"));
  const todayMM = Number(String(today.getMonth() + 1).padStart(2, "0"));
  const todayYYYY = today.getFullYear();
  let allScrims = await ScrimData.findAll();
  let scrimsToDelete = []; // createdAt
  let deleteCount = 0;
  for(let scrim in allScrims) {
    const t = new Date(scrim.createdAt);
    const tDD = Number(String(t.getDate()).padStart(2, "0"));
    const tMM = Number(String(t.getMonth() + 1).padStart(2, "0"));
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
        if (tDD + scrim.day - todayDD > 25) {
          scrimsToDelete.push(scrim.createdAt);
        }
      } else {
        // Is this a new year
        if (tYYYY < todayYYYY) {
          // Yes, this is a new year
          if (tDD + scrim.day - todayDD > 28) {
            scrimsToDelete.push(scrim.createdAt);
          }
        } else {
          // This is weird, log it and return
          console.log(
            `Found weird date:\nEntry createdAt: ${tMM}-${tDD}-${tYYYY}\nToday's Date: ${todayMM}-${todayDD}-${todayYYYY}`
          );
          return;
        }
      }
    } else {
      // We can proceed with the general case
      if (todayDD - (tDD + scrim.day) > 0) {
        scrimsToDelete.push(scrim.createdAt);
      }
    }
  }

  for (let i = 0; i < scrimsToDelete.length; i++) {
    const numRowsDeleted = await ScrimData.destroy({
      where: { createdAt: scrimsToDelete[i] },
    });
    deleteCount += numRowsDeleted;
  }

  console.log("Scrimmages Removed:", deleteCount);
}

async function checkDuplicates(contact, mmrRange, time, timezone, day) {
  await ScrimData.sync();
  let allScrims = await ScrimData.findAll();
  for(let i = 0; i < allScrims.length; i++) {
    if (
      allScrims[i].contact === contact &&
      allScrims[i].mmr_range === mmrRange.toLowerCase() &&
      allScrims[i].time === time.toLowerCase() &&
      allScrims[i].timezone === timezone.toLowerCase() &&
      allScrims[i].day === day
    ) {
      return true; // Found a duplicate LFS message, so we DO NOT want to add it
    }
  }
  return false; // Not a duplicate LFS message
}

// Get the number of days if a day of the week is given
function getNumDays(inputDay) {
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = new Date();
  const todayWeekday = weekdays[today.getDay()];
  // CASE: 6 Days
  if (
    (inputDay === "sunday" && todayWeekday === "Monday") ||
    (inputDay === "monday" && todayWeekday === "Tuesday") ||
    (inputDay === "tuesday" && todayWeekday === "Wednesday") ||
    (inputDay === "wednesday" && todayWeekday === "Thursday") ||
    (inputDay === "thursday" && todayWeekday === "Friday") ||
    (inputDay === "friday" && todayWeekday === "Saturday") ||
    (inputDay === "saturday" && todayWeekday === "Sunday")
  ) {
    return 6;
  }
  // CASE: 5 Days
  else if (
    (inputDay === "sunday" && todayWeekday === "Tuesday") ||
    (inputDay === "monday" && todayWeekday === "Wednesday") ||
    (inputDay === "tuesday" && todayWeekday === "Thursday") ||
    (inputDay === "wednesday" && todayWeekday === "Friday") ||
    (inputDay === "thursday" && todayWeekday === "Saturday") ||
    (inputDay === "friday" && todayWeekday === "Sunday") ||
    (inputDay === "saturday" && todayWeekday === "Monday")
  ) {
    return 5;
  }
  // CASE: 4 Days
  else if (
    (inputDay === "sunday" && todayWeekday === "Wednesday") ||
    (inputDay === "monday" && todayWeekday === "Thursday") ||
    (inputDay === "tuesday" && todayWeekday === "Friday") ||
    (inputDay === "wednesday" && todayWeekday === "Saturday") ||
    (inputDay === "thursday" && todayWeekday === "Sunday") ||
    (inputDay === "friday" && todayWeekday === "Monday") ||
    (inputDay === "saturday" && todayWeekday === "Tuesday")
  ) {
    return 4;
  }
  // CASE: 3 Days
  else if (
    (inputDay === "sunday" && todayWeekday === "Thursday") ||
    (inputDay === "monday" && todayWeekday === "Friday") ||
    (inputDay === "tuesday" && todayWeekday === "Saturday") ||
    (inputDay === "wednesday" && todayWeekday === "Sunday") ||
    (inputDay === "thursday" && todayWeekday === "Monday") ||
    (inputDay === "friday" && todayWeekday === "Tuesday") ||
    (inputDay === "saturday" && todayWeekday === "Wednesday")
  ) {
    return 3;
  }
  // CASE: 2 Days
  else if (
    (inputDay === "sunday" && todayWeekday === "Friday") ||
    (inputDay === "monday" && todayWeekday === "Saturday") ||
    (inputDay === "tuesday" && todayWeekday === "Sunday") ||
    (inputDay === "wednesday" && todayWeekday === "Monday") ||
    (inputDay === "thursday" && todayWeekday === "Tuesday") ||
    (inputDay === "friday" && todayWeekday === "Wednesday") ||
    (inputDay === "saturday" && todayWeekday === "Thursday")
  ) {
    return 2;
  }
  // CASE: 1 Day
  else if (
    (inputDay === "sunday" && todayWeekday === "Saturday") ||
    (inputDay === "monday" && todayWeekday === "Sunday") ||
    (inputDay === "tuesday" && todayWeekday === "Monday") ||
    (inputDay === "wednesday" && todayWeekday === "Tuesday") ||
    (inputDay === "thursday" && todayWeekday === "Wednesday") ||
    (inputDay === "friday" && todayWeekday === "Thursday") ||
    (inputDay === "saturday" && todayWeekday === "Friday")
  ) {
    return 1;
  }
  return 0;
}

// Parse the data received from the selfcore listener
async function parse(msg, author) {
  // Refer to lfs-messages.txt for in-depth approach behind this function
  // Define variables for our database
  let min_mmr = "";
  let max_mmr = "";
  let time = "";
  let timezone = "";
  let date = 0;
  let mmr_range = "";

  /**
   * Here are some common examples of messages
   * LFS 1800+ 9pm EST (CASE 1)
   * LFS 1800-1900 7pm EST (CASE 2)
   * LFS 1400 4pm PST (CASE 3)
   */
  if (msg.includes("+")) {
    // We are safe to assume the max_mmr is infinite
    max_mmr = "+";
    let plusIndex = msg.indexOf("+");
    min_mmr = msg.substring(plusIndex - 4, plusIndex);
    // Check if this substring contains ONLY numbers
    if (!/^\d+$/.test(min_mmr)) {
      // We need to find the non-digit characters using common cases
      // CASE: 2k
      if (min_mmr.includes("k")) {
        let kIndex = min_mmr.indexOf("k");
        min_mmr = String(Number(min_mmr.substring(kIndex - 1, kIndex)) * 1000);
      }
      else {
        min_mmr = "";
      }
    }
  } else if (msg.includes("-")) {
    // Get the count of - in the string
    let dashCount = (msg.match(/-/g) || []).length;
    if (dashCount === 1) {
      // Confirm that this is the MMR Range and NOT the Time Range
      // Check the next 4 characters and confirm they are all digits
      let dashIndex = msg.indexOf("-");
      if (/^\d+$/.test(msg.substring(dashIndex + 1, dashIndex + 5))) {
        //1400-1700
        min_mmr = msg.substring(dashIndex - 4, dashIndex);
        max_mmr = msg.substring(dashIndex + 1, dashIndex + 5);
      }
    }
    // else if (dashCount === 2) {

    // }
    else {
      console.log("Unrecognized message input! Returning....");
      return;
    }
  } else {
    // MOST COMMON EXAMPLE: LFS MMR TIME TIMEZONE DATE
    // Split on the spaces
    let msgPieces = msg.split(" "); // [LFS, MMR, TIME, TIMEZONE, DATE]
    for (let i = 1; i < msgPieces.length; i++) {
      if (/^\d+$/.test(msgPieces[i])) {
        // MMR
        mmr_range = msgPieces[i];
        break;
      } else if (msgPieces[i].includes("k")) {
        const kIndex = msgPieces[i].indexOf("k");
        if (/^\d+$/.test(msgPieces[i].substring(0, kIndex))) {
          mmr_range = Number(msgPieces[i].substring(0, kIndex)) * 1000;
          break;
        }
      }
    }
  }

  // Get the timezone
  if (timezone === "") {
    if (msg.includes("est") || msg.includes("eastern")) {
      timezone = "est";
    } else if (msg.includes("cst") || msg.includes("central")) {
      timezone = "cst";
    } else if (msg.includes("pst") || msg.includes("pacific")) {
      timezone = "pst";
    }
  }

  // Get Time
  if (time === "") {
    if (!msg.includes(":")) {
      if (msg.includes("pm")) {
        let pmIndex = msg.indexOf("pm");
        // Check if hour is 2 digits
        if (/^\d+$/.test(msg.substring(pmIndex - 2, pmIndex))) {
          // This is 2 digits
          time = msg.substring(pmIndex - 2, pmIndex + 2);
        } else if (/^\d+$/.test(msg.substring(pmIndex - 1, pmIndex))) {
          // This is 1 digit
          time = msg.substring(pmIndex - 1, pmIndex + 2);
        }
      } else if (msg.includes("am")) {
        let amIndex = msg.indexOf("am");
        // Check if hour is 2 digits
        if (/^\d+$/.test(msg.substring(amIndex - 2, amIndex))) {
          // This is 2 digits
          time = msg.substring(amIndex - 2, amIndex + 2);
        } else if (/^\d+$/.test(msg.substring(amIndex - 1, amIndex))) {
          // This is 1 digit
          time = msg.substring(amIndex - 1, amIndex + 2);
        }
      } else {
        // Message does NOT have AM or PM, so we can assume PM
        let msgPieces = msg.split(" "); // [LFS, MMR, TIME, TIMEZONE, DATE]
        for (let i = 1; i < msgPieces.length; i++) {
          if (msgPieces[i].length <= 2 && /^\d+$/.test(msgPieces[i])) {
            time = msgPieces[i] + "pm";
          }
        }
      }
    } else {
      const colonIndex = msg.indexOf(":");
      if (
        /^\d+$/.test(msg.substring(colonIndex - 1, colonIndex)) &&
        /^\d+$/.test(msg.substring(colonIndex + 1, colonIndex + 3))
      ) {
        // Check if 1 or 2 digits before colon
        if (/^\d+$/.test(msg.substring(colonIndex - 2, colonIndex))) {
          // 2 Digits
          if (
            msg.substring(colonIndex + 3, colonIndex + 5) === "pm" ||
            msg.substring(colonIndex + 3, colonIndex + 5) === "am"
          ) {
            time = msg.substring(colonIndex - 2, colonIndex + 5);
          } else {
            time = msg.substring(colonIndex - 2, colonIndex + 3) + "pm";
          }
        } else {
          // 1 Digit
          if (
            msg.substring(colonIndex + 3, colonIndex + 5) === "pm" ||
            msg.substring(colonIndex + 3, colonIndex + 5) === "am"
          ) {
            time = msg.substring(colonIndex - 1, colonIndex + 5);
          } else {
            time = msg.substring(colonIndex - 1, colonIndex + 3) + "pm";
          }
        }
      }
    }
  }

  // Get Day
  if (msg.includes("rn") || msg.includes("now")) {
    date = 0;
  } else if (msg.includes("tonight")) {
    date = 0;
  } else if (msg.includes("tomorrow") || msg.includes("tom")) {
    date = 1;
  } else if (msg.includes("monday")) {
    date = getNumDays("monday");
  } else if (msg.includes("tuesday")) {
    date = getNumDays("tuesday");
  } else if (msg.includes("wednesday")) {
    date = getNumDays("wednesday");
  } else if (msg.includes("thursday")) {
    date = getNumDays("thursday");
  } else if (msg.includes("friday")) {
    date = getNumDays("friday");
  } else if (msg.includes("saturday")) {
    date = getNumDays("saturday");
  } else if (msg.includes("sunday")) {
    date = getNumDays("sunday");
  }

  // Compute actual MMR Range
  if (min_mmr !== "" && max_mmr !== "" && mmr_range === "") {
    if (max_mmr === "+") {
      mmr_range = min_mmr + "+";
    } else {
      mmr_range = min_mmr + "-" + max_mmr;
    }
  }

  // Strategy: post these to the Bot Test Server to see what kind of formats are not working
  // Check all variables
  if (mmr_range !== "" && time !== "" && timezone !== "" && mmr_range.length > 3) {
    const foundDuplicate = await checkDuplicates(author, mmr_range, time, timezone, date);
    if (!foundDuplicate) {
      // Add to database
      await ScrimData.sync();
      const scrim = await ScrimData.create({
        contact: author,
        mmr_range: mmr_range,
        time: time,
        timezone: timezone,
        day: date,
      });
    } else {
      discord_client.channels.cache.get(ENV.MISSED_SCRIM_ID).send('Found duplicate!');
    }
  } else {
    // Post msg to private Discord
    //console.log(`Message failed to be parsed:\nMessage = ${msg}\nAuthor = ${author}\n`);
    discord_client.channels.cache.get(ENV.MISSED_SCRIM_ID).send(msg);
  }
}

// TODO: Have this store information in the database
async function parseEmbeds(embeds) {
  let testMsg = ''; // We will remove this later once we have our information
  for (let i = 0; i < embeds.length; i++) {
    testMsg += `Embed ${i} Title: ${embeds[i].title}\nEmbed ${i} Description: ${embeds[i].description}\n`;
    if (embeds[i].fields.length > 0) {
      // There is at least one field to this Embed
      for (let j = 0; j < embeds[i].fields.length; j++) {
        testMsg += `Embed ${i} Field ${j} Name: ${embeds[i].fields[j].name}\nEmbed ${i} Field ${j} Value: ${embeds[i].fields[j].value}\n`
      }
    }
    if (embeds[i].url) {
      // There is a link attached to this Embed
      testMsg += `Embed ${i} Link: ${embeds[i].url}\n`
    }
  }
}

// Trigger when the bot is ready
discord_client.once("ready", async () => {
  console.log("ScrimBot online!");
});

// Handle Commands
discord_client.on(Events.InteractionCreate, async (interaction) => {
  //const temp = new Date();
  //console.log(temp.toString());
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  // Remove all old scrimmages from the database
  await removeScrims();

  // Make sure commands are only executed via the #lf-scrim channel
  if (interaction.channel.name !== "lf-scrim") {
    const channelEmbed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("ScrimBot - Wrong Channel")
      .setDescription("Please use the #lf-scrim channel");
    await interaction.reply({ embeds: [channelEmbed] });
    return;
  }

  try {
    if (interaction.commandName === "lfs") {
      await LFS_COMMAND.execute(interaction);
    } else if (interaction.commandName === "reset") {
      await RESET_COMMAND.execute(interaction);
    } else {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }
  } catch (err) {
    console.error(err);
    const errorEmbed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("ScrimBot - Error")
      .setDescription("There was an error while executing this command!");
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
});

// Log in to Discord
discord_client.login(ENV.BOT_TOKEN);
