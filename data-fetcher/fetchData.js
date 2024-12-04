const fs = require("fs/promises"); // Using promises for async file handling

// Initial API endpoints for getting team info
const baseStandingsUrl = "https://api-web.nhle.com/v1/standings/2023-12-01";
const baseGamesUrl = "https://api-web.nhle.com/v1/club-schedule-season/";
const baseRosterUrl = "https://api-web.nhle.com/v1/roster/";

const season = "20232024";

const teamMap = {};
const playerMap = {};
const gameMap = {};

// Start fetching the team data
getTeamData();

// Fetches data for all teams, their rosters, and game IDs for the season
async function getTeamData() {
  try {
    // Fetch standings data to get all teams
    const response = await fetch(baseStandingsUrl);
    const data = await response.json();
    const standings = data.standings;

    const teamPromises = standings.map(async (team) => {
      // Get data for each team from standings data
      const abbrev = team.teamAbbrev.default;
      const teamName = team.teamName.default;
      const teamLogo = team.teamLogo;

      teamMap[abbrev] = {
        name: teamName,
        logo: teamLogo,
        games: [],
        playerIds: [],
      };

      // Fetch games and roster
      const [gamesResponse, rosterResponse] = await Promise.all([
        fetch(`${baseGamesUrl}${abbrev}/${season}`),
        fetch(`${baseRosterUrl}${abbrev}/${season}`),
      ]);

      const gamesData = await gamesResponse.json();
      const rosterData = await rosterResponse.json();

      // Format games and add them to the team map
      const games = gamesData.games.map((game) => {
        const opponent = game.awayTeam.abbrev !== abbrev ? game.awayTeam.abbrev : game.homeTeam.abbrev;

        return {
          gameId: game.id,
          date: game.gameDate,
          opponent: opponent,
        };
      });
      teamMap[abbrev].games = games;

      // Add players to maps
      const addPlayersToMaps = (players) => {
        players.forEach((player) => {
          const playerId = player.id;
          const playerObject = {
            firstName: player.firstName.default,
            lastName: player.lastName.default,
            sweaterNumber: player.sweaterNumber,
            positionCode: player.positionCode,
            headshot: player.headshot,
          };

          teamMap[abbrev].playerIds.push(playerId);
          playerMap[playerId] = playerObject;
        });
      };
      addPlayersToMaps(rosterData.forwards);
      addPlayersToMaps(rosterData.defensemen);
    });

    // Wait for all team data to be fetched
    await Promise.all(teamPromises);

    // Fetch all game events data
    await fetchAllGameEvents();

    // Write data to files after all fetching is done
    await writeDataToFiles();

    console.log("Data fetched and written to JSON files.");
  } catch (error) {
    console.error("Error in getTeamData:", error);
  }
}

// Fetches all game data for the season
async function fetchAllGameEvents() {
  for (const team of Object.values(teamMap)) {
    for (const game of team.games) {
      game.validData = await fetchGameData(game.gameId)
    }
    // Remove invalid game data
    team.games = team.games.filter(game => game.validData)
  }
}

// Fetches and returns game data for an individual game
async function fetchGameData(gameId) {
  if (gameMap[gameId]) return true;

  const apiUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }

    const data = await response.json();
    const homeTeam = { name: data.homeTeam.name.default, abbrev: data.homeTeam.abbrev };
    const awayTeam = { name: data.awayTeam.name.default, abbrev: data.awayTeam.abbrev };

    const teamMapLocal = {
      [data.homeTeam.id]: homeTeam,
      [data.awayTeam.id]: awayTeam,
    };

    const plays = data.plays;
    const goalAndShotEvents = await Promise.all(
      plays
        .filter((play) => (play.typeDescKey === "goal" || play.typeDescKey === "shot-on-goal") && play.details.xCoord !== undefined && play.details.yCoord !== undefined)
        .map(async (play) => {
          const teamName = teamMapLocal[play.details.eventOwnerTeamId].name;
          const teamAbbrev = teamMapLocal[play.details.eventOwnerTeamId].abbrev;
          const playerId = play.typeDescKey === "goal" ? play.details.scoringPlayerId : play.details.shootingPlayerId;

          if (!playerMap[playerId]) {
            // Fetch and store player data if not in the playerMap.
            await fetchPlayerData(playerId, teamAbbrev);
          }

          return {
            ...play,
            teamName,
            teamAbbrev,
            playerId,
            isHomeTeam: play.details.eventOwnerTeamId == data.homeTeam.id,
          };
        })
    );

    // Check for invalid data
    if (goalAndShotEvents.length == 0)
      return false

    gameMap[gameId] = {
      events: goalAndShotEvents,
      periods: data.periodDescriptor.number,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      date: data.startTimeUTC,
    };
    return true;
  } catch (error) {
    console.log("Error in fetchGameData:", error);
  }
}

// Fetch individual player data
async function fetchPlayerData(playerId, abbrev) {
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/player/${playerId}/landing`);
    if (!response.ok) {
      console.error(`Failed to fetch player data for ID: ${playerId}`);
      return null;
    }

    const data = await response.json();

    const playerObject = {
      firstName: data.firstName.default,
      lastName: data.lastName.default,
      sweaterNumber: data.sweaterNumber,
      position: data.position,
      headshot: data.headshot,
    };

    playerMap[playerId] = playerObject;
    if (!teamMap[abbrev].playerIds.includes(playerId)) {
      teamMap[abbrev].playerIds.push(playerId);
    }
  } catch (error) {
    console.error(`Error fetching player data for ID: ${playerId} for team ${abbrev}`, error);
  }
}

// Writes team, player, and game data to JSON files
async function writeDataToFiles() {
  try {
    await fs.writeFile("teamData.json", JSON.stringify(teamMap, null, 2));
    await fs.writeFile("playerData.json", JSON.stringify(playerMap, null, 2));
    await fs.writeFile("gameData.json", JSON.stringify(gameMap, null, 2));
  } catch (error) {
    console.error("Error writing data to files:", error);
  }
}
