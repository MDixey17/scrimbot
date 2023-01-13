import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const HELP_COMMAND = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get more info about ScrimBot and submit feedback!'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor("#32CD32")
            .setTitle("ScrimBot - More Info")
            .setDescription(
                `
                **Available Commands:**
                /lfs = Look for a scrimmage in the ScrimBot database. Optionally, 
                you can pass parameters (MMR, Day, Time, Timezone) to refine and customize 
                the search.

                /help = Returns this message
                
                **Servers Where ScrimBot Listens:**
                RL 6mans NA
                College Carball Association
                NACE Starleague
                
                **Submit Your Feedback:**
                Please let us know about your ScrimBot experience by filling out this 
                Google Form!
                https://forms.gle/67nyHXrpR93tMqkJ9
                
                `
            )
            .setURL('https://forms.gle/67nyHXrpR93tMqkJ9');
        
        await interaction.reply({ embeds: [embed] });
    }
}