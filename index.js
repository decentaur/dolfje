require('dotenv').config();
const localizify = require('localizify');

const en = require('./en.json');
const nl = require('./nl.json');
localizify.default
  .add('en', en)
  .add('nl', nl)
  .setLocale(process.env.APPLANG);
const { App } = require('@slack/bolt');
const ww_actions = require('./ww_actions');
const ww_commands = require('./ww_commands');
const ww_messages = require('./ww_messages');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

(async () => {
  await app.start(process.env.PORT || 6262);
})();

ww_actions.addActions(app);
ww_commands.addCommands(app);
ww_messages.addMessages(app);
