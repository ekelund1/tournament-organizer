document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const numTeamsInput = document.getElementById('numTeams');
    const teamNamesInput = document.getElementById('teamNames');
    const numGroupsInput = document.getElementById('numGroups');
    const assignRefsCheckbox = document.getElementById('assignRefs');
    const shortenGroupStageCheckbox = document.getElementById('shortenGroupStage'); // <-- New Checkbox
    const generateButton = document.getElementById('generateButton');
    const tournamentOutput = document.getElementById('tournamentOutput');
    const errorMessagesDiv = document.getElementById('errorMessages');
    const goToGroupStageBtn = document.getElementById('goToGroupStageBtn');
    const clearTournamentBtn = document.getElementById('clearTournamentBtn');

    // --- Constants for LocalStorage Keys ---
    const LS_KEYS = {
        NUM_TEAMS: 'tournament_numTeams',
        TEAM_NAMES: 'tournament_teamNames',
        NUM_GROUPS: 'tournament_numGroups',
        ASSIGN_REFS: 'tournament_assignRefs',
        SHORTEN_GROUP_STAGE: 'tournament_shortenGroupStage', // <-- New Key
        TOURNAMENT_DATA: 'tournament_data' // Main data structure
    };

    // --- Functions ---

    function displayError(message) {
        errorMessagesDiv.textContent = message;
        goToGroupStageBtn.disabled = true; // Also disable navigation on error
    }

    function clearErrors() {
        errorMessagesDiv.textContent = '';
    }

    function snakeSeeding(teams, numGroups) {
        // ... (no changes needed in this function)
        if (!Array.isArray(teams) || typeof numGroups !== 'number' || numGroups <= 0 || teams.length === 0 || numGroups > teams.length) {
            return [];
        }
        const groups = Array.from({ length: numGroups }, () => []);
        let direction = 1;
        let groupIndex = 0;
        teams.forEach((team) => {
            if (groupIndex >= 0 && groupIndex < numGroups && groups[groupIndex]) {
                groups[groupIndex].push(team);
            } else {
                 console.error(`Snake seeding error: Invalid groupIndex ${groupIndex}`);
                 groups[0].push(team); groupIndex = 0; direction = 1; // Fallback
            }
            groupIndex += direction;
            if (groupIndex >= numGroups || groupIndex < 0) {
                direction *= -1;
                groupIndex += direction;
                 if (groupIndex >= numGroups || groupIndex < 0) groupIndex = 0; // Safety check
            }
        });
        return groups;
    }

    function generateGroupMatchPairs(groupTeams) {
        // ... (no changes needed in this function)
        if (!Array.isArray(groupTeams)) return [];
        const matchPairs = [];
        const teams = [...groupTeams];
        const numTeams = teams.length;
        if (numTeams < 2) return [];
        let useBye = false;
        if (numTeams % 2 !== 0) { teams.push("BYE"); useBye = true; }
        const scheduleNumTeams = teams.length;
        const teamIndices = Array.from({ length: scheduleNumTeams }, (_, i) => i);
        for (let round = 0; round < scheduleNumTeams - 1; round++) {
            for (let i = 0; i < scheduleNumTeams / 2; i++) {
                const t1Idx = teamIndices[i], t2Idx = teamIndices[scheduleNumTeams - 1 - i];
                const t1Name = teams[t1Idx], t2Name = teams[t2Idx];
                if (t1Name !== "BYE" && t2Name !== "BYE") matchPairs.push([t1Name, t2Name]);
            }
            if (scheduleNumTeams > 2) { const last = teamIndices.pop(); teamIndices.splice(1, 0, last); }
        }
        return matchPairs;
    }

    function assignReferee(matchPair, allGroupTeams, refereeCounts) {
        // ... (no changes needed in this function)
        if (!Array.isArray(matchPair) || !Array.isArray(allGroupTeams) || typeof refereeCounts !== 'object') return null;
        const availableTeams = allGroupTeams.filter(team => !matchPair.includes(team));
        if (availableTeams.length === 0) return null;
        let minRefCount = Infinity;
        availableTeams.forEach(team => { minRefCount = Math.min(minRefCount, refereeCounts[team] || 0); });
        const candidates = availableTeams.filter(team => (refereeCounts[team] || 0) === minRefCount);
        let chosenRef = null;
        for (const team of allGroupTeams) { if (candidates.includes(team)) { chosenRef = team; break; } }
        if (chosenRef) { refereeCounts[chosenRef] = (refereeCounts[chosenRef] || 0) + 1; }
        return chosenRef;
    }

    function displayTournament(tournamentData, shouldDisplayRefs) {
        // ... (no major changes needed, but ensure group name is displayed correctly)
        tournamentOutput.innerHTML = '';
        goToGroupStageBtn.disabled = true; // Disable by default

        if (!tournamentData || !tournamentData.groups || !Array.isArray(tournamentData.groups)) {
            if (!errorMessagesDiv.textContent) displayError("Failed to display: Invalid data structure.");
            return;
        }
        if (tournamentData.groups.length === 0 && tournamentData.numTeams > 0) {
            return; // Nothing to display, keep button disabled
        }

        tournamentOutput.innerHTML = '<h2>Generated Groups</h2>';
        let groupsDisplayed = 0; // Keep track if any groups are actually shown

        tournamentData.groups.forEach((group) => {
             // Check group validity slightly differently as group might just contain settings
             if (!group || typeof group !== 'object' || !Array.isArray(group.teams) || !Array.isArray(group.matches)) {
                 console.warn("Skipping invalid group structure during display:", group);
                 return;
             }
            groupsDisplayed++; // Increment count for valid group structure

            const groupDiv = document.createElement('div'); groupDiv.className = 'group';
            const groupTitle = document.createElement('h3');
            // Check if group.name exists, otherwise fallback
            groupTitle.textContent = group.name || 'Unnamed Group';
            groupDiv.appendChild(groupTitle);

            const teamsTitle = document.createElement('h4'); teamsTitle.textContent = 'Teams'; groupDiv.appendChild(teamsTitle);
            const teamList = document.createElement('ul');
            group.teams.forEach(teamName => { const listItem = document.createElement('li'); listItem.textContent = teamName; teamList.appendChild(listItem); });
            groupDiv.appendChild(teamList);

            if (group.matches.length > 0) {
                const matchesTitle = document.createElement('h4'); matchesTitle.textContent = 'Matches'; groupDiv.appendChild(matchesTitle);
                const matchList = document.createElement('ul');
                group.matches.forEach(match => {
                    if (!match || typeof match !== 'object' || !match.team1 || !match.team2) return; // Skip invalid match
                    const listItem = document.createElement('li'); listItem.className = 'match-pair';
                    let matchText = `${match.team1} vs ${match.team2}`;
                    // Check assignRefs setting specifically from tournamentData if available
                    const assignRefsEnabled = tournamentData.assignRefs ?? shouldDisplayRefs;
                    if (assignRefsEnabled && match.referee) {
                         matchText = matchText.padEnd(30); // Keep padding consistent
                         matchText += `<span class="referee">(Ref: ${match.referee})</span>`;
                    }
                    listItem.innerHTML = matchText;
                    matchList.appendChild(listItem);
                });
                groupDiv.appendChild(matchList);
            }
            tournamentOutput.appendChild(groupDiv);
        });

        // Enable button only if at least one group was successfully displayed
        if (groupsDisplayed > 0) {
             goToGroupStageBtn.disabled = false;
        }
    }


    function saveState(settings, tournamentData) {
        try {
            localStorage.setItem(LS_KEYS.NUM_TEAMS, settings.numTeams);
            localStorage.setItem(LS_KEYS.TEAM_NAMES, settings.teamNames);
            localStorage.setItem(LS_KEYS.NUM_GROUPS, settings.numGroups);
            localStorage.setItem(LS_KEYS.ASSIGN_REFS, settings.assignRefs);
            localStorage.setItem(LS_KEYS.SHORTEN_GROUP_STAGE, settings.shortenGroupStage); // <-- Save new setting

            if (tournamentData && typeof tournamentData === 'object' && Array.isArray(tournamentData.groups)) {
                 // Ensure no lingering playoff data from previous versions if structure changed
                 delete tournamentData.playoffSettings;
                 delete tournamentData.playoffs;
                 localStorage.setItem(LS_KEYS.TOURNAMENT_DATA, JSON.stringify(tournamentData));
            } else {
                localStorage.removeItem(LS_KEYS.TOURNAMENT_DATA);
            }
        } catch (e) {
            console.error("Error saving state:", e);
            displayError("Could not save state. Storage might be full.");
        }
    }

    function loadState() {
        goToGroupStageBtn.disabled = true;
        try {
            const savedNumTeams = localStorage.getItem(LS_KEYS.NUM_TEAMS);
            const savedTeamNames = localStorage.getItem(LS_KEYS.TEAM_NAMES);
            const savedNumGroups = localStorage.getItem(LS_KEYS.NUM_GROUPS);
            const savedAssignRefs = localStorage.getItem(LS_KEYS.ASSIGN_REFS) === 'true';
            const savedShorten = localStorage.getItem(LS_KEYS.SHORTEN_GROUP_STAGE) === 'true'; // <-- Load new setting
            const savedTournamentDataJSON = localStorage.getItem(LS_KEYS.TOURNAMENT_DATA);

            if (savedNumTeams) numTeamsInput.value = savedNumTeams;
            if (savedTeamNames) teamNamesInput.value = savedTeamNames;
            if (savedNumGroups) numGroupsInput.value = savedNumGroups;
            assignRefsCheckbox.checked = savedAssignRefs;
            shortenGroupStageCheckbox.checked = savedShorten; // <-- Set checkbox state

            if (savedTournamentDataJSON) {
                const savedTournamentData = JSON.parse(savedTournamentDataJSON);
                 // Pass the specific assignRefs setting from the saved data if available
                 const displayRefs = savedTournamentData?.assignRefs ?? savedAssignRefs;
                 if (savedTournamentData && Array.isArray(savedTournamentData.groups)) {
                     displayTournament(savedTournamentData, displayRefs);
                 } else {
                      localStorage.removeItem(LS_KEYS.TOURNAMENT_DATA); // Clear invalid data
                      tournamentOutput.innerHTML = '';
                 }
            } else {
                tournamentOutput.innerHTML = '';
            }
        } catch (e) {
             console.error("Error loading state:", e);
             displayError("Could not load previous state.");
            localStorage.removeItem(LS_KEYS.TOURNAMENT_DATA);
            tournamentOutput.innerHTML = '';
        }
    }

    function handleGenerateClick() {
        clearErrors();
        goToGroupStageBtn.disabled = true;

        const numTeams = parseInt(numTeamsInput.value, 10);
        const teamNamesRaw = teamNamesInput.value.trim();
        const numGroups = parseInt(numGroupsInput.value, 10);
        const assignRefs = assignRefsCheckbox.checked;
        const shortenGroupStage = shortenGroupStageCheckbox.checked; // <-- Get new setting state

        const currentSettings = {
             numTeams: numTeamsInput.value,
             teamNames: teamNamesInput.value,
             numGroups: numGroupsInput.value,
             assignRefs: assignRefs,
             shortenGroupStage: shortenGroupStage // <-- Include in settings for saving
        };

        // Validation
        if (isNaN(numTeams) || numTeams < 2) { displayError("Please enter at least 2 teams."); return; }
        if (isNaN(numGroups) || numGroups < 1) { displayError("Please enter at least 1 group."); return; }
        if (numGroups > numTeams) { displayError("Cannot have more groups than teams."); return; }
        const teams = teamNamesRaw.split('\n').map(name => name.trim()).filter(name => name !== '');
        if (teams.length === 0 && numTeams > 0) { displayError("Please enter team names."); return; }
        if (teams.length !== numTeams) { displayError(`Expected ${numTeams} teams, received ${teams.length}.`); return; }

        // Generate Groups & Matches
        const seededGroups = snakeSeeding(teams, numGroups);
        if (!Array.isArray(seededGroups)) { displayError("Internal error: Failed to generate groups."); return; }

        // Prepare Main Data Structure
        const tournamentData = {
            numTeams: numTeams,
            teamNames: teams,
            numGroups: numGroups,
            assignRefs: assignRefs, // Store setting in main data
            shortenGroupStage: shortenGroupStage, // <-- Store new setting in main data
            groups: [],
        };

        if (seededGroups.length > 0) {
            seededGroups.forEach((groupTeams, index) => {
                if (!Array.isArray(groupTeams)) return;
                const groupLetter = String.fromCharCode(65 + index);
                const matchPairs = generateGroupMatchPairs(groupTeams);
                const refereeCounts = {};
                if (assignRefs && groupTeams.length > 0) { groupTeams.forEach(team => { refereeCounts[team] = 0; }); }

                const detailedMatches = matchPairs.map(pair => {
                    let referee = null;
                    if (assignRefs) { referee = assignReferee(pair, groupTeams, refereeCounts); }
                    // Initialize results structure for compatibility with group_stage.js
                    // Add the new set_points fields, initialized to 0
                    return {
                        team1: pair[0], team2: pair[1], referee: referee,
                        results: {
                            sets: [ [null, null], [null, null], [null, null] ], // Keep 3 sets structure for data storage
                            team1_sets_won: 0,
                            team2_sets_won: 0,
                            team1_match_points: 0, // Used in normal mode
                            team2_match_points: 0, // Used in normal mode
                            team1_set_points: 0,   // <-- New: Used in shortened mode
                            team2_set_points: 0,   // <-- New: Used in shortened mode
                            team1_point_diff: 0,
                            team2_point_diff: 0,
                            is_complete: false
                        }
                    };
                });
                tournamentData.groups.push({ name: `Group ${groupLetter}`, teams: groupTeams, matches: detailedMatches });
            });
        } else if (numTeams > 0 && !errorMessagesDiv.textContent) {
             displayError("Could not generate groups based on inputs.");
        }

        displayTournament(tournamentData, assignRefs); // Display generated structure
        saveState(currentSettings, tournamentData); // Save the state (includes new setting)
    }

    // --- Clear Tournament Function ---
    function handleClearTournament() {
        if (window.confirm("Are you sure you want to clear ALL tournament data?\nThis cannot be undone.")) {
            console.log("Clearing tournament data...");
            try {
                 // This loop automatically includes the new LS_KEYS.SHORTEN_GROUP_STAGE
                 Object.values(LS_KEYS).forEach(key => {
                     console.log(`Removing localStorage key: ${key}`);
                     localStorage.removeItem(key);
                 });
                window.location.reload();
            } catch (e) {
                console.error("Error clearing localStorage:", e);
                displayError("Failed to clear tournament data.");
            }
        }
    }

    // --- Event Listeners ---
    generateButton.addEventListener('click', handleGenerateClick);
    goToGroupStageBtn.addEventListener('click', () => {
        const dataExists = localStorage.getItem(LS_KEYS.TOURNAMENT_DATA);
        if (dataExists) { window.location.href = 'group_stage.html'; }
        else { displayError("Cannot navigate: Tournament data not generated or saved."); }
    });
    clearTournamentBtn.addEventListener('click', handleClearTournament);

    // --- Initial Load ---
    loadState();
});