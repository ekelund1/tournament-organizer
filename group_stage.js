document.addEventListener('DOMContentLoaded', () => {
    const groupsContainer = document.getElementById('groupsContainer');
    const errorMessagesDiv = document.getElementById('errorMessages');
    const backButton = document.getElementById('backButton');
    const clearTournamentBtn = document.getElementById('clearTournamentBtn');

    const LS_KEYS = {
        TOURNAMENT_DATA: 'tournament_data'
        // Add other keys if needed, but TOURNAMENT_DATA is the primary one here
    };
    let tournamentData = null; // Will hold the entire tournament object, including settings

    function displayError(message) {
        console.error("group_stage.js: Displaying Error -", message);
        errorMessagesDiv.textContent = message;
    }
    function clearErrors() { errorMessagesDiv.textContent = ''; }

    function loadTournamentData() {
        clearErrors();
        const savedDataJSON = localStorage.getItem(LS_KEYS.TOURNAMENT_DATA);

        if (!savedDataJSON) {
            displayError("No tournament data found. Please go back to setup and generate groups first.");
            return false;
        }
        try {
            tournamentData = JSON.parse(savedDataJSON);

            if (!tournamentData || !Array.isArray(tournamentData.groups) || typeof tournamentData.shortenGroupStage === 'undefined') { // Check for shorten setting too
                displayError("Invalid tournament data format found (missing structure, groups, or settings).");
                tournamentData = null;
                return false;
            }

            // Initialize/validate results object for each match
            let validationOk = true;
            tournamentData.groups.forEach((group, groupIndex) => {
                if (!group || typeof group !== 'object') { validationOk = false; return; }
                if (!Array.isArray(group.teams)) group.teams = [];
                if (!Array.isArray(group.matches)) group.matches = [];

                 group.matches.forEach((match, matchIndex) => {
                    if (!match || typeof match !== 'object') { validationOk = false; return; }

                    if (!match.results) { // Ensure results object exists
                           match.results = { sets: [ [null, null], [null, null], [null, null] ], team1_sets_won: 0, team2_sets_won: 0, team1_match_points: 0, team2_match_points: 0, team1_set_points: 0, team2_set_points: 0, team1_point_diff: 0, team2_point_diff: 0, is_complete: false };
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
                     match.results.team1_set_points = match.results.team1_set_points ?? 0; // <-- Ensure exists
                     match.results.team2_set_points = match.results.team2_set_points ?? 0; // <-- Ensure exists
                     match.results.team1_point_diff = match.results.team1_point_diff ?? 0;
                     match.results.team2_point_diff = match.results.team2_point_diff ?? 0;
                     match.results.is_complete = match.results.is_complete ?? false;
                 });
                 if (!validationOk) return;
            });

             if (!validationOk) {
                 displayError("Found invalid group or match structure within the data.");
                 tournamentData = null; // Prevent further processing
                 return false;
             }
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

    // --- MODIFIED: calculateMatchResult ---
    function calculateMatchResult(setsScores, isShortenedMode) {
        let team1SetsWon = 0;
        let team2SetsWon = 0;
        let team1SetPoints = 0; // Specific for shortened mode
        let team2SetPoints = 0; // Specific for shortened mode
        let team1TotalPoints = 0;
        let team2TotalPoints = 0;
        let setsPlayed = 0;
        let isComplete = false;

        const maxSetsToCheck = isShortenedMode ? 2 : 3;

        for (let i = 0; i < maxSetsToCheck; i++) {
            const score1 = setsScores[i]?.[0];
            const score2 = setsScores[i]?.[1];
            const scoresAreValidNumbers = typeof score1 === 'number' && !isNaN(score1) && typeof score2 === 'number' && !isNaN(score2) && score1 >= 0 && score2 >= 0;

            if (scoresAreValidNumbers) {
                setsPlayed++;
                team1TotalPoints += score1;
                team2TotalPoints += score2;

                if (score1 > score2) {
                    team1SetsWon++;
                    if (isShortenedMode) team1SetPoints++;
                } else if (score2 > score1) {
                    team2SetsWon++;
                    if (isShortenedMode) team2SetPoints++;
                } // No set points awarded for a tie in a set (shouldn't happen in volleyball)

                // Check for match completion (Standard Mode)
                if (!isShortenedMode && (team1SetsWon === 2 || team2SetsWon === 2)) {
                    isComplete = true;
                    break; // Match finished
                }
            } else {
                // If a score is missing in a set that *should* have been played, match is not complete
                if (setsPlayed < i) { // If we skipped a set
                     isComplete = false;
                     break;
                }
                 // For standard mode, if not yet complete, break processing further sets
                 // For shortened mode, we *require* both sets to have scores to be complete
                 if (!isComplete && (!isShortenedMode || i < 2)) {
                    break;
                 }
            }
        }

        // Check for completion in Shortened Mode (requires exactly 2 sets with valid scores)
        if (isShortenedMode) {
             const set1Valid = typeof setsScores[0]?.[0] === 'number' && typeof setsScores[0]?.[1] === 'number';
             const set2Valid = typeof setsScores[1]?.[0] === 'number' && typeof setsScores[1]?.[1] === 'number';
             isComplete = set1Valid && set2Valid;
             // Make sure 3rd set scores are ignored/nulled if mode is active
             if(setsScores[2]) {
                 setsScores[2][0] = null;
                 setsScores[2][1] = null;
             }
        }


        // Calculate Match Points (Standard Mode Only)
        let team1MatchPoints = 0;
        let team2MatchPoints = 0;
        if (!isShortenedMode && isComplete) {
            if (team1SetsWon === 2 && team2SetsWon === 0) { team1MatchPoints = 3; team2MatchPoints = 0; }
            else if (team1SetsWon === 2 && team2SetsWon === 1) { team1MatchPoints = 2; team2MatchPoints = 1; }
            else if (team1SetsWon === 1 && team2SetsWon === 2) { team1MatchPoints = 1; team2MatchPoints = 2; }
            else if (team1SetsWon === 0 && team2SetsWon === 2) { team1MatchPoints = 0; team2MatchPoints = 3; }
        }

        return {
            team1_sets_won: team1SetsWon, // Overall sets won (useful info even in shortened)
            team2_sets_won: team2SetsWon,
            team1_match_points: team1MatchPoints, // Only relevant in standard mode
            team2_match_points: team2MatchPoints, // Only relevant in standard mode
            team1_set_points: team1SetPoints,     // Only relevant in shortened mode
            team2_set_points: team2SetPoints,     // Only relevant in shortened mode
            team1_point_diff: team1TotalPoints - team2TotalPoints,
            team2_point_diff: team2TotalPoints - team1TotalPoints,
            is_complete: isComplete
        };
    }

    // --- MODIFIED: calculateGroupStandings ---
    function calculateGroupStandings(group, isShortenedMode) {
        const standings = {};
        if (!group || !Array.isArray(group.teams)) return [];

        group.teams.forEach(teamName => {
            if (teamName) {
                // Initialize with all possible fields needed for sorting
                standings[teamName] = { teamName: teamName, matchPoints: 0, setPoints: 0, gamesPlayed: 0, pointDifference: 0 };
            }
        });

        if (Array.isArray(group.matches)) {
            group.matches.forEach(match => {
                // Only count completed matches towards standings
                if (match?.results?.is_complete && match.team1 && match.team2) {
                    if (standings[match.team1]) {
                        standings[match.team1].gamesPlayed++;
                        standings[match.team1].pointDifference += match.results.team1_point_diff ?? 0;
                        if (isShortenedMode) {
                            standings[match.team1].setPoints += match.results.team1_set_points ?? 0;
                        } else {
                            standings[match.team1].matchPoints += match.results.team1_match_points ?? 0;
                        }
                    }
                    if (standings[match.team2]) {
                        standings[match.team2].gamesPlayed++;
                        standings[match.team2].pointDifference += match.results.team2_point_diff ?? 0;
                        if (isShortenedMode) {
                            standings[match.team2].setPoints += match.results.team2_set_points ?? 0;
                        } else {
                            standings[match.team2].matchPoints += match.results.team2_match_points ?? 0;
                        }
                    }
                }
            });
        }

        const standingsArray = Object.values(standings);

        // Sort based on the mode
        standingsArray.sort((a, b) => {
            if (isShortenedMode) {
                // Sort by Set Points (desc), then Point Difference (desc)
                if ((b.setPoints ?? 0) !== (a.setPoints ?? 0)) return (b.setPoints ?? 0) - (a.setPoints ?? 0);
            } else {
                // Sort by Match Points (desc), then Point Difference (desc)
                if ((b.matchPoints ?? 0) !== (a.matchPoints ?? 0)) return (b.matchPoints ?? 0) - (a.matchPoints ?? 0);
            }
            // Tie-breaker: Point Difference
            return (b.pointDifference ?? 0) - (a.pointDifference ?? 0);
            // Consider adding further tie-breakers if needed (e.g., head-to-head)
        });

        return standingsArray;
    }

    // --- MODIFIED: renderStandingsTable ---
    function renderStandingsTable(standingsArray, containerElement, isShortenedMode) {
        containerElement.innerHTML = ''; // Clear previous table
        if (!Array.isArray(standingsArray)) return;

        const table = document.createElement('table'); table.className = 'standings-table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        // Adjust header based on mode
        const headers = ["Team", isShortenedMode ? "Set Pts" : "Pts", "Played", "Diff"];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        standingsArray.forEach(teamStanding => {
            if (teamStanding && typeof teamStanding === 'object') {
                const row = tbody.insertRow();
                row.insertCell().textContent = teamStanding.teamName || 'N/A';
                // Display correct points based on mode
                row.insertCell().textContent = isShortenedMode ? (teamStanding.setPoints ?? 0) : (teamStanding.matchPoints ?? 0);
                row.insertCell().textContent = teamStanding.gamesPlayed ?? 0;
                const diff = teamStanding.pointDifference ?? 0;
                row.insertCell().textContent = diff > 0 ? `+${diff}` : diff;
            }
        });
        containerElement.appendChild(table);
    }

    // --- MODIFIED: handleScoreInput ---
    function handleScoreInput(event, groupIndex, matchIndex) {
        // Check if tournamentData and the specific match exist
        if (!tournamentData?.groups?.[groupIndex]?.matches?.[matchIndex]) {
            console.error("Data structure error in handleScoreInput for:", groupIndex, matchIndex);
            return;
        }
        const group = tournamentData.groups[groupIndex];
        const match = group.matches[matchIndex];
        const isShortenedMode = tournamentData.shortenGroupStage; // Get mode

        const targetInput = event.target;
        const setIndex = parseInt(targetInput.dataset.set, 10);
        const teamIdentifier = targetInput.dataset.team; // 'team1' or 'team2'
        const rawValue = targetInput.value;
        const score = rawValue === '' ? null : parseInt(rawValue, 10);

        // Basic validation for input
        if (rawValue !== '' && (isNaN(score) || score < 0)) {
            // Revert to previous value if invalid
            const previousScore = match.results.sets[setIndex]?.[teamIdentifier === 'team1' ? 0 : 1];
            targetInput.value = (typeof previousScore === 'number') ? previousScore : '';
            return; // Stop processing invalid input
        }

         // Prevent inputting scores for set 3 in shortened mode
         if (isShortenedMode && setIndex === 2) {
             targetInput.value = ''; // Clear the input
             return;
         }

        const teamArrayIndex = (teamIdentifier === 'team1' ? 0 : 1);
        // Ensure the set array exists before trying to write
        if (!match.results.sets[setIndex]) match.results.sets[setIndex] = [null, null];
        match.results.sets[setIndex][teamArrayIndex] = score;

        // Recalculate the entire match result based on current scores and mode
        const calculated = calculateMatchResult(match.results.sets, isShortenedMode);
        // Merge the calculated results back into the match object
        match.results = { ...match.results, ...calculated };

        // If shortened mode, ensure 3rd set data is nullified in the results object
        if (isShortenedMode) {
            match.results.sets[2] = [null, null];
        }

        saveTournamentData(); // Save updated results to localStorage

        // Update Standings Table
        const standingsArray = calculateGroupStandings(group, isShortenedMode); // Pass mode
        const tableContainerId = `standings-table-${groupIndex}`;
        const tableContainer = document.getElementById(tableContainerId);
        if (tableContainer) {
            renderStandingsTable(standingsArray, tableContainer, isShortenedMode); // Pass mode
        } else {
            console.error(`Standings container #${tableContainerId} NOT FOUND!`);
        }
    }

    // --- MODIFIED: renderGroupStage ---
    function renderGroupStage() {
        if (!tournamentData || !Array.isArray(tournamentData.groups)) {
            displayError("Cannot display groups: Tournament data is missing or invalid.");
            groupsContainer.innerHTML = '<p>Could not load tournament data. Please return to setup.</p>'; // Clear container
            return;
        }
        groupsContainer.innerHTML = ''; // Clear previous content
        const isShortenedMode = tournamentData.shortenGroupStage; // Get mode

        tournamentData.groups.forEach((group, groupIndex) => {
            if (!group || typeof group !== 'object') return;

            const groupDiv = document.createElement('div'); groupDiv.className = 'group-container';
            const groupTitle = document.createElement('h3'); groupTitle.textContent = group.name || `Group ${String.fromCharCode(65 + groupIndex)}`; groupDiv.appendChild(groupTitle);

            // Standings Table Area
            const standingsContainer = document.createElement('div'); standingsContainer.className = 'standings-table-container'; standingsContainer.id = `standings-table-${groupIndex}`; groupDiv.appendChild(standingsContainer);
            const standingsArray = calculateGroupStandings(group, isShortenedMode); // Pass mode
            renderStandingsTable(standingsArray, standingsContainer, isShortenedMode); // Pass mode

            // Matches Area
            const matchesContainer = document.createElement('div'); matchesContainer.className = 'matches-container'; groupDiv.appendChild(matchesContainer);

            if (!Array.isArray(group.matches) || group.matches.length === 0) {
                matchesContainer.innerHTML = '<p>No matches scheduled for this group.</p>';
            } else {
                const matchesTitle = document.createElement('h4'); matchesTitle.textContent = "Matches"; matchesContainer.appendChild(matchesTitle);
                group.matches.forEach((match, matchIndex) => {
                     if (!match || !match.team1 || !match.team2) return;
                     const matchContainer = document.createElement('div'); matchContainer.className = 'match-container'; matchContainer.id = `match-${groupIndex}-${matchIndex}`;
                     const matchHeader = document.createElement('div'); matchHeader.className = 'match-header'; matchHeader.textContent = `${match.team1} vs ${match.team2}`;
                     // Check assignRefs setting from tournamentData if available
                     if (tournamentData.assignRefs && match.referee) {
                        const refSpan = document.createElement('span'); refSpan.className = 'match-ref'; refSpan.textContent = `(Ref: ${match.referee})`; matchHeader.appendChild(refSpan);
                     }
                     matchContainer.appendChild(matchHeader);

                     // Loop for sets - ONLY show 2 sets if shortenedMode is true
                      const setsToShow = isShortenedMode ? 2 : 3;
                      for (let i = 0; i < setsToShow; i++) {
                         const setRow = document.createElement('div'); setRow.className = 'set-input-row';
                         const setLabel = document.createElement('label'); setLabel.textContent = `Set ${i + 1}:`;

                         // Input 1
                         const input1 = document.createElement('input'); input1.type = 'number'; input1.min = '0'; input1.placeholder='...'; input1.dataset.groupIndex = groupIndex; input1.dataset.matchIndex = matchIndex; input1.dataset.set = i; input1.dataset.team = 'team1';
                         const score1 = match.results?.sets?.[i]?.[0]; input1.value = (typeof score1 === 'number') ? score1 : '';
                         input1.addEventListener('input', (e) => handleScoreInput(e, groupIndex, matchIndex));

                          // Input 2
                         const input2 = document.createElement('input'); input2.type = 'number'; input2.min = '0'; input2.placeholder='...'; input2.dataset.groupIndex = groupIndex; input2.dataset.matchIndex = matchIndex; input2.dataset.set = i; input2.dataset.team = 'team2';
                         const score2 = match.results?.sets?.[i]?.[1]; input2.value = (typeof score2 === 'number') ? score2 : '';
                         input2.addEventListener('input', (e) => handleScoreInput(e, groupIndex, matchIndex));

                         setRow.appendChild(setLabel); setRow.appendChild(input1); setRow.appendChild(document.createTextNode(' - ')); setRow.appendChild(input2);
                         matchContainer.appendChild(setRow);
                     }
                     matchesContainer.appendChild(matchContainer);
                 });
            }
            groupsContainer.appendChild(groupDiv);
        });
    }


    // --- Clear Tournament Function ---
    function handleClearTournament() {
        if (window.confirm("Are you sure you want to clear ALL tournament data?\nThis cannot be undone.")) {
            console.log("Clearing tournament data from group stage page...");
            try {
                 // Only need to remove the main data key here
                 localStorage.removeItem(LS_KEYS.TOURNAMENT_DATA);
                 // Also remove setup settings if they are stored separately (as done in script.js)
                 Object.keys(LS_KEYS).forEach(keyName => {
                    if (keyName !== 'TOURNAMENT_DATA') { // Avoid trying to remove it twice
                        localStorage.removeItem(LS_KEYS[keyName]);
                    }
                 });

                window.location.href = 'index.html'; // Navigate back to setup
            } catch (e) {
                console.error("Error clearing localStorage:", e);
                displayError("Failed to clear tournament data.");
            }
        }
    }

    // --- Initialisation ---
    if (loadTournamentData()) {
        renderGroupStage(); // Render based on loaded data and settings
    }
    // Error message displayed within loadTournamentData if it fails

    // --- Event Listeners ---
    backButton.addEventListener('click', () => { window.location.href = 'index.html'; });
    clearTournamentBtn.addEventListener('click', handleClearTournament);

}); // End of DOMContentLoaded