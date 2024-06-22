const helpers = require('./ww_helpers');
const queries = require('./ww_queries');
const actions = require('./ww_actions');
const { t } = require('localizify');
module.exports = { addCommands };
let client;

const channelType = {
  main: 'MAIN',
  vote: 'VOTE',
  viewer: 'VIEWER',
  standard: 'NORMAL',
  stemstand: 'VOTEFLOW',
};

function addCommands(app) {
  client = app.client;
  app.command(t('COMMANDLIST'), channelList);
  app.command(t('COMMANDSTATUS'), status);
  app.command(t('COMMANDRULES'), regels);
  app.command(t('COMMANDARCHIVE'), archiveren);
  app.command(t('COMMANDVOTEROUND'), startStemRonde);
  app.command(t('COMMANDSTOPVOTEROUND'), stopStemRonde);
  app.command(t('COMMANDREMINDER'), stemHerinnering);
  app.command(t('COMMANDVOTESCORE'), stemStand);
  app.command(t('COMMANDSTARTQUICKVOTE'), startVluchtigeStemRonde);
  app.command(t('COMMANDSTARTREGISTRATION'), startRegistratie);
  app.command(t('COMMANDSTARTGAME'), startSpel);
  app.command(t('COMMANDSTOPGAME'), stopSpel);
  app.command(t('COMMANDCREATECHANNEL'), createChannel);
  app.command(t('COMMANDDEAD'), dood);
  app.command(t('COMMANDREVIVE'), reanimeer);
  app.command(t('COMMANDEXTRAMODERATOR'), extraVerteller);
  app.command(t('COMMANDINVITEMODERATOR'), nodigVertellersUit);
  app.command(t('COMMANDINVITEPLAYERS'), nodigSpelersUit);
  app.command(t('COMMANDIWILLJOIN'), ikDoeMee);
  app.command(t('COMMANDIWILLVIEW'), ikKijkMee);
  app.command(t('COMMANDREMOVEYOURSELFFROMGAME'), ikDoeNietMeerMee);
  app.command(t('COMMANDGIVEROLES'), verdeelRollen);
  app.command(t('COMMANDLOTTO'), lotto);
  app.command(t('COMMANDHELP'), help);
  app.command(t('COMMANDSUMMARIZE'), summarize);
}

async function channelList({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    const playerList = await queries.getPlayerList(game.gms_id);
    const inputList = channelUsersList.filter((x) => playerList.map((y) => y.gpl_slack_id).includes(x.id));

    let returnText;
    let seperator = ', ';
    if (command.text.trim() === 'newline') {
      seperator = '\n';
    }
    returnText = `*${t('TEXTLIVING')}* (${
      inputList.filter((x) => x.status === t('TEXTPARTICIPANT') || x.status === t('TEXTMAYOR')).length
    }): ${inputList
      .filter((x) => x.status === t('TEXTPARTICIPANT') || x.status === t('TEXTMAYOR'))
      .map((x) => x.name)
      .join(seperator)}\n*${t('TEXTMULTIPLEDEAD')}* (${
      inputList.filter((x) => x.status === t('TEXTDEAD')).length
    }): ${inputList
      .filter((x) => x.status === t('TEXTDEAD'))
      .map((x) => x.name)
      .join(seperator)}\n*${t('TEXTNOSTATUS')}* (${inputList.filter((x) => x.status === '').length}): ${inputList
      .filter((x) => !x.status)
      .map((x) => x.name)
      .join(seperator)}`;
    if (command.text.trim() === 'public') {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: returnText,
            },
          },
        ],
      });
    } else {
      await client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        channel: command.channel_id,
        attachments: [{ text: `${t('TEXTUSE')} '${t('COMMANDLIST')} ${t('TEXTPUBLIC')}` }],
        text: returnText,
        user: command.user_id,
      });
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDLIST')}: ${error}`);
  }
}

