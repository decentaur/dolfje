module.exports = {
  addActions,
  selfInviteClickFunction,
  inschrijvenFunction,
  meekijkenFunction,
  uitschrijvenFunction,
  vertellerToevoegenFunction,
  createNewChannelFunction,
};

let helpers = require('./ww_helpers');
const queries = require('./ww_queries');
const { t } = require('localizify');

let client;

function addActions(app) {
  client = app.client;
  app.action(/^stem-.*/, stemClick);
  app.action(/^vluchtig-.*/, vluchtigClick);
  app.action(/^selfinvite-.*/, selfInviteClick);
  app.action(/^inschrijven-.*/, inschrijven);
  app.action(/^meekijken-.*/, meekijken);
  app.action(/^uitschrijven-.*/, uitschrijven);
  app.action(/^delete-.*/, deleteMessage);
  app.action(/^verteller-.*/, vertellerToevoegen);
  app.action(/^kanaal-.*/, createNewChannel);
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
        .filter((x) => x.id === body.actions[0].value)
        .map((x) => x.name)
        .join()}`,
      user: body.user.id,
    });
    const channelId = await queries.getChannel(game.gms_id, helpers.channelType.stemstand);
    client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<@${body.user.id}> heeft gestemd op: <@${body.actions[0].value}>`,
          },
        },
      ],
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
          text: 'vluchtige stemming:',
        },
      },
    ];
    if (!votedOn || votedOn === 'sluit') {
      buttonblocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'stemming gesloten',
        },
      });
    } else {
      for (const channelChunk of chuckedUsersAlive)
        buttonblocks.push({
          type: 'actions',
          elements: channelChunk.map((x) => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: x.slack_name,
            },
            value: x.user_id,
            action_id: `vluchtig-${x.user_id}`,
          })),
        });

      buttonblocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: `sluit vluchtige stemming`,
            },
            value: 'sluit',
            action_id: `vluchtig-sluit`,
          },
        ],
      });
    }
    const stemUitslag = [];
    for (const stemmen in vluchtigeStemmingen[body.message.ts]) {
      stemUitslag.push(
        `<@${stemmen}>: *${vluchtigeStemmingen[body.message.ts][stemmen].length}* (${vluchtigeStemmingen[
          body.message.ts
        ][stemmen]
          .map((x) => `<@${x}>`)
          .join(', ')})`
      );
    }
    buttonblocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `stemmen:\n${stemUitslag.join('\n')}`,
      },
    });
    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: buttonblocks,
    });
    if (!votedOn || votedOn === 'sluit') {
      delete vluchtigeStemmingen[body.message.ts];
    }
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `Er ging iets mis met het vluchtig stemmen: ${error}`);
  }
}

async function selfInviteClick({ body, ack, say }) {
  ack();
  const channelId = body.actions[0].value;
  const userId = body.user.id;
  await selfInviteClickFunction(channelId, userId);
}

async function selfInviteClickFunction(channelId, userId) {
  try {
    await client.conversations.invite({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      users: userId,
    });
  } catch (error) {
    await helpers.sendIM(client, userId, `Er ging iets mis met het het zelf uitnodigen: ${error}`);
  }
}

