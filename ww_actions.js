module.exports = { addActions };

let helpers = require('./ww_helpers');
const queries = require('./ww_queries');
const { t } = require('localizify');

let client;

function addActions(app) {
  client = app.client;
  app.action(/^stem-.*/, stemClick);
  app.action(/^vluchtig-.*/, vluchtigClick);
  app.action(/^archiveer-.*/, archiveerClick);
  app.action(/^inschrijven-.*/, inschrijven);
  app.action(/^meekijken-.*/, meekijken);
  app.action(/^uitschrijven-.*/, uitschrijven);
  app.action(/^delete-.*/, deleteMessage);
}

vluchtigeStemmingen = [];

async function stemClick({ body, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(body.channel.id);
    const channelUsersList = await helpers.getUserlist(client, body.channel.id);
    await queries.votesOn(game.gms_id, body.user.id, body.actions[0].value);

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
    const game = await queries.getActiveGameWithChannel(body.channel.id);
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
    let playersAlive = await queries.getAlive(game.gms_id);
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
    //await client.conversations.invite({  //use to invite yourself to delete any channels
      await client.conversations.archive({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.actions[0].value,
    //users: body.user.id,
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

async function inschrijven({body, ack, say}) {
ack();
try {
  const userName = await helpers.getUserName(client, body.user.id);
  const result = await queries.joinGame(body.actions[0].value, body.user.id, userName);
  if (result.succes) {
    say({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${userName} ${t('TEXTJOINED')} ${result.numberOfPlayers} ${t('TEXTAMOUNTJOINED')} ${t('TEXTAMOUNTVIEWING')} ${result.numberOfViewers}`,
          },
        },
      ],
    });
    const doeMeeMessage = `${t('TEXTJOINEDGAME')} ${t('COMMANDREMOVEYOURSELFFROMGAME')} \n ${t('TEXTALIVENOTSELECTED')}`;
    await helpers.sendIM(client, body.user.id, doeMeeMessage);
  } else {
    await helpers.sendIM(
      client,
      body.user.id,
      `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${result.error}`
    );
  }
  const games = await queries.getGameRegisterUser(body.user.id);
  if (games) {
    let buttonElements = [{
      type: 'button',
      text: {
        type: 'plain_text',
        text: `${t('TEXTCLOSEMESSAGE')}`,
      },
      value: 'Close',
      action_id: `delete-${body.container.channel_id}`,
    }];
    for (const game of games) {
    buttonElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: game.gms_name,
      },
      value: game.gms_id.toString(),
      action_id: `inschrijven-${game.gms_id}`,
    });
  };
    let buttonblocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${t('TEXTCLICKREGISTER')}`,
        },
      },
      {
        type: 'actions',
        elements: buttonElements,
      }];
    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: buttonblocks
    });
  } else {
    await client.chat.delete({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts
    }); 
  }
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `Er ging iets mis met het archiveren: ${error}`);
  }
}