async function status({ command, ack, say }) {
  ack();
  try {
    const state = await queries.getGameState();
    let returnText;
    if (state.length > 0) {
      returnText = `${t('TEXTSTATUSGAME')}\n\n`;
      for (i = 0; i < state.length; i++) {
        switch (state[i].gms_status) {
          case 'REGISTERING':
            returnText += `${i + 1}. \t ${state[i].gms_name} \t ${t('TEXTOPENREGISTRATION')} ${t(
              'COMMANDIWILLJOIN'
            )} ${t('TEXTTOVIEW')} ${t('COMMANDIWILLVIEW')}. ${t('TEXTREGISTER')} ${state[i].players} ${t(
              'TEXTVIEWING'
            )} ${state[i].viewers} \n`;
            break;
          case 'STARTED':
            returnText += `${i + 1}. \t ${state[i].gms_name} \t ${t('TEXTGAMESTARTED')} ${state[i].alive} ${t(
              'TEXTPLAYERSAND'
            )} ${state[i].dead} ${t('TEXTDEADPLAYERS')} \n`;
            break;
        }
      }
      const enrolledGames = await queries.getActiveGameUser(command.user_id);
      if (enrolledGames.length !== 0) {
        for (const inGame of enrolledGames) {
          returnText += `\n ${t('TEXTENROLLEDIN')} ${inGame.gms_name}`;
        }
      } else {
        returnText += `${t('TEXTNOTENROLLED')}`;
      }
    } else {
      returnText = `${t('TEXTGAMESTOPPED')}`;
    }
    if (command.text.trim() === 'public') {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${returnText}`,
            },
          },
        ],
      });
    } else {
      await client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        channel: command.channel_id,
        attachments: [{ text: `${t('TEXTUSE')} ${t('COMMANDSTATUS')} ${t('TEXTPUBLIC')}` }],
        text: `${returnText}`,
        user: command.user_id,
      });
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTATUS')}: ${error}`);
  }
}

async function regels({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const regels = await queries.getRules(game.gms_id);
    if (!regels) {
      regels = {
        gru_name: `${t('TEXTNORULES')}`,
        gru_rules: `${t('TEXTNORULESSETTELL')}`,
      };
    }

    if (command.text.trim() === 'public') {
      say(`${regels.gru_name}:\n${regels.gru_rules}`);
    } else {
      await client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        channel: command.channel_id,
        attachments: [{ text: `${t('TEXTUSE')} '${t('COMMANDRULES')} ${t('TEXTPUBLIC')}` }],
        text: `${regels.gru_name}:\n${regels.gru_rules}`,
        user: command.user_id,
      });
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDRULES')}: ${error}`);
  }
}

async function archiveren({ command, ack, say }) {
  ack();
  try {
    params = command.text.trim().split(' ');
    if (params.length < 1) {
      const warning = `${t('TEXTTWOPARAMETERs')} ${t('COMMANDARCHIVE')} [${t('TEXTPASSWORD')}] [${t('TEXTGAMENAME')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params[0] !== process.env.MNOT_ADMIN_PASS) {
      const warning = `${t('TEXTINCORRECTPASSWORD')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const game = await queries.getGameName(params[1]);
    const channelList = await queries.getAllChannels(game.gms_id);
    for (const oneChannel of channelList) {
      try {
        await client.conversations.archive({
          token: process.env.SLACK_BOT_TOKEN,
          channel: oneChannel.gch_slack_id,
        });
      } catch (error) {
        await helpers.sendIM(client, command.user_id, `${t('TEXTARCHIVEERROR')}: ${oneChannel.gch_name} (${error}`);
      }
    }
    await helpers.sendIM(client, command.user_id, `${game.gms_name} ${t('TEXTARCHIVED')}`);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDARCHIVE')}: ${error}`);
  }
}

async function startStemRonde({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTSTARTVOTEROUNDMODERATOR')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const channelId = await queries.getChannel(game.gms_id, channelType.vote);
    const channelUsersList = await helpers.getUserlist(client, channelId);
    await queries.startPoll(game.gms_id, command.text.trim() || ' ');
    const playersAlive = await queries.getAlive(game.gms_id);
    const channelUsersAlive = channelUsersList.filter((x) => playersAlive.map((y) => y.user_id).includes(x.id));

    const chuckedUsersAlive = [];
    while (channelUsersAlive.length) {
      chuckedUsersAlive.push(channelUsersAlive.splice(0, 5));
    }

    let buttonblocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: command.text.trim() || ' ',
        },
      },
    ];
    for (const channelChunk of chuckedUsersAlive)
      buttonblocks = buttonblocks.concat([
        {
          type: 'actions',
          elements: channelChunk.map((x) => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: x.name,
            },
            value: x.id,
            action_id: `stem-${x.id}`,
          })),
        },
      ]);
    const message = await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      blocks: buttonblocks,
    });
    await queries.setMessageIdPoll(game.gms_id, message);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDVOTEROUND')}: ${error}`);
  }
}

