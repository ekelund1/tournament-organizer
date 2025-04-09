document.addEventListener('DOMContentLoaded', () => {
    const groupsContainer = document.getElementById('groupsContainer');
    const errorMessagesDiv = document.getElementById('errorMessages');
    const backButton = document.getElementById('backButton');

    const LS_TOURNAMENT_DATA_KEY = 'tournament_data';
    let tournamentData = null;

    function displayError(message) {
        errorMessagesDiv.textContent = message;
    }

    function clearErrors() {
        errorMessagesDiv.textContent = '';
    }

    function loadTournamentData() {
        clearErrors();
        const savedDataJSON = localStorage.getItem(LS_TOURNAMENT_DATA_KEY);
        if (!savedDataJSON) {
            displayError("No tournament data found. Please go back to setup and generate groups first.");
            return false;
        }
        try {
            tournamentData = JSON.parse(savedDataJSON);
            if (!tournamentData || !Array.isArray(tournamentData.groups)) {
                displayError("Invalid tournament data format found.");
                tournamentData = null;
                return false;
            }
            // Initialize/validate results object for each match and ensure arrays exist
            tournamentData.groups.forEach(group => {
                if (!Array.isArray(group.teams)) group.teams = [];
                if (Array.isArray(group.matches)) {
                    group.matches.forEach(match => {
                         // Ensure team names exist in match object (important for standings)
                         if (!match.team1 || !match.team2) {
                             console.warn("Match object missing team names:", match);
                             // Optionally handle this error, e.g., skip match in calculations
                         }

                        if (!match.results) {
                            match.results = { sets: [ [null, null], [null, null], [null, null] ], team1_sets_won: 0, team2_sets_won: 0, team1_match_points: 0, team2_match_points: 0, team1_point_diff: 0, team2_point_diff: 0, is_complete: false };
                        }
                        if (!Array.isArray(match.results.sets) || match.results.sets.length !== 3 || !Array.isArray(match.results.sets[0])) {
                             match.results.sets = [ [null, null], [null, null], [null, null] ];
                        }
                         for(let i=0; i<3; i++) {
                            if (!Array.isArray(match.results.sets[i]) || match.results.sets[i].length !== 2) {
                                match.results.sets[i] = [null, null];
                            }
                         }
                    });
                } else {
                    group.matches = [];
                }
            });
            return true;
        } catch (e) {
            displayError("Error parsing tournament data.");
            console.error("Parsing error:", e);
            return false;
        }
    }

    function saveTournamentData() {
        if (tournamentData) {
            try {
                localStorage.setItem(LS_TOURNAMENT_DATA_KEY, JSON.stringify(tournamentData));
            } catch (e) {
                displayError("Error saving results. Storage might be full.");
                console.error("Saving error:", e);
            }
        }
    }

    function calculateMatchResult(setsScores) {
        let team1SetsWon = 0;
        let team2SetsWon = 0;
        let team1TotalPoints = 0;
        let team2TotalPoints = 0;
        let setsPlayed = 0;
        let isComplete = false;

        for (let i = 0; i < 3; i++) {
            const score1 = setsScores[i][0];
            const score2 = setsScores[i][1];

            if (typeof score1 === 'number' && !isNaN(score1) && typeof score2 === 'number' && !isNaN(score2) && score1 >= 0 && score2 >= 0) {
                setsPlayed++;
                team1TotalPoints += score1;
                team2TotalPoints += score2;
                if (score1 > score2) team1SetsWon++;
                else if (score2 > score1) team2SetsWon++;

                if (team1SetsWon === 2 || team2SetsWon === 2) {
                     isComplete = true; // Mark as complete as soon as someone wins 2 sets
                     break;
                }
            } else {
                 // If a score is missing in a set that should have been played (e.g., Set 1 or Set 2 when Set 3 has scores, or if Set 1 is missing)
                 // we consider the result incomplete for points calculation.
                 if (i < 2 && (typeof setsScores[i+1]?.[0] === 'number' || typeof setsScores[i+1]?.[1] === 'number')) {
                      isComplete = false; // Incomplete if a later set has scores but this one doesn't
                      break;
                 }
                 // Stop processing if a set is missing and we haven't finished
                 if (!isComplete) break;
            }
        }

        let team1MatchPoints = 0;
        let team2MatchPoints = 0;

        if (isComplete) {
            if (team1SetsWon === 2 && team2SetsWon === 0) { team1MatchPoints = 3; team2MatchPoints = 0; }
            else if (team1SetsWon === 2 && team2SetsWon === 1) { team1MatchPoints = 2; team2MatchPoints = 1; }
            else if (team1SetsWon === 1 && team2SetsWon === 2) { team1MatchPoints = 1; team2MatchPoints = 2; }
            else if (team1SetsWon === 0 && team2SetsWon === 2) { team1MatchPoints = 0; team2MatchPoints = 3; }
            // The case 0-0, 1-0, 0-1, 1-1 shouldn't happen if isComplete is true based on 2 sets won
        }

        return {
            team1_sets_won: team1SetsWon,
            team2_sets_won: team2SetsWon,
            team1_match_points: team1MatchPoints,
            team2_match_points: team2MatchPoints,
            team1_point_diff: team1TotalPoints - team2TotalPoints,
            team2_point_diff: team2TotalPoints - team1TotalPoints,
            is_complete: isComplete && setsPlayed >= 2 // Ensure at least 2 sets were played for a complete result
        };
    }

    function calculateGroupStandings(group) {
        const standings = {};
        if (!group || !Array.isArray(group.teams)) return []; // Handle invalid group

        group.teams.forEach(teamName => {
             if(teamName) { // Ensure teamName is valid
                 standings[teamName] = {
                    teamName: teamName, matchPoints: 0, gamesPlayed: 0, pointDifference: 0
                 };
            }
        });

        if (Array.isArray(group.matches)) {
            group.matches.forEach(match => {
                // Ensure match has valid teams and results are complete
                if (match && match.team1 && match.team2 && match.results && match.results.is_complete) {
                    if (standings[match.team1]) {
                        standings[match.team1].gamesPlayed += 1;
                        standings[match.team1].matchPoints += match.results.team1_match_points;
                        standings[match.team1].pointDifference += match.results.team1_point_diff;
                    } else {
                         console.warn(`Team ${match.team1} from match results not found in group teams list.`);
                    }
                    if (standings[match.team2]) {
                        standings[match.team2].gamesPlayed += 1;
                        standings[match.team2].matchPoints += match.results.team2_match_points;
                        standings[match.team2].pointDifference += match.results.team2_point_diff;
                    } else {
                         console.warn(`Team ${match.team2} from match results not found in group teams list.`);
                    }
                }
            });
        }

        const standingsArray = Object.values(standings);
        standingsArray.sort((a, b) => {
            if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
            return b.pointDifference - a.pointDifference;
        });
        return standingsArray;
    }

    function renderStandingsTable(standingsArray, containerElement) {
        containerElement.innerHTML = '';
        if (!Array.isArray(standingsArray)) return;

        const table = document.createElement('table');
        table.className = 'standings-table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const headers = ["Team", "Pts", "Played", "Diff"];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        standingsArray.forEach(teamStanding => {
             // Ensure teamStanding is a valid object before trying to render
             if (teamStanding && typeof teamStanding === 'object') {
                 const row = tbody.insertRow();
                 row.insertCell().textContent = teamStanding.teamName || 'N/A';
                 row.insertCell().textContent = teamStanding.matchPoints ?? 0;
                 row.insertCell().textContent = teamStanding.gamesPlayed ?? 0;
                 const diff = teamStanding.pointDifference ?? 0;
                 row.insertCell().textContent = diff > 0 ? `+${diff}` : diff;
            }
        });
        containerElement.appendChild(table);
    }

    function handleScoreInput(event, groupIndex, matchIndex) {
        const group = tournamentData?.groups?.[groupIndex];
        const match = group?.matches?.[matchIndex];
        if (!match || !group) return;

        const setIndex = parseInt(event.target.dataset.set, 10);
        const teamIdentifier = event.target.dataset.team; // 'team1' or 'team2'
        const score = event.target.value === '' ? null : parseInt(event.target.value, 10);

        // Input validation
        if (event.target.value !== '' && (isNaN(score) || score < 0)) {
            const previousScore = match.results.sets[setIndex][teamIdentifier === 'team1' ? 0 : 1];
            event.target.value = (typeof previousScore === 'number') ? previousScore : ''; // Revert
            return;
        }

        // Update data structure
        const teamArrayIndex = (teamIdentifier === 'team1' ? 0 : 1);
        match.results.sets[setIndex][teamArrayIndex] = score;

        // Recalculate results
        const calculated = calculateMatchResult(match.results.sets);
        match.results = { ...match.results, ...calculated }; // Merge calculated results back

        // Save data BEFORE updating UI reliant on this data
        saveTournamentData();

        // Update the standings table for this group
        const standingsArray = calculateGroupStandings(group);
        const tableContainer = document.getElementById(`standings-table-${groupIndex}`);
        if (tableContainer) {
            renderStandingsTable(standingsArray, tableContainer);
        } else {
            console.error(`Standings table container not found for group index ${groupIndex}`);
        }
    }

    function renderGroupStage() {
        if (!tournamentData) return;
        groupsContainer.innerHTML = '';

        tournamentData.groups.forEach((group, groupIndex) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'group-container';

            const groupTitle = document.createElement('h3');
            groupTitle.textContent = group.name || `Group ${String.fromCharCode(65 + groupIndex)}`;
            groupDiv.appendChild(groupTitle);

            // Standings Table Area
            const standingsContainer = document.createElement('div');
            standingsContainer.className = 'standings-table-container';
            standingsContainer.id = `standings-table-${groupIndex}`;
            groupDiv.appendChild(standingsContainer);
            const standingsArray = calculateGroupStandings(group); // Calculate initial standings
            renderStandingsTable(standingsArray, standingsContainer); // Render initial table

            // Matches Area
            const matchesContainer = document.createElement('div');
            matchesContainer.className = 'matches-container';
            groupDiv.appendChild(matchesContainer);

            if (!Array.isArray(group.matches) || group.matches.length === 0) {
                const noMatchesP = document.createElement('p');
                noMatchesP.textContent = "No matches for this group.";
                matchesContainer.appendChild(noMatchesP);
            } else {
                const matchesTitle = document.createElement('h4');
                matchesTitle.textContent = "Matches";
                matchesContainer.appendChild(matchesTitle);

                group.matches.forEach((match, matchIndex) => {
                     if (!match || !match.team1 || !match.team2) return; // Skip rendering invalid match object

                    const matchContainer = document.createElement('div');
                    matchContainer.className = 'match-container';
                    matchContainer.id = `match-${groupIndex}-${matchIndex}`;

                    const matchHeader = document.createElement('div');
                    matchHeader.className = 'match-header';
                    matchHeader.textContent = `${match.team1} vs ${match.team2}`;
                    if (match.referee) {
                        const refSpan = document.createElement('span');
                        refSpan.className = 'match-ref';
                        refSpan.textContent = `(Ref: ${match.referee})`;
                        matchHeader.appendChild(refSpan);
                    }
                    matchContainer.appendChild(matchHeader);

                    // Set Inputs
                    for (let i = 0; i < 3; i++) {
                        const setRow = document.createElement('div');
                        setRow.className = 'set-input-row';
                        const setLabel = document.createElement('label');
                        setLabel.textContent = `Set ${i + 1}:`;
                        const input1 = document.createElement('input');
                        input1.type = 'number'; input1.min = '0'; input1.placeholder = '...';
                        input1.dataset.groupIndex = groupIndex; input1.dataset.matchIndex = matchIndex;
                        input1.dataset.set = i; input1.dataset.team = 'team1';
                        const score1 = match.results?.sets?.[i]?.[0];
                        input1.value = (typeof score1 === 'number') ? score1 : '';
                        input1.addEventListener('input', (e) => handleScoreInput(e, groupIndex, matchIndex));

                        const input2 = document.createElement('input');
                        input2.type = 'number'; input2.min = '0'; input2.placeholder = '...';
                        input2.dataset.groupIndex = groupIndex; input2.dataset.matchIndex = matchIndex;
                        input2.dataset.set = i; input2.dataset.team = 'team2';
                        const score2 = match.results?.sets?.[i]?.[1];
                        input2.value = (typeof score2 === 'number') ? score2 : '';
                        input2.addEventListener('input', (e) => handleScoreInput(e, groupIndex, matchIndex));

                        setRow.appendChild(setLabel);
                        setRow.appendChild(input1);
                        setRow.appendChild(document.createTextNode(' - '));
                        setRow.appendChild(input2);
                        matchContainer.appendChild(setRow);
                    }
                    matchesContainer.appendChild(matchContainer);
                });
            }
            groupsContainer.appendChild(groupDiv);
        });
    }

    // --- Initialisation ---
    if (loadTournamentData()) {
        renderGroupStage();
    } else {
        // If loading failed, maybe disable inputs or show clear message
        groupsContainer.innerHTML = '<p>Could not load tournament data. Please return to setup.</p>';
    }

    // --- Back button ---
    backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});