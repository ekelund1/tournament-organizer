document.addEventListener('DOMContentLoaded', () => {
    // console.log("group_stage.js: DOMContentLoaded event fired."); // Optional log

    const groupsContainer = document.getElementById('groupsContainer');
    const errorMessagesDiv = document.getElementById('errorMessages');
    const backButton = document.getElementById('backButton');
    const clearTournamentBtn = document.getElementById('clearTournamentBtn'); // Clear Button Ref

    // Ensure keys match script.js
    const LS_KEYS = {
        NUM_TEAMS: 'tournament_numTeams',
        TEAM_NAMES: 'tournament_teamNames',
        NUM_GROUPS: 'tournament_numGroups',
        ASSIGN_REFS: 'tournament_assignRefs',
        TOURNAMENT_DATA: 'tournament_data'
    };
    let tournamentData = null;

    function displayError(message) {
        console.error("group_stage.js: Displaying Error -", message);
        errorMessagesDiv.textContent = message;
    }
    function clearErrors() { errorMessagesDiv.textContent = ''; }

    function loadTournamentData() {
        // console.log("group_stage.js: loadTournamentData() called.");
        clearErrors();
        const savedDataJSON = localStorage.getItem(LS_KEYS.TOURNAMENT_DATA);
        // console.log("group_stage.js: Raw data from localStorage:", savedDataJSON);

        if (!savedDataJSON) {
            displayError("No tournament data found. Please go back to setup and generate groups first.");
            return false;
        }
        try {
            tournamentData = JSON.parse(savedDataJSON);
            // console.log("group_stage.js: Parsed tournamentData:", JSON.parse(JSON.stringify(tournamentData)));

            if (!tournamentData || !Array.isArray(tournamentData.groups)) {
                displayError("Invalid tournament data format found (missing top level structure or groups array).");
                tournamentData = null;
                return false;
            }

            // Initialize/validate results object for each match and ensure arrays exist
            let validationOk = true;
            tournamentData.groups.forEach((group, groupIndex) => {
                if (!group || typeof group !== 'object') { validationOk = false; return; }
                if (!Array.isArray(group.teams)) group.teams = [];
                if (!Array.isArray(group.matches)) group.matches = [];

                 group.matches.forEach((match, matchIndex) => {
                    if (!match || typeof match !== 'object') { validationOk = false; return; }
                    // if (!match.team1 || !match.team2) { console.warn(`Match ${matchIndex} in group ${groupIndex} missing team names.`); } // Optional warning

                    if (!match.results) {
                           match.results = { sets: [ [null, null], [null, null], [null, null] ], team1_sets_won: 0, team2_sets_won: 0, team1_match_points: 0, team2_match_points: 0, team1_point_diff: 0, team2_point_diff: 0, is_complete: false };
                    }
                     // Deep check results structure
                     if (!Array.isArray(match.results.sets) || match.results.sets.length !== 3) match.results.sets = [[null,null],[null,null],[null,null]];
                     for(let i=0; i<3; i++) {
                         if (!Array.isArray(match.results.sets[i]) || match.results.sets[i].length !== 2) match.results.sets[i] = [null, null];
                     }
                     // Ensure other result props exist (using nullish coalescing)
                     match.results.team1_sets_won = match.results.team1_sets_won ?? 0;
                     match.results.team2_sets_won = match.results.team2_sets_won ?? 0;
                     match.results.team1_match_points = match.results.team1_match_points ?? 0;
                     match.results.team2_match_points = match.results.team2_match_points ?? 0;
                     match.results.team1_point_diff = match.results.team1_point_diff ?? 0;
                     match.results.team2_point_diff = match.results.team2_point_diff ?? 0;
                     match.results.is_complete = match.results.is_complete ?? false;
                 });
                 if (!validationOk) return; // Stop checking this group if match was invalid
            });

             if (!validationOk) {
                 displayError("Found invalid group or match structure within the data.");
                 return false;
             }
            // console.log("group_stage.js: loadTournamentData() completed successfully.");
            return true;
        } catch (e) {
            displayError("Error parsing tournament data.");
            console.error("group_stage.js: Parsing error:", e);
            tournamentData = null;
            return false;
        }
    }

    function saveTournamentData() {
        if (tournamentData) {
            try {
                // Ensure no lingering playoff data from previous versions if structure changed
                delete tournamentData.playoffSettings;
                delete tournamentData.playoffs;
                localStorage.setItem(LS_KEYS.TOURNAMENT_DATA, JSON.stringify(tournamentData));
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
            const score1 = setsScores[i]?.[0]; // Use optional chaining for safety
            const score2 = setsScores[i]?.[1];

            if (typeof score1 === 'number' && !isNaN(score1) && typeof score2 === 'number' && !isNaN(score2) && score1 >= 0 && score2 >= 0) {
                setsPlayed++;
                team1TotalPoints += score1;
                team2TotalPoints += score2;
                if (score1 > score2) team1SetsWon++;
                else if (score2 > score1) team2SetsWon++;

                if (team1SetsWon === 2 || team2SetsWon === 2) {
                     isComplete = true;
                     break;
                }
            } else {
                 if (i < 2 && (typeof setsScores[i+1]?.[0] === 'number' || typeof setsScores[i+1]?.[1] === 'number')) {
                      isComplete = false; break; // Incomplete if later set has scores but this one doesn't
                 }
                 if (!isComplete) break; // Stop processing if set missing and match not won
            }
        }

        let team1MatchPoints = 0;
        let team2MatchPoints = 0;
        // Determine match points ONLY if the match is marked complete
        if (isComplete) {
            if (team1SetsWon === 2 && team2SetsWon === 0) { team1MatchPoints = 3; team2MatchPoints = 0; }
            else if (team1SetsWon === 2 && team2SetsWon === 1) { team1MatchPoints = 2; team2MatchPoints = 1; }
            else if (team1SetsWon === 1 && team2SetsWon === 2) { team1MatchPoints = 1; team2MatchPoints = 2; }
            else if (team1SetsWon === 0 && team2SetsWon === 2) { team1MatchPoints = 0; team2MatchPoints = 3; }
        }

        return {
            team1_sets_won: team1SetsWon,
            team2_sets_won: team2SetsWon,
            team1_match_points: team1MatchPoints,
            team2_match_points: team2MatchPoints,
            team1_point_diff: team1TotalPoints - team2TotalPoints,
            team2_point_diff: team2TotalPoints - team1TotalPoints,
            // Consider complete only if required sets won OR minimum sets played?
            // Let's stick to isComplete flag determined by sets won.
            is_complete: isComplete
        };
    }

    function calculateGroupStandings(group) {
        // console.log(`group_stage.js: calculateGroupStandings called for group: ${group?.name}`);
        const standings = {};
        if (!group || !Array.isArray(group.teams)) return [];

        group.teams.forEach(teamName => {
            if(teamName) { standings[teamName] = { teamName: teamName, matchPoints: 0, gamesPlayed: 0, pointDifference: 0 }; }
        });

        if (Array.isArray(group.matches)) {
            group.matches.forEach(match => {
                if (match?.results?.is_complete && match.team1 && match.team2) {
                    if (standings[match.team1]) {
                        standings[match.team1].gamesPlayed++;
                        standings[match.team1].matchPoints += match.results.team1_match_points ?? 0;
                        standings[match.team1].pointDifference += match.results.team1_point_diff ?? 0;
                    }
                    if (standings[match.team2]) {
                        standings[match.team2].gamesPlayed++;
                        standings[match.team2].matchPoints += match.results.team2_match_points ?? 0;
                        standings[match.team2].pointDifference += match.results.team2_point_diff ?? 0;
                    }
                }
            });
        }

        const standingsArray = Object.values(standings);
        standingsArray.sort((a, b) => {
            if ((b.matchPoints ?? 0) !== (a.matchPoints ?? 0)) return (b.matchPoints ?? 0) - (a.matchPoints ?? 0);
            return (b.pointDifference ?? 0) - (a.pointDifference ?? 0);
        });
        // console.log(`group_stage.js: Calculated standings for ${group?.name}:`, JSON.parse(JSON.stringify(standingsArray)));
        return standingsArray;
    }

    function renderStandingsTable(standingsArray, containerElement) {
        // console.log("group_stage.js: renderStandingsTable called.");
        containerElement.innerHTML = '';
        if (!Array.isArray(standingsArray)) return;
        const table = document.createElement('table'); table.className = 'standings-table'; const thead = table.createTHead(); const headerRow = thead.insertRow(); const headers = ["Team", "Pts", "Played", "Diff"]; headers.forEach(text => { const th = document.createElement('th'); th.textContent = text; headerRow.appendChild(th); }); const tbody = table.createTBody(); standingsArray.forEach(teamStanding => { if (teamStanding && typeof teamStanding === 'object') { const row = tbody.insertRow(); row.insertCell().textContent = teamStanding.teamName || 'N/A'; row.insertCell().textContent = teamStanding.matchPoints ?? 0; row.insertCell().textContent = teamStanding.gamesPlayed ?? 0; const diff = teamStanding.pointDifference ?? 0; row.insertCell().textContent = diff > 0 ? `+${diff}` : diff; }}); containerElement.appendChild(table);
        // console.log("group_stage.js: Standings table appended/updated.");
    }

    function handleScoreInput(event, groupIndex, matchIndex) {
        // console.log(`DEBUG: handleScoreInput triggered for G${groupIndex}, M${matchIndex}`);
        if (!tournamentData || !tournamentData.groups || !tournamentData.groups[groupIndex] || !tournamentData.groups[groupIndex].matches || !tournamentData.groups[groupIndex].matches[matchIndex]) {
             console.error("DEBUG: handleScoreInput - Could not find group or match data for indices:", groupIndex, matchIndex);
             return;
        }
        const group = tournamentData.groups[groupIndex];
        const match = group.matches[matchIndex];
        const targetInput = event.target;
        const setIndex = parseInt(targetInput.dataset.set, 10);
        const teamIdentifier = targetInput.dataset.team;
        const rawValue = targetInput.value;
        const score = rawValue === '' ? null : parseInt(rawValue, 10);
        // console.log(`DEBUG: Input Details - Set: ${setIndex}, Team: ${teamIdentifier}, RawValue: '${rawValue}', ParsedScore: ${score}`);

        if (rawValue !== '' && (isNaN(score) || score < 0)) {
            // console.warn("DEBUG: Invalid score input detected. Reverting.");
            const previousScore = match.results.sets[setIndex][teamIdentifier === 'team1' ? 0 : 1];
            targetInput.value = (typeof previousScore === 'number') ? previousScore : '';
            return;
        }

        const teamArrayIndex = (teamIdentifier === 'team1' ? 0 : 1);
        // console.log(`DEBUG: Updating match.results.sets[${setIndex}][${teamArrayIndex}] from ${match.results.sets[setIndex][teamArrayIndex]} to ${score}`);
        match.results.sets[setIndex][teamArrayIndex] = score;

        // console.log("DEBUG: Calling calculateMatchResult with sets:", JSON.parse(JSON.stringify(match.results.sets)));
        const calculated = calculateMatchResult(match.results.sets);
        // console.log("DEBUG: Calculated result:", calculated);
        match.results = { ...match.results, ...calculated }; // Merge results

        // console.log("DEBUG: Calling saveTournamentData...");
        saveTournamentData(); // Save updated results

        // Update Standings
        // console.log("DEBUG: Calling calculateGroupStandings for group:", group.name);
        const standingsArray = calculateGroupStandings(group);
        const tableContainerId = `standings-table-${groupIndex}`;
        const tableContainer = document.getElementById(tableContainerId);
        if (tableContainer) {
            // console.log(`DEBUG: Found standings container #${tableContainerId}. Calling renderStandingsTable.`);
            renderStandingsTable(standingsArray, tableContainer);
        } else {
            console.error(`DEBUG: Standings container #${tableContainerId} NOT FOUND!`);
        }
        // console.log(`DEBUG: handleScoreInput finished for G${groupIndex}, M${matchIndex}`);
    }

    function renderGroupStage() {
        // console.log("group_stage.js: renderGroupStage() called.");
        if (!tournamentData || !Array.isArray(tournamentData.groups)) {
            displayError("Cannot display groups: Tournament data is missing or invalid.");
            return;
        }
        groupsContainer.innerHTML = '';
        // console.log(`group_stage.js: Starting to render ${tournamentData.groups.length} groups.`);

        tournamentData.groups.forEach((group, groupIndex) => {
            // console.log(`group_stage.js: Processing group ${groupIndex}: ${group?.name}`);
            if (!group || typeof group !== 'object') return; // Skip invalid

            const groupDiv = document.createElement('div'); groupDiv.className = 'group-container';
            const groupTitle = document.createElement('h3'); groupTitle.textContent = group.name || `Group ${String.fromCharCode(65 + groupIndex)}`; groupDiv.appendChild(groupTitle);

            // Standings Table Area
            const standingsContainer = document.createElement('div'); standingsContainer.className = 'standings-table-container'; standingsContainer.id = `standings-table-${groupIndex}`; groupDiv.appendChild(standingsContainer);
            // console.log(`group_stage.js: Calling calculate+render standings for group ${groupIndex}`);
            const standingsArray = calculateGroupStandings(group); renderStandingsTable(standingsArray, standingsContainer);

            // Matches Area
            const matchesContainer = document.createElement('div'); matchesContainer.className = 'matches-container'; groupDiv.appendChild(matchesContainer);

            if (!Array.isArray(group.matches) || group.matches.length === 0) {
                matchesContainer.innerHTML = '<p>No matches for this group.</p>';
            } else {
                // console.log(`group_stage.js: Rendering ${group.matches.length} matches for group ${groupIndex}`);
                const matchesTitle = document.createElement('h4'); matchesTitle.textContent = "Matches"; matchesContainer.appendChild(matchesTitle);
                group.matches.forEach((match, matchIndex) => {
                     if (!match || !match.team1 || !match.team2) return; // Skip invalid match
                     const matchContainer = document.createElement('div'); matchContainer.className = 'match-container'; matchContainer.id = `match-${groupIndex}-${matchIndex}`;
                     const matchHeader = document.createElement('div'); matchHeader.className = 'match-header'; matchHeader.textContent = `${match.team1} vs ${match.team2}`;
                     if (match.referee) { const refSpan = document.createElement('span'); refSpan.className = 'match-ref'; refSpan.textContent = `(Ref: ${match.referee})`; matchHeader.appendChild(refSpan); }
                     matchContainer.appendChild(matchHeader);
                      for (let i = 0; i < 3; i++) {
                         const setRow = document.createElement('div'); setRow.className = 'set-input-row';
                         const setLabel = document.createElement('label'); setLabel.textContent = `Set ${i + 1}:`;
                         const input1 = document.createElement('input'); input1.type = 'number'; input1.min = '0'; input1.placeholder='...'; input1.dataset.groupIndex = groupIndex; input1.dataset.matchIndex = matchIndex; input1.dataset.set = i; input1.dataset.team = 'team1'; const score1 = match.results?.sets?.[i]?.[0]; input1.value = (typeof score1 === 'number') ? score1 : '';
                         input1.addEventListener('input', (e) => handleScoreInput(e, groupIndex, matchIndex)); // Attach listener
                         const input2 = document.createElement('input'); input2.type = 'number'; input2.min = '0'; input2.placeholder='...'; input2.dataset.groupIndex = groupIndex; input2.dataset.matchIndex = matchIndex; input2.dataset.set = i; input2.dataset.team = 'team2'; const score2 = match.results?.sets?.[i]?.[1]; input2.value = (typeof score2 === 'number') ? score2 : '';
                         input2.addEventListener('input', (e) => handleScoreInput(e, groupIndex, matchIndex)); // Attach listener
                         setRow.appendChild(setLabel); setRow.appendChild(input1); setRow.appendChild(document.createTextNode(' - ')); setRow.appendChild(input2);
                         matchContainer.appendChild(setRow);
                     }
                     matchesContainer.appendChild(matchContainer);
                 });
            }
            // console.log(`group_stage.js: Appending group container for group ${groupIndex}`);
            groupsContainer.appendChild(groupDiv);
        });
        // console.log("group_stage.js: Finished rendering groups.");
    }


    // --- Clear Tournament Function ---
    function handleClearTournament() {
        if (window.confirm("Are you sure you want to clear ALL tournament data?\nThis cannot be undone.")) {
            console.log("Clearing tournament data from group stage page...");
            try {
                 Object.values(LS_KEYS).forEach(key => {
                     console.log(`Removing localStorage key: ${key}`);
                     localStorage.removeItem(key);
                 });
                window.location.href = 'index.html'; // Navigate back to setup
            } catch (e) {
                console.error("Error clearing localStorage:", e);
                displayError("Failed to clear tournament data.");
            }
        }
    }

    // --- Initialisation ---
    // console.log("group_stage.js: Starting initialization.");
    if (loadTournamentData()) {
        // console.log("group_stage.js: loadTournamentData returned true. Calling renderGroupStage.");
        renderGroupStage();
    } else {
        // console.warn("group_stage.js: loadTournamentData returned false. Rendering skipped.");
        // Error message is displayed within loadTournamentData
        groupsContainer.innerHTML = '<p>Could not load tournament data. Please return to setup.</p>';
    }

    // --- Event Listeners ---
    backButton.addEventListener('click', () => { window.location.href = 'index.html'; });
    clearTournamentBtn.addEventListener('click', handleClearTournament); // Added listener
    // console.log("group_stage.js: Event listeners attached.");

}); // End of DOMContentLoaded