async function stopStemRonde({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTSTOPGAMEROUNDMODERATOR')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    const playersAlive = await queries.getAlive(game.gms_id);
    const channelUsersAlive = channelUsersList.filter((x) => playersAlive.map((y) => y.user_id).includes(x.id));

    const poll = await queries.stopPoll(game.gms_id);
    const pollResults = await queries.getPollResults(poll);
    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: poll.gpo_slack_message_id.split('-')[0],
      ts: poll.gpo_slack_message_id.split('-')[1],
      text: `${poll.gpo_title} ${t('TEXTCLOSED')}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${poll.gpo_title} ${t('TEXTCLOSED')}`,
          },
        },
      ],
    });
    const mayorId = channelUsersAlive
      .filter((x) => x.status === t('TEXTMAYOR'))
      .map((y) => y.id)
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
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTOPVOTEROUND')}: ${error}`);
  }
}

async function stemHerinnering({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORVOTEREMINDER')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const playersNotVoted = await queries.getAliveNotVoted(game.gms_id);
    const message = `${t('TEXTNOTVOTEDTIME')} ${command.text.trim()} om te stemmen, stemmen is verplicht`;
    for (const player of playersNotVoted) {
      await helpers.sendIM(client, player.user_id, message);
    }
    await helpers.sendIM(client, command.user_id, `${playersNotVoted.length} stemherinneringen verstuurd`);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMINDER')}: ${error}`);
  }
}

async function stemStand({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    if (!(await queries.isSectator(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORVOTESCORE')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    // tijdelijk uitschakelen stemstand
    // if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
    //   const warning = `sorry sectators op verzoek van de vertellers staat wwstemstand uit`;
    //   await helpers.sendIM(client, command.user_id, warning);
    //   return;
    // }
    const prelimResult = await queries.getCurrentPollResults(game.gms_id);
    if (!prelimResult.length) {
      return await helpers.sendIM(client, command.user_id, `${t('TEXTNOVOTES')}`);
    }
    await helpers.sendIM(
      client,
      command.user_id,
      `${prelimResult.map((x) => `${t('TEXTVOTESON')} <@${x.votee}>: *${x.votes}*`).join('\n')}`
    );
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDVOTESCORE')}: ${error}`);
  }
}

async function startVluchtigeStemRonde({ command, ack, say }) {
  ack();
  try {
    const gameId = await queries.getActiveGameWithChannel(command.channel_id);
    let playersAlive = await queries.getAlive(gameId.gms_id);
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
          text: `${t('TEXTQUICKVOTE')}:`,
        },
      },
    ];
    for (const channelChunk of chuckedUsersAlive)
      buttonblocks = buttonblocks.concat([
        {
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
        },
      ]);
    buttonblocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEQUICKVOTE')}`,
          },
          value: `sluit`,
          action_id: `vluchtig-sluit`,
        },
      ],
    });
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: command.channel_id,
      blocks: buttonblocks,
    });
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTARTQUICKVOTE')}: ${error}`);
  }
}

async function startRegistratie({ command, ack, say }) {
  ack();
  try {
    params = command.text.trim().split(' ');
    if (params.length !== 3) {
      const warning = `${t('TEXTTHREEPARAMETERSNEEDED')} ${t('COMMANDSTARTREGISTRATION')} [${t('TEXTPASSWORD')}] [${t(
        'TEXTVOTESTYLE'
      )}] [${t('TEXTREVIVEABLE')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params[0] !== process.env.MNOT_ADMIN_PASS) {
      const warning = `${t('TEXTINCORRECTPASSWORDSTARTGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params[1] !== t('TEXTBLIND')) {
      const warning = `${t('TEXTINCORRECTVOTESTYLE')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const lastGameName = await queries.getLastGameName();
    const gameName = `ww${parseInt(lastGameName[0].gms_name.substring(2)) + 1}`;
    const userName = await helpers.getUserName(client, command.user_id);
    const result = await queries.createNewGame(params[1], gameName, params[2], command.user_id, userName);
    if (result.succes) {
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.REG_CHANNEL || command.channel_id,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTREGISTRATIONSGAME')} (${result.gameName}) ${t('TEXTAREOPENED')} ${t(
                'COMMANDIWILLJOIN'
              )} ${t('TEXTSUBSCRIBE')} ${t('COMMANDIWILLVIEW')} ${t('TEXTVIEW')}`,
            },
          },
        ],
      });
    } else {
      await helpers.sendIM(client, command.user_id, result.error);
    }
  } catch (error) {
    await helpers.sendIM(
      client,
      command.user_id,
      `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTARTREGISTRATION')}: ${error}`
    );
  }
}