async function inschrijven({ body, ack, say }) {
  ack();
  try {
    const userId = body.user.id;
    const gameId = body.actions[0].value;
    const msgChannelId = body.container.channel_id;
    const msgTs = body.container.message_ts;
    const singleGame = false;
    await inschrijvenFunction(userId, gameId, msgChannelId, msgTs, singleGame);
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${result.error}`);
  }
}

async function inschrijvenFunction(userId, gameId, msgChannelId, msgTs, singleGame) {
  try {
    const userName = await helpers.getUserName(client, userId);
    const result = await queries.joinGame(gameId, userId, userName);
    const thisGame = await queries.getSpecificGame(gameId);
    if (result.succes) {
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.REG_CHANNEL,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTJOINED')} ${t(thisGame.gms_name)}, ${t('TEXTTHEREARE')} ${
                result.numberOfPlayers
              } ${t('TEXTAMOUNTJOINED')} ${t('TEXTAMOUNTVIEWING')} ${result.numberOfViewers}`,
            },
          },
        ],
      });
      const doeMeeMessage = `${t('TEXTJOINEDGAME')} ${t('COMMANDREMOVEYOURSELFFROMGAME')} \n ${t(
        'TEXTALIVENOTSELECTED'
      )}`;
      await helpers.sendIM(client, userId, doeMeeMessage);
    } else {
      await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${result.error}`);
    }
    if (!singleGame) {
      const games = await queries.getGameRegisterUser(userId);
      if (games.length > 0) {
        let buttonElements = [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: `${t('TEXTCLOSEMESSAGE')}`,
            },
            value: 'Close',
            action_id: `delete-${msgChannelId}`,
          },
        ];
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
        }
        let buttonblocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKREGISTER')}`,
            },
          },
          {
            type: 'actions',
            elements: buttonElements,
          },
        ];
        await client.chat.update({
          token: process.env.SLACK_BOT_TOKEN,
          channel: msgChannelId,
          ts: msgTs,
          blocks: buttonblocks,
        });
      } else {
        await client.chat.delete({
          token: process.env.SLACK_BOT_TOKEN,
          channel: msgChannelId,
          ts: msgTs,
        });
      }
    }
  } catch (error) {
    await helpers.sendIM(client, userId, `Er ging iets mis met deelnemen: ${error}`);
  }
}

async function meekijken({ body, ack, say }) {
  ack();
  try {
    const userId = body.user.id;
    const gameId = body.actions[0].value;
    const msgChannelId = body.container.channel_id;
    const msgTs = body.container.message_ts;
    const singleGame = false;
    await meekijkenFunction(userId, gameId, msgChannelId, msgTs, singleGame);
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${result.error}`);
  }
}

async function meekijkenFunction(userId, gameId, msgChannelId, msgTs, singleGame) {
  try {
    const userName = await helpers.getUserName(client, userId);
    const game = await queries.getSpecificGame(gameId);
    const result = await queries.viewGame(userId, userName, game.gms_id);
    if (result.succes) {
      if (game.gms_status === 'REGISTERING') {
        await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: process.env.REG_CHANNEL,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${userName} ${t('TEXTVIEWED')} ${t(game.gms_name)}, ${t('TEXTTHEREARE')} ${
                  result.numberOfPlayers
                } ${t('TEXTAMOUNTJOINED')} ${t('TEXTAMOUNTVIEWING')} ${result.numberOfViewers}`,
              },
            },
          ],
        });
      } else if (game.gms_status === 'STARTED') {
        await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: process.env.REG_CHANNEL,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${t('TEXTVIEWERJOINED')} ${userName}`,
              },
            },
          ],
        });

        //invite player to main channel
        const mainId = await queries.getChannel(game.gms_id, helpers.channelType.main);
        await client.conversations.invite({
          token: process.env.SLACK_BOT_TOKEN,
          channel: mainId,
          users: userId,
        });
        //invite player to stemhok
        const voteId = await queries.getChannel(game.gms_id, helpers.channelType.vote);
        await client.conversations.invite({
          token: process.env.SLACK_BOT_TOKEN,
          channel: voteId,
          users: userId,
        });
        //invite player to sectators
        const sectatorId = await queries.getChannel(game.gms_id, helpers.channelType.viewer);
        await client.conversations.invite({
          token: process.env.SLACK_BOT_TOKEN,
          channel: sectatorId,
          users: userId,
        });
        //invite player to kletskanaal
        const talkChannelId = await queries.getChannel(game.gms_id, helpers.channelType.viewer);
        await client.conversations.invite({
          token: process.env.SLACK_BOT_TOKEN,
          channel: talkChannelId,
          users: userId,
        });
        //send IM to vertellers
        const vertellerMessage = `${t('TEXTVIEWERJOINED')} ${userName}`;
        const vertellers = await queries.getVertellers(game.gms_id);
        for (const verteller of vertellers) {
          await helpers.sendIM(client, verteller, vertellerMessage);
        }
      }
      const viewMessage = `${t('TEXTVIEWEDGAME')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}`;
      await helpers.sendIM(client, userId, viewMessage);

      if (!singleGame) {
        const games = await queries.getGameOpenUser(userId);

        if (games.length > 0) {
          let buttonElements = [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: `${t('TEXTCLOSEMESSAGE')}`,
              },
              value: 'Close',
              action_id: `delete-${msgChannelId}`,
            },
          ];
          for (const singleGame of games) {
            buttonElements.push({
              type: 'button',
              text: {
                type: 'plain_text',
                text: singleGame.gms_name,
              },
              value: singleGame.gms_id.toString(),
              action_id: `meekijken-${singleGame.gms_id}`,
            });
          }
          let buttonblocks = [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKVIEW')}`,
              },
            },
            {
              type: 'actions',
              elements: buttonElements,
            },
          ];
          await client.chat.update({
            token: process.env.SLACK_BOT_TOKEN,
            channel: msgChannelId,
            ts: msgTs,
            blocks: buttonblocks,
          });
        } else {
          await client.chat.delete({
            token: process.env.SLACK_BOT_TOKEN,
            channel: msgChannelId,
            ts: msgTs,
          });
        }
      }
    } else {
      await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${result.error}`);
    }
  } catch (error) {
    await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${error}`);
  }
}

