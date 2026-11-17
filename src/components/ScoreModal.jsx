import React, { useState, useEffect } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScoreModal({ isOpen, matchKey, onClose }) {
  const { matches, players, teams, customCourtNames, setScore, isHost } = useTournamentStore();

  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');

  const m = matchKey ? matches[matchKey] : null;

  useEffect(() => {
    if (isOpen && m) {
      setVal1(m.score1 !== null ? String(m.score1) : '');
      setVal2(m.score2 !== null ? String(m.score2) : '');
    }
  }, [isOpen, matchKey, m?.score1, m?.score2]);

  if (!isOpen || !matchKey || !isHost || !m) return null;

  const p1 = players.find(x => x.id === m.t1[0]) || { name: 'Pemain 1' };
  const p2 = players.find(x => x.id === m.t1[1]) || { name: 'Pemain 2' };
  const p3 = players.find(x => x.id === m.t2[0]) || { name: 'Pemain 3' };
  const p4 = players.find(x => x.id === m.t2[1]) || { name: 'Pemain 4' };

  const team1Obj = (m.t1[0] && m.t1[1]) ? (teams || []).find(t => 
    (t.playerIds[0] === m.t1[0] && t.playerIds[1] === m.t1[1]) ||
    (t.playerIds[0] === m.t1[1] && t.playerIds[1] === m.t1[0])
  ) : null;

  const team2Obj = (m.t2[0] && m.t2[1]) ? (teams || []).find(t => 
    (t.playerIds[0] === m.t2[0] && t.playerIds[1] === m.t2[1]) ||
    (t.playerIds[0] === m.t2[1] && t.playerIds[1] === m.t2[0])
  ) : null;

  const cName = customCourtNames[m.court] || `Lapangan ${m.court}`;

  const adjust = (team, delta) => {
    if (team === 1) {
      setVal1(prev => String(Math.max(0, (parseInt(prev || '0', 10) + delta))));
    } else {
      setVal2(prev => String(Math.max(0, (parseInt(prev || '0', 10) + delta))));
    }
  };

  const setPreset = (team, score) => {
    if (team === 1) setVal1(String(score));
    else setVal2(String(score));
  };

  const handleSave = () => {
    if (val1.trim() === '' || val2.trim() === '') return;
    const s1 = parseInt(val1, 10);
    const s2 = parseInt(val2, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
    setScore(matchKey, s1, s2);
    onClose();
  };

  const handleReset = () => {
    setScore(matchKey, null, null);
    onClose();
  };

  const isDraw = val1 !== '' && val2 !== '' && parseInt(val1, 10) === parseInt(val2, 10);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-800 border border-slate-600 rounded-2xl md:rounded-3xl shadow-2xl max-w-md md:max-w-2xl lg:max-w-3xl w-full p-4 sm:p-5 md:p-6 relative flex flex-col my-auto max-h-[92vh] overflow-y-auto overflow-x-hidden"
        >
          <button onClick={onClose} className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-white transition bg-slate-700/50 rounded-full p-1.5">
            <X className="w-5 h-5" />
          </button>
          
          <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4 border-b border-slate-700/50 pb-2.5 md:pb-3 flex items-center gap-2 tracking-tight pr-8">
            Input Skor <span className="px-2 py-0.5 rounded shadow-sm border border-slate-600 bg-slate-900/50 text-[12px] align-middle font-mono text-slate-300">{cName}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2.5 md:gap-4 w-full">
            {/* Team 1 Section */}
            <div className="bg-slate-900/70 p-3 sm:p-4 rounded-xl md:rounded-2xl border border-slate-700/80 flex flex-col gap-1.5 sm:gap-2 min-w-0 w-full">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Tim 1</span>
                {team1Obj && (
                  <span className="text-[10px] bg-indigo-500/80 text-white font-bold px-2 py-0.5 rounded uppercase truncate">{team1Obj.name}</span>
                )}
              </div>
              <div className="text-sm font-semibold text-emerald-400 truncate w-full" title={`${p1.name} & ${p2.name}`}>
                {p1.name} &amp; {p2.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5 w-full min-w-0">
                <button 
                  type="button"
                  onClick={() => adjust(1, -1)} 
                  className="w-9 sm:w-10 h-10 sm:h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base sm:text-lg rounded-xl border border-slate-600 transition shrink-0"
                >
                  -1
                </button>
                <input 
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  placeholder="0"
                  className="w-full min-w-0 flex-1 bg-slate-800 border border-slate-600 rounded-xl h-10 sm:h-12 text-center text-white text-xl sm:text-2xl font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button 
                  type="button"
                  onClick={() => adjust(1, 1)} 
                  className="w-9 sm:w-10 h-10 sm:h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base sm:text-lg rounded-xl border border-slate-600 transition shrink-0"
                >
                  +1
                </button>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-mono shrink-0">Quick:</span>
                {[15, 21, 30].map(n => (
                  <button 
                    key={`t1-${n}`}
                    type="button"
                    onClick={() => setPreset(1, n)}
                    className="text-xs bg-slate-800 hover:bg-emerald-600/40 text-slate-300 hover:text-white px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-700 transition font-mono font-bold shrink-0"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex items-center justify-center shrink-0 my-[-2px] md:my-0">
              <span className="text-xs font-bold text-slate-500 bg-slate-900 px-3 py-0.5 sm:py-1 rounded-full border border-slate-700 font-mono">VS</span>
            </div>

            {/* Team 2 Section */}
            <div className="bg-slate-900/70 p-3 sm:p-4 rounded-xl md:rounded-2xl border border-slate-700/80 flex flex-col gap-1.5 sm:gap-2 min-w-0 w-full">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Tim 2</span>
                {team2Obj && (
                  <span className="text-[10px] bg-indigo-500/80 text-white font-bold px-2 py-0.5 rounded uppercase truncate">{team2Obj.name}</span>
                )}
              </div>
              <div className="text-sm font-semibold text-emerald-400 truncate w-full" title={`${p3.name} & ${p4.name}`}>
                {p3.name} &amp; {p4.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5 w-full min-w-0">
                <button 
                  type="button"
                  onClick={() => adjust(2, -1)} 
                  className="w-9 sm:w-10 h-10 sm:h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base sm:text-lg rounded-xl border border-slate-600 transition shrink-0"
                >
                  -1
                </button>
                <input 
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  placeholder="0"
                  className="w-full min-w-0 flex-1 bg-slate-800 border border-slate-600 rounded-xl h-10 sm:h-12 text-center text-white text-xl sm:text-2xl font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button 
                  type="button"
                  onClick={() => adjust(2, 1)} 
                  className="w-9 sm:w-10 h-10 sm:h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-base sm:text-lg rounded-xl border border-slate-600 transition shrink-0"
                >
                  +1
                </button>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-mono shrink-0">Quick:</span>
                {[15, 21, 30].map(n => (
                  <button 
                    key={`t2-${n}`}
                    type="button"
                    onClick={() => setPreset(2, n)}
                    className="text-xs bg-slate-800 hover:bg-emerald-600/40 text-slate-300 hover:text-white px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-700 transition font-mono font-bold shrink-0"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isDraw && (
            <p className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/60 rounded-lg p-2 text-center mt-2.5">
              Catatan: Skor imbang / seri (di badminton umumnya ada penentuan deuce / pemenang).
            </p>
          )}

          <div className="mt-4 md:mt-6 flex flex-col gap-2">
            <button 
              type="button"
              onClick={handleSave} 
              disabled={val1.trim() === '' || val2.trim() === ''}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3 md:py-3.5 rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              <Check className="w-5 h-5" />
              Simpan Skor
            </button>

            <button 
              type="button"
              onClick={handleReset} 
              className="text-xs bg-red-900/30 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-700/40 py-2 md:py-2.5 rounded-xl transition font-bold tracking-wider uppercase text-center"
            >
              Reset Skor
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