async function startSpel({ command, ack, say }) {
  ack();
  try {
    params = command.text.trim().split(' ');
    if (params.length !== 3) {
      const warning = `${t('TEXTTHREEPARAMETERSNEEDED')} ${t('COMMANDSTARTGAME')} [${t('TEXTGAMENAME')}] [${t(
        'TEXTPLAYERAMOUNT'
      )}] [${t('TEXTNAMEMAINCHANNEL')}] ${t('TEXTUSESTATUS')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const game = await queries.getGameName(params[0]);
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORSTARTGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    let channelName;
    const regexName = /^ww[0-9].*/;
    if (regexName.test(params[2]) === false) {
      channelName = `${game.gms_name.toLowerCase().split(' ').join('_')}_${params[2].toLowerCase()}`;
    } else {
      channelName = params[2].toLowerCase();
    }
    const hoofdkanaal = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: channelName,
      is_private: true,
    });

    const hiernamaals = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_${t('TEXTSPECTATORS')}`,
      is_private: true,
    });

    const stemhok = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_${t('TEXTVOTEBOOTH')}`,
      is_private: true,
    });

    const stemstand = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_${t('TEXTVOTEFLOW')}`,
      is_private: true,
    });

    const kletskanaal = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_${t('TEXTTALKCHANNEL')}`,
      is_private: true,
    });

    const spoilerkanaal = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_${t('TEXTSPOILERCHANNEL')}`,
      is_private: true,
    });

    const result = await queries.startGame(game.gms_id, params[1]);

    if (result.succes) {
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: hoofdkanaal.channel.id,
        users: result.playerList.map((x) => x.gpl_slack_id).join(','),
      });
      const hoofdkanaalInput = {
        gch_gms_id: game.gms_id,
        gch_slack_id: hoofdkanaal.channel.id,
        gch_name: hoofdkanaal.channel.name,
        gch_type: channelType.main,
        gch_user_created: command.user_id,
      };
      await queries.logChannel(hoofdkanaalInput);
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: stemhok.channel.id,
        users: result.playerList.map((x) => x.gpl_slack_id).join(','),
      });
      const stemhokInput = {
        gch_gms_id: game.gms_id,
        gch_slack_id: stemhok.channel.id,
        gch_name: stemhok.channel.name,
        gch_type: channelType.vote,
        gch_user_created: command.user_id,
      };
      await queries.logChannel(stemhokInput);
      const stemstandInput = {
        gch_gms_id: game.gms_id,
        gch_slack_id: stemstand.channel.id,
        gch_name: stemstand.channel.name,
        gch_type: channelType.stemstand,
        gch_user_created: command.user_id,
      };
      await queries.logChannel(stemstandInput);
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: hoofdkanaal.channel.id,
        users: result.viewerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: stemhok.channel.id,
        users: result.viewerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: stemstand.channel.id,
        users: result.vertellerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: hiernamaals.channel.id,
        users: result.viewerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: kletskanaal.channel.id,
        users: result.viewerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: spoilerkanaal.channel.id,
        users: result.vertellerList.map((x) => x.gpl_slack_id).join(','),
      });
      const hiernamaalsInput = {
        gch_gms_id: game.gms_id,
        gch_slack_id: hiernamaals.channel.id,
        gch_name: hiernamaals.channel.name,
        gch_type: channelType.viewer,
        gch_user_created: command.user_id,
      };
      await queries.logChannel(hiernamaalsInput);

      const uitgeloot = `${t('TEXTNOTINGAME')}`;
      const uitgeloteSpelers = await queries.getNotDrawnPlayers(game.gms_id);
      for (const speler of uitgeloteSpelers) {
        await helpers.sendIM(client, speler.gpl_slack_id, uitgeloot);
      }
      let returnText = [];
      const usersList = await helpers.getUserlist(client, hoofdkanaal.channel.id);
      for (i = 0; i < result.playerList.length; i++) {
        let temp = usersList.filter((y) => y.id == result.playerList[i].gpl_slack_id);
        returnText += `${temp[0].name}\n`;
      }
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: hoofdkanaal.channel.id,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${params[0]} ${t('TEXTGAMESTARTEDREGISTRATION')} ${returnText}`,
            },
          },
        ],
      });
    } else {
      await helpers.sendIM(client, command.user_id, result.error);
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTARTGAME')}: ${error}`);
  }
}

