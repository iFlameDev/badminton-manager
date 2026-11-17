import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { toast } from './useToastStore';

let syncTimeout = null;

const draftCourtEntities = (entities) => {
  let resultIndices = [];
  
  const dfs = (index, currentSum, currentIndices) => {
    if (currentSum === 4) {
      resultIndices = [...currentIndices];
      return true;
    }
    if (currentSum > 4 || index >= entities.length) return false;
    
    currentIndices.push(index);
    if (dfs(index + 1, currentSum + entities[index].players.length, currentIndices)) return true;
    
    currentIndices.pop();
    if (dfs(index + 1, currentSum, currentIndices)) return true;
    
    return false;
  };
  
  if (dfs(0, 0, [])) {
    let selected = [];
    for (let i = resultIndices.length - 1; i >= 0; i--) {
      selected.unshift(entities[resultIndices[i]]);
      entities.splice(resultIndices[i], 1);
    }
    return selected;
  }
  return null;
};

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

const autoReplaceWalkoutsInMatches = (playersArray, matchesMap, currentRound, config, customCourtNames) => {
  let nextMatches = { ...matchesMap };
  let updatedPlayers = playersArray.map(p => ({ ...p }));
  let replacedLogs = [];

  const activeMatchKeys = Object.keys(nextMatches).filter((key) => {
    const m = nextMatches[key];
    return m.round === currentRound && (m.score1 === null || m.score2 === null);
  });

  if (activeMatchKeys.length === 0) {
    return { nextMatches, updatedPlayers, replacedLogs };
  }

  let playerStats = {};
  updatedPlayers.forEach((p) => {
    playerStats[p.id] = { games: 0, totalPts: 0 };
  });
  Object.values(nextMatches).forEach((m) => {
    if (m.score1 !== null && m.score2 !== null) {
      m.t1.forEach((id) => { if (playerStats[id]) playerStats[id].games++; });
      m.t2.forEach((id) => { if (playerStats[id]) playerStats[id].games++; });
    }
  });

  let assignedPlayerIds = new Set();
  activeMatchKeys.forEach((key) => {
    const m = nextMatches[key];
    [...m.t1, ...m.t2].forEach((id) => {
      if (id !== null) {
        const p = updatedPlayers.find((x) => x.id === id);
        if (p && !p.isWalkout) {
          assignedPlayerIds.add(id);
        }
      }
    });
  });

  let availableSubs = updatedPlayers.filter(
    (p) => !p.isWalkout && !assignedPlayerIds.has(p.id)
  );

  const tierVal = { A: 4, B: 3, C: 2, D: 1 };
  const isMarked = config?.type ? config.type.includes('marked') : false;

  const pickBestSubstitute = (oldPlayer) => {
    if (availableSubs.length === 0) return null;

    const oldTierNum = oldPlayer && tierVal[oldPlayer.tier] ? tierVal[oldPlayer.tier] : 3;

    availableSubs.sort((a, b) => {
      const sA = playerStats[a.id] || { games: 0, totalPts: 0 };
      const sB = playerStats[b.id] || { games: 0, totalPts: 0 };

      // 1. Prioritize resting player who has played the fewest games
      if (sA.games !== sB.games) return sA.games - sB.games;

      // 2. If marked tournament, prioritize closest tier match
      if (isMarked && oldPlayer) {
        const diffA = Math.abs((tierVal[a.tier] || 3) - oldTierNum);
        const diffB = Math.abs((tierVal[b.tier] || 3) - oldTierNum);
        if (diffA !== diffB) return diffA - diffB;
      }

      // 3. Total points tie-breaker
      return sB.totalPts - sA.totalPts;
    });

    const chosen = availableSubs.shift();
    assignedPlayerIds.add(chosen.id);
    return chosen;
  };

  activeMatchKeys.forEach((key) => {
    let m = { ...nextMatches[key] };
    let matchChanged = false;
    const cName = (customCourtNames && customCourtNames[m.court]) ? customCourtNames[m.court] : `Lapangan ${m.court}`;

    const processSlot = (id) => {
      if (id === null) {
        const sub = pickBestSubstitute(null);
        if (sub) {
          matchChanged = true;
          replacedLogs.push({ courtName: cName, oldName: 'Slot Kosong', newName: sub.name });
          return sub.id;
        }
        return null;
      }

      const p = updatedPlayers.find((x) => x.id === id);
      if (p && p.isWalkout) {
        matchChanged = true;
        const sub = pickBestSubstitute(p);
        if (sub) {
          replacedLogs.push({ courtName: cName, oldName: p.name, newName: sub.name });
          return sub.id;
        }
        replacedLogs.push({ courtName: cName, oldName: p.name, newName: null });
        return null;
      }

      return id;
    };

    m.t1 = m.t1.map(processSlot);
    m.t2 = m.t2.map(processSlot);

    if (matchChanged) {
      nextMatches[key] = m;
    }
  });

  updatedPlayers = updatedPlayers.map((p) => {
    if (p.isWalkout) {
      return { ...p, status: 'rest', court: null };
    }
    const playingMatch = Object.values(nextMatches).find(
      (m) =>
        m.round === currentRound &&
        (m.score1 === null || m.score2 === null) &&
        (m.t1.includes(p.id) || m.t2.includes(p.id))
    );
    if (playingMatch) {
      return { ...p, status: 'playing', court: playingMatch.court };
    }
    return { ...p, status: 'rest', court: null };
  });

  return { nextMatches, updatedPlayers, replacedLogs };
};

