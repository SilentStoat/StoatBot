import { getInfoChoices } from './game.js';
import { capitalize, DiscordRequest } from './utils.js';

export async function HasGuildCommands(appId, guildId, commands) {
  if (guildId === '' || appId === '') return;

  commands.forEach((c) => HasGuildCommand(appId, guildId, c));
}

// Checks for a command
async function HasGuildCommand(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = await res.json();

    if (data) {
      const installedNames = data.map((c) => c['name']);
      // This is just matching on the name, so it's not good for updates
      if (!installedNames.includes(command['name'])) {
        console.log(`Installing "${command['name']}"`);
        InstallGuildCommand(appId, guildId, command);
      } else {
        console.log(`"${command['name']}" command already installed`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Installs a command
export async function InstallGuildCommand(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'POST', body: command });
  } catch (err) {
    console.error(err);
  }
}

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getInfoChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic guild command',
  options: [
    {
      "name": "user",
      "description": "The user to get",
      "type": 6, // 6 is type USER
      "required": true
    },
  ]
};

// Command returns time
export const TIME_COMMAND = {
  name: 'time',
  description: 'timestamps!',
  type: 1,
};


// Command for setting info
export const ABOUT_ME_COMMAND = {
  name: 'aboutme',
  description: 'set personal info',
  options: [
    {
      type: 3,
      name: 'info',
      description: 'which info',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
};

// Whenis command
export const WHEN_IS_COMMAND = {
  name: 'whenis',
  description: 'returns users timezone',
  options: [
    {
      "name": "user",
      "description": "The user to get",
      "type": 6, // 6 is type USER
      "required": true
    },
  ]
};