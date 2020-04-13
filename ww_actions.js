module.exports = { addActions };

let helpers = require('./ww_helpers');
const queries = require('./ww_queries');

let client;

function addActions(app) {
  client = app.client;
  app.action(/^stem-.*/, stemClick);
  app.action(/^vluchtig-.*/, vluchtigClick);
  app.action(/^archiveer-.*/, archiveerClick);
}
vluchtigeStemmingen = [];

async function stemClick({ body, ack, say }) {
  ack();
  try {
    const channelUsersList = await helpers.getUserlist(client, body.channel.id);
    await queries.votesOn(body.user.id, body.actions[0].value);

    await client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      text: `Je hebt gestemd op: ${channelUsersList
        .filter(x => x.id === body.actions[0].value)
        .map(x => x.name)
        .join()}`,
      user: body.user.id
    });
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `Er ging iets mis met het stemmen: ${error}`);
  }
}

async function vluchtigClick({ body, ack, say }) {
  ack();
  try {
    if (!vluchtigeStemmingen[body.message.ts]) {
      vluchtigeStemmingen[body.message.ts] = [];
    }

    const user = body.user.id;
    const votedOn = body.actions[0].value;
    if (votedOn !== 'sluit') {
      for (const stemmen in vluchtigeStemmingen[body.message.ts]) {
        if (
          vluchtigeStemmingen[body.message.ts][stemmen].length &&
          vluchtigeStemmingen[body.message.ts][stemmen].includes(user)
        ) {
          vluchtigeStemmingen[body.message.ts][stemmen].splice(
            vluchtigeStemmingen[body.message.ts][stemmen].indexOf(user),
            1
          );
        }
      }

      if (vluchtigeStemmingen[body.message.ts][votedOn]) {
        vluchtigeStemmingen[body.message.ts][votedOn].push(user);
      } else {
        vluchtigeStemmingen[body.message.ts][votedOn] = [user];
      }
    }
    let playersAlive = await queries.getAlive();
    playersAlive = await helpers.addSlackName(client, playersAlive);
    const chuckedUsersAlive = [];
    while (playersAlive.length) {
      chuckedUsersAlive.push(playersAlive.splice(0, 5));
    }

    let buttonblocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'vluchtige stemming:'
        }
      }
    ];
    if (!votedOn || votedOn === 'sluit') {
      buttonblocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'stemming gesloten'
        }
      });
    } else {
      for (const channelChunk of chuckedUsersAlive)
        buttonblocks.push({
          type: 'actions',
          elements: channelChunk.map(x => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: x.slack_name
            },
            value: x.user_id,
            action_id: `vluchtig-${x.user_id}`
          }))
        });

      buttonblocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: `sluit vluchtige stemming`
            },
            value: 'sluit',
            action_id: `vluchtig-sluit`
          }
        ]
      });
    }
    const stemUitslag = [];
    for (const stemmen in vluchtigeStemmingen[body.message.ts]) {
      stemUitslag.push(
        `<@${stemmen}>: *${vluchtigeStemmingen[body.message.ts][stemmen].length}* (${vluchtigeStemmingen[
          body.message.ts
        ][stemmen]
          .map(x => `<@${x}>`)
          .join(', ')})`
      );
    }
    buttonblocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `stemmen:\n${stemUitslag.join('\n')}`
      }
    });
    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: buttonblocks
    });
    if (!votedOn || votedOn === 'sluit') {
      delete vluchtigeStemmingen[body.message.ts];
    }
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `Er ging iets mis met het vluchtig stemmen: ${error}`);
    console.log(error.stack);
  }
}

async function archiveerClick({ body, ack, say }) {
  ack();
  try {
    await client.conversations.archive({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.actions[0].value
    });
    const channelList = await client.conversations.list({
      token: process.env.SLACK_BOT_TOKEN,
      exclude_archived: true,
      types: 'private_channel'
    });
    const chuckedChannels = [];
    while (channelList.channels.length) {
      chuckedChannels.push(channelList.channels.splice(0, 5));
    }

    let buttonblocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'klik op de kanalen die je wilt archiveren'
        }
      }
    ];
    for (const channelChunk of chuckedChannels)
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
            action_id: `archiveer-${x.id}`
          }))
        }
      ]);

    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: buttonblocks
    });
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `Er ging iets mis met het archiveren: ${error}`);
  }
}