async function stopSpel({ command, ack, say }) {
  ack();
  try {
    params = command.text.trim().split(' ');
    if (params.length < 1) {
      const warning = `${t('TEXTTWODPARAMETERS')} ${t('COMMANDSTOPGAME')} [${t('TEXTPASSWORD')}] [${t(
        'TEXTGAMENAME'
      )}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const game = await queries.getGameName(params[1]);

    if (params[0] !== process.env.MNOT_ADMIN_PASS) {
      const warning = `${t('TEXTPASSWORDNEEDEDSTOPGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORSTOPGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const result = await queries.stopGame(game.gms_id);
    if (result.succes) {
      const allChannels = await queries.getAllChannels(game.gms_id);
      const channelId = await queries.getChannel(game.gms_id, channelType.vote);
      const chuckedChannels = [];
      while (allChannels.length) {
        chuckedChannels.push(allChannels.splice(0, 5));
      }

      let buttonblocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${t('TEXTCLICKSELFINVITECHANNELS')}`,
          },
        },
      ];
      for (const channelChunk of chuckedChannels)
        buttonblocks = buttonblocks.concat([
          {
            type: 'actions',
            elements: channelChunk.map((x) => ({
              type: 'button',
              text: {
                type: 'plain_text',
                text: x.gch_name,
              },
              value: x.gch_slack_id,
              action_id: `selfinvite-${x.gch_slack_id}`,
            })),
          },
        ]);
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channelId,
        blocks: buttonblocks,
      });

      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.REG_CHANNEL || command.channel_id,
        text: `${game.gms_name} ${t('TEXTGAMECLOSED')}`,
      });

      await helpers.sendIM(client, command.user_id, `${game.gms_name} ${t('TEXTGAMECLOSED')}`);
    } else {
      await helpers.sendIM(client, command.user_id, result.error);
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTOPGAME')}: ${error}`);
  }
}

async function createChannel({ command, ack, say }) {
  ack();
  try {
    const games = await queries.getActiveGameUser(command.user_id);
    params = command.text.trim().split(' ');
    if (params.length !== 1) {
      const warning = `${t('TEXTONEPARAMETERNEEDED')} ${t('COMMANDCREATECHANNEL')} [${t('TEXTNAMECHANNEL')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (games.length == 1) {
      await actions.createNewChannelFunction(games[0].gms_id, command.user_id, params[0], 0, 0, true);
    } else if (games.length > 0) {
      const im = await client.conversations.open({
        token: process.env.SLACK_BOT_TOKEN,
        users: command.user_id,
      });
      let buttonElements = [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEMESSAGE')}`,
          },
          value: 'Close',
          action_id: `delete-${command.channel_id}`,
        },
      ];
      for (const game of games) {
        buttonElements.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: game.gms_name,
          },
          value: params[0].toString(),
          action_id: `kanaal-${game.gms_id}`,
        });
      }
      let buttonblocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKCHANNEL')}`,
          },
        },
        {
          type: 'actions',
          elements: buttonElements,
        },
      ];
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: im.channel.id,
        blocks: buttonblocks,
      });
    } else {
      throw 'Je doet niet mee aan een actief spel';
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDCREATECHANNEL')}: ${error}`);
  }
}

async function dood({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const params = command.text.trim().split(' ');
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `TEXTKILLPEOPLE`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params.length !== 1) {
      const warning = `${t('COMMANDDEAD')} ${t('TEXTONEPARAMETER')} [@${t('TEXTUSER')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (/^<(@[A-Z0-9]*)(\|.*)?>/.test(params[0]) === false) {
      const warning = `${t('TEXTFIRSTPARAMETERSHOULD')} ${t('COMMANDDEAD')} ${t('TEXTSHOULDBEA')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }

    const userId = params[0].match(/^<@([A-Z0-9]*)(\|.*)?>/)[1];
    const channelId = await queries.getChannel(game.gms_id, channelType.viewer);
    await queries.killUser(game.gms_id, userId);
    const message = `${t('TEXTYOUDIED')} ${t('TEXTDEAD')}? ${t('TEXTINVITEDAFTERLIFE')}`;
    await helpers.sendIM(client, userId, message);
    await client.conversations.invite({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      users: userId,
    });
    await helpers.sendIM(client, command.user_id, `${params[0]} is ${t('TEXTDEAD')}`);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDDEAD')}: ${error}`);
  }
}

