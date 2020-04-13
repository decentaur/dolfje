const mysql = require('mysql2');

module.exports = {
  createNewGame,
  startGame,
  stopGame,
  joinGame,
  leaveGame,
  getGameState,
  isVerteller,
  getVertellers,
  addVerteller,
  startPoll,
  stopPoll,
  getPollName,
  getPollResults,
  getCurrentPollResults,
  setMessageIdPoll,
  killUser,
  reanimateUser,
  getPlayers,
  getAlive,
  getAliveNotVoted,
  getActiveGame,
  getNotDrawnPlayers,
  votesOn,
  getRules,
  messageCountPlusPlus
};

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE
});
const promisePool = pool.promise();

const gameStates = {
  registering: 'REGISTERING',
  ended: 'ENDED',
  started: 'STARTED'
};

const playerStates = {
  alive: 'ALIVE',
  dead: 'DEAD',
  verteller: 'VERTELLER'
};

const pollStates = {
  open: 'OPEN',
  closed: 'CLOSED'
};

async function createNewGame(voteStyle, gameName, userId, userName) {
  try {
    await promisePool.query(
      `insert into games (gms_name, gms_status, gms_vote_style)
      (select ?,?,?
      from dual
      where not exists (select 'open games'
                        from games
                        where gms_status <> ?))`,
      [gameName, gameStates.registering, voteStyle, gameStates.ended]
    );

    const game = await getGame(gameStates.registering);
    await addVerteller(userId, userName);
    return { succes: true, gameName: game.gms_name };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function startGame(maxPlayers) {
  try {
    const game = await getGame(gameStates.registering);
    await promisePool.query(
      `update game_players
       set gpl_drawn = true 
       where (gpl_gms_id, gpl_slack_id) in (
        select gpl_gms_id,  gpl_slack_id from(
          select reg_game.gpl_gms_id,  gpl.gpl_slack_id, count(1) , max(gms_created_at) 
            from game_players gpl
          join games 
          on gms_id = gpl_gms_id
            join (select gpl_slack_id
                , gpl_gms_id
                from game_players gpl
                where gpl_gms_id = ?
                and !gpl.gpl_leader) reg_game
            on reg_game.gpl_slack_id = gpl.gpl_slack_id
            where !gpl.gpl_drawn  
            and !gpl.gpl_leader
            and not exists (select 'played game'
            				from game_players gp2 
            				where gp2.gpl_slack_id = gpl.gpl_slack_id 
            				and gp2.gpl_drawn 
            				and gp2.gpl_gms_id > gpl.gpl_gms_id )
            group by 1,2
            order by 3 desc, 4 desc, rand()
            limit ?) prefDraw)`,
      [game.gms_id, maxPlayers * 1]
    );
    await promisePool.query(
      `update games
       set gms_status = ? 
       where gms_id = ?`,
      [gameStates.started, game.gms_id]
    );
    const [rows] = await promisePool.query(
      `select gpl_slack_id
       from game_players gpl
       where gpl_gms_id = ?
       and (gpl_drawn
       or gpl_leader)`,
      [game.gms_id]
    );

    return { succes: true, playerList: rows };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function stopGame() {
  try {
    const game = await getGame(gameStates.started);
    await promisePool.query(
      `update games
       set gms_status = ? 
       where gms_id = ?`,
      [gameStates.ended, game.gms_id]
    );
    return { succes: true };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function joinGame(userId, userName) {
  try {
    const game = await getGame(gameStates.registering);
    const gameHasPlayer = await getGameHasPlayer(game.gms_id, userId);
    if (gameHasPlayer) {
      return { succes: false, error: 'je bent al ingeschreven' };
    }
    await promisePool.query(
      `insert into game_players
          (gpl_gms_id, gpl_slack_id, gpl_name, gpl_status, gpl_leader, gpl_drawn,  gpl_number_of_messages)
        values (?,?,?,?,?,?,?)`,
      [game.gms_id, userId, userName, playerStates.alive, false, false, 0]
    );

    let [rows] = await promisePool.query(
      `select count(1) numberOfPlayers
       from  game_players
       where gpl_gms_id = ?
       and not gpl_leader`,
      [game.gms_id]
    );
    return { succes: true, numberOfPlayers: rows[0].numberOfPlayers };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function leaveGame(userId) {
  try {
    const game = await getGame(gameStates.registering);
    const gameHasPlayer = await getGameHasPlayer(game.gms_id, userId);
    if (!gameHasPlayer) {
      return { succes: false, error: 'je bent niet ingeschreven' };
    }
    await promisePool.query(
      `delete from game_players
       where gpl_gms_id = ?
       and gpl_slack_id = ?`,
      [game.gms_id, userId]
    );

    let [rows] = await promisePool.query(
      `select count(1) numberOfPlayers
       from  game_players
       where gpl_gms_id = ?
       and not gpl_leader`,
      [game.gms_id]
    );
    return { succes: true, numberOfPlayers: rows[0].numberOfPlayers };
  } catch (err) {
    console.log(err);
    return { succes: false, error: err };
  }
}

async function getGameState() {
  const [rows] = await promisePool.query(
    `select gms_name
          , gms_status 
          , sum(case when gpl_status in ('DEAD', 'ALIVE') then 1 else 0 end) players
          , sum(case when gpl_status in ('ALIVE') then 1 else 0 end) alive
          , sum(case when gpl_status in ('DEAD') then 1 else 0 end) dead
      from games
      left join game_players 
      on gms_id = gpl_gms_id
      where gms_status <> 'ENDED'
      group by 1,2`
  );
  return rows;
}

async function isVerteller(userId) {
  const game = await getActiveGame();

  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?
      and gpl_leader`,
    [game.gms_id, userId]
  );
  return rows.length;
}

async function getVertellers() {
  const game = await getActiveGame();

  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_leader`,
    [game.gms_id]
  );
  return rows.map(x => x.gpl_slack_id);
}

async function addVerteller(userId, userName) {
  const game = await getActiveGame();
  await promisePool.query(
    `insert into game_players
        (gpl_gms_id, gpl_slack_id, gpl_name, gpl_status, gpl_leader, gpl_drawn,  gpl_number_of_messages)
      values (?,?,?,?,?,?,?)
      on duplicate key update
        gpl_status = ?
      , gpl_leader = ?`,
    [game.gms_id, userId, userName, playerStates.verteller, true, null, 0, playerStates.verteller, true]
  );
}

async function startPoll(voteName) {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
  if (poll.gpo_status !== pollStates.closed) {
    throw 'Er is nog een actieve stemming';
  }
  await promisePool.query(
    `insert into game_polls
     (gpo_gms_id, gpo_number, gpo_title, gpo_status)
      values(?,?,?,?)`,
    [game.gms_id, poll.gpo_number + 1, voteName, pollStates.open]
  );
}

async function getPollName() {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
  return `Stemming ${poll.gpo_number + 1} voor spel ${game.gms_name}`;
}

async function stopPoll() {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
  if (poll.gpo_status !== pollStates.open) {
    throw 'Er is geen actieve stemming';
  }
  await promisePool.query(
    `update game_polls
      set gpo_status = ?
      where gpo_gms_id = ?
      and gpo_number = ?`,
    [pollStates.closed, game.gms_id, poll.gpo_number]
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

async function getCurrentPollResults() {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
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

async function setMessageIdPoll(message) {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
  if (poll.gpo_status !== pollStates.open) {
    console.log(poll);
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

async function killUser(userId) {
  const game = await getGame(gameStates.started);
  await checkAlive(game.gms_id, userId);
  const [rows] = await promisePool.query(
    `update game_players
    set gpl_status = ?
    where gpl_gms_id = ?
    and gpl_slack_id = ?`,
    [playerStates.dead, game.gms_id, userId]
  );
  return rows;
}

async function reanimateUser(userId) {
  const game = await getGame(gameStates.started);
  await checkDead(game.gms_id, userId);
  const [rows] = await promisePool.query(
    `update game_players
    set gpl_status = ?
    where gpl_gms_id = ?
    and gpl_slack_id = ?`,
    [playerStates.alive, game.gms_id, userId]
  );
  return rows;
}

async function getPlayers() {
  const game = await getGame(gameStates.started);
  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?
      and gpl_leader = false
      and gpl_drawn`,
    [game.gms_id]
  );
  return rows;
}

async function getAlive() {
  const game = await getGame(gameStates.started);
  const [rows] = await promisePool.query(
    `select gpl_slack_id user_id
         , gpl_name name
      from game_players
      where gpl_gms_id = ?
      and gpl_status = ? 
      and gpl_drawn`,
    [game.gms_id, playerStates.alive]
  );
  return rows;
}

async function getAliveNotVoted() {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
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
    [game.gms_id, playerStates.alive, poll.gpo_gms_id, poll.gpo_number]
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

async function votesOn(userIdFrom, userIdTo) {
  const game = await getGame(gameStates.started);
  const poll = await getPoll(game.gms_id);
  try {
    await checkAlive(game.gms_id, userIdFrom);
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
    [game.gms_id, poll.gpo_number, game.gms_id, userIdFrom, game.gms_id, userIdTo, game.gms_id, userIdTo]
  );
}

async function getRules() {
  const game = await getActiveGame();

  const [rows] = await promisePool.query(
    `select * 
      from game_rules
      where gru_id = ?`,
    [game.gms_gru_id]
  );
  return rows[0];
}

async function messageCountPlusPlus(userId) {
  await promisePool.query(
    `update game_players gp 
      set gpl_number_of_messages = coalesce(gpl_number_of_messages,0) +1
      where gpl_slack_id = ?
      and gpl_gms_id = (select gms_id
                        from games 
                        where gms_status <> ?)`,
    [userId, gameStates.ended]
  );
}

async function getGame(status) {
  const [rows] = await promisePool.query(
    `select * 
      from games
      where gms_status = ?`,
    [status]
  );
  if (rows.length !== 1) {
    throw 'Er kon geen actief spel gevonden worden';
  }
  return rows[0];
}

async function getActiveGame() {
  const [rows] = await promisePool.query(
    `select * 
      from games
      where gms_status <> ?`,
    [gameStates.ended]
  );
  if (rows.length !== 1) {
    throw 'Er kon geen actief spel gevonden worden';
  }
  return rows[0];
}

async function getNotDrawnPlayers() {
  const game = await getActiveGame();

  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and !gpl_drawn`,
    [game.gms_id]
  );
  return rows;
}

async function getGameHasPlayer(gmsId, userId) {
  const [rows] = await promisePool.query(
    `select * 
      from game_players
      where gpl_gms_id = ?
      and gpl_slack_id = ?`,
    [gmsId, userId]
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