async function uitschrijven({ body, ack, say }) {
  ack();
  try {
    const userId = body.user.id;
    const gameId = body.actions[0].value;
    const msgChannelId = body.container.channel_id;
    const msgTs = body.container.message_ts;
    const singleGame = false;
    await uitschrijvenFunction(userI, gameId, msgChannelId, msgTs, singleGame);
  } catch (error) {
    await helpers.sendIM(
      client,
      body.user.id,
      `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${error}`
    );
  }
}

async function uitschrijvenFunction(userId, gameId, msgChannelId, msgTs, singleGame) {
  try {
    const userName = await helpers.getUserName(client, userId);
    const result = await queries.leaveGame(gameId, userId);
    const thisGame = await queries.getSpecificGame(gameId);
    if (result.succes) {
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.REG_CHANNEL,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTNOTINGAMEANYMORE')} ${thisGame.gms_name}, ${t('TEXTTHEREARE')} ${
                result.numberOfPlayers
              } ${t('TEXTAMOUNTJOINED')} ${t('TEXTAMOUNTVIEWING')} ${result.numberOfViewers}`,
            },
          },
        ],
      });
      const doeMeeMessage = `${t('TEXTPLAYERNOTINGAME')} ${thisGame.gms_name}. ${t('TEXTCHANGEDMIND')} ${t(
        'COMMANDIWILLJOIN'
      )}`;
      await helpers.sendIM(client, userId, doeMeeMessage);
      if (!singleGame) {
        const games = await queries.getGameUnregisterUser(userId);
        if (games.length > 0) {
          let buttonElements = [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: `${t('TEXTCLOSEMESSAGE')}`,
              },
              value: 'Close',
              action_id: `delete-${msgChannelId}`,
            },
          ];
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
          }
          let buttonblocks = [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKUNREGISTER')}`,
              },
            },
            {
              type: 'actions',
              elements: buttonElements,
            },
          ];
          await client.chat.update({
            token: process.env.SLACK_BOT_TOKEN,
            channel: msgChannelId,
            ts: msgTs,
            blocks: buttonblocks,
          });
        } else {
          await client.chat.delete({
            token: process.env.SLACK_BOT_TOKEN,
            channel: msgChannelId,
            ts: msgTs,
          });
        }
      }
    } else {
      await helpers.sendIM(
        client,
        userId,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${result.error}`
      );
    }
  } catch (error) {
    await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${error}`);
  }
}

