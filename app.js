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
var db = new loki('./.data/quickstart.db', {
    autoload: true,
    autoloadCallback : databaseInitialize,
    autosave: true, 
    autosaveInterval: 4000
});

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
  var entries = db.getCollection("entries");
  if (entries === null) {
    entries = db.addCollection("entries");
  }

  // kick off any program logic or start listening to external events
  runProgramLogic();
}

// example method with any bootstrap logic to run after database initialized
function runProgramLogic() {
  var entryCount = db.getCollection("entries").count();
  console.log("number of entries in database : " + entryCount);
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
      var entries = db.getCollection("entries");
      var results = entries.findOne({ id: userId });
      console.log("results : " + results);
      
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
      // User's object choice
      const objectName = req.body.data.options[0].value;
      // get entries collection
      var entries = db.getCollection("entries");
      // check if user id exists
      var result = entries.findOne({ id: userId });
      
      if (result) {
        //if exists get doc and update
        var doc = entries.by("id", userId);
        doc.locale = objectName;
        entries.update(doc)
      } else {
        //if doesn't exist, create doc
        entries.insert({id: userId, locale: objectName});
      }
      
      // Create active game using message ID as the game ID
      activeGames[id] = {
        id: userId,
        objectName,
      };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: `time change <@${userId}> \n` + userId + '\n' + objectName ,       
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
  ]);
});