async function reanimeer({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const params = command.text.trim().split(' ');
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORREVIVE')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params.length !== 1) {
      const warning = `${t('COMMANDREVIVE')} ${t('TEXTONEPARAMETER.')} [@${t('TEXTUSER')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (/^<(@[A-Z0-9]*)(\|.*)?>/.test(params[0]) === false) {
      const warning = `${t('TEXTFIRSTPARAMETER')} ${t('COMMANDREVIVE')} ${t('TEXTSHOULDBEA')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }

    const userId = params[0].match(/^<@([A-Z0-9]*)(\|.*)?>/)[1];
    const channelId = await queries.getChannel(game.gms_id, channelType.viewer);
    await queries.reanimateUser(game.gms_id, userId);
    const message = `${t('TEXTRERISE')}`;
    await helpers.sendIM(client, userId, message);
    await helpers.sendIM(client, command.user_id, `${params[0]} is ${t('TEXTALIVE')}`);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDREVIVE')}: ${error}`);
  }
}

async function extraVerteller({ command, ack, say }) {
  ack();
  try {
    const params = command.text.trim().split(' ');
    if (params.length !== 1) {
      const warning = `${t('COMMANDEXTRAMODERATOR')} ${t('TEXTONEPARAMETER')} [@${t('TEXTUSER')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (/^<(@[A-Z0-9]*)(\|.*)?>/.test(params[0]) === false) {
      const warning = `${t('TEXTFIRSTPARAMETERSHOULD')} ${t('COMMANDEXTRAMODERATOR')} ${t('TEXTSHOULDBEA')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const vertellerId = params[0].match(/^<@([A-Z0-9]*)(\|.*)?>/)[1];
    const games = await queries.getGameVerteller(command.user_id, vertellerId);
    if (games.length == 1) {
      await actions.vertellerToevoegenFunction(
        vertellerId,
        command.user_id,
        process.env.REG_CHANNEL || command.channel_id,
        games[0].gms_id,
        0,
        0,
        true
      );
    } else if (games.length > 0) {
      const im = await client.conversations.open({
        token: process.env.SLACK_BOT_TOKEN,
        users: command.user_id,
      });
      let buttonElements = [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEMESSAGE')}`,
          },
          value: 'Close',
          action_id: `delete-${command.channel_id}`,
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
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: im.channel.id,
        blocks: buttonblocks,
      });
    } else {
      await helpers.sendIM(client, command.user_id, `${t('TEXTONLYMODSCANMAKEMODS')}`);
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function nodigVertellersUit({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameUser(command.user_id);
    const vertellers = await queries.getVertellers(game[0].gms_id);
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    const uitTeNodigen = vertellers.filter((x) => !channelUsersList.map((y) => y.id).includes(x));
    if (!uitTeNodigen.length) {
      await helpers.sendIM(client, command.user_id, `${t('TEXTALLMODERATORSINVITED')}`);
    } else {
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: command.channel_id,
        users: uitTeNodigen.join(','),
      });
      const kanaalInput = {
        gch_gms_id: game[0].gms_id,
        gch_slack_id: command.channel_id,
        gch_name: command.channel_name,
        gch_type: channelType.standard,
        gch_user_created: command.user_id,
      };
      await queries.logChannel(kanaalInput);
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDINVITEMODERATOR')}: ${error}`);
  }
}

async function nodigSpelersUit({ command, ack, say }) {
  ack();
  params = command.text.trim().split(' ');
  try {
    if (params[0] !== 'ikweethetzeker') {
      const warning = `${t('TEXTBESURE')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const spelers = await queries.getEveryOne(game.gms_id);
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    const uitTeNodigen = spelers.filter((x) => !channelUsersList.map((y) => y.id).includes(x.user_id));
    if (!uitTeNodigen.length) {
      await helpers.sendIM(client, command.user_id, `${t('TEXTALLINVITED')}`);
    } else {
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: command.channel_id,
        users: uitTeNodigen.map((x) => x.user_id).join(','),
      });
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDINVITEPLAYERS')}: ${error}`);
  }
}

async function ikDoeMee({ command, ack, say }) {
  ack();
  try {
    const games = await queries.getGameRegisterUser(command.user_id);
    if (games.length == 1) {
      await actions.inschrijvenFunction(command.user_id, games[0].gms_id, 0, 0, true);
    } else if (games.length > 0) {
      const im = await client.conversations.open({
        token: process.env.SLACK_BOT_TOKEN,
        users: command.user_id,
      });
      let buttonElements = [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEMESSAGE')}`,
          },
          value: 'Close',
          action_id: `delete-${command.channel_id}`,
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
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: im.channel.id,
        blocks: buttonblocks,
      });
    } else {
      await helpers.sendIM(client, command.user_id, `${t('TEXTNOREGISTRATION')}`);
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${error}`);
  }
}

async function ikKijkMee({ command, ack, say }) {
  ack();
  try {
    const games = await queries.getGameOpenUser(command.user_id);
    if (games.length == 1) {
      await actions.meekijkenFunction(command.user_id, games[0].gms_id, 0, 0, true);
    } else if (games.length > 0) {
      const im = await client.conversations.open({
        token: process.env.SLACK_BOT_TOKEN,
        users: command.user_id,
      });
      let buttonElements = [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEMESSAGE')}`,
          },
          value: 'Close',
          action_id: `delete-${command.channel_id}`,
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
          action_id: `meekijken-${game.gms_id}`,
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
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: im.channel.id,
        blocks: buttonblocks,
      });
    } else {
      await helpers.sendIM(
        client,
        command.user_id,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${t('TEXTNOREGISTRATION')}`
      );
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${error}`);
  }
}