async function vertellerToevoegen({ body, ack, say }) {
  ack();
  try {
    const vertellerId = body.actions[0].value;
    const userId = body.user.id;
    const channelId = process.env.REG_CHANNEL;
    const gameId = body.actions[0].action_id.trim().split('-')[1];
    const msgChannelId = body.container.channel_id;
    const msgTs = body.container.message_ts;
    const singleGame = false;
    await vertellerToevoegenFunction(vertellerId, userId, channelId, gameId, msgChannelId, msgTs, singleGame);
  } catch (error) {
    await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function vertellerToevoegenFunction(vertellerId, userId, mainChannel, gameId, msgChannelId, msgTs, singleGame) {
  try {
    const thisGame = await queries.getSpecificGame(gameId);
    const userName = await helpers.getUserName(client, vertellerId);
    await queries.addVerteller(vertellerId, userName, thisGame.gms_id);
    if (thisGame.gms_status === 'STARTED') {
      const allChannels = await queries.getAllChannels(thisGame.gms_id);
      for (const oneChannel of allChannels) {
        await client.conversations.invite({
          token: process.env.SLACK_BOT_TOKEN,
          channel: oneChannel.gch_slack_id,
          users: vertellerId,
        });
        if (oneChannel.gch_type === 'MAIN') {
          mainChannel = oneChannel.gch_slack_id;
        }
      }
    }
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: mainChannel,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${userName} ${t('TEXTISVERTELLER')} ${thisGame.gms_name}`,
          },
        },
      ],
    });
    const message = `${t('TEXTBECAMEMODERATOR')} ${thisGame.gms_name}`;
    await helpers.sendIM(client, vertellerId, message);
    if (!singleGame) {
      const games = await queries.getGameVerteller(userId, vertellerId);
      if (games.length > 0) {
        let buttonElements = [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: `${t('TEXTCLOSEMESSAGE')}`,
            },
            value: 'Close',
            action_id: `delete-${msgChannelId}`,
          },
        ];
        for (const game of games) {
          buttonElements.push({
            type: 'button',
            text: {
              type: 'plain_text',
              text: game.gms_name,
            },
            value: vertellerId,
            action_id: `verteller-${game.gms_id}`,
          });
        }
        let buttonblocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKVERTELLER')}`,
            },
          },
          {
            type: 'actions',
            elements: buttonElements,
          },
        ];
        await client.chat.update({
          token: process.env.SLACK_BOT_TOKEN,
          channel: msgChannelId,
          ts: msgTs,
          blocks: buttonblocks,
        });
      } else {
        await client.chat.delete({
          token: process.env.SLACK_BOT_TOKEN,
          channel: msgChannelId,
          ts: msgTs,
        });
      }
    }
  } catch (error) {
    await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function createNewChannel({ body, ack, say }) {
  ack();
  try {
    const userId = body.user.id;
    const gameId = body.actions[0].action_id.trim().split('-')[1];
    const channelName = body.actions[0].value;
    const msgChannelId = body.container.channel_id;
    const msgTs = body.container.message_ts;
    const singleGame = false;
    await createNewChannelFunction(gameId, userId, channelName, msgChannelId, msgTs, singleGame);
  } catch (error) {
    await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function createNewChannelFunction(gameId, userId, newChannelName, msgChannelId, msgTs, singleGame) {
  try {
    const alleVertellers = await queries.getVertellers(gameId);
    const game = await queries.getSpecificGame(gameId);
    if (!alleVertellers.includes(userId)) {
      alleVertellers.push(userId);
    }
    let channelName;
    const regexName = /^[w|W]{2}[0-9].*/;
    if (regexName.test(newChannelName) === false) {
      channelName = `${game.gms_name.toLowerCase().split(' ').join('_')}_${newChannelName.toLowerCase()}`;
    } else {
      channelName = newChannelName.toLowerCase();
    }
    const kanaal = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: channelName,
      is_private: true,
    });
    await client.conversations.invite({
      token: process.env.SLACK_BOT_TOKEN,
      channel: kanaal.channel.id,
      users: alleVertellers.join(','),
    });
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: kanaal.channel.id,
      text: `${await helpers.getUserName(client, userId)} ${t('TEXTCREATEDCHANNEL')}`,
    });
    const kanaalInput = {
      gch_gms_id: gameId,
      gch_slack_id: kanaal.channel.id,
      gch_name: kanaal.channel.name,
      gch_type: helpers.channelType.standard,
      gch_user_created: userId,
    };
    await queries.logChannel(kanaalInput);
    if (!singleGame) {
      await client.chat.delete({
        token: process.env.SLACK_BOT_TOKEN,
        channel: msgChannelId,
        ts: msgTs,
      });
    }
  } catch (error) {
    await helpers.sendIM(client, userId, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function deleteMessage({ body, ack, say }) {
  ack();
  try {
    await client.chat.delete({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.container.channel_id,
      ts: body.container.message_ts,
    });
  } catch (error) {
    await helpers.sendIM(client, body.user.id, `${t('TEXTCOMMANDERROR')}: ${error}`);
  }
}
