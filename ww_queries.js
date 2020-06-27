const mysql = require('mysql2');
const { t } = require('localizify');

module.exports = {
  createNewGame,
  startGame,
  stopGame,
  joinGame,
  viewGame,
  leaveGame,
  getGame,
  getGameRegisterUser,
  getGameUnregisterUser,
  getGameOpenUser,
  getGameVerteller,
  getGameState,
  getSpecificGame,
  getGameName,
  getActiveGameName,
  isVerteller,
  isSectator,
  getVertellers,
  addVerteller,
  startPoll,
  stopPoll,
  getPollName,
  getPollResults,
  getCurrentPollResults,
  getGameHasPlayer,
  setMessageIdPoll,
  killUser,
  reanimateUser,
  getEveryOne,
  getAlive,
  getAliveNotVoted,
  getActiveGameWithChannel,
  getActiveGameUser,
  getNotDrawnPlayers,
  getPlayerList, 
  votesOn,
  getRules,
  logChannel, 
  getChannel,
  getAllChannels,
  messageCountPlusPlus
};

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
});
const promisePool = pool.promise();

const gameStates = {
  registering: 'REGISTERING',
  ended: 'ENDED',
  started: 'STARTED',
};

const playerStates = {
  alive: 'ALIVE',
  dead: 'DEAD',
  verteller: 'VERTELLER',
  viewer: 'VIEWER'
};

const pollStates = {
  open: 'OPEN',
  closed: 'CLOSED',
};