async function ikDoeNietMeerMee({ command, ack, say }) {
  ack();
  try {
    const games = await queries.getGameUnregisterUser(command.user_id);
    if (games.length == 1) {
      await actions.uitschrijvenFunction(command.user_id, games[0].gms_id, 0, 0, true);
    } else if (games.length > 0) {
      const im = await client.conversations.open({
        token: process.env.SLACK_BOT_TOKEN,
        users: command.user_id,
      });
      let buttonElements = [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `${t('TEXTCLOSEMESSAGE')}`,
          },
          value: 'Close',
          action_id: `delete-${command.channel_id}`,
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
            text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKVIEW')}`,
          },
        },
        {
          type: 'actions',
          elements: buttonElements,
        },
      ];
      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: im.channel.id,
        blocks: buttonblocks,
      });
    } else {
      await helpers.sendIM(
        client,
        command.user_id,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${t('TEXTNOTENROLLED')}`
      );
    }
  } catch (error) {
    await helpers.sendIM(
      client,
      command.user_id,
      `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${error}`
    );
  }
}

async function verdeelRollen({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTONLYMODERATORROLES')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const params = command.text.trim().split(' ');
    // The following lines removed because in the new setup you can
    // (and are encouraged to do so) set the number of civilians

    //     if (!command.text.trim().endsWith(':')) {
    //       const warning = `${t('TEXTNOCIVILIANS')}`;
    //       await helpers.sendIM(client, command.user_id, warning);
    //       return;
    //     }

    const playersAlive = await queries.getAlive(game.gms_id);
    helpers.shuffle(playersAlive);
    let neededRoles = playersAlive.length;
    let playerIndex = 0;
    let optionals = [];

    for (const rol of params) {
      const rolNaam = rol.split(':')[0];
      const aantal = rol.split(':')[1];

      let aantalMin = 0;
      let aantalOpt = 0;

      if (aantal) {
        if (aantal.split('-').length == 2) {
          aantalMin = parseInt(aantal.split('-')[0]);
          aantalOpt = parseInt(aantal.split('-')[1]) - aantalMin;
          neededRoles -= aantalMin;
        } else if (aantal.split('-').length == 1) {
          aantalMin = parseInt(aantal.split('-')[0]);
          neededRoles -= aantalMin;
        }
      } else {
        // The value for aantalOpt is the number of players minus the minumum number for each role
        aantalOpt = neededRoles;
        // Now we don't have need for more optional roles
        neededRoles = 0;
      }

      // First give all the mandatory roles
      for (let i = 0; i < aantalMin; i++) {
        playersAlive[playerIndex++].rol = rolNaam;
      }

      // Store the optional roles for later use
      for (let i = 0; i < aantalOpt; i++) {
        optionals.push(rolNaam);
      }
    }

    // shuffle the remaining roles
    helpers.shuffle(optionals);

    for (const player of playersAlive) {
      if (!player.rol && optionals.length > 0) {
        player.rol = optionals.pop();
      } else if (!player.rol && optionals.length == 0) {
        // We don't have enough roles for all the players
        throw `${t('TEXTNOTENOUGHROLES')}`;
      }
    }

    const rolLijst = [];
    for (const player of playersAlive) {
      await helpers.sendIM(
        client,
        player.user_id,
        `${t('TEXTHI')} <@${player.user_id}>, ${t('TEXTYOURROLE')} ${player.rol}`
      );
      rolLijst.push(`<@${player.user_id}>: ${player.rol}`);
    }
    await helpers.sendIM(client, command.user_id, `${t('TEXTROLES')}:\n${rolLijst.join('\n')}`);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDGIVEROLES')}: ${error}`);
  }
}

