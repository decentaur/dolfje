const helpers = require('./ww_helpers');
const queries = require('./ww_queries');
const { t } = require('localizify');
module.exports = { addCommands };
let client;

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
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    let seperator = ', ';
    if (command.text.trim() === 'newline') {
      seperator = '\n';
    }
    returnText = `*${t('TEXTLIVING')}* (${
      channelUsersList.filter((x) => x.status === t('TEXTPARTICIPANT') || x.status === t('TEXTMAYOR')).length
    }): ${channelUsersList
      .filter((x) => x.status === t('TEXTPARTICIPANT') || x.status === t('TEXTMAYOR'))
      .map((x) => x.name)
      .join(seperator)}\n*${t('TEXTMULTIPLEDEAD')}* (${
      channelUsersList.filter((x) => x.status === t('TEXTDEAD')).length
    }): ${channelUsersList
      .filter((x) => x.status === t('TEXTDEAD'))
      .map((x) => x.name)
      .join(seperator)}\n*${t('TEXTNOSTATUS')}* (${
      channelUsersList.filter((x) => x.status === '').length
    }): ${channelUsersList
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
    if (state.length) {
      returnText = `${t('TEXTCURRENTGAME')} ${state[0].gms_name}, `;
      if (state[0].gms_status === 'STARTED') {
        returnText += `${t('TEXTGAMESTARTED')} ${state[0].alive} ${t('TEXTPLAYERSAND')} ${state[0].dead} ${t(
          'TEXTDEADPLAYERS'
        )} `;
      } else {
        returnText += `${t('TEXTOPENREGISTRATION')} ${t('COMMANDIWILLJOIN')} ${t('TEXTREGISTER')}: ${state[0].players}`;
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
    let regels = await queries.getRules();
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
      const warning = `${t('TEXTONEPARAMETERNEEDED')} ${t('COMMANDARCHIVE')} [${t('TEXTPASSWORD')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params[0] !== process.env.MNOT_ADMIN_PASS) {
      const warning = `${t('TEXTINCORRECTPASSWORD')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const channelList = await client.conversations.list({
      token: process.env.SLACK_BOT_TOKEN,
      exclude_archived: true,
      types: 'private_channel',
    });
    const im = await client.conversations.open({
      token: process.env.SLACK_BOT_TOKEN,
      users: command.user_id,
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
          text: `${t('TEXTCLICKARCHIVECHANNELS')}`,
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
              text: x.name,
            },
            value: x.id,
            action_id: `archiveer-${x.id}`,
          })),
        },
      ]);

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
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTSTARTVOTEROUNDMODERATOR')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    await queries.startPoll(command.text.trim() || ' ');
    const playersAlive = await queries.getAlive();
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
    await queries.setMessageIdPoll(message);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDVOTEROUND')}: ${error}`);
  }
}

