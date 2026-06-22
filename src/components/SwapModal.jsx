import React, { useState, useEffect } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

function getTierStyle(tier) {
  switch (tier) {
    case 'A': return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
    case 'B': return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
    case 'C': return 'bg-amber-900/40 text-amber-300 border-amber-700/50';
    case 'D': return 'bg-rose-900/40 text-rose-300 border-rose-700/50';
    default: return 'bg-slate-800 text-slate-300 border-slate-600';
  }
}

export default function SwapModal({ isOpen, matchKey, onClose }) {
  const { matches, players, customCourtNames, executeSwap, config, isHost } = useTournamentStore();
  const showMarking = config.type.includes('marked');
  const [selectedSlot, setSelectedSlot] = useState(null); // { team: 1|2, index: 0|1 }
  const [lastSwappedSlot, setLastSwappedSlot] = useState(null); // String representation to animate

  useEffect(() => {
    if (!isOpen) {
      setSelectedSlot(null);
      setLastSwappedSlot(null);
    }
  }, [isOpen]);

  if (!isOpen || !matchKey) return null;

  const m = matches[matchKey];
  if (!m) return null;

  const p = [
    players.find(x => x.id === m.t1[0]),
    players.find(x => x.id === m.t1[1]),
    players.find(x => x.id === m.t2[0]),
    players.find(x => x.id === m.t2[1])
  ];

  const cName = customCourtNames[m.court] || `Court ${m.court}`;

  // Get available replacement players
  const currentPlayersInMatch = [...m.t1, ...m.t2].filter(id => id !== null);
  
  let currentStats = {};
  players.forEach(p => { currentStats[p.id] = { games: 0 }; });
  Object.values(matches).forEach(mx => {
    if (mx.score1 !== null && mx.score2 !== null) {
      mx.t1.forEach(id => { if (currentStats[id]) currentStats[id].games++; });
      mx.t2.forEach(id => { if (currentStats[id]) currentStats[id].games++; });
    }
  });

  const availablePlayers = players.filter(pl => !pl.isWalkout && !currentPlayersInMatch.includes(pl.id)).map(pl => {
    const g = currentStats[pl.id] ? currentStats[pl.id].games : 0;
    let assignedCourt = pl.status === 'playing' && pl.court !== m.court ? pl.court : 0;
    return { ...pl, games: g, assignedCourt };
  });

  const tierVal = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
  availablePlayers.sort((a, b) => {
    if (a.assignedCourt !== b.assignedCourt) return a.assignedCourt - b.assignedCourt;
    if (a.games !== b.games) return a.games - b.games;
    return (tierVal[a.tier] || 5) - (tierVal[b.tier] || 5);
  });

  const handleSwap = (newPlayerId) => {
    if (!selectedSlot) {
      alert("Pilih dulu slot pemain di lapangan atas yang mau diganti!");
      return;
    }
    executeSwap(matchKey, selectedSlot, newPlayerId);
    
    const slotStr = `${selectedSlot.team}-${selectedSlot.index}`;
    setLastSwappedSlot(slotStr);
    setSelectedSlot(null);
    setTimeout(() => {
      setLastSwappedSlot(null);
    }, 500);
  };

  const SlotButton = ({ playerObj, team, index }) => {
    const isSelected = selectedSlot?.team === team && selectedSlot?.index === index;
    const isAnimating = lastSwappedSlot === `${team}-${index}`;
    
    let pStats = 0;
    if (playerObj) {
      pStats = Object.values(matches).reduce((acc, mx) => acc + (mx.score1 !== null && (mx.t1.includes(playerObj.id) || mx.t2.includes(playerObj.id)) ? 1 : 0), 0);
    }

    return (
      <motion.button
        animate={isAnimating ? { 
          scale: [1, 1.1, 1], 
          backgroundColor: ["#1e293b", "#059669", "#1e293b"], // slate-800 to emerald-600 to slate-800
          boxShadow: ["0px 0px 0px rgba(16,185,129,0)", "0px 0px 20px rgba(16,185,129,0.8)", "0px 0px 0px rgba(16,185,129,0)"],
          y: [0, -5, 0]
        } : {}}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        onClick={() => setSelectedSlot({ team, index })}
        className={clsx(
          "w-full py-3 px-3 rounded-xl text-center text-[13px] font-bold transition border",
          isSelected ? "bg-emerald-600/90 border-emerald-400 text-white ring-2 ring-emerald-300" : "bg-slate-800 border-slate-600/80 text-slate-300 hover:bg-slate-700 hover:border-slate-500"
        )}
      >
        {playerObj ? (
          <div className="flex items-center justify-center gap-1.5">
            {showMarking && playerObj.tier !== '-' && (
              <span className={clsx("text-[9px] px-1 py-0.5 rounded border font-mono", getTierStyle(playerObj.tier))}>{playerObj.tier}</span>
            )}
            <span className="truncate max-w-[100px]">{playerObj.name}</span>
            <span className="text-[10px] text-slate-400 font-normal ml-1">({pStats})</span>
          </div>
        ) : (
          <div className="opacity-50 font-bold text-sm my-auto text-slate-500">Kosong</div>
        )}
      </motion.button>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-800 border border-slate-600/80 rounded-3xl shadow-2xl max-w-2xl w-full p-5 md:p-6 relative flex flex-col max-h-[90vh]"
        >
          <h3 className="text-xl font-bold text-white mb-4 border-b border-slate-700/50 pb-3 flex items-center gap-2">
            Edit Court <span className="px-2 py-0.5 rounded shadow-sm border border-slate-600 bg-slate-900/50 text-[12px] align-middle font-mono text-slate-300">{cName}</span>
          </h3>
          
          <div className="bg-slate-900/60 rounded-2xl border border-slate-700/50 p-3 mb-4 flex relative items-center gap-8 md:gap-10 shadow-inner">
            <div className="w-1/2 flex flex-col gap-3">
              <SlotButton playerObj={p[0]} team={1} index={0} />
              <SlotButton playerObj={p[1]} team={1} index={1} />
            </div>
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500 font-bold italic text-sm md:text-lg bg-slate-900 z-10 px-2 py-1 rounded-full border border-slate-800">VS</div>
            
            <div className="w-1/2 flex flex-col gap-3">
              <SlotButton playerObj={p[2]} team={2} index={0} />
              <SlotButton playerObj={p[3]} team={2} index={1} />
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-2 px-1">Pilih pemain pengganti:</p>
          <div className="overflow-y-auto flex-grow bg-slate-900/40 p-2.5 rounded-2xl border border-slate-700/50 mb-4 hide-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {availablePlayers.map(pl => {
                const isAssignedOtherCourt = pl.assignedCourt > 0;
                const cAssignedName = customCourtNames[pl.assignedCourt] || `L${pl.assignedCourt}`;
                
                return (
                  <button 
                    key={pl.id}
                    onClick={() => handleSwap(pl.id)} 
                    className={clsx(
                      "relative p-3 rounded-xl border border-slate-600/80 bg-slate-800/80 hover:bg-slate-700 flex flex-col items-center justify-center transition shadow-sm",
                      isAssignedOtherCourt ? "opacity-50 hover:opacity-100" : "opacity-100"
                    )}
                  >
                    {isAssignedOtherCourt && (
                      <div className="absolute -top-2 -right-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full shadow border border-slate-700 bg-slate-900 text-slate-300 font-bold">
                          {cAssignedName}
                        </span>
                      </div>
                    )}
                    <span className="font-bold text-white text-sm truncate w-full text-center mb-1.5">{pl.name}</span>
                    <div className="flex items-center gap-1.5 mt-auto">
                      {showMarking && pl.tier !== '-' && (
                        <span className={clsx("text-[9px] px-1.5 py-0.5 rounded font-mono border", getTierStyle(pl.tier))}>{pl.tier}</span>
                      )}
                      <span className="text-[10px] text-slate-300 font-bold font-mono bg-slate-900/80 px-2 py-0.5 rounded-md shadow-inner border border-slate-700/50">{pl.games}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex mt-auto shrink-0">
            <button onClick={onClose} className="w-full bg-slate-700/80 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition shadow border border-slate-600 tracking-wide">
              Selesai / Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
