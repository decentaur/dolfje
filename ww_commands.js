const helpers = require('./ww_helpers');
const queries = require('./ww_queries');
const { t } = require('localizify');
module.exports = { addCommands };
let client;

const channelType = {
  main: 'MAIN',
  vote: 'VOTE',
  viewer: 'VIEWER',
  standard: 'NORMAL'
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
}

async function channelList({ command, ack, say }) {
  ack();
  let returnText;
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id); 
    const channelPlayersList = [];
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    const playerList = await queries.getPlayerList(game.gms_id);
    for (const user of channelUsersList.members) {
      if (playerList.members.includes(user.id)) {
        channelPlayersList.push({
          id: user.id,
          name: user.profile.display_name_normalized || user.profile.real_name_normalized,
          status: user.profile.status_text
        });
      }
    }
    let seperator = ', ';
    if (command.text.trim() === 'newline') {
      seperator = '\n';
    }
    returnText = `*${t('TEXTLIVING')}* (${
      channelPlayersList.filter((x) => x.status === t('TEXTPARTICIPANT') || x.status === t('TEXTMAYOR')).length
    }): ${channelPlayersList
      .filter((x) => x.status === t('TEXTPARTICIPANT') || x.status === t('TEXTMAYOR'))
      .map((x) => x.name)
      .join(seperator)}\n*${t('TEXTMULTIPLEDEAD')}* (${
        channelPlayersList.filter((x) => x.status === t('TEXTDEAD')).length
    }): ${channelPlayersList
      .filter((x) => x.status === t('TEXTDEAD'))
      .map((x) => x.name)
      .join(seperator)}\n*${t('TEXTNOSTATUS')}* (${
        channelPlayersList.filter((x) => x.status === '').length
    }): ${channelPlayersList
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
    if (state.length > 0){
      returnText = `${t('TEXTSTATUSGAME')}\n\n`;
      for(i=0; i<state.length; i++) {
        switch (state[i].gms_status) {
          case 'REGISTERING':
          returnText += `${i+1}. \t ${state[i].gms_name} \t ${t('TEXTOPENREGISTRATION')} ${t('COMMANDIWILLJOIN')} ${t('TEXTREGISTER')} ${state[0].players} ${t('TEXTVIEWING')} ${state[0].viewers} \n`;
          break;          
          case 'STARTED':
          returnText += `${i+1}. \t ${state[i].gms_name} \t ${t('TEXTGAMESTARTED')} ${state[0].alive} ${t('TEXTPLAYERSAND')} ${state[0].dead} ${t('TEXTDEADPLAYERS')} \n`;
          break;
        }
      }
      const enrolledGames = await queries.getGameUnregisterUser(command.user_id);
      console.log(enrolledGames);
      if (enrolledGames) {
        for (const inGame of enrolledGames) {
          returnText += `\n ${t('TEXTENROLLEDIN')} ${enrolledGame.gms_name}`;
        }
      } else {
        returnText += `${t('TEXTNOTENROLLED')}`
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
    game = await queries.getActiveGameWithChannel(command.channel_id);
    let regels = await queries.getRules(game.gms_id);
    console.log(regels)
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
    const im = await client.conversations.open({
      token: process.env.SLACK_BOT_TOKEN,
      users: command.user_id,
    });

    let buttonElements = [{
      type: 'button',
      text: {
        type: 'plain_text',
        text: `${t('TEXTCLOSEMESSAGE')}`,
      },
      value: 'Close',
      action_id: `delete-${command.channel_id}`,
    }];
    // buttonElements.push({
    //   type: 'button',
    //   text: {
    //     type: 'plain_text',
    //     text: `${t('TEXTALLCHANNELS')}`
    //   },
    //   value: 'AllChannels',
    //   action_id: 'archiveer-AllChannels'
    // })
    for (const oneChannel of channelList) {
      buttonElements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: channelList.gch_name,
        },
        value: channelList.gch_slack_id.toString(),
        action_id: `archiveer-${channelList.gch_slack_id}`,
      });
    }

    let buttonblocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKARCHIVECHANNELS')}`,
        },
      },
      {
        type: 'actions',
        elements: buttonElements,
      }];

    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: im.channel.id,
      user: command.user_id,
      blocks: buttonblocks,
    });
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
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
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
      channel: command.channel_id,
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
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORVOTESCORE')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
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
    let playersAlive = await queries.getAlive(gameId);
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
    if (params.length !== 4) {
      const warning = `${t('TEXTFOURPARAMETERSNEEDED')} ${t('COMMANDSTARTREGISTRATION')} [${t('TEXTPASSWORD')}] [${t(
        'TEXTVOTESTYLE')}] [${t('TEXTGAMENAME')}] [${t('TEXTREVIVEABLE')}]`;
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
    if (!params[2].match(/^ww([0-9]|[0-9][0-9].*)/)) {
      const warning = `${t('TEXTINCORRECTNAME')}`
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const userName = await helpers.getUserName(client, command.user_id);
    const result = await queries.createNewGame(params[1], params.slice(2).join(' '), params[3].toUpperCase(), command.user_id, userName);
    if (result.succes) {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTREGISTRATIONSGAME')} (${result.gameName}) ${t('TEXTAREOPENED')} ${t(
                'COMMANDIWILLJOIN'
              )} ${t('TEXTSUBSCRIBE')}`,
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
      const warning = `${t('TEXTTHREEPARAMETERSNEEDED')} ${t('COMMANDSTARTGAME')} [${t('TEXTGAMENAME')}] [${t('TEXTPLAYERAMOUNT')}] [${t(
        'TEXTNAMEMAINCHANNEL')}] ${t('TEXTUSESTATUS')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const game = await queries.getGameName(params[0]);
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTMODERATORSTARTGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }

    const hoofdkanaal = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: params[2].toLowerCase(),
      is_private: true,
    });

    const hiernamaals = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_sectators`,
      is_private: true,
    });

    const stemhok = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${game.gms_name.toLowerCase().split(' ').join('_')}_${t('TEXTVOTEBOOTH')}`,
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
        gch_id: game.gms_id,
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
        gch_id: game.gms_id,
        gch_slack_id: stemhok.channel.id,
        gch_name: stemhok.channel.name,
        gch_type: channelType.vote,
        gch_user_created: command.user_id,
      };
      await queries.logChannel(stemhokInput);
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
        channel: hiernamaals.channel.id,
        users: result.viewerList.map((x) => x.gpl_slack_id).join(','),
      });
      const hiernamaalsInput = {
        gch_id: game.gms_id,
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
      const activePlayerList = [];
      const activePlayers = await queries.getPlayerList(game.gms_id);
      const playerList = await queries.getUserlist(client, hoofdkanaal.channel.id);
      for (const player of playerList.members) {
        if (activePlayers.members.includes(player.id)) {
          activePlayerList.push({
            id: player.id,
            name: player.profile.display_name_normalized || player.profile.real_name_normalized,
            status: player.profile.status_text,
          })
        }
      }
      let seperator = ', ';
      let returnText = `(${activePlayerList
        .map((x) => x.name)
        .join(seperator)
      })`

      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              attachments,
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
      const warning = `${t('TEXTTWODPARAMETERS')} ${t('COMMANDSTOPGAME')} [${t('TEXTPASSWORD')}] [${t('TEXTGAMENAME')}]`;
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
      await helpers.sendIM(client, command.user_id, `${t('TEXTGAMECLOSED')}`);
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
    const game= await queries.getActiveGameWithChannel(command.channel_id);
    params = command.text.trim().split(' ');
    if (params.length !== 1) {
      const warning = `${t('TEXTONEPARAMETERNEEDED')} ${t('COMMANDCREATECHANNEL')} [${t('TEXTNAMECHANNEL')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const alleVertellers = await queries.getVertellers(game.gms_id);
    if (!alleVertellers.includes(command.user_id)) {
      alleVertellers.push(command.user_id);
    }
    if (!params[0].match(/^ww0-9.*/)) {
      const channelName = `${game.gms_name.toLowerCase().split(' ').join('_')}_${params[0].toLowerCase()}`
    } else {
      const channelName = params[0].toLowerCase();
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
      text: `${await helpers.getUserName(command.user_id)} ${t('TEXTCREATEDCHANNEL')}`,
    });
    const kanaalInput = {
        gch_id: game.gms_id,
        gch_slack_id: kanaal.channel.id,
        gch_name: kanaal.channel.name,
        gch_type: channelType.standard,
        gch_user_created: command.user_id,
        gch_created_at: new Date(Math.floor(Date.now()))
      };
    await queries.logChannel(kanaalInput);

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
      const warning = `TEXTFIRSTPARAMETERSHOULD ${t('COMMANDDEAD')} ${t('TEXTSHOULDBEA')}`;
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
    await client.conversations.kick({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      user: userId,
    });
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDREVIVE')}: ${error}`);
  }
}

