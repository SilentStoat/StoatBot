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

//import Intl from 'full-icu';
import moment from 'moment-timezone';

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

const tzNames = moment.tz.names();
const zonesMap = new Map();

for (const name of tzNames) {
  const isDST = (moment.tz('2020-05-05', name).isDST() || moment.tz('2020-12-12', name).isDST());  
  const offset = moment.tz(name).utcOffset();
  
  if (!zonesMap.has(isDST)) {
    zonesMap.set(isDST, new Map());
  }

  if (!zonesMap.get(isDST).has(offset)) {
      zonesMap.get(isDST).set(offset, new Set());
  }
  
  zonesMap.get(isDST).get(offset).add(name);
  
}

//console.log(moment.tz('Asia/Jakarta').utcOffset());

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
      const userLocale = req.body.locale;
      //var entries = db.getCollection("entries");
      //var results = entries.findOne({ id: userId });
      //console.log(req.body);
      
      //get list of users by timezone
      
      // build collection name
      const collectionID = guildId + '_user_info';
      // initialize collection
      await databaseInitialize(collectionID);      
      // get entries collection
      var userInfos = db.getCollection(collectionID);
      // get all users
      let users = userInfos.find();
      
      // create users for each offset
      const offsetMap = new Map();      
      for (const user of users) {
        const offset = moment.tz(user.timeZone).utcOffset(); //get user's offset
        
        if (!offsetMap.has(offset)) {
          offsetMap.set(offset, new Set()); //add offset if it doesn't exist
        }

        offsetMap.get(offset).add(user.id); //add user to offset
      }
      
      //console.log(offsetMap);
      
      //build message content
      let content = '';
      for (const offset of offsetMap.keys()) {
          content = content + moment().utcOffset(offset).format('HH:mm') + "\n";
          const userIDs = offsetMap.get(offset);
          console.log(userIDs);
        for (const userID of userIDs) {
          content = content + '<@' + userID + '> \n';
        }
      }
    
      
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: content,
          flags: InteractionResponseFlags.EPHEMERAL,
          // Selects are inside of action rows
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
      if (objectName == 'timezone') {
        //First ask if DST
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Do you have observe Daylight Savings or not?',
            flags: InteractionResponseFlags.EPHEMERAL,
            // Selects are inside of action rows
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Value for your app to identify the select menu interactions
                    custom_id: 'my_DST',
                    // Select options - see https://discord.com/developers/docs/interactions/message-components#select-menu-object-select-option-structure
                    options: [
                      {
                        label: 'No Day Light Savings',
                        value: "False",
                        description: 'Not suffering from Benjamin Frankin\'s mistakes',
                      },
                      {
                        label: 'Day Light Savings',
                        value: "True",
                        description: 'Twice a year I timeskip an hour',
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
      } else if (objectName == 'color') {
        
        //get time
        const d = new Date();
        console.log(d.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" }));
        d.setMinutes(d.getMinutes() - 720);
        
        //build options
        let options = [];        
        for(var i=-12; i<13; i++){
          let option = {};
          option.label = d.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" }) + ' ' + i + '';
          option.value = i * 60;
          option.description = 'test'
          options.push(option);
          d.setMinutes(d.getMinutes() + 60);
        }
        //console.log(options);
        
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
                    custom_id: 'my_Offset',
                    // Select options - see https://discord.com/developers/docs/interactions/message-components#select-menu-object-select-option-structure
                    options: options,
                  },
                ],
              },{
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Value for your app to identify the select menu interactions
                    custom_id: 'my_DST',
                    // Select options - see https://discord.com/developers/docs/interactions/message-components#select-menu-object-select-option-structure
                    options: [
                      {
                        label: 'No Day Light Savings',
                        value: 'False',
                        description: 'Not suffering from Benjamin Frankin\'s mistakes',
                        default: true,
                      },
                      {
                        label: 'Day Light Savings',
                        value: 'True',
                        description: 'Twice a year I timeskip an hour',
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
        if (result.timeZone) {
          // Send a message into the channel where command was triggered from
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              // Fetches a random emoji to send from a helper function
              content: getTime(result.timeZone),
              //content: result.color,
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
    } else if (componentId === 'my_color') {

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
        doc.color = selectedOption;
        userInfos.update(doc)
      } else {
        //if doesn't exist, create doc
        userInfos.insert({id: userId, color: selectedOption});
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
    } else if (componentId === 'my_DST') {

      // Get selected option from payload      
      let selectedOption = false;   
      if (data.values[0] == "True") {
        selectedOption = true;
      }
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
        doc.dst = selectedOption;
        userInfos.update(doc)
      } else {
        //if doesn't exist, create doc
        userInfos.insert({id: userId, dst: selectedOption});
      }
      
      //get time
      const d = new Date();
      console.log(d.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" }));
      d.setMinutes(d.getMinutes() - 720);

      //build options
      let options = [];        
      for(var i=-12; i<13; i++){
        let option = {};
        option.label = d.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" }) + ' ' + i + '';
        option.value = i * 60;
        option.description = 'test'
        options.push(option);
        d.setMinutes(d.getMinutes() + 60);
      }
      //console.log(options);
      
      // Send results
      await res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Select your current time',
          flags: InteractionResponseFlags.EPHEMERAL,
          // Selects are inside of action rows
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.STRING_SELECT,
                  // Value for your app to identify the select menu interactions
                  custom_id: 'my_Offset',
                  // Select options - see https://discord.com/developers/docs/interactions/message-components#select-menu-object-select-option-structure
                  options: options,
                },
              ],
            },
          ],
        },
      });
      // Delete ephemeral message
      await DiscordRequest(endpoint, {method: "DELETE" });
    } else if (componentId === 'my_Offset') {

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
      
      let isDST = false;
      if (result) {
        //if exists get doc and update
        var doc = userInfos.by("id", userId);
        isDST = doc.dst;
      }
      
      //build timezone list using dst and offset
      const currentOffset = Number(selectedOption);
      const offsetList = zonesMap.get(isDST).get(currentOffset);
      
      
      //add check for empty timezone list
      

      console.log('currentOffset: ' + currentOffset);
      console.log('offset list size: ' + offsetList.size);

      console.log('List items: ');
      for (const item of offsetList) {
        console.log(item);
      }
      
      //build Rows
      let rowNum = 1;
      let messageComponents = [];
      
      //build options
      let options = [];
      let count = 1;
      let iterations = offsetList.size;
      
      for(const item of offsetList){
                
        let option = {};
        option.label = item;
        option.value = item;
        //option.description = item;
        options.push(option);
        
        iterations--;
        if (count >=25 || (!iterations)) {
          
          //make row Component
          let rowComponent = {};
          rowComponent.type = MessageComponentTypes.STRING_SELECT;
          rowComponent.custom_id = 'my_TZ_' + rowNum;
          rowComponent.options = options;
          
          options = [];
          
          //Build row components
          let rowComponents = [];
          rowComponents.push(rowComponent);
          
          //make action row
          let actionRow = {};
          actionRow.type = MessageComponentTypes.ACTION_ROW;
          actionRow.components = rowComponents;
          
          messageComponents.push(actionRow);
          
          count = 1;
          rowNum++;
          //add a check to make sure no more than 5 rows
                    
        } else {
          count++;
        }
      }
            
      // Send a message into the channel where command was triggered from
      await res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Showing ' + count + ' of ' + offsetList.size + ' timezones',
          flags: InteractionResponseFlags.EPHEMERAL,
          // Selects are inside of action rows
          components: messageComponents,
        },
      });
      // Delete ephemeral message
      await DiscordRequest(endpoint, {method: "DELETE" });
    } else if (componentId.startsWith('my_TZ_')) {

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
        doc.timeZone = selectedOption;
        userInfos.update(doc)
      } else {
        //if doesn't exist, create doc
        userInfos.insert({id: userId, timeZone: selectedOption});
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