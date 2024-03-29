import { REST, Routes } from 'discord.js';
import envjson from "./config.json";
import { LFS_COMMAND } from "./commands/lfs.js";
import { RESET_COMMAND } from "./commands/reset.js";
import { HELP_COMMAND } from './commands/help.js';

const commands = [];

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
commands.push(LFS_COMMAND.data.toJSON());
commands.push(RESET_COMMAND.data.toJSON());
commands.push(HELP_COMMAND.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(envjson.BOT_TOKEN);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationCommands(envjson.BOT_CLIENT_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();