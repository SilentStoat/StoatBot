import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest, getTime } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import {
  TEST_COMMAND,
  WHEN_IS_COMMAND,
  TIME_COMMAND,
  ABOUT_ME_COMMAND,
  HasGuildCommands,
} from './commands.js';

import loki from "lokijs"; //import loki

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

// Setup loki DB
var db = new loki('./.data/stoatbot.db', {
    autoload: true,
    autosave: true, 
    autosaveInterval: 4000
});

// implement the autoloadback referenced in loki constructor
function databaseInitialize(collection) {
  var entries = db.getCollection(collection);
  if (entries === null) {
    entries = db.addCollection(collection);
  }
}

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" guild command
    if (name === 'test') {      
      //const userId = req.body.member.user.id;
      const userId = req.body.data.options[0].value;
      const guildId = req.body.guild_id;
      var entries = db.getCollection("entries");
      var results = entries.findOne({ id: userId });
      console.log(guildId);
      
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: results.locale,
        },
      });
    }
    
    // "time" guild command
    if (name === 'time') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: getTime(),
        },
      });
    }
    
    // "about me" guild command
    if (name === "aboutme" && id) {
      // Get user ID
      const userId = req.body.member.user.id;
      // Get guild ID
      const guildId = req.body.guild_id;
      // User's object choice
      const objectName = req.body.data.options[0].value;
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'A message with a button',
          flags: InteractionResponseFlags.EPHEMERAL,
          // Selects are inside of action rows
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.STRING_SELECT,
                  // Value for your app to identify the select menu interactions
                  custom_id: 'my_locale',
                  // Select options - see https://discord.com/developers/docs/interactions/message-components#select-menu-object-select-option-structure
                  options: [
                    {
                      label: 'US/Central',
                      value: 'US/Central',
                      description: 'Central time US gmt -6',
                    },
                    {
                      label: 'US/Eastern',
                      value: 'US/Eastern',
                      description: 'Eastern time US gmt -4',
                    },
                  ],
                },
              ],
            },
          ],
          // Fetches a random emoji to send from a helper function
          //content: `time change <@${userId}> \n` + userId + '\n' + objectName ,       
        },
      });
    }
    
    // "whenis" guild command
    if (name === 'whenis') {      
      //const userId = req.body.member.user.id;
      const userId = req.body.data.options[0].value;
      // Get guild ID
      const guildId = req.body.guild_id;
      // build collection name
      const collectionID = guildId + '_user_info';
      // initialize collection
      await databaseInitialize(collectionID);      
      // get entries collection
      var userInfos = db.getCollection(collectionID);
      // find the users entry
      var result = userInfos.findOne({ id: userId });
      
      if (result) {             
        // Send a message into the channel where command was triggered from
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: getTime(result.locale),
          },
        });
      } else {           
        // Send a message into the channel where command was triggered from
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: "user hasn't entered that info",
          },
        });
      }
    }    
  }
  
  /**
   * Handle requests from interactive components
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;
    // Delete message with token in request body
    const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

    if (componentId === 'my_locale') {

      // Get selected option from payload
      const selectedOption = data.values[0];
      //get user ID
      const userId = req.body.member.user.id;
      // Get guild ID
      const guildId = req.body.guild_id;
      // build collection name
      const collectionID = guildId + '_user_info';
      // initialize collection
      await databaseInitialize(collectionID);
      
      // get entries collection
      var userInfos = db.getCollection(collectionID);
      // check if user id exists
      var result = userInfos.findOne({ id: userId });
      
      if (result) {
        //if exists get doc and update
        var doc = userInfos.by("id", userId);
        doc.locale = selectedOption;
        userInfos.update(doc)
      } else {
        //if doesn't exist, create doc
        userInfos.insert({id: userId, locale: selectedOption});
      }
      
      // Send results
      await res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `<@${userId}> selected ${selectedOption}` },
      });
      // Update ephemeral message
      await DiscordRequest(endpoint, {
        method: "PATCH",
        body: {
          content: "Nice choice " + getRandomEmoji(),
          components: [],
        },
      });
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);

  // Check if guild commands from commands.json are installed (if not, install them)
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    TEST_COMMAND,
    ABOUT_ME_COMMAND,
    TIME_COMMAND,
    WHEN_IS_COMMAND,
  ]);
});