async function createNewGame(voteStyle, gameName, revivable, userId, userName) {
  try {
    await promisePool.query(
      `insert into games (gms_name, gms_status, gms_vote_style, gms_revive)
      values (?,?,?,?)`,
      [gameName, gameStates.registering, voteStyle, revivable]
    );

    const game = await getNewGame();
    await addVerteller(userId, userName, game.gms_id);
    return { succes: true, gameName: game.gms_name };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function startGame(gameId, maxPlayers) {
  try {
    await promisePool.query(
      `UPDATE game_players
      SET gpl_drawn = true
      WHERE (gpl_gms_id, gpl_slack_id) IN (
          SELECT gpl_gms_id,  gpl_slack_id FROM (
          SELECT reg_game.gpl_gms_id, gpl.gpl_slack_id, SUM(case when gpl.gpl_not_drawn then 1 ELSE 0 END ) 
            FROM game_players gpl
             JOIN games ON gms_id = gpl_gms_id
            JOIN (SELECT gpl_slack_id, gpl_gms_id
                  FROM game_players gpl
                  WHERE gpl_gms_id = ?
                  AND !gpl.gpl_leader
                  AND gpl.gpl_status <> ?
                  AND NOT EXISTS (SELECT 'already alive'
                      FROM game_players gp3
                      JOIN games g2 ON gp3.gpl_gms_id = g2.gms_id
                      WHERE gp3.gpl_slack_id = gpl.gpl_slack_id
                      AND g2.gms_status = ?
                      AND gp3.gpl_status = ?
                      AND gp3.gpl_gms_id <> gpl.gpl_gms_id)
                  AND NOT EXISTS (SELECT 'revivable' 
                          FROM game_players gp4
                          JOIN games g3 ON g3.gms_id = gp4.gpl_gms_id
                          WHERE gp4.gpl_slack_id = gpl.gpl_slack_id
                          AND g3.gms_revive  = 1
                          AND g3.gms_status = ?
                          AND gp4.gpl_status = ?)
                ) reg_game
            ON reg_game.gpl_slack_id = gpl.gpl_slack_id
            GROUP BY 1, 2
            ORDER BY 3 DESC, RAND()
            LIMIT ?) prefDraw)`,
      [gameId, playerStates.viewer, gameStates.started, playerStates.alive, gameStates.started, playerStates.dead, maxPlayers * 1]
    );
    await promisePool.query(
      `update games
       set gms_status = ? 
       where gms_id = ?`,
      [gameStates.started, gameId]
    );
    const [rows] = await promisePool.query(
      `select gpl_slack_id
       from game_players gpl
       where gpl_gms_id = ?
       and gpl_drawn`,
      [gameId]
    );
    const [
      rows2,
    ] = await promisePool.query(
      `select gpl_slack_id from game_players gpl 
      where gpl_gms_id = ? 
      and (gpl_status = ? or gpl_leader)`,
      [gameId, playerStates.viewer]
    );
    await promisePool.query(
      `DELETE gpl.* FROM game_players gpl
      JOIN games g ON g.gms_id = gpl.gpl_gms_id
      JOIN (SELECT gpl_slack_id, gpl_gms_id
          FROM game_players gpl
          WHERE gpl_gms_id = ?
          AND gpl.gpl_drawn 
          AND !gpl.gpl_leader
          ) reg_game
      ON reg_game.gpl_slack_id = gpl.gpl_slack_id
      WHERE g.gms_id <> reg_game.gpl_gms_id
      AND g.gms_status = ?
      AND gpl.gpl_status = ?`,
      [gameId, gameStates.registering, playerStates.alive]
    )
    return { succes: true, playerList: rows, viewerList: rows2 };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function stopGame(gameId) {
  try {
    await promisePool.query(
      `update games
       set gms_status = ? 
       where gms_id = ?`,
      [gameStates.ended, gameId]
    );
    return { succes: true };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function joinGame(gameId, userId, userName) {
  try {
    const gameHasPlayer = await getGameHasPlayer(gameId, userId);
    const gameHasViewer = await getGameHasViewer(gameId, userId);
    if (gameHasPlayer) {
      return { succes: false, error: `${t('TEXTALREADYENROLLED')}` };
    }
    if (gameHasViewer) {
      await promisePool.query(
        `update game_players 
            set gpl_status = ?
            where gpl_gms_id =? 
            and gpl_slack_id = ?`,
        [playerStates.alive, gameId, userId]
      );

      let [rows] = await promisePool.query(
        `select
        sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) numberOfPlayers,
        sum(case when gpl_status in ('VIEWER') then 1 else 0 end) numberOfViewers
        from game_players
        where gpl_gms_id = ?`,
      [gameId]
      );
      return { succes: true, numberOfPlayers: rows[0].numberOfPlayers, numberOfViewers: rows[0].numberOfViewers };
    }
    await promisePool.query(
      `insert into game_players
          (gpl_gms_id, gpl_slack_id, gpl_name, gpl_status, gpl_leader, gpl_drawn, gpl_not_drawn, gpl_number_of_messages)
        values (?,?,?,?,?,?,?,?)`,
      [gameId, userId, userName, playerStates.alive, false, false, false, 0]
    );

    let [rows] = await promisePool.query(
      `select
        sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) numberOfPlayers,
        sum(case when gpl_status in ('VIEWER') then 1 else 0 end) numberOfViewers
        from game_players
        where gpl_gms_id = ?`,
      [gameId]
    );
    return { succes: true, numberOfPlayers: rows[0].numberOfPlayers, numberOfViewers: rows[0].numberOfViewers };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function viewGame(userId, userName, gameId) {
  try {
    const gameHasViewer = await getGameHasViewer(gameId, userId);
    const gameHasPlayer = await getGameHasPlayer(gameId, userId);
    if (gameHasViewer) {
      return { succes: false, error: 'je bent al ingeschreven als kijker' };
    }
    if (gameHasPlayer) {
      await promisePool.query(
        `update game_players 
            set gpl_status = ?
            where gpl_gms_id =? 
            and gpl_slack_id = ?`,
        [playerStates.viewer, gameId, userId]
      );
      let [rows] = await promisePool.query(
        `select 
          sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) numberOfPlayers,
          sum(case when gpl_status in ('VIEWER') then 1 else 0 end) numberOfViewers
          from game_players
          where gpl_gms_id = ?`,
        [gameId]
      );
      return { succes: true, numberOfPlayers: rows[0].numberOfPlayers, numberOfViewers: rows[0].numberOfViewers };
      }        
    await promisePool.query(
      `insert into game_players
        (gpl_gms_id, gpl_slack_id, gpl_name, gpl_status, gpl_leader, gpl_drawn, gpl_not_drawn, gpl_number_of_messages)
        values (?,?,?,?,?,?,?,?)`,
      [gameId, userId, userName, playerStates.viewer, false, false, false, 0]
    );
    let [rows] = await promisePool.query(
      `select 
        sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) numberOfPlayers,
        sum(case when gpl_status in ('VIEWER') then 1 else 0 end) numberOfViewers
        from game_players
        where gpl_gms_id = ?`,
      [gameId]
    );
    return { succes: true, numberOfPlayers: rows[0].numberOfPlayers, numberOfViewers: rows[0].numberOfViewers };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function leaveGame(gameId, userId) {
  try {
    await promisePool.query(
      `delete from game_players
       where gpl_gms_id = ?
       and gpl_slack_id = ?`,
      [gameId, userId]
    );
    let [rows] = await promisePool.query(
      `select 
        sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) numberOfPlayers,
        sum(case when gpl_status in ('VIEWER') then 1 else 0 end) numberOfViewers
        from game_players
        where gpl_gms_id = ?`,
      [gameId]
    );
    return { succes: true, numberOfPlayers: rows[0].numberOfPlayers, numberOfViewers: rows[0].numberOfViewers };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function getGameState() {
  const [rows] = await promisePool.query(
    `select gms_name
          , gms_id
          , gms_status
          , sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) players
          , sum(case when gpl_status in ('ALIVE') then 1 else 0 end) alive
          , sum(case when gpl_status in ('VIEWER') then 1 else 0 end) viewers
          , sum(case when gpl_status in ('DEAD') then 1 else 0 end) dead
      from games
      left join game_players 
      on gms_id = gpl_gms_id
      where gms_status <> 'ENDED'
      group by 1,3
      order by 2`
  );
  return rows;
}

async function isVerteller(gameId, userId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?
      and gpl_leader`,
    [gameId, userId]
  );
  return rows.length;
}

async function isSectator(gameId, userId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?
      and gpl_status <> ?`,
    [gameId, userId, playerStates.alive]
  );
  return rows.length;
}

async function getVertellers(gameId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_leader`,
    [gameId]
  );
  return rows.map((x) => x.gpl_slack_id);
}

async function addVerteller(userId, userName, gameId) {
  await promisePool.query(
    `insert into game_players
        (gpl_gms_id, gpl_slack_id, gpl_name, gpl_status, gpl_leader, gpl_drawn, gpl_not_drawn, gpl_number_of_messages)
      values (?,?,?,?,?,?,?,?)
      on duplicate key update
        gpl_status = ?
      , gpl_leader = ?`,
    [gameId, userId, userName, playerStates.verteller, true, false, false, 0, playerStates.verteller, true]
  );
}

async function startPoll(gameId, voteName) {
  const poll = await getPoll(gameId);
  if (poll.gpo_status !== pollStates.closed) {
    throw 'Er is nog een actieve stemming';
  }
  await promisePool.query(
    `insert into game_polls
     (gpo_gms_id, gpo_number, gpo_title, gpo_status)
      values(?,?,?,?)`,
    [gameId, poll.gpo_number + 1, voteName, pollStates.open]
  );
}

async function getPollName(gameId) {
  const poll = await getPoll(gameId);
  return `Stemming ${poll.gpo_number + 1} voor spel ${game.gms_name}`;
}

async function stopPoll(gameId) {
  const poll = await getPoll(gameId);
  if (poll.gpo_status !== pollStates.open) {
    throw 'Er is geen actieve stemming';
  }
  await promisePool.query(
    `update game_polls
      set gpo_status = ?
      where gpo_gms_id = ?
      and gpo_number = ?`,
    [pollStates.closed, gameId, poll.gpo_number]
  );
  return poll;
}

async function getPollResults(poll) {
  const [rows] = await promisePool.query(
    ` select gvo.* , 0 missedVotes
      from game_votes gvo
      where gvo_gpo_gms_id = ? 
      and gvo_gpo_number = ? 
      union 
      select null,null,null, gpl_slack_id ,null,null,null, 
      (select count(1) from game_polls where gpo_gms_id = ?) - sum(case when gvo_gpl_slack_id is null then 0 else 1 end)
      from game_players gpl
      left join game_votes gvo
      on gvo_gpo_gms_id = gpl_gms_id
      and gvo_gpl_slack_id  = gpl_slack_id 
      where gpl_gms_id = ? 
      and not exists(select 'voted'
      				from game_votes gvo
				    where gvo_gpo_gms_id = ?
				    and gvo_gpo_number = ?
				    and gvo_gpo_gms_id = gpl_gms_id
				    and gvo_gpl_slack_id  = gpl_slack_id)
      group by gpl_slack_id`,
    [poll.gpo_gms_id, poll.gpo_number, poll.gpo_gms_id, poll.gpo_gms_id, poll.gpo_gms_id, poll.gpo_number]
  );
  return rows;
}

async function getCurrentPollResults(gameId) {
  const poll = await getPoll(gameId);
  if (poll.gpo_status !== pollStates.open) {
    throw 'Er is geen actieve stemming';
  }
  const [rows] = await promisePool.query(
    `select  gvo_voted_on_gpl_slack_id votee
            , count(1) votes
            , group_concat(gvo_gpl_slack_id separator ', @') voters
      from game_votes
      where gvo_gpo_gms_id = ?
      and gvo_gpo_number = ?
      group by 1
      order by 2 desc`,
    [poll.gpo_gms_id, poll.gpo_number]
  );
  return rows;
}

async function setMessageIdPoll(gameId, message) {
  const poll = await getPoll(gameId);
  if (poll.gpo_status !== pollStates.open) {
    throw 'Er gaat iets mis met het aanmaken van de stemming';
  }
  await promisePool.query(
    `update game_polls
     set gpo_slack_message_id = ?
     where gpo_gms_id = ?
     and gpo_number = ?
     `,
    [`${message.channel}-${message.ts}`, poll.gpo_gms_id, poll.gpo_number]
  );
}

async function killUser(gameId, userId) {
  await checkAlive(gameId, userId);
  const [rows] = await promisePool.query(
    `update game_players
    set gpl_status = ?
    where gpl_gms_id = ?
    and gpl_slack_id = ?`,
    [playerStates.dead, gameId, userId]
  );
  return rows;
}

async function reanimateUser(gameId, userId) {
  await checkDead(gameId, userId);
  const [rows] = await promisePool.query(
    `update game_players
    set gpl_status = ?
    where gpl_gms_id = ?
    and gpl_slack_id = ?`,
    [playerStates.alive, gameId, userId]
  );
  return rows;
}

async function getEveryOne(gameId) {
  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?`,
    [gameId]
  );
  return rows;
}

async function getAlive(gameId) {
  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?
      and gpl_status = ? 
      and gpl_drawn`,
    [gameId, playerStates.alive]
  );
  return rows;
}

async function getAliveNotVoted(gameId) {
  const poll = await getPoll(gameId);
  if (poll.gpo_status !== pollStates.open) {
    throw 'Er is geen actieve stemming';
  }

  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?
      and gpl_status = ? 
      and gpl_drawn
      and not exists (select 'already voted'
                     from game_votes
                     where gvo_gpo_gms_id = ?
                     and gvo_gpo_number = ?
                     and gvo_gpl_gms_id = gpl_gms_id
                     and gvo_gpl_slack_id = gpl_slack_id)`,
    [gameId, playerStates.alive, poll.gpo_gms_id, poll.gpo_number]
  );
  return rows;
}

async function checkAlive(gmsId, userId) {
  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?
      and gpl_status = ? 
      and gpl_drawn`,
    [gmsId, userId, playerStates.alive]
  );
  if (!rows.length) {
    throw `Speler <@${userId}> leeft niet in dit spelletje`;
  }
}

async function checkDead(gmsId, userId) {
  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?
      and gpl_status = ? 
      and gpl_drawn`,
    [gmsId, userId, playerStates.dead]
  );
  if (!rows.length) {
    throw `Speler <@${userId}> is niet dood in dit spelletje`;
  }
}

async function votesOn(gameId, userIdFrom, userIdTo) {
  const poll = await getPoll(gameId);
  try {
    await checkAlive(gameId, userIdFrom);
  } catch (err) {
    throw 'Alleen levende spelers mogen stemmen';
  }

  await promisePool.query(
    `insert into game_votes
      (gvo_gpo_gms_id, gvo_gpo_number, gvo_gpl_gms_id, gvo_gpl_slack_id, gvo_voted_on_gpl_gms_id, gvo_voted_on_gpl_slack_id)
        values(?,?,?,?,?,?)
      on duplicate key update
       gvo_voted_on_gpl_gms_id = ?
     , gvo_voted_on_gpl_slack_id = ?`,
    [gameId, poll.gpo_number, gameId, userIdFrom, gameId, userIdTo, gameId, userIdTo]
  );
}

async function getRules(gameId) {
  const [rows] = await promisePool.query(
    `select gru_name, gru_rules
      from games
      join game_rules on gru_id = gms_gru_id
      where gms_id = ?`,
    [gameId]
  );
  return rows[0];
}

async function messageCountPlusPlus(userId, gameId) {
  await promisePool.query(
    `update game_players gp 
      set gpl_number_of_messages = coalesce(gpl_number_of_messages,0) +1
      where gpl_slack_id = ?
      and gpl_gms_id = ?`,
    [userId, gameId]
  );
}

async function getGame(status) {
  const [rows] = await promisePool.query(
    `select * 
      from games
      where gms_status = ?`,
    [status]
  );
  if (rows.length == 0) {
    throw `${t('TEXTGAMENOTFOUND')}`;
  }
  return rows;
}

async function getSpecificGame(gameId) {
  const [rows] = await promisePool.query(
    `select * 
      from games
      where gms_id = ?`,
    [gameId]
  );
  if (rows.length == 0) {
    throw `${t('TEXTGAMENOTFOUND')}`;
  }
  return rows[0];
}

async function getGameRegisterUser(userId) {
  const [rows] = await promisePool.query(
    `select * 
      from games
      left join (select * from game_players where gpl_slack_id = ?) as gpl
      on gpl_gms_id = gms_id
      where gms_status = ?
      and (gpl_status IS NULL or gpl_status = ?)`,
    [userId, gameStates.registering, playerStates.viewer]
  );
  return rows;
}

async function getGameUnregisterUser(userId) {
  const [rows] = await promisePool.query(
    `select * 
      from games
      left join (select * from game_players where gpl_slack_id = ?) as gpl
      on gpl_gms_id = gms_id
      where gms_status = ?
      and gpl_gms_id is not null
      and !gpl_leader`,
    [userId, gameStates.registering]
  );
  return rows;
}

async function getGameOpenUser(userId) {
  const [rows] = await promisePool.query(
    `select * 
    from games
    left join (select * from game_players where gpl_slack_id = ?) as gpl
    on gpl_gms_id = gms_id
    where gms_status <> ? 
    and gpl_drawn is null or !gpl_drawn
    and gpl_status <> ? 
    and gpl_status <> ?`,
    [userId, gameStates.ended, playerStates.viewer, playerStates.verteller]
  );
  return rows;
}

async function getGameVerteller(userId, vertellerId) {
  const [rows] = await promisePool.query(
    `SELECT  * 
      FROM games
      LEFT JOIN (SELECT * FROM game_players WHERE gpl_slack_id = ?) AS gpl
      ON gpl.gpl_gms_id = gms_id 
      AND gms_status <> ?
      LEFT JOIN (SELECT * FROM game_players WHERE gpl_slack_id = ?) AS gpl2
      ON gpl2.gpl_gms_id= gms_id 
      WHERE gpl2.gpl_status <> ? OR gpl2.gpl_status IS NULL 
    AND !gpl2.gpl_drawn OR gpl2.gpl_drawn IS NULL
    and gpl.gpl_leader`,
    [userId, gameStates.ended, vertellerId, playerStates.verteller]
  );
  return rows;
}

async function getNewGame() {
  const [rows] = await promisePool.query(
    `select * 
      from games
      order by gms_created_at desc`
  );
  return rows[0];
}

async function getActiveGameWithChannel(channelId) {
  const [ rows ] = await promisePool.query(
    `select * from games
    join game_channels on gch_gms_id = gms_id
    where gch_slack_id = ?`, [channelId] 
  );
  if (!rows[0]) {
    throw 'Dit kanaal is geen onderdeel van een spel';
  }
  return rows[0];
}

async function getActiveGameUser(userId) {
  const [rows] = await promisePool.query(
    `select *
      from games
      join game_players on gpl_gms_id = gms_id
      where gms_status <> ? and gpl_slack_id = ?
      and !gpl_not_drawn
      order by gpl_status asc`,
    [gameStates.ended, userId]
  );
  return rows;
}

async function getGameName (gameName) {
  const [rows] = await promisePool.query(
    `select *
      from games
      where gms_name = ?`,
    [gameName]
  );
  if (!rows[0]) {
    throw `${t('TEXTNAMEINCORRECT')}`
  }
  return rows[0];
}

async function getActiveGameName () {
  const [rows] = await promisePool.query(
    `select gms_name
      from games
      where gms_status <> ?`,
    [gameStates.ended]
  );
  return rows.map((x) => x.gms_name);
}

async function getNotDrawnPlayers(gameId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and !gpl_drawn
      and gpl_status = ?`,
    [gameId, playerStates.alive]
  );

  await promisePool.query(
    `update game_players
      set gpl_not_drawn = 1
      where gpl_gms_id = ?
      and !gpl_drawn
      and gpl_status = ?`,
      [gameId, playerStates.alive]
  )
  return rows;
}

async function getPlayerList(gameId) {
  const [rows] = await promisePool.query(
    `select gpl_slack_id from game_players 
    where gpl_gms_id = ? 
    and !gpl_leader 
    and gpl_status <> ?`, 
    [gameId, playerStates.viewer]
  );
  return rows;
}

async function getGameHasPlayer(gameId, userId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      join games on gms_id = gpl_gms_id
      where gpl_slack_id = ?
      and not gpl_status = ?
      and gms_id = ?`,
    [userId, playerStates.viewer, gameId]
  );
  return rows.length;
}

async function getGameHasViewer(gameId, userId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?
      and gpl_status = ?`,
    [gameId, userId, playerStates.viewer]
  );
  return rows.length;
}

async function getPoll(gmsId) {
  const [rows] = await promisePool.query(
    `select *
      from game_polls
      where gpo_gms_id = ?
      order by gpo_number desc
      limit 1`,
    [gmsId]
  );
  if (rows.length !== 1) {
    return { gpo_gms_id: gmsId, gpo_number: 0, gpo_status: pollStates.closed, gpo_slack_message_id: null };
  }
  return rows[0];
}

async function logChannel(logInput) {
  await promisePool.query(
    `insert into game_channels
      (gch_gms_id, gch_slack_id, gch_name, gch_type, gch_user_created)
        values(?,?,?,?,?)`,
    [logInput.gch_id, logInput.gch_slack_id, logInput.gch_name, logInput.gch_type, logInput.gch_user_created]
  );
}

async function getChannel(gameId, channelType) {
  const [rows] = await promisePool.query(
    `select gch_slack_id from game_channels where gch_gms_id = ? and gch_type = ?`,
    [gameId, channelType]
  );
  return rows[0].gch_slack_id;
}

async function getAllChannels(gameId) {
  const [ rows ] = await promisePool.query(
      `select gch_slack_id, gch_name from game_channels where gch_gms_id = ?`, [gameId]
  ); 
  return rows;
}