async function meekijken({body, ack, say}) {
  ack();
  try{
  const userName = await helpers.getUserName(client, body.user.id);
  const game = await queries.getSpecificGame(body.actions[0].value);
  const result = await queries.viewGame(body.user.id, userName, game.gms_id);
  if (result.succes) {
    if (game.gms_status === 'REGISTERING') {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTVIEWED')} ${result.numberOfPlayers} ${t('TEXTAMOUNTJOINED')} ${t('TEXTAMOUNTVIEWING')} ${result.numberOfViewers}`,
            },
          },
        ],
      });
    } else if (game.gms_status === 'STARTED') {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTVIEWERJOINED')} ${userName}`
            }
          }
        ]
      });
      
      //invite player to main channel
      const mainId = await queries.getChannel(game.gms_id, channelType.main);
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: mainId.gch_slack_id,
        users: body.user.id
      });
      //invite player to stemhok
      const voteId = await queries.getChannel(game.gms_id, channelType.vote);
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: voteId.gch_slack_id,
        users: body.user.id
      });
      //invite player to sectators
      const sectatorId = await queries.getChannel(game.gms_id, channelType.viewer);
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: sectatorId.gch_slack_id,
        users: body.user.id
      });
      //send IM to vertellers
      const vertellerMessage  = `${t('TEXTVIEWERJOINED')} ${userName}`;
      const alleVertellers = await queries.getVertellers(game.gms_id);
      for (let i=0; i<alleVertellers.length; i++ ) {
        await helpers.sendIM(client, alleVertellers[i], vertellerMessage);
        }
    }
    const viewMessage = `${t('TEXTVIEWEDGAME')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}`;
    await helpers.sendIM(client, body.user.id, viewMessage);
    const games = await queries.getGameOpenUser(body.user.id);

    if (games) {
      let buttonElements = [{
        type: 'button',
        text: {
          type: 'plain_text',
          text: `${t('TEXTCLOSEMESSAGE')}`,
        },
        value: 'Close',
        action_id: `delete-${body.container.channel_id}`,
      }];
      for (const singlegame of games) {
      buttonElements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: singlegame.gms_name,
        },
        value: singlegame.gms_id.toString(),
        action_id: `meekijken-${singlegame.gms_id}`,
      });
    };
      let buttonblocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${t('TEXTCLICKVIEW')}`,
          },
        },
        {
          type: 'actions',
          elements: buttonElements,
        }];
        await client.chat.update({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.container.channel_id,
          ts: body.container.message_ts,
          blocks: buttonblocks
        });
    } else {  
      await client.chat.delete({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts
    }); 
    }
  } else {
    await helpers.sendIM(
      client,
      body.user.id,
      `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${result.error}`
    );
  }
} catch (error) {
  await helpers.sendIM(client, body.user.id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${error}`);
  }
}

async function uitschrijven({body, ack, say}) {
  ack();
  try {
    const userName = await helpers.getUserName(client, body.user.id);
    const result = await queries.leaveGame(body.actions[0].value, body.user.id);
    if (result.succes) {
      say({
        blocks: [
          {
            channel: body.channel.id,
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTNOTINGAMEANUMORE')} ${result.numberOfPlayers} ${t('TEXTAMOUNTJOINED')} ${t('TEXTAMOUNTVIEWING')} ${result.numberOfViewers}`,
            },
          },
        ],
      });
      const doeMeeMessage = `${t('TEXTPLAYERNOTINGAME')} ${t('COMMANDIWILLJOIN')}`;
      await helpers.sendIM(client, body.user.id, doeMeeMessage);
      const games = await queries.getGameUnregisterUser(body.user.id);  
      if (games) {
        let buttonElements = [{
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEMESSAGE')}`,
          },
          value: 'Close',
          action_id: `delete-${body.container.channel_id}`,
        }];
        for (const game of games) {
        buttonElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: game.gms_name,
          },
          value: game.gms_id.toString(),
          action_id: `uitschrijven-${game.gms_id}`,
        });
      };
        let buttonblocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTCLICKVIEW')}`,
            },
          },
          {
            type: 'actions',
            elements: buttonElements,
          }];
          await client.chat.update({
            token: process.env.SLACK_BOT_TOKEN,
            channel: body.container.channel_id,
            ts: body.container.message_ts,
            blocks: buttonblocks
          });
      } else {
        await client.chat.delete({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.container.channel_id,
          ts: body.container.message_ts
        }); 
      }
    } else {
      await helpers.sendIM(
        client,
        body.user.id,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${result.error}`
      );
    }
  } catch (error) {
    await helpers.sendIM(
      client,
      body.user.id,
      `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${error}`
    );
  }
}

async function deleteMessage({body, ack, say}) {
  ack();
  try {
    console.log(body);
  await client.chat.delete({
    token: process.env.SLACK_BOT_TOKEN,
    channel: body.container.channel_id,
    ts: body.container.message_ts
  }); 
  } catch(error) {
    await helpers.sendIM(client, body.user.id, `${t('TEXTCOMMANDERROR')}: ${error}`);
  }
}