async function help({ command, ack, say }) {
  ack();
  try {
    const helpText = `${t('HELPTEXT')}`;
    await helpers.sendIM(client, command.user_id, helpText);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDHELP')}: ${error}`);
  }
}

async function lotto({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const playersAlive = await queries.getAlive(game.gms_id);
    helpers.shuffle(playersAlive);
    if (playersAlive.length) {
      if (command.text.trim() === 'public') {
        say({
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${t('TEXTIFIVOTE')} <@${playersAlive[0].user_id}>\n(${t('TEXTREMARK')}!)`,
              },
            },
          ],
        });
      } else {
        await client.chat.postEphemeral({
          token: process.env.SLACK_BOT_TOKEN,
          channel: command.channel_id,
          attachments: [{ text: `${t('TEXTUSE')} '${t('COMMANDLOTTO')} ${t('TEXTPUBLIC')}` }],
          text: `${t('TEXTIFIVOTE')} <@${playersAlive[0].user_id}>\n(${t('TEXTREMARK')}!)`,
          user: command.user_id,
        });
      }
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDLOTTO')}: ${error}`);
  }
}

async function summarize({ command, ack, say }) {
  ack();

  try {
    // Only a moderator can give this command
    const game = await queries.getGameWithChannel(command.channel_id);
    // if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
    //   const warning = `${t('TEXTONLYMODERATORSUMMARIZE')}`;
    //   await helpers.sendIM(client, command.user_id, warning);
    //   return;
    // }
    const params = command.text.trim().split(' ');
    const regex = /202[0-9]-[0-1][0-9]-[0-3][0-9]/m;
    if (regex.exec(params[0]) === null) {
      throw 'Date is invalid, format is yyyy-mm-dd';
    }
    if (params.length < 2) {
      params[1] = params[0];
    } else {
      if (regex.exec(params[1]) === null) {
        throw 'Date is invalid, format is yyyy-mm-dd';
      }
    }

    const threads = await queries.threatIdsInChannelByDate(command.channel_id, params[0], params[1]);
    const threadIds = threads.map((x) => x.gpm_thread_ts);
    let ids = JSON.stringify(threadIds);

    const ntMessages = await queries.nonThreadedMessagesInChannelByDate(command.channel_id, params[0], params[1]);
    let tMessages = {};

    let summary = [];
    let lastUser = null;
    let lastTime = new Date(0);
    let newTime = null;
    let threadBlock = {};

    // Loop through all the non-threaded messages (or the original post of a thread)
    for (const message of ntMessages) {
      newTime = new Date(message.gpm_created_at);

      // If the post is written by a different user (than the prev. post) or there is more than a minute between posts write a "header"
      if (message.gpl_name !== lastUser || newTime - lastTime > 1 * 60 * 1000) {
        lastUser = message.gpl_name;
        lastTime = newTime;
        summary.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*${message.gpl_name}* (${newTime.toLocaleTimeString()})`,
            },
          ],
        });
      }

      // If the post contains text (and not only an image) write the message
      if (message.gpm_blocks !== '') {
        summary.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${message.gpm_blocks}`,
          },
        });
      }

      // If the post contains an image, write a link to that message
      if (message.gpm_files !== null) {
        try {
          let files = JSON.parse(message.gpm_files);
          for (file of files) {
            summary.push(file);
          }
        } catch (err) {
          //not a valid JSON try backup strat
          try {
            summary.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message.gpm_files.match(/<(.*)\|/)[1],
              },
            });
          } catch (err) {
            summary.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '<failed loading image>',
              },
            });
          }
        }
      }

      // Post threaded messages
      if (threadIds.includes(message.gpm_slack_ts)) {
        tMessages = await queries.threadedMessagesInChannelByTS(command.channel_id, message.gpm_slack_ts);

        for (const tMessage of tMessages) {
          threadBlock = { type: 'section', fields: [] };
          threadBlock.fields.push({
            type: 'mrkdwn',
            text: `> _${tMessage.gpl_name}_`,
          });
          threadBlock.fields.push({
            type: 'mrkdwn',
            text: `_${tMessage.gpm_blocks}_`,
          });
          summary.push(threadBlock);
        }
      }
    }
    while (summary.length) {
      const subSummary = summary.splice(0, 25);
      say({
        blocks: subSummary,
      });
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSUMMARIZE')}: ${error}`);
  }
}