async function extraVerteller({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameWithChannel(command.channel_id);
    const params = command.text.trim().split(' ');
    if (!(await queries.isVerteller(game.gms_id, command.user_id))) {
      const warning = `${t('TEXTONLYMODSCANMAKEMODS')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params.length !== 1) {
      const warning = `${t('COMMANDEXTRAMODERATOR')} ${t('TEXTONEPARAMETER')} [@${t('TEXTUSER')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const userId = params[0].match(/^<@([A-Z0-9]*)(\|.*)?>/)[1];
    if(!game.gpl_status === 'VERTELLER' && !game.gpl_status === 'ALIVE') {
      const warning = `${command.text} ${t('TEXTISPLAYER')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (/^<(@[A-Z0-9]*)(\|.*)?>/.test(params[0]) === false) {
      const warning = `${t('TEXTFIRSTPARAMETERSHOULD')} ${t('COMMANDEXTRAMODERATOR')} ${t('TEXTSHOULDBEA')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const userName = await helpers.getUserName(client, userId);
    await queries.addVerteller(userId, userName, game.gms_id);
    if (game.gms_status === 'STARTED') {
        const allChannels = await queries.getAllChannels(game.gms_id)
        for (const oneChannel of allChannels) {
          await client.conversations.invite({
            token: process.env.SLACK_BOT_TOKEN,
            channel: oneChannel.gch_slack_id,
            users: userId,
          });
        }
      }
    say({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${command.text} ${t('TEXTISVERTELLER')}`,
          },
        },
      ],
    });

    const message = `${t('TEXTBECAMEMODERATOR')}`;
    await helpers.sendIM(client, userId, message);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function nodigVertellersUit({ command, ack, say }) {
  ack();
  try {
    const game = await queries.getActiveGameUser(command.user_id);
    const vertellers = await queries.getVertellers(game.gms_id);
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
      gch_id: game.gms_id,
      gch_slack_id: command.channel_id,
      gch_name: command.channel_name,
      gch_type: channelType.standard,
      gch_user_created: command.user_id,
      gch_created_at: new Date(Math.floor(Date.now())),
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
    const games = await queries.getGameRegisterUser(command.userId);
    let buttonElements = [{
      type: 'button',
      text: {
        type: 'plain_text',
        text: `${t('TEXTCLOSEMESSAGE')}`,
      },
      value: 'Close',
      action_id: `delete-${command.channel_id}`,
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
          text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKREGISTER')}`,
        },
      },
      {
        type: 'actions',
        elements: buttonElements,
      }];
    await client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: command.channel_id,
      user: command.user_id,
      blocks: buttonblocks,
    });
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${error}`);
  }
}

async function ikKijkMee({ command, ack, say }) {
ack();
try{
  const games = await queries.getGameOpenUser(command.userId);

  let buttonElements = [{
    type: 'button',
    text: {
      type: 'plain_text',
      text: `${t('TEXTCLOSEMESSAGE')}`,
    },
    value: 'Close',
    action_id: `delete-${command.channel_id}`,
  }];
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
};
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
    }];
  await client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    channel: command.channel_id,
    user: command.user_id,
    blocks: buttonblocks,
  });
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${error}`);
  }
}

async function ikDoeNietMeerMee({ command, ack, say }) {
  ack();
  try {
  const games = await queries.getGameUnregisterUser(command.userId);
  let buttonElements = [{
    type: 'button',
    text: {
      type: 'plain_text',
      text: `${t('TEXTCLOSEMESSAGE')}`,
    },
    value: 'Close',
    action_id: `delete-${command.channel_id}`,
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
        text: `${t('TEXTCLICKGAME')} ${t('TEXTCLICKVIEW')}`,
      },
    },
    {
      type: 'actions',
      elements: buttonElements,
    }];
  await client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    channel: command.channel_id,
    user: command.user_id,
    blocks: buttonblocks,
  });
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${error}`);
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
    if(!command.text.trim().endsWith(':')) {
      const warning = `${t('TEXTNOCIVILIANS')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const playersAlive = await queries.getAlive(game.gms_id);
    helpers.shuffle(playersAlive);
    let playerIndex = 0;
    
    for (const rol of params) {
      const rolNaam = rol.split(':')[0];
      const aantal = rol.split(':')[1];
      if (aantal) {
        for (let i = 0; i < aantal; i++) {
          playersAlive[playerIndex++].rol = rolNaam;
        }
      } else {
        for (const player of playersAlive) {
          if (!player.rol) {
            player.rol = rolNaam;
          }
        }
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
