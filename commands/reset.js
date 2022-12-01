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

export const RESET_COMMAND = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Reset the scrimmages database'),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(role => role.name === "Operations" || role.name === "Admin")) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor('#7A0019')
                .setTitle('ScrimBot - Permission Denied')
                .setDescription(`You don't have permission to execute /reset.\nOnly Operations and Admin users can execute this command.`);
            await interaction.reply( {embeds: [noPermissionEmbed]} );
            return;
        }

        await ScrimData.sync({ force: true });
        const embed = new EmbedBuilder()
            .setColor("#32CD32")
            .setTitle("ScrimBot - Reset Scrimmages Database")
            .setDescription("Successfully reset the scrimmages database");

        await interaction.reply({ embeds: [embed] });
    }
};