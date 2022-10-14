const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "cricketMatchDetails.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

app.get("/players/", async (request, response) => {
  const getPlayersQuery = `
    SELECT 
        *
    FROM 
        player_details
    ORDER BY
        player_id;`;
  const players = await db.all(getPlayersQuery);
  response.send(
    players.map((item) => {
      return {
        playerId: item.player_id,
        playerName: item.player_name,
      };
    })
  );
});
app.get("/players/:playerId/", async (request, response) => {
  const { playerId } = request.params;
  const getPlayerQuery = `
    SELECT
        *
    FROM 
        player_details
    WHERE 
        player_id=${playerId};`;
  const player = await db.get(getPlayerQuery);
  response.send({
    playerId: player.player_id,
    playerName: player.player_name,
  });
});
app.put("/players/:playerId/", async (request, response) => {
  const { playerId } = request.params;
  const { playerName } = request.body;
  const putPlayerQuery = `
    UPDATE player_details
    SET 
        player_name='${playerName}'
    WHERE 
        player_id=${playerId};`;
  const dbResponse = await db.run(putPlayerQuery);
  response.send("Player Details Updated");
});
app.get("/matches/:matchId/", async (request, response) => {
  const { matchId } = request.params;
  const getMatchQuery = `
    SELECT 
        *
    FROM 
        match_details
    WHERE
        match_id=${matchId};`;
  const match = await db.get(getMatchQuery);
  response.send({
    matchId: match.match_id,
    match: match.match,
    year: match.year,
  });
});
app.get("/players/:playerId/matches", async (request, response) => {
  const { playerId } = request.params;
  const getMatchesQuery = `
    SELECT 
        T.match_id as match_id,
        T.match as match,
        T.year as year
    FROM 
        (match_details 
        INNER JOIN player_match_score 
        ON match_details.match_id=player_match_score.match_id) as T
    WHERE 
        T.player_id=${playerId};`;
  const matches = await db.all(getMatchesQuery);
  response.send(
    matches.map((item) => {
      return {
        matchId: item.match_id,
        match: item.match,
        year: item.year,
      };
    })
  );
});
app.get("/matches/:matchId/players", async (request, response) => {
  const { matchId } = request.params;
  const getPlayersQuery = `
    SELECT 
        T.player_id as player_id,
        player_name
    FROM 
        (player_match_score
        INNER JOIN player_details
        ON player_details.player_id=player_match_score.player_id) as T
    WHERE 
        T.match_id=${matchId};`;
  const matches = await db.all(getPlayersQuery);
  response.send(
    matches.map((item) => {
      return {
        playerID: item.player_id,
        playerName: item.player_name,
      };
    })
  );
});
app.get("/players/:playerId/playerScores", async (request, response) => {
  const { playerId } = request.params;
  const getPlayerQuery = `
    SELECT 
        T.player_id as playerId,
        T.player_name as playerName,
        SUM(T.score) as totalScore,
        SUM(T.fours) as totalFours,
        SUM(T.sixes) as totalSixes
    FROM 
        (player_details 
        INNER JOIN player_match_score
        ON player_details.player_id=player_match_score.player_id) as T
    GROUP BY 
        T.player_id
    HAVING 
        T.player_id=${playerId};`;
  let player = await db.get(getPlayerQuery);
  response.send(player);
});
module.exports = app;
