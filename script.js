const teamMap = {};
const playerMap = {};
const gameMap = {};

window.addEventListener('DOMContentLoaded', async function () {
  // Create the initial empty plots once the DOM loads
  plotGameData([])

  // Setup tab switching
  document.getElementById("game-tab").addEventListener("click", () => { switchTab("game") });
  document.getElementById("season-tab").addEventListener("click", () => { switchTab("season") });

  // Load data from JSON files
  await loadTeamData();
  await loadPlayerData();
  await loadGameData();

  // Get team selects and teams
  const gameTeamSelect = document.getElementById("game-team-select")
  const seasonTeamSelect = document.getElementById("season-team-select")
  const teamEntries = Object.entries(teamMap).sort(([abbrev1, team1], [abbrev2, team2]) => {
    return team1.name.localeCompare(team2.name);
  });

  // Add team options to team selects
  for (const [abbrev, team] of teamEntries) {
    const option1 = document.createElement("option");
    option1.value = abbrev;
    option1.textContent = team.name;
    gameTeamSelect.appendChild(option1);
    const option2 = document.createElement("option");
    option2.value = abbrev;
    option2.textContent = team.name;
    seasonTeamSelect.appendChild(option2);
  };

  // Initialize heat map for entire league data
  handleSeasonTeamSelect();

  // Set up event listeners once data is fetched
  gameTeamSelect.addEventListener("change", filterGames);
  document.getElementById("start-date").addEventListener("change", filterGames);
  document.getElementById("end-date").addEventListener("change", filterGames);
  seasonTeamSelect.addEventListener("change", handleSeasonTeamSelect);
  document.getElementById("season-player-select").addEventListener("change", handleSeasonPlayerSelect);
});

