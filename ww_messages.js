module.exports = { addMessages };
const { directMention } = require('@slack/bolt');
const queries = require('./ww_queries');
const helpers = require('./ww_helpers');

let client;
let botUserId;
async function addMessages(app) {
  client = app.client;
  botUserId = (await client.auth.test({ token: process.env.SLACK_BOT_TOKEN })).user_id;
  const regexStart = new RegExp(`<(@${botUserId})(\|.*)?>.*start.*stemming.*`, 'i');
  const regexStop = new RegExp(`<(@${botUserId})(\|.*)?>.*stop.*stemming.*`, 'i');
  const regexHerinner = new RegExp(`<(@${botUserId})(\|.*)?>.*herinner.*\[(.*)\].*`, 'i');
  app.message(directMention(), appMention);
  app.message(regexStart, startStemming);
  app.message(regexStop, stopStemming);
  app.message(regexHerinner, herinnerStemmers);
  app.message(/.*/, registerMessage);
}

async function appMention({ message, say }) {
  await client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    channel: message.channel,
    user: message.user,
    text: `Hey stop met me @-mentionen, ik heb geen idee wat ik daar mee aan moet...`
  });
}

async function startStemming({ message, say }) {
  if (message.type !== 'message' || message.user !== 'USLACKBOT') {
    return;
  }
  try {
    const game = await queries.getActiveGameWithChannel(message.channel.id);
    const channelUsersList = await helpers.getUserlist(client, message.channel);
    const pollName = await queries.getPollName(game.gms_id);
    const playersAlive = await queries.getAlive(game.gms_id);
    const channelUsersAlive = channelUsersList.filter(x => playersAlive.map(y => y.user_id).includes(x.id));
    if (!channelUsersAlive) {
      throw 'Er zijn geen spelers waarop gestemd kan worden, poll is niet gestart';
    }
    await queries.startPoll(pollName);

    const chuckedUsersAlive = [];
    while (channelUsersAlive.length) {
      chuckedUsersAlive.push(channelUsersAlive.splice(0, 5));
    }

    let buttonblocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: pollName
        }
      }
    ];
    for (const channelChunk of chuckedUsersAlive)
      buttonblocks = buttonblocks.concat([
        {
          type: 'actions',
          elements: channelChunk.map(x => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: x.name
            },
            value: x.id,
            action_id: `stem-${x.id}`
          }))
        }
      ]);

    const chatMessage = await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: message.channel,
      blocks: buttonblocks
    });
    await queries.setMessageIdPoll(chatMessage);
  } catch (error) {
    console.log(`Er ging iets mis met automagisch starten stem ronde: ${error}`);
  }
}

async function stopStemming({ message, say }) {
  if (message.type !== 'message' || message.user !== 'USLACKBOT') {
    return;
  }
  try {
    const game = await queries.getActiveGameWithChannel(message.channel.id);
    const channelUsersList = await helpers.getUserlist(client, message.channel);
    const playersAlive = await queries.getAlive(game.gms_id);
    const channelUsersAlive = channelUsersList.filter(x => playersAlive.map(y => y.user_id).includes(x.id));

    const poll = await queries.stopPoll(game.gms_id);
    const pollResults = await queries.getPollResults(poll);
    if (!poll.gpo_slack_message_id.split) {
      throw 'Resultaten konden niet weergegeven worden, poll is wel gesloten';
    }
    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: poll.gpo_slack_message_id.split('-')[0],
      ts: poll.gpo_slack_message_id.split('-')[1],
      text: `${poll.gpo_title} is gesloten, uitslag volgt`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${poll.gpo_title} is gesloten, uitslag volgt`
          }
        }
      ]
    });
    const mayorId = channelUsersAlive
      .filter(x => x.status === 'Burgemeester')
      .map(y => y.id)
      .join();
    for (const playerAlive of channelUsersAlive) {
      for (const pollResult of pollResults) {
        if (pollResult.gvo_gpl_slack_id === playerAlive.id && pollResult.gvo_voted_on_gpl_slack_id) {
          playerAlive.hasVoted = true;
        }
        if (pollResult.gvo_gpl_slack_id === playerAlive.id && !pollResult.gvo_voted_on_gpl_slack_id) {
          playerAlive.hasVoted = false;
          playerAlive.missedVotes = pollResult.missedVotes;
        }
        if (pollResult.gvo_voted_on_gpl_slack_id === playerAlive.id) {
          if (pollResult.gvo_gpl_slack_id === mayorId) {
            playerAlive.votedBy.push(`<@${pollResult.gvo_gpl_slack_id}> :tophat:`);
            playerAlive.votedByMayor = true;
          } else {
            playerAlive.votedBy.push(`<@${pollResult.gvo_gpl_slack_id}>`);
          }
        }
      }
    }
    helpers.shuffle(channelUsersAlive);
    helpers.postDelayed(client, poll.gpo_slack_message_id.split('-')[0], channelUsersAlive);
  } catch (error) {
    console.log(`Er ging iets mis met automagische sluiting stemming: ${error}`);
  }
}

async function herinnerStemmers({ message, say }) {
  if (message.type !== 'message' || message.user !== 'USLACKBOT') {
    return;
  }
  try {
    const game = await queries.getActiveGameWithChannel(message.channel.id);
    const time = message.text.match(/.*herinner.*\[(.*)\].*/)[1];
    const playersNotVoted = await queries.getAliveNotVoted(game.gms_id);
    const stemMessage = `Je hebt nog niet gestemd, je hebt tot ${time} om te stemmen, stemmen is verplicht`;
    for (const player of playersNotVoted) {
      await helpers.sendIM(client, player.user_id, stemMessage);
    }
    say({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Ok <@${message.user}>, ik heb ${playersNotVoted.length} stemherinneringen verstuurd`
          }
        }
      ]
    });
  } catch (error) {
    console.log(`Er ging iets mis met automagische stemherinnering: ${error}`);
  }
}

async function registerMessage({ message, say }) {
  await queries.messageCountPlusPlus(message.user);
}