export const useTournamentStore = create((set, get) => ({
  // Navigation & UI State
  currentView: 'setup', // 'setup', 'manager', 'config'
  viewMode: 'pager', // 'pager', 'list'
  activeRoundTab: 1,
  showCourtTags: true,
  showMarkedTags: true,

  // Supabase State
  tournamentId: null,
  isHost: true,
  createdAt: null,
  lastModified: null,

  // Tournament Data
  config: {
    name: '',
    type: 'marked_mexicano',
    date: '',
    time: '',
    duration: 120,
    sort: 'wins',
  },
  numCourts: 1,
  customCourtNames: {},
  players: [], // { id, name, tier, isWalkout, status, court }
  teams: [],
  matches: {}, // rX-cY: { round, court, t1: [], t2: [], score1, score2 }
  currentRound: 0,
  playerIdCounter: 1,
  isTournamentStarted: false,

  // --- ACTIONS: UI ---
  setView: (view) => set({ currentView: view }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveRoundTab: (tab) => set({ activeRoundTab: tab }),
  toggleCourtTags: () => set((state) => ({ showCourtTags: !state.showCourtTags })),
  toggleMarkedTags: () => set((state) => ({ showMarkedTags: !state.showMarkedTags })),

  // --- ACTIONS: CONFIG & PLAYERS ---
  updateConfig: (updates) => {
    set((state) => ({ config: { ...state.config, ...updates } }));
    get().syncToSupabase();
  },
  setNumCourts: (num) => set({ numCourts: num }),
  setCustomCourtNames: (names) => set({ customCourtNames: names }),
  setPlayers: (players) => set({ players }),
  setPlayerIdCounter: (count) => set({ playerIdCounter: count }),

  // --- ACTIONS: ENGINES ---
  syncToSupabase: () => {
    const state = get();
    if (!state.tournamentId || !state.isHost) return;

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      const now = new Date().toISOString();
      set({ lastModified: now });
      const finalState = get();

      const payload = {
        config: finalState.config,
        numCourts: finalState.numCourts,
        customCourtNames: finalState.customCourtNames,
        players: finalState.players,
        teams: finalState.teams,
        matches: finalState.matches,
        currentRound: finalState.currentRound,
        playerIdCounter: finalState.playerIdCounter,
        isTournamentStarted: finalState.isTournamentStarted,
        createdAt: finalState.createdAt,
        lastModified: finalState.lastModified
      };
      
      try {
        await supabase
          .from('tournaments')
          .update({ state: payload })
          .eq('id', finalState.tournamentId);
      } catch (e) {
        console.error('Failed to sync', e);
      }
    }, 500);
  },

  loadFromSupabase: async (id, isHostUser) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('state')
        .eq('id', id)
        .single();
      
      if (data && data.state) {
        set({
          tournamentId: id,
          isHost: isHostUser,
          config: data.state.config,
          numCourts: data.state.numCourts,
          customCourtNames: data.state.customCourtNames,
          players: data.state.players,
          teams: data.state.teams || [],
          matches: data.state.matches,
          currentRound: data.state.currentRound,
          playerIdCounter: data.state.playerIdCounter,
          isTournamentStarted: data.state.isTournamentStarted,
          createdAt: data.state.createdAt || null,
          lastModified: data.state.lastModified || null,
          currentView: 'manager'
        });

        if (isHostUser) {
          const historyItem = {
            id: id,
            name: data.state.config.name || 'Badminton Tournament',
            createdAt: data.state.createdAt,
            playersCount: data.state.players.filter(p => !p.isWalkout).length,
            courtsCount: data.state.numCourts
          };
          let history = JSON.parse(localStorage.getItem('badminton_history') || '[]');
          history = history.filter(h => h.id !== id);
          history.unshift(historyItem);
          localStorage.setItem('badminton_history', JSON.stringify(history));
        }
        
        // Ensure activeRoundTab is valid
        const st = get();
        if (st.currentRound > 0) {
          set({ activeRoundTab: st.currentRound });
        }
      } else {
        console.error("Tournament not found", error);
      }
    } catch (e) {
      console.error('Failed to load from Supabase', e);
    }
  },

  startTournament: async (parsedPlayers, newNumCourts, newConfig, newCourtNames, teams) => {
    const state = get();
    let newPlayerId = state.playerIdCounter;
    let newPlayersArray = [];

    let tempToRealId = {};

    parsedPlayers.forEach((data) => {
      if (data.pid) {
        let p = state.players.find((x) => x.id === data.pid);
        if (p) {
          p.name = data.name;
          p.tier = data.tier;
          p.isWalkout = data.isInactive;
          if (p.isWalkout) {
            p.status = 'rest';
            p.court = null;
          }
          newPlayersArray.push({ ...p });
          tempToRealId[data.tempId] = p.id;
        }
      } else {
        let p = state.players.find((x) => x.name.toLowerCase() === data.name.toLowerCase());
        if (p) {
          p.tier = data.tier;
          p.isWalkout = data.isInactive;
          if (p.isWalkout) {
            p.status = 'rest';
            p.court = null;
          }
          newPlayersArray.push({ ...p });
          tempToRealId[data.tempId] = p.id;
        } else {
          newPlayersArray.push({
            id: newPlayerId,
            name: data.name,
            tier: data.tier,
            status: 'rest',
            court: null,
            isWalkout: data.isInactive,
          });
          tempToRealId[data.tempId] = newPlayerId;
          newPlayerId++;
        }
      }
    });

    if (state.isTournamentStarted) {
      state.players.forEach((oldP) => {
        if (!newPlayersArray.find((nP) => nP.id === oldP.id)) {
          newPlayersArray.push({ ...oldP, isWalkout: true, status: 'rest', court: null });
        }
      });
    }

    let nextMatches = { ...state.matches };
    let finalPlayers = newPlayersArray;

    if (state.isTournamentStarted && state.currentRound > 0) {
      const autoRes = autoReplaceWalkoutsInMatches(
        newPlayersArray,
        nextMatches,
        state.currentRound,
        newConfig,
        newCourtNames
      );
      nextMatches = autoRes.nextMatches;
      finalPlayers = autoRes.updatedPlayers;

      if (autoRes.replacedLogs.length > 0) {
        autoRes.replacedLogs.forEach((log) => {
          if (log.newName) {
            toast.success(`Pemain ${log.oldName} (OFF) otomatis digantikan oleh ${log.newName} di ${log.courtName}!`);
          } else {
            toast.error(`Pemain ${log.oldName} di-set OFF di ${log.courtName}, namun tidak ada pemain istirahat yang tersedia.`);
          }
        });
      }
    }

    let realTeams = (teams || []).map(t => ({
       id: t.id,
       name: t.name,
       playerIds: [ tempToRealId[t.playerIds[0]], tempToRealId[t.playerIds[1]] ]
    })).filter(t => t.playerIds[0] !== undefined && t.playerIds[1] !== undefined);

    set({
      config: { ...state.config, ...newConfig },
      numCourts: newNumCourts,
      customCourtNames: newCourtNames,
      players: finalPlayers,
      teams: realTeams,
      playerIdCounter: newPlayerId,
      matches: nextMatches,
      currentView: 'manager',
    });

    const updatedState = get();

    if (!updatedState.isTournamentStarted) {
      set({ isTournamentStarted: true });
      updatedState.generateNextRound();
    }

    if (state.isTournamentStarted && state.currentRound === 1) {
      const current = get();
      const roundOneMatches = Object.values(current.matches).filter((match) => match.round === 1);
      const hasScoredMatch = roundOneMatches.some(
        (match) => match.score1 !== null && match.score2 !== null
      );
      const missingCourts = Array.from(
        { length: current.numCourts },
        (_, index) => index + 1
      ).filter((courtId) => !roundOneMatches.some((match) => match.court === courtId));

      if (!hasScoredMatch && missingCourts.length > 0) {
        const availablePlayers = current.players.filter(
          (player) => !player.isWalkout && player.status === 'rest'
        );
        const { stats } = current.getLeaderboardStats();
        const draftedCourts = current.draftCourts(
          availablePlayers,
          stats,
          missingCourts.length,
          current.teams
        );

        if (draftedCourts.length > 0) {
          const nextMatches = { ...current.matches };
          const nextPlayers = current.players.map((player) => ({ ...player }));

          draftedCourts.forEach((courtMatch, index) => {
            const courtId = missingCourts[index];
            nextMatches[`r1-c${courtId}`] = {
              round: 1,
              court: courtId,
              t1: courtMatch.t1,
              t2: courtMatch.t2,
              score1: null,
              score2: null,
              timestamp: Date.now()
            };

            [...courtMatch.t1, ...courtMatch.t2].forEach((id) => {
              const player = nextPlayers.find((item) => item.id === id);
              if (player) {
                player.status = 'playing';
                player.court = courtId;
              }
            });
          });

          set({ matches: nextMatches, players: nextPlayers, activeRoundTab: 1 });
          get().syncToSupabase();
          toast.success(`${draftedCourts.length} court kosong berhasil dibuat otomatis.`);
        }
      }
    }

    const finalState = get();
    const now = new Date().toISOString();
    
    set({ createdAt: now, lastModified: now });
    const stateWithDates = get();

    const payload = {
      config: stateWithDates.config,
      numCourts: stateWithDates.numCourts,
      customCourtNames: stateWithDates.customCourtNames,
      players: stateWithDates.players,
      teams: stateWithDates.teams,
      matches: stateWithDates.matches,
      currentRound: stateWithDates.currentRound,
      playerIdCounter: stateWithDates.playerIdCounter,
      isTournamentStarted: stateWithDates.isTournamentStarted,
      createdAt: stateWithDates.createdAt,
      lastModified: stateWithDates.lastModified
    };

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert([{ state: payload }])
        .select('id');

        window.localStorage.setItem('badminton_host_' + data[0].id, 'true');
        window.history.replaceState({}, '', `?id=${data[0].id}`);
        set({ tournamentId: data[0].id, isHost: true });
        
        let hostTourneys = JSON.parse(localStorage.getItem('host_tournaments') || '[]');
        if (!hostTourneys.includes(data[0].id)) {
          hostTourneys.push(data[0].id);
          localStorage.setItem('host_tournaments', JSON.stringify(hostTourneys));
        }

        const historyItem = {
          id: data[0].id,
          name: stateWithDates.config.name || 'Badminton Tournament',
          createdAt: stateWithDates.createdAt,
          playersCount: stateWithDates.players.filter(p => !p.isWalkout).length,
          courtsCount: stateWithDates.numCourts
        };
        let history = JSON.parse(localStorage.getItem('badminton_history') || '[]');
        history = history.filter(h => h.id !== data[0].id);
        history.unshift(historyItem);
        localStorage.setItem('badminton_history', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to create tournament', e);
    }
  },

  draftCourts: (availablePlayers, currentStats, courtsToDraft, teams) => {
    const state = get();
    let sortedForDraft = [...availablePlayers].sort((a, b) => {
      let sA = currentStats[a.id], sB = currentStats[b.id];
      if (sA.games !== sB.games) return sA.games - sB.games;
      if (sB.points !== sA.points) return sB.points - sA.points;
      if (sB.wins !== sA.wins) return sB.wins - sA.wins;
      return sB.diff - sA.diff;
    });

    let entities = [];
    let handledPlayers = new Set();
    
    (teams || []).forEach(t => {
       let p1 = sortedForDraft.find(p => p.id === t.playerIds[0]);
       let p2 = sortedForDraft.find(p => p.id === t.playerIds[1]);
       if (p1 && p2) {
          entities.push({
             isTeam: true,
             teamId: t.id,
             players: [p1, p2],
             rank: sortedForDraft.indexOf(p1) + sortedForDraft.indexOf(p2)
          });
          handledPlayers.add(p1.id);
          handledPlayers.add(p2.id);
       }
    });

    sortedForDraft.forEach(p => {
       if (!handledPlayers.has(p.id)) {
          entities.push({
             isTeam: false,
             players: [p],
             rank: sortedForDraft.indexOf(p)
          });
       }
    });

    entities.sort((a, b) => a.rank - b.rank);

    let draftedCourts = [];
    for (let c = 0; c < courtsToDraft; c++) {
        let selected = draftCourtEntities(entities);
        if (!selected) break;

        let courtPlayers = { t1: [], t2: [] };
        if (selected.length === 2) {
            courtPlayers.t1 = selected[0].players.map(p => p.id);
            courtPlayers.t2 = selected[1].players.map(p => p.id);
        } else if (selected.length === 3) {
            let team = selected.find(e => e.isTeam);
            let solos = selected.filter(e => !e.isTeam);
            courtPlayers.t1 = team.players.map(p => p.id);
            courtPlayers.t2 = [solos[0].players[0].id, solos[1].players[0].id];
        } else if (selected.length === 4) {
            let solos = selected.map(e => e.players[0]);
            if (state.config.type.includes('marked')) {
               const tierVal = { A: 4, B: 3, C: 2, D: 1 };
               solos.sort((a, b) => (tierVal[b.tier] || 0) - (tierVal[a.tier] || 0));
            } else {
               solos.sort((a, b) => currentStats[b.id].points - currentStats[a.id].points);
            }
            courtPlayers.t1 = [solos[0].id, solos[2].id];
            courtPlayers.t2 = [solos[1].id, solos[3].id];
        }
        draftedCourts.push(courtPlayers);
    }
    return draftedCourts;
  },

  generateNextRound: () => {
    const state = get();
    const nextRound = state.currentRound + 1;
    
    let updatedPlayers = state.players.map((p) => {
      if (!p.isWalkout) return { ...p, status: 'rest', court: null };
      return p;
    });

    let availablePlayers = updatedPlayers.filter((p) => !p.isWalkout);
    const { stats } = state.getLeaderboardStats();

    let draftedCourts = get().draftCourts(availablePlayers, stats, state.numCourts, state.teams);
    let nextMatches = { ...state.matches };

    for (let i = 0; i < draftedCourts.length; i++) {
      let courtId = i + 1;
      let cMatch = draftedCourts[i];

      let matchKey = `r${nextRound}-c${courtId}`;
      nextMatches[matchKey] = {
        round: nextRound,
        court: courtId,
        t1: cMatch.t1,
        t2: cMatch.t2,
        score1: null,
        score2: null,
        timestamp: Date.now()
      };

      [...cMatch.t1, ...cMatch.t2].forEach((id) => {
        let pIndex = updatedPlayers.findIndex((p) => p.id === id);
        if (pIndex !== -1) {
          updatedPlayers[pIndex].status = 'playing';
          updatedPlayers[pIndex].court = courtId;
        }
      });
    }

    set({
      currentRound: nextRound,
      players: updatedPlayers,
      matches: nextMatches,
      activeRoundTab: nextRound,
    });
    get().syncToSupabase();
  },

  setScore: (matchKey, score1, score2) => {
    const state = get();
    const match = state.matches[matchKey];
    if (!match) return;

    let newMatch = { ...match };
    if (score1 === null || score2 === null) {
      newMatch.score1 = null;
      newMatch.score2 = null;
    } else {
      newMatch.score1 = Number(score1);
      newMatch.score2 = Number(score2);
    }

    set({ matches: { ...state.matches, [matchKey]: newMatch } });
    get().syncToSupabase();
  },

  generateMatchForCourt: (courtId) => {
    const state = get();
    let updatedPlayers = [...state.players];
    
    updatedPlayers.forEach(p => {
       if (p.court === courtId) {
          p.status = 'rest';
          p.court = null;
       }
    });

    let availablePlayers = updatedPlayers.filter(p => !p.isWalkout && p.status === 'rest');
    if (availablePlayers.length < 4) return;

    const { stats } = state.getLeaderboardStats();
    let draftedCourts = get().draftCourts(availablePlayers, stats, 1, state.teams);

    if (draftedCourts.length === 0) return;

    let cMatch = draftedCourts[0];
    let nextMatches = { ...state.matches };
    let courtMatches = Object.values(state.matches).filter(m => m.court === courtId);
    let nextRound = courtMatches.length + 1;
    let matchId = `r${nextRound}-c${courtId}`; 

    nextMatches[matchId] = {
      round: nextRound,
      court: courtId,
      t1: cMatch.t1,
      t2: cMatch.t2,
      score1: null,
      score2: null,
      timestamp: Date.now()
    };

    [...cMatch.t1, ...cMatch.t2].forEach(id => {
      let pIndex = updatedPlayers.findIndex(p => p.id === id);
      if (pIndex !== -1) {
        updatedPlayers[pIndex].status = 'playing';
        updatedPlayers[pIndex].court = courtId;
      }
    });

    let newCurrentRound = Math.max(state.currentRound, nextRound);

    set({ players: updatedPlayers, matches: nextMatches, currentRound: newCurrentRound });
    get().syncToSupabase();
  },

  triggerNextRound: () => {
    const state = get();
    let latestMatches = {};
    for (let i = 1; i <= state.numCourts; i++) {
       let courtMatches = Object.values(state.matches).filter(m => m.court === i);
       if (courtMatches.length > 0) {
          latestMatches[i] = courtMatches.reduce((max, m) => m.round > max.round ? m : max, courtMatches[0]);
       }
    }

    let readyCourts = [];
    let allReady = true;
    for (let i = 1; i <= state.numCourts; i++) {
       let lm = latestMatches[i];
       if (lm && lm.score1 !== null && lm.score2 !== null) {
          readyCourts.push(i);
       } else {
          allReady = false;
       }
    }

    if (readyCourts.length === 0) return;

    if (allReady) {
       let rounds = Object.values(latestMatches).map(m => m.round);
       let sameRound = rounds.every(r => r === rounds[0]);
       if (sameRound) {
          get().generateNextRound();
       } else {
          readyCourts.forEach(c => get().generateMatchForCourt(c));
       }
    } else {
       readyCourts.forEach(c => get().generateMatchForCourt(c));
    }
  },

  executeSwap: (matchKey, selectedSlot, newEntity) => {
    const state = get();
    let nextMatches = { ...state.matches };
    let m = { ...nextMatches[matchKey] };

    let pIds = newEntity.type === 'team' ? [newEntity.p1, newEntity.p2] : [newEntity.id];

    // Remove these players from any active match
    Object.keys(nextMatches).forEach((k) => {
      let rm = { ...nextMatches[k] };
      if (rm.score1 === null || rm.score2 === null) {
        let changed = false;
        pIds.forEach(pid => {
          if (rm.t1.includes(pid)) {
            rm.t1 = rm.t1.map((id) => (id === pid ? null : id));
            changed = true;
          }
          if (rm.t2.includes(pid)) {
            rm.t2 = rm.t2.map((id) => (id === pid ? null : id));
            changed = true;
          }
        });
        if (changed) nextMatches[k] = rm;
      }
    });

    let targetSide = selectedSlot.team === 1 ? m.t1 : m.t2;
    let existingP1 = targetSide[0];
    let existingP2 = targetSide[1];
    
    let isOccupiedByTeam = false;
    if (existingP1 !== null && existingP2 !== null) {
       isOccupiedByTeam = (state.teams || []).some(t => 
         (t.playerIds[0] === existingP1 && t.playerIds[1] === existingP2) ||
         (t.playerIds[0] === existingP2 && t.playerIds[1] === existingP1)
       );
    }

    if (newEntity.type === 'team') {
       targetSide = [newEntity.p1, newEntity.p2];
    } else {
       if (isOccupiedByTeam) {
          targetSide = targetSide.map((_, idx) => idx === selectedSlot.index ? newEntity.id : null);
       } else {
          targetSide = [...targetSide];
          targetSide[selectedSlot.index] = newEntity.id;
       }
    }

    if (selectedSlot.team === 1) m.t1 = targetSide;
    else m.t2 = targetSide;
    
    nextMatches[matchKey] = m;

    // Recalculate player statuses
    let nextPlayers = state.players.map((p) => {
      if (!p.isWalkout) return { ...p, status: 'rest', court: null };
      return p;
    });

    Object.values(nextMatches).forEach((rm) => {
      if (rm.score1 === null || rm.score2 === null) {
        [...rm.t1, ...rm.t2].forEach((id) => {
          if (id !== null) {
            let pIndex = nextPlayers.findIndex((x) => x.id === id);
            if (pIndex !== -1) {
              nextPlayers[pIndex].status = 'playing';
              nextPlayers[pIndex].court = rm.court;
            }
          }
        });
      }
    });

    set({ matches: nextMatches, players: nextPlayers });
    get().syncToSupabase();
  },

  reshuffleMatch: (matchKey) => {
    const state = get();
    const match = state.matches[matchKey];
    if (!match) return;
    if (match.score1 !== null || match.score2 !== null) {
      toast.error('Bracket tidak bisa diacak ulang setelah skor pertandingan diisi.');
      return;
    }

    const playerIds = [...match.t1, ...match.t2];
    if (
      match.t1.length !== 2 ||
      match.t2.length !== 2 ||
      playerIds.some((id) => id === null) ||
      new Set(playerIds).size !== 4
    ) {
      toast.error('Bracket hanya bisa diacak ulang jika empat slot pemain sudah terisi.');
      return;
    }

    const entities = [];
    const groupedPlayerIds = new Set();
    (state.teams || []).forEach((team) => {
      const [first, second] = team.playerIds;
      if (
        playerIds.includes(first) &&
        playerIds.includes(second) &&
        !groupedPlayerIds.has(first) &&
        !groupedPlayerIds.has(second)
      ) {
        entities.push([first, second]);
        groupedPlayerIds.add(first);
        groupedPlayerIds.add(second);
      }
    });
    playerIds.forEach((id) => {
      if (!groupedPlayerIds.has(id)) entities.push([id]);
    });

    const layouts = [];
    for (let mask = 1; mask < (1 << entities.length) - 1; mask++) {
      if ((mask & 1) === 0) continue;

      const firstSide = [];
      const secondSide = [];
      entities.forEach((entity, index) => {
        (mask & (1 << index) ? firstSide : secondSide).push(...entity);
      });

      if (firstSide.length !== 2 || secondSide.length !== 2) continue;
      layouts.push({ t1: firstSide, t2: secondSide });
      layouts.push({ t1: secondSide, t2: firstSide });
    }

    const alternatives = layouts.filter(
      (layout) =>
        JSON.stringify(layout.t1) !== JSON.stringify(match.t1) ||
        JSON.stringify(layout.t2) !== JSON.stringify(match.t2)
    );
    if (alternatives.length === 0) {
      toast.error('Tidak ada susunan bracket lain yang valid untuk pemain di court ini.');
      return;
    }

    const shuffled = alternatives[Math.floor(Math.random() * alternatives.length)];
    set({
      matches: {
        ...state.matches,
        [matchKey]: { ...match, t1: shuffled.t1, t2: shuffled.t2 }
      }
    });
    get().syncToSupabase();
    toast.success('Bracket court berhasil diacak ulang.');
  },

  togglePlayerWalkout: (playerId) => {
    const state = get();
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;

    const willBeWalkout = !p.isWalkout;
    let nextPlayers = state.players.map((x) =>
      x.id === playerId ? { ...x, isWalkout: willBeWalkout } : x
    );

    let nextMatches = { ...state.matches };

    if (willBeWalkout && state.isTournamentStarted && state.currentRound > 0) {
      const autoRes = autoReplaceWalkoutsInMatches(
        nextPlayers,
        nextMatches,
        state.currentRound,
        state.config,
        state.customCourtNames
      );
      nextMatches = autoRes.nextMatches;
      nextPlayers = autoRes.updatedPlayers;

      if (autoRes.replacedLogs.length > 0) {
        autoRes.replacedLogs.forEach((log) => {
          if (log.newName) {
            toast.success(`Pemain ${log.oldName} (OFF) otomatis digantikan oleh ${log.newName} di ${log.courtName}!`);
          } else {
            toast.error(`Pemain ${log.oldName} di-set OFF di ${log.courtName}, namun tidak ada pemain istirahat yang tersedia.`);
          }
        });
      } else {
        toast.success(`Status ${p.name} diubah menjadi OFF`);
      }
    } else {
      nextPlayers = nextPlayers.map((x) =>
        x.id === playerId ? { ...x, isWalkout: false, status: 'rest', court: null } : x
      );
      toast.success(`Status ${p.name} diubah menjadi AKTIF`);
    }

    set({ players: nextPlayers, matches: nextMatches });
    get().syncToSupabase();
  },

  getLeaderboardStats: () => {
    const state = get();
    let stats = {};
    state.players.forEach((p) => {
      stats[p.id] = { games: 0, wins: 0, losses: 0, ties: 0, points: 0, diff: 0, rests: 0, streak: 0 };
    });

    // To calculate streak, we need matches ordered by round
    const sortedMatches = Object.values(state.matches)
      .filter((m) => m.score1 !== null && m.score2 !== null)
      .sort((a, b) => a.round - b.round);

    sortedMatches.forEach((m) => {
      m.t1.forEach((id) => {
        if (stats[id]) {
          stats[id].games++;
          stats[id].points += m.score1;
          stats[id].diff += m.score1 - m.score2;
          if (m.score1 > m.score2) {
            stats[id].wins++;
            stats[id].streak++;
          } else if (m.score1 < m.score2) {
            stats[id].losses++;
            stats[id].streak = 0;
          } else {
            stats[id].ties++;
            stats[id].streak = 0;
          }
        }
      });
      m.t2.forEach((id) => {
        if (stats[id]) {
          stats[id].games++;
          stats[id].points += m.score2;
          stats[id].diff += m.score2 - m.score1;
          if (m.score2 > m.score1) {
            stats[id].wins++;
            stats[id].streak++;
          } else if (m.score2 < m.score1) {
            stats[id].losses++;
            stats[id].streak = 0;
          } else {
            stats[id].ties++;
            stats[id].streak = 0;
          }
        }
      });
    });

    state.players.forEach((p) => {
      if (!p.isWalkout && state.currentRound > 0) {
        stats[p.id].rests = Math.max(0, state.currentRound - stats[p.id].games);
      } else {
        stats[p.id].rests = 0;
      }
      
      let s = stats[p.id];
      s.totalPts = s.points;
    });

    let leaderboardItems = [];
    let handledPlayers = new Set();
    
    (state.teams || []).forEach(t => {
       let p1 = state.players.find(p => p.id === t.playerIds[0]);
       let p2 = state.players.find(p => p.id === t.playerIds[1]);
       if (p1 && p2) {
          leaderboardItems.push({
             isTeam: true,
             id: t.id,
             name: t.name,
             stats: stats[p1.id],
             players: [p1, p2],
             sortVal: stats[p1.id].totalPts,
             isWalkout: p1.isWalkout || p2.isWalkout
          });
          handledPlayers.add(p1.id);
          handledPlayers.add(p2.id);
       }
    });

    state.players.forEach(p => {
       if (!handledPlayers.has(p.id)) {
          leaderboardItems.push({
             isTeam: false,
             id: p.id,
             name: p.name,
             tier: p.tier,
             isWalkout: p.isWalkout,
             stats: stats[p.id],
             players: [p],
             sortVal: stats[p.id].totalPts
          });
       }
    });

    leaderboardItems.sort((a, b) => {
      if (a.isWalkout && !b.isWalkout) return 1;
      if (!a.isWalkout && b.isWalkout) return -1;

      let sA = a.stats, sB = b.stats;
      if (state.config.sort === 'points') {
        if (sB.totalPts !== sA.totalPts) return sB.totalPts - sA.totalPts;
        if (sB.diff !== sA.diff) return sB.diff - sA.diff;
        return sB.wins - sA.wins;
      } else {
        if (sB.wins !== sA.wins) return sB.wins - sA.wins;
        if (sB.diff !== sA.diff) return sB.diff - sA.diff;
        return sB.totalPts - sA.totalPts;
      }
    });

    let sortedPlayers = [...state.players].sort((a, b) => {
      if (a.isWalkout && !b.isWalkout) return 1;
      if (!a.isWalkout && b.isWalkout) return -1;

      let sA = stats[a.id], sB = stats[b.id];
      if (state.config.sort === 'points') {
        if (sB.totalPts !== sA.totalPts) return sB.totalPts - sA.totalPts;
        if (sB.diff !== sA.diff) return sB.diff - sA.diff;
        return sB.wins - sA.wins;
      } else {
        if (sB.wins !== sA.wins) return sB.wins - sA.wins;
        if (sB.diff !== sA.diff) return sB.diff - sA.diff;
        return sB.totalPts - sA.totalPts;
      }
    });

    return { sortedPlayers, stats, leaderboardItems };
  },

  getBalanceText: () => {
    const state = get();
    let activeCount = state.players.filter((p) => !p.isWalkout).length;
    if (activeCount === 0 || state.numCourts === 0) return '-';
    let slots = state.numCourts * 4;
    let cycle = activeCount / gcd(activeCount, slots);
    if (!Number.isInteger(cycle)) cycle = Math.ceil(cycle);

    let rem = cycle - (state.currentRound % cycle);
    if (rem === cycle && state.currentRound > 0) return '0 - WELL BALANCE';
    return rem.toString();
  },

}));