// Loads the team data from the json file
async function loadTeamData() {
  try {
    const response = await fetch('teamData.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    Object.assign(teamMap, data);
  } catch (error) {
    console.error('Error loading team data:', error);
  }
}

// Loads the player data from the json file
async function loadPlayerData() {
  try {
    const response = await fetch('playerData.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    Object.assign(playerMap, data);
  } catch (error) {
    console.error('Error loading player data:', error);
  }
}

// Loads the game data from the json file
async function loadGameData() {
  try {
    const response = await fetch('gameData.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    Object.assign(gameMap, data);
  } catch (error) {
    console.error('Error loading game data:', error);
  }
}

// Handles switching tabs
function switchTab(tab) {
  // Toggle tab active states
  document.getElementById('game-tab').classList.toggle('active', tab === 'game');
  document.getElementById('season-tab').classList.toggle('active', tab === 'season');

  // Show/hide controls and plot panels
  document.getElementById('game-controls').classList.toggle('hidden', tab !== 'game');
  document.getElementById('season-controls').classList.toggle('hidden', tab !== 'season');
  document.getElementById('game-plot-panel').classList.toggle('hidden', tab !== 'game');
  document.getElementById('season-plot-panel').classList.toggle('hidden', tab !== 'season');
}

// Filter games and display the game list
function filterGames() {
  const selectedTeam = document.getElementById("game-team-select").value;
  const startDate = new Date(document.getElementById("start-date").value);
  const endDate = new Date(document.getElementById("end-date").value);

  // Clear game list
  const gameListContainer = document.getElementById("game-list");
  gameListContainer.innerHTML = "";

  // Filter based on selected team and dates
  if (selectedTeam) {
    const filteredGames = teamMap[selectedTeam].games.filter(game => {
      const gameDate = new Date(game.date);
      return (!isNaN(startDate) ? gameDate >= startDate : true) &&
        (!isNaN(endDate) ? gameDate <= endDate : true);
    });

    // Add games to the game list
    if (filteredGames.length > 0) {
      filteredGames.forEach(game => {
        const gameElement = document.createElement("div");
        gameElement.className = "game-element";
        gameElement.textContent = `${selectedTeam} vs ${game.opponent} - ${game.date}`;
        gameElement.style.cursor = "pointer";
        gameElement.addEventListener("click", () => handleGameSelect(game.gameId, selectedTeam));
        gameListContainer.appendChild(gameElement);
      });
    } else {
      const gameListText = document.createElement("div");
      gameListText.className = "game-list-text";
      gameListText.innerHTML = "No games found."
      gameListContainer.appendChild(gameListText);
    }
  }
  else {
    const gameListText = document.createElement("div");
    gameListText.className = "game-list-text";
    gameListText.innerHTML = "Select a team."
    gameListContainer.appendChild(gameListText);
  }
}

// Filter events based on the selected period and player
function filterEvents(events) {
  const selectedPeriod = document.getElementById("periodFilter").value;
  const selectedPlayer = document.getElementById("playerFilter").value;

  const filteredEvents = events.filter(event => {
    const periodMatches = selectedPeriod ? event.periodDescriptor.number == Number(selectedPeriod) : true;
    const playerMatches = selectedPlayer ? event.playerId == selectedPlayer : true;
    return periodMatches && playerMatches;
  });

  return filteredEvents
}

let gameFilterController = new AbortController();

// Populates the game filters' options based on the game player/period data
async function populateIndividualGameFilters(eventData, periods, teamAbbrev) {
  const playerDropdown = document.getElementById("playerFilter");
  const periodDropdown = document.getElementById("periodFilter");

  // Clear existing options
  periodDropdown.innerHTML = '<option value="">All Periods</option>';
  playerDropdown.innerHTML = '<option value="">All Players</option>';

  // Cancel previous change listeners
  gameFilterController.abort();
  gameFilterController = new AbortController();

  // Add period options
  for (let period = 1; period <= periods; period++) {
    const option = document.createElement("option");
    option.value = period;
    option.textContent = period;
    periodDropdown.appendChild(option);
  }

  // Collect unique player options from eventData
  const uniquePlayers = [...new Set(eventData.map(event => { return { "id": event.playerId, "team": event.teamAbbrev } }))];
  const playerOptions = [];
  for (const player of uniquePlayers) {
    const playerInfo = playerMap[player.id];
    if (playerInfo)
      playerOptions.push({
        ...player,
        "name": `${playerInfo.firstName} ${playerInfo.lastName}`
      })
  }

  // Sort by selected team, then by name
  playerOptions.sort((player1, player2) => {
    const isSelectedTeam1 = player1.team === teamAbbrev;
    const isSelectedTeam2 = player2.team === teamAbbrev;

    if (isSelectedTeam1 && !isSelectedTeam2) return -1;
    if (!isSelectedTeam1 && isSelectedTeam2) return 1;

    return player1.name.localeCompare(player2.name);
  });

  // Add the options
  for (const playerOption of playerOptions) {
    const option = document.createElement("option");
    option.value = playerOption.id;
    option.textContent = `${playerOption.name} (${playerOption.team})`;
    playerDropdown.appendChild(option);
  };

  // Event listeners to update plot on filter change
  playerDropdown.addEventListener("change", () => {
    const filteredEvents = filterEvents(eventData);
    plotGameData(filteredEvents);
  }, { signal: gameFilterController.signal });

  periodDropdown.addEventListener("change", () => {
    const filteredEvents = filterEvents(eventData);
    plotGameData(filteredEvents);
  }, { signal: gameFilterController.signal });
}

// Get game data and update game plot and filters
function handleGameSelect(gameId, homeTeamAbbrev) {
  const gameData = gameMap[gameId];
  const teamHeader = document.getElementById("game-header");

  const date = new Date(gameData.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  teamHeader.innerHTML = `${gameData.homeTeam} vs. ${gameData.awayTeam}: ${date}`;
  populateIndividualGameFilters(gameData.events, gameData.periods, homeTeamAbbrev);
  plotGameData(gameData.events);
}

let seasonFiltersController = new AbortController();

// Handle a team (or all teams) being selected for the season
function handleSeasonTeamSelect() {
  const selectedTeam = document.getElementById("season-team-select").value;

  // Get events for selected team or all events is all teams is selected
  const events = selectedTeam ? getEventsForTeam(selectedTeam) : Object.values(gameMap).flatMap(game => game.events);
  const shotEvents = events.filter(event => event.typeDescKey === "shot-on-goal");
  const goalEvents = events.filter(event => event.typeDescKey === "goal")

  const shotsButton = document.getElementById("shots-btn");
  const goalsButton = document.getElementById("goals-btn");
  shotsButton.classList.remove("hidden");
  goalsButton.classList.remove("hidden");

  const playerPositionSelect = document.getElementById("player-type-select");
  const playerSelect = document.getElementById("season-player-select");
  playerSelect.innerHTML = '<option value="">All Players</option>';

  if (!selectedTeam) {
    // Switch out player select for position select
    document.getElementById("player-select-label").innerHTML = "Select Position:"
    playerPositionSelect.classList.remove("hidden");
    playerSelect.classList.add("hidden");
  } else {
    // Switch out position select for player select
    document.getElementById("player-select-label").innerHTML = "Select Player:"
    playerPositionSelect.classList.add("hidden");
    playerPositionSelect.value = ""
    playerSelect.classList.remove("hidden");

    // Get all player options for the team
    const playerOptions = teamMap[selectedTeam].playerIds.map(id => {
      const player = playerMap[id];
      return {
        "id": id,
        "name": `${player.firstName} ${player.lastName}`
      }
    }).sort((p1, p2) => p1.name.localeCompare(p2.name))

    // Add player options
    for (const playerOption of playerOptions) {
      const option = document.createElement("option");
      option.value = playerOption.id;
      option.textContent = playerOption.name;
      playerSelect.appendChild(option);
    }
  }

  // Plot data based on current active shot/goal toggle button
  if (goalsButton.classList.contains("active")) {
    document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Goals (${goalEvents.length})` : "Entire League Goals";
    plotSeasonData(goalEvents)
  } else if (shotsButton.classList.contains("active")) {
    document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Shots (${shotEvents.length})` : "Entire League Shots";
    plotSeasonData(shotEvents)
  }

  // Cancel previous change listeners
  seasonFiltersController.abort();
  seasonFiltersController = new AbortController();

  // Add change listeners to the toggle buttons and player select
  goalsButton.addEventListener("click", () => {
    if (!goalsButton.classList.contains("active")) {
      goalsButton.classList.add("active");
      shotsButton.classList.remove("active");
      filterSeasonEvents(shotEvents, goalEvents, selectedTeam)
    }
  }, { signal: seasonFiltersController.signal })
  shotsButton.addEventListener("click", () => {
    if (!shotsButton.classList.contains("active")) {
      goalsButton.classList.remove("active");
      shotsButton.classList.add("active");
      filterSeasonEvents(shotEvents, goalEvents, selectedTeam)
    }
  }, { signal: seasonFiltersController.signal })
  playerPositionSelect.addEventListener("change", () => {
    filterSeasonEvents(shotEvents, goalEvents, selectedTeam)
  }, { signal: seasonFiltersController.signal })
}

// Filters and plots season events based on selected team, active goal/shot toggle button, and selected position
function filterSeasonEvents(shotEvents, goalEvents, selectedTeam) {
  const shotsButton = document.getElementById("shots-btn");
  const playerPositionSelect = document.getElementById("player-type-select");
  const selectedPosition = playerPositionSelect.value

  if (selectedPosition) {
    if (shotsButton.classList.contains("active")) {
      const shots = shotEvents.filter(event => selectedPosition.includes(playerMap[event.playerId].position));
      document.getElementById("season-header").innerHTML = `${playerPositionSelect.options[playerPositionSelect.selectedIndex].text} Shots (${shots.length})`
      plotSeasonData(shots)
    } else {
      const goals = goalEvents.filter(event => selectedPosition.includes(playerMap[event.playerId].position));
      document.getElementById("season-header").innerHTML = `${playerPositionSelect.options[playerPositionSelect.selectedIndex].text} Goals (${goals.length})`
      plotSeasonData(goals)
    }
  } else {
    if (shotsButton.classList.contains("active")) {
      document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Shots (${shotEvents.length})` : "Entire League Shots"
      plotSeasonData(shotEvents)
    }
    else {
      document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Goals (${goalEvents.length})` : "Entire League Goals"
      plotSeasonData(goalEvents)
    }
  }
}

// Function to get all events for a team
function getEventsForTeam(abbrev) {
  const team = teamMap[abbrev];
  return team.games
    .flatMap(game => {
      const gameData = gameMap[game.gameId]
      if (!gameData) return []

      const startDate = new Date(gameData.date)
      const date = (startDate.getMonth() + 1) + '/' + startDate.getDate() + '/' + startDate.getFullYear();

      return gameData.events.map(event => ({ ...event, game: `${gameData.homeTeam} vs. ${gameData.awayTeam}`, date }))
    }).filter(event => event.teamAbbrev == abbrev);
};

// Handles the player select for the season tab
function handleSeasonPlayerSelect() {
  const selectedPlayer = document.getElementById("season-player-select").value;
  document.getElementById("season-player-select").classList.remove("hidden");
  if (!selectedPlayer) {
    // All players selected, update plot with current team select value
    handleSeasonTeamSelect();
  } else {
    // Player selected, hide shot/goal toggle and plot player scatterplot
    document.getElementById("shots-btn").classList.add("hidden");
    document.getElementById("goals-btn").classList.add("hidden");
    document.getElementById("season-header").innerHTML = `${playerMap[selectedPlayer].firstName} ${playerMap[selectedPlayer].lastName} Shots and Goals`;
    plotSeasonPlayerData(getEventsForPlayer(selectedPlayer));
  }
}

// Gets all events for player with the provided id
function getEventsForPlayer(id) {
  const playerId = Number(id);
  const events = [];
  for (const [abbrev, team] of Object.entries(teamMap)) {
    if (team.playerIds.includes(playerId)) {
      events.push(...getEventsForTeam(abbrev).filter(event => event.playerId == id));
    }
  }
  return events;
};

// Rink dimensions in feet
const rinkWidth = 200
const rinkHeight = 85

// Plot pixel to foot scale
const plotScale = 4.4

// Plot dimensions
const plotWidth = rinkWidth * plotScale;
const plotHeight = rinkHeight * plotScale;

// X and y axis scales
const x = d3.scaleLinear()
  .domain([-rinkWidth / 2, rinkWidth / 2])
  .range([0, plotWidth]);
const y = d3.scaleLinear()
  .domain([-rinkHeight / 2, rinkHeight / 2])
  .range([plotHeight, 0]);

// Plots D3 scatterplot of individual game data
function plotGameData(goalAndShotEvents) {
  d3.select("#game-d3-plot").selectAll("*").remove();

  const svg = d3.select("#game-d3-plot")
    .append("svg")
    .attr("width", plotWidth)
    .attr("height", plotHeight)
    .append("g")

  // Add rink image to plot
  svg.append("image")
    .attr("xlink:href", "images/rink.jpeg")
    .attr("x", x(- rinkWidth / 2))
    .attr("y", y(rinkHeight / 2))
    .attr("width", x(rinkWidth / 2) - x(-rinkWidth / 2))
    .attr("height", y(-rinkHeight / 2) - y(rinkHeight / 2));

  var tooltip = d3.select("#game-tooltip");

  // Add shot events as circles
  svg.selectAll("circle")
    .data(goalAndShotEvents.filter(event => event.typeDescKey == "shot-on-goal"))
    .enter()
    .append("circle")
    .attr("cx", event => x(event.details.xCoord))
    .attr("cy", event => y(event.details.yCoord))
    .attr("r", 4)
    .style("fill", event => getColor(event.isHomeTeam))
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue")
      showToolTip(event, this.getBoundingClientRect());
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black")
      tooltip.style("visibility", "hidden");
    })

  // Add goal events as crosses
  svg.selectAll("path")
    .data(goalAndShotEvents.filter(event => event.typeDescKey == "goal"))
    .enter()
    .append("path")
    .attr("d", d3.symbol().type(d3.symbolCross).size(80))
    .attr("transform", event => `translate(${x(event.details.xCoord)}, ${y(event.details.yCoord)}) rotate(45)`)
    .style("fill", event => getColor(event.isHomeTeam))
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue");
      showToolTip(event, this.getBoundingClientRect())
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black");
      tooltip.style("visibility", "hidden");
    });

  // Gets color for home/away teams
  function getColor(isHomeTeam) {
    return isHomeTeam ? "yellow" : "#c772fc"
  }

  // Shows the tooltip for the provided event at the provided location
  function showToolTip(event, position) {
    tooltip.style("visibility", "visible")
      .html(`
        ${event.typeDescKey === "goal" ? "<b>Goal</b>" : "<b>Shot on Goal</b>"}
        <br>Player: ${playerMap[event.playerId].firstName} ${playerMap[event.playerId].lastName}
        <br>Team: ${event.teamName}
        <br>Period: ${event.periodDescriptor.number}
        <br>Time Into Period: ${event.timeInPeriod}
        <br>Shot type: ${String(event.details.shotType).charAt(0).toUpperCase() + String(event.details.shotType).slice(1)}
      `)
      .style("top", (position.bottom + window.scrollY + 110 > window.innerHeight ? position.bottom + window.scrollY - 110 : position.bottom + window.scrollY) + "px")
      .style("left", (position.right + window.scrollX + 160 > window.innerWidth ? position.right + window.scrollX - 170 : position.right + window.scrollX) + "px")
      .style("background", getColor(event.isHomeTeam));
  }
}

// Plots a D3 density 2D map of season data
function plotSeasonData(events) {
  const filteredEvents = events.filter(event => event.details.xCoord !== undefined && event.details.yCoord !== undefined)
  d3.select("#season-d3-plot").selectAll("*").remove();

  // Room for heatmap legend
  const legendBuffer = 60

  const svg = d3.select("#season-d3-plot")
    .append("svg")
    .attr("width", plotWidth)
    .attr("height", plotHeight + legendBuffer)
    .append("g")
    .attr("transform", "translate(0," + legendBuffer + ")");

  // Add rink image to plot
  svg.append("image")
    .attr("xlink:href", "images/rink.jpeg")
    .attr("x", x(- rinkWidth / 2))
    .attr("y", y(rinkHeight / 2))
    .attr("width", x(rinkWidth / 2) - x(-rinkWidth / 2))
    .attr("height", y(-rinkHeight / 2) - y(rinkHeight / 2));

  // Compute the density data
  var densityData = d3.contourDensity()
    .x(event => x(event.details.xCoord))
    .y(event => y(event.details.yCoord))
    .size([plotWidth, plotHeight])
    .bandwidth(6)
    (filteredEvents)

  // Get max and min density data
  const sortedDensityData = densityData.map(d => d.value).sort(d3.ascending);
  const maxDensityValue = d3.quantile(sortedDensityData, 0.95);
  const minDensityValue = d3.min(densityData, d => d.value);

  // Increase the bandwidth if the minimum density value is very small
  if (minDensityValue < 0.0032) {
    densityData = d3.contourDensity()
      .x(event => x(event.details.xCoord))
      .y(event => y(event.details.yCoord))
      .size([plotWidth, plotHeight])
      .bandwidth(9)
      (filteredEvents)
  }

  // Create heatmap color scale
  const colorScale = d3.scaleSequential(d3.interpolatePlasma)
    .domain([minDensityValue, maxDensityValue]);

  // Create heatmap opacity scale
  const opacityScale = d3.scaleLinear()
    .domain([minDensityValue, maxDensityValue])
    .range([0.1, 0.5]);

  // Gets color with opacity based on density value
  function getColor(density) {
    const color = d3.color(colorScale(density));
    color.opacity = opacityScale(density);
    return color;
  }

  // Draw the contours
  svg.insert("g", "g")
    .selectAll("path")
    .data(densityData)
    .enter().append("path")
    .attr("d", d3.geoPath())
    .attr("fill", function (d) { return getColor(d.value); });

  const legendRectWidth = 200;
  const legendRectHeight = 10;
  const legendLabelHeight = 20;

  // Covert shots per square pixel to shots per square foot
  const legendMinValue = minDensityValue * plotScale * plotScale
  const legendMaxValue = maxDensityValue * plotScale * plotScale

  const legendSvg = svg.append("g")
    .attr("transform", `translate(${(plotWidth - legendRectWidth) / 2}, -${legendBuffer})`);

  legendSvg.append("text")
    .attr("x", 0)
    .attr("transform", `translate(${(legendRectWidth) / 2}, 12)`)
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text(`${filteredEvents[0].typeDescKey === "goal" ? "Goals" : "Shots"} per Square Foot`);

  const gradient = svg.append("defs")
    .append("linearGradient")
    .attr("id", "legendGradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const legendOpacityScale = d3.scaleLinear()
    .domain([minDensityValue, maxDensityValue])
    .range([0.1, 0.9]);

  // Add more stops for a smoother color transition
  const legendStops = 40;
  for (let i = 0; i <= legendStops; i++) {
    const t = i / legendStops;
    const densityValue = minDensityValue + t * (maxDensityValue - minDensityValue);
    const stopColor = colorScale(densityValue);
    const stopOpacity = legendOpacityScale(densityValue);

    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", stopColor)
      .attr("stop-opacity", stopOpacity);
  }

  // Draw the legend color bar
  legendSvg.append("rect")
    .attr("transform", `translate(0, ${legendLabelHeight})`)
    .attr("width", legendRectWidth)
    .attr("height", legendRectHeight)
    .style("fill", "url(#legendGradient)");

  // Create a scale for the legend axis
  const legendScale = d3.scaleLinear()
    .domain([legendMinValue, legendMaxValue])
    .range([0, legendRectWidth]);

  // Add legend ticks and values
  const numberOfTicks = 5;
  const tickValues = d3.range(legendMinValue, legendMaxValue, (legendMaxValue - legendMinValue) / (numberOfTicks - 1)).concat(legendMaxValue);

  // Add the legend axis with specified tick values
  legendSvg.append("g")
    .attr("transform", `translate(0, ${legendRectHeight + legendLabelHeight})`)
    .call(d3.axisBottom(legendScale)
      .tickValues(tickValues)
      .tickFormat(d => d === legendMaxValue ? `${parseFloat(d.toFixed(2))}+` : parseFloat(d.toFixed(2))))
    .call(g => g.selectAll(".tick text")
      .style("text-anchor", "middle"));
}

// Plots D3 scatterplot of season player data
function plotSeasonPlayerData(events) {
  const filteredEvents = events.filter(event => event.details.xCoord !== undefined && event.details.yCoord !== undefined)

  d3.select("#season-d3-plot").selectAll("*").remove();

  const svg = d3.select("#season-d3-plot")
    .append("svg")
    .attr("width", plotWidth)
    .attr("height", plotHeight)
    .append("g")

  // Add rink image to plot
  svg.append("image")
    .attr("xlink:href", "images/rink.jpeg")
    .attr("x", x(- rinkWidth / 2))
    .attr("y", y(rinkHeight / 2))
    .attr("width", x(rinkWidth / 2) - x(-rinkWidth / 2))
    .attr("height", y(-rinkHeight / 2) - y(rinkHeight / 2));

  var tooltip = d3.select("#season-tooltip");

  // Add circles for shots
  svg.selectAll("circle")
    .data(filteredEvents.filter(event => event.typeDescKey == "shot-on-goal"))
    .enter()
    .append("circle")
    .attr("cx", event => x(event.details.xCoord))
    .attr("cy", event => y(event.details.yCoord))
    .attr("r", 4)
    .style("fill", "#c772fc")
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue")
      showToolTip(event, this.getBoundingClientRect());
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black")
      tooltip.style("visibility", "hidden");
    })

  // Add crosses for goals
  svg.selectAll("path")
    .data(filteredEvents.filter(event => event.typeDescKey == "goal"))
    .enter()
    .append("path")
    .attr("d", d3.symbol().type(d3.symbolCross).size(80))
    .attr("transform", event => `translate(${x(event.details.xCoord)}, ${y(event.details.yCoord)}) rotate(45)`)
    .style("fill", "yellow")
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue");
      showToolTip(event, this.getBoundingClientRect())
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black");
      tooltip.style("visibility", "hidden");
    });

  // Shows player tooltip for provided event
  function showToolTip(event, position) {
    tooltip.style("visibility", "visible")
      .html(`
        ${event.typeDescKey === "goal" ? "<b>Goal</b>" : "<b>Shot on Goal</b>"}
        <br>Game: ${event.game}
        <br>Date: ${event.date}
        <br>Period: ${event.periodDescriptor.number}
        <br>Time Into Period: ${event.timeInPeriod}
        <br>Shot type: ${String(event.details.shotType).charAt(0).toUpperCase() + String(event.details.shotType).slice(1)}
      `)
      .style("top", (position.bottom + window.scrollY + 110 > window.innerHeight ? position.bottom + window.scrollY - 110 : position.bottom + window.scrollY) + "px")
      .style("left", (position.right + window.scrollX + 170 > window.innerWidth ? position.right + window.scrollX - 170 : position.right + window.scrollX) + "px")
  }
}