async function stopStemRonde({ command, ack, say }) {
  ack();
  try {
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTSTOPGAMEROUNDMODERATOR')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const channelUsersList = await helpers.getUserlist(client, command.channel_id);
    const playersAlive = await queries.getAlive();
    const channelUsersAlive = channelUsersList.filter((x) => playersAlive.map((y) => y.user_id).includes(x.id));

    const poll = await queries.stopPoll();
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
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTMODERATORVOTEREMINDER')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const playersNotVoted = await queries.getAliveNotVoted();
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
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTMODERATORVOTESCORE')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const prelimResult = await queries.getCurrentPollResults();
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
    if (params.length < 3) {
      const warning = `${t('TEXTTHREEPARAMETERSNEEDED')} ${t('COMMANDSTARTREGISTRATION')} [${t('TEXTPASSWORD')}] [${t(
        'TEXTVOTESTYLE'
      )}] [${t('TEXTGAMENAME')}] `;
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
    const userName = await helpers.getUserName(client, command.user_id);
    const result = await queries.createNewGame(params[1], params.slice(2).join(' '), command.user_id, userName);
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
      const warning = `${t('TEXTTWOPARAMETERS')} ${t('COMMANDSTARTGAME')} [${t('TEXTPLAYERAMOUNT')}] [${t(
        'TEXTNAMEMAINCHANNEL')}] [${t('TEXTNAMEVIEWERCHANNEl')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTMODERATORSTARTGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const hoofdkanaal = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: params[1].toLowerCase(),
      is_private: true,
    });
    const game = await queries.getActiveGame();
    const hiernamaals = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: params[2].toLowerCase(),
      is_private: true,
    });
    const stemhok = await client.conversations.create({
      token: process.env.SLACK_BOT_TOKEN,
      name: `${t('TEXTVOTEBOOTH')}_${game.gms_name.toLowerCase().split(' ').join('_')}`,
      is_private: true,
    });

    const result = await queries.startGame(params[0]);
    if (result.succes) {
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: hoofdkanaal.channel.id,
        users: result.playerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: stemhok.channel.id,
        users: result.playerList.map((x) => x.gpl_slack_id).join(','),
      });
      await client.conversations.invite({
        token: process.env.SLACK_BOT_TOKEN,
        channel: hiernamaals.channel.id,
        users: result.viewerList.map((x) => x.gpl_slack_id).join(','),
      });

      const uitgeloot = `${t('TEXTNOTINGAME')}`;
      const uitgeloteSpelers = await queries.getNotDrawnPlayers();
      for (const speler of uitgeloteSpelers) {
        await helpers.sendIM(client, speler.gpl_slack_id, uitgeloot);
      }
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${t('TEXTGAMESTARTEDREGISTRATION')}`,
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
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTMODERATORSTOPGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    params = command.text.trim().split(' ');
    if (params.length < 1) {
      const warning = `${t('TEXTNEEDPARAMETER')} ${t('COMMANDSTOPGAME')} [${t('TEXTPASSWORD')}]`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    if (params[0] !== process.env.MNOT_ADMIN_PASS) {
      const warning = `${t('TEXTPASSWORDNEEDEDSTOPGAME')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const result = await queries.stopGame();
    if (result.succes) {
      await helpers.sendIM(client, command.user_id, `${t('TEXTGAMECLOSED')}`);
    } else {
      await helpers.sendIM(client, command.user_id, result.error);
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDSTOPGAME')}: ${error}`);
  }
}

async function dood({ command, ack, say }) {
  ack();
  try {
    const params = command.text.trim().split(' ');
    if (!(await queries.isVerteller(command.user_id))) {
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
    const channelId = command.channel_id;
    await queries.killUser(userId);
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
    const params = command.text.trim().split(' ');
    if (!(await queries.isVerteller(command.user_id))) {
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
    const channelId = command.channel_id;
    await queries.reanimateUser(userId);
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
    const params = command.text.trim().split(' ');
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTONLYMODSCANMAKEMODS')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
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

    const userId = params[0].match(/^<@([A-Z0-9]*)(\|.*)?>/)[1];
    const userName = await helpers.getUserName(client, userId);
    await queries.addVerteller(userId, userName);
    const message = `${t('TEXTBECAMEMODERATOR')}`;
    await helpers.sendIM(client, userId, message);
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDEXTRAMODERATOR')}: ${error}`);
  }
}

async function nodigVertellersUit({ command, ack, say }) {
  ack();
  try {
    const vertellers = await queries.getVertellers();
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
    const spelers = await queries.getPlayers();
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
    const userName = await helpers.getUserName(client, command.user_id);
    const result = await queries.joinGame(command.user_id, userName);
    if (result.succes) {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTJOINED')} ${result.numberOfPlayers} ${t('TEXTAMOUNTJOINED')}`,
            },
          },
        ],
      });
      const doeMeeMessage = `${t('TEXTJOINEDGAME')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}`;
      await helpers.sendIM(client, command.user_id, doeMeeMessage);
    } else {
      await helpers.sendIM(
        client,
        command.user_id,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${result.error}`
      );
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLJOIN')}: ${error}`);
  }
}

async function ikKijkMee({ command, ack, say }) {
  ack();
  try {
    const userName = await helpers.getUserName(client, command.user_id);
    const result = await queries.viewGame(command.user_id, userName);
    if (result.succes) {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTVIEWED')} ${result.numberOfPlayers} ${t('TEXTAMOUNTJOINED')}`,
            },
          },
        ],
      });
      const doeMeeMessage = `${t('TEXTVIEWEDGAME')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}`;
      await helpers.sendIM(client, command.user_id, doeMeeMessage);
    } else {
      await helpers.sendIM(
        client,
        command.user_id,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${result.error}`
      );
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDIWILLVIEW')}: ${error}`);
  }
}

async function ikDoeNietMeerMee({ command, ack, say }) {
  ack();
  try {
    const userName = await helpers.getUserName(client, command.user_id);
    const result = await queries.leaveGame(command.user_id);
    if (result.succes) {
      say({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${userName} ${t('TEXTNOTINGAMEANUMORE')} ${result.numberOfPlayers} ${t('TEXTAMOUNTJOINED')}`,
            },
          },
        ],
      });
      const doeMeeMessage = `${t('TEXTPLAYERNOTINGAME')} ${t('COMMANDIWILLJOIN')}`;
      await helpers.sendIM(client, command.user_id, doeMeeMessage);
    } else {
      await helpers.sendIM(
        client,
        command.user_id,
        `${t('TEXTCOMMANDERROR')} ${t('COMMANDREMOVEYOURSELFFROMGAME')}: ${result.error}`
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
    if (!(await queries.isVerteller(command.user_id))) {
      const warning = `${t('TEXTONLYMODERATORROLES')}`;
      await helpers.sendIM(client, command.user_id, warning);
      return;
    }
    const playersAlive = await queries.getAlive();
    helpers.shuffle(playersAlive);
    let playerIndex = 0;
    const params = command.text.trim().split(' ');
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
    const playersAlive = await queries.getAlive();
    helpers.shuffle(playersAlive);
    if (playersAlive.length) {
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
    }
  } catch (error) {
    await helpers.sendIM(client, command.user_id, `${t('TEXTCOMMANDERROR')} ${t('COMMANDLOTTO')}: ${error}`);
  }
}
