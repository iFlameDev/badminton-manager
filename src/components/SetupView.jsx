import React, { useState, useEffect, useRef } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { FileText, List, X, Plus, HelpCircle, History } from 'lucide-react';
import clsx from 'clsx';

export default function SetupView() {
  const { config, updateConfig, currentView, setView, numCourts, setNumCourts, customCourtNames, setCustomCourtNames, players, isTournamentStarted, matches, startTournament } = useTournamentStore();
  
  const [localConfig, setLocalConfig] = useState(config);
  const [localCourts, setLocalCourts] = useState(numCourts);

  const hasScoredMatches = Object.values(matches).some(m => m.score1 !== null && m.score2 !== null);
  const isDisabled = isTournamentStarted && hasScoredMatches;
  const [localCourtNames, setLocalCourtNames] = useState(customCourtNames);
  
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [playerRows, setPlayerRows] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  };

  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem('padel_history') || '[]');
    setHistoryList(storedHistory);
  }, []);

  useEffect(() => {
    // Sync with global store when mounting setup or config view
    setLocalConfig(config);
    setLocalCourts(numCourts);
    setLocalCourtNames(customCourtNames);

    if (players.length > 0) {
      const rows = players.map(p => ({
        id: p.id,
        name: p.name,
        tier: p.tier,
        isInactive: p.isWalkout,
        pid: p.id
      }));
      // Add empty row at end if configuring
      if (currentView === 'config') {
        rows.push({ id: Date.now(), name: '', tier: 'B', isInactive: false, pid: null });
      }
      setPlayerRows(rows);
      
      const bulkStr = players.map(p => {
        const suffix = p.isWalkout ? ' [OFF]' : '';
        return localConfig.type.includes('marked') ? `${p.name} - ${p.tier}${suffix}` : `${p.name}${suffix}`;
      }).join('\n');
      setBulkText(bulkStr);
    } else {
      setPlayerRows([
        { id: 1, name: '', tier: 'B', isInactive: false, pid: null },
        { id: 2, name: '', tier: 'B', isInactive: false, pid: null },
        { id: 3, name: '', tier: 'B', isInactive: false, pid: null }
      ]);
    }
  }, [config, numCourts, customCourtNames, players, currentView]);

  useEffect(() => {
    const handleRandom = (e) => {
      const { generatedPlayers, randomCourts } = e.detail;
      setLocalCourts(randomCourts);
      let names = {};
      for(let i=1; i<=randomCourts; i++) {
        names[i] = `Court ${i}`;
      }
      setLocalCourtNames(names);
      
      const rows = generatedPlayers.map((p, idx) => ({
        id: Date.now() + idx,
        name: p.name,
        tier: p.tier,
        isInactive: false,
        pid: null
      }));
      setPlayerRows(rows);
      
      const bulkStr = generatedPlayers.map(p => {
        return localConfig.type.includes('marked') ? `${p.name} - ${p.tier}` : p.name;
      }).join('\n');
      setBulkText(bulkStr);

      setLocalConfig(prev => ({
        ...prev,
        name: "Testcase Padel Tournament"
      }));
    };
    window.addEventListener('generate-random-test', handleRandom);
    return () => window.removeEventListener('generate-random-test', handleRandom);
  }, [localConfig.type]);

  const handleConfigChange = (e) => {
    if (isDisabled) return;
    const { name, value, type, checked } = e.target;
    let val = value;
    if (type === 'number') val = parseInt(value, 10);
    if (type === 'checkbox') val = checked;
    
    setLocalConfig(prev => ({ ...prev, [name]: val }));
  };

  const handleCourtNameChange = (i, value) => {
    setLocalCourtNames(prev => ({ ...prev, [i]: value }));
  };

  const addRow = () => {
    setPlayerRows(prev => [...prev, { id: Date.now(), name: '', tier: 'B', isInactive: false, pid: null }]);
  };

  const updateRow = (id, field, value) => {
    setPlayerRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const removeRow = (id) => {
    setPlayerRows(prev => prev.filter(row => row.id !== id));
  };

  const handleSave = () => {
    let parsedData = [];
    if (isBulkMode) {
      const lines = bulkText.split('\n');
      lines.forEach(line => {
        let trimmed = line.trim();
        if (!trimmed) return;
        let isInactive = trimmed.includes('[OFF]') || trimmed.includes('[EXIT]');
        let cleanLine = trimmed.replace('[OFF]', '').replace('[EXIT]', '').trim();
        let match = cleanLine.match(/^(.+?)\s*-\s*([A-Da-d])$/i);
        
        let existingP = null;
        if (match) {
          existingP = players.find(p => p.name.toLowerCase() === match[1].trim().toLowerCase());
          parsedData.push({ name: match[1].trim(), tier: match[2].toUpperCase(), pid: existingP ? existingP.id : null, isInactive });
        } else {
          existingP = players.find(p => p.name.toLowerCase() === cleanLine.toLowerCase());
          parsedData.push({ name: cleanLine, tier: 'B', pid: existingP ? existingP.id : null, isInactive });
        }
      });
    } else {
      parsedData = playerRows.filter(r => r.name.trim() !== '').map(r => ({
        name: r.name.trim(),
        tier: r.tier,
        pid: r.pid,
        isInactive: r.isInactive
      }));
    }

    startTournament(parsedData, localCourts, localConfig, localCourtNames);
  };

  if (currentView !== 'setup' && currentView !== 'config') return null;

  const isMarked = localConfig.type.includes('marked');

  return (
    <div className="w-full fade-in flex-shrink-0 flex flex-col gap-6 md:bg-slate-800 md:p-6 md:rounded-2xl md:shadow-xl md:border md:border-slate-700">
      <div className="space-y-6 flex-grow">
        
        {/* Tournament Info */}
        <div className="bg-slate-900/80 p-4 md:p-5 rounded-xl border border-slate-700/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 border-b border-slate-700/50 pb-2 mb-2 flex justify-between items-center">
            <h2 className="text-lg font-bold text-amber-400">Tournament Info</h2>
            {!isDisabled && currentView === 'setup' && historyList.length > 0 && (
              <button onClick={() => setShowHistory(true)} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-600 transition flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                History
              </button>
            )}
          </div>
          
          <div className="md:col-span-2">
            <div className="w-full">
              <label className="text-[10px] text-slate-400 font-mono uppercase mb-1 block">Nama Turnamen</label>
              <input type="text" name="name" value={localConfig.name} onChange={handleConfigChange} placeholder="Contoh: Padel DNA Weekly" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500 transition placeholder-slate-500" disabled={isDisabled} />
            </div>
          </div>
          
          <div className="flex gap-3 md:col-span-2">
            <div className="w-1/2">
              <label className="text-[10px] text-slate-400 font-mono uppercase mb-1 block">Tipe Game</label>
              <select name="type" value={localConfig.type} onChange={handleConfigChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-emerald-400 text-sm outline-none font-bold focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50" disabled={isDisabled}>
                <option value="marked_mexicano">Marked Mexicano</option>
                <option value="marked_americano">Marked Americano</option>
                <option value="mexicano">Mexicano (Pure)</option>
                <option value="americano">Americano (Pure)</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="text-[10px] text-slate-400 font-mono uppercase mb-1 block">Leaderboard Sort By</label>
              <select name="sort" value={localConfig.sort} onChange={handleConfigChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50" disabled={isDisabled}>
                <option value="points">Points</option>
                <option value="wins">Win</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase mb-1 block">Poin / Round</label>
              <input type="number" name="maxPoints" value={localConfig.maxPoints} onChange={handleConfigChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-emerald-400 text-sm outline-none text-center font-bold focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50" disabled={isDisabled} />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase mb-1 block">Win Bonus</label>
              <input type="number" name="bonus" value={localConfig.bonus} onChange={handleConfigChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none text-center focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50" disabled={isDisabled} />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase mb-1 block">Rest Bonus</label>
              <input type="number" name="restBonus" value={localConfig.restBonus} onChange={handleConfigChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none text-center focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50" disabled={isDisabled} />
            </div>
          </div>
          {isDisabled && (
            <div className="md:col-span-2 text-center text-xs text-amber-500 bg-amber-900/20 p-2 rounded-lg border border-amber-800/50 mt-4">
              Pengaturan turnamen dikunci karena pertandingan sudah berjalan dan memiliki skor.
            </div>
          )}
        </div>

        {/* Court Config */}
        <div className="bg-slate-900/80 p-4 md:p-5 rounded-xl border border-slate-700/80 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <label className="font-bold text-slate-300">Jumlah Lapangan:</label>
            <div className="flex items-center gap-2">
              <button onClick={() => !isDisabled && setLocalCourts(Math.max(1, localCourts - 1))} className="bg-slate-700 hover:bg-slate-600 w-8 h-8 rounded-lg font-bold text-white transition shadow disabled:opacity-50" disabled={isDisabled}>-</button>
              <input type="number" value={localCourts} readOnly className="w-14 bg-slate-800 border border-slate-600 rounded-lg p-1 text-white text-center font-bold outline-none pointer-events-none disabled:opacity-50" disabled={isDisabled} />
              <button onClick={() => !isDisabled && setLocalCourts(localCourts + 1)} className="bg-slate-700 hover:bg-slate-600 w-8 h-8 rounded-lg font-bold text-white transition shadow disabled:opacity-50" disabled={isDisabled}>+</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-slate-700/50 pt-4">
            {Array.from({ length: localCourts }).map((_, i) => {
              const courtNum = i + 1;
              return (
                <div key={courtNum} className="flex flex-col">
                  <label className="text-[10px] text-slate-400 mb-1 font-mono uppercase">Nama L{courtNum}</label>
                  <input type="text" value={localCourtNames[courtNum] || `Court ${courtNum}`} onChange={(e) => handleCourtNameChange(courtNum, e.target.value)} className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500 transition" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Player Input */}
        <div className="bg-slate-700/30 p-4 md:p-5 rounded-xl border border-slate-600 flex flex-col min-w-0 mb-6">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-bold text-slate-400 shrink-0">Data Pemain</label>
            <button onClick={() => setIsBulkMode(!isBulkMode)} className="text-xs bg-slate-600/80 hover:bg-slate-500 text-white px-3 py-2 rounded-lg transition font-bold shadow flex items-center gap-1.5 shrink-0">
              {isBulkMode ? <List className="w-4 h-4"/> : <FileText className="w-4 h-4"/>}
              {isBulkMode ? 'Ganti ke Baris' : 'Ganti Teks'}
            </button>
          </div>
          
          {!isBulkMode ? (
            <div className="space-y-2 flex-grow min-w-0 w-full overflow-hidden">
              <div className="text-[10px] font-normal text-slate-500 mb-2 uppercase tracking-wide">* Tekan 'Enter' di kolom nama untuk baris baru</div>
              <div className="space-y-2 w-full">
                {playerRows.map((row, index) => (
                  <div key={row.id} className="flex items-center gap-2 player-row">
                    <span className="w-4 shrink-0 text-slate-500 font-mono text-right font-bold text-xs">{index + 1}.</span>
                    <input 
                      type="text" 
                      placeholder="Nama" 
                      value={row.name} 
                      onChange={(e) => updateRow(row.id, 'name', e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (index === playerRows.length - 1) addRow();
                        }
                      }}
                      className="min-w-0 flex-grow bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500 transition" 
                    />
                    {isMarked && (
                      <select 
                        value={row.tier} 
                        onChange={(e) => updateRow(row.id, 'tier', e.target.value)}
                        className="w-16 shrink-0 bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      >
                        {['A','B','C','D'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    <div className="shrink-0 flex items-center gap-2">
                      <label className="flex items-center cursor-pointer ml-1" title="Toggle Active Status">
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={!row.isInactive} onChange={(e) => updateRow(row.id, 'isInactive', !e.target.checked)} />
                          <div className={clsx("block w-8 h-4 rounded-full transition-colors", !row.isInactive ? "bg-emerald-500" : "bg-slate-600")}></div>
                          <div className={clsx("absolute left-[2px] top-[2px] bg-white w-3 h-3 rounded-full transition-transform", !row.isInactive ? "translate-x-[16px]" : "")}></div>
                        </div>
                      </label>
                      <button onClick={() => removeRow(row.id)} className="shrink-0 text-slate-500 hover:text-red-400 p-1.5 transition ml-1" title="Hapus Baris">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addRow} className="mt-3 text-xs flex items-center justify-center w-full gap-1 p-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700/50 transition">
                <Plus className="w-4 h-4" /> Tambah Pemain
              </button>
            </div>
          ) : (
            <div className="w-full fade-in">
              <div className="text-xs font-normal text-slate-400 mb-3 bg-slate-800 p-3 rounded-lg border border-slate-700">
                Format: <b className="text-emerald-400">{isMarked ? 'NAMA - MARKING' : 'NAMA'}</b><br/>
                Contoh: <span className="font-mono text-amber-400">{isMarked ? 'Adi s - A' : 'Adi s'}</span>
                <br/><span className="text-slate-500 mt-1 block">* Tambahkan [OFF] di akhir untuk set tidak aktif.</span>
              </div>
              <textarea 
                rows="8" 
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-1 focus:ring-emerald-500 outline-none font-mono text-sm leading-relaxed hide-scrollbar"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom Action Bar (Mobile Sticky equivalent) */}
      <div className="shrink-0 bg-slate-900 md:bg-transparent p-4 border-t border-slate-700 md:border-none flex gap-4 w-full z-20 mt-auto md:mt-0">
        {currentView === 'config' && (
          <button onClick={() => setView('manager')} className="w-1/4 bg-slate-700/80 hover:bg-slate-600 text-slate-200 font-bold py-3 rounded-xl transition border border-slate-600 shadow-lg">Cancel</button>
        )}
        <button onClick={handleSave} className="w-full bg-blue-600/90 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-900/30 text-lg flex items-center justify-center gap-2">
          {currentView === 'config' ? 'Save Changes' : 'Start Tournament'}
        </button>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm fade-in">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-md w-full p-5 relative flex flex-col max-h-[85vh]">
            <button onClick={() => setShowHistory(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition bg-slate-700/50 hover:bg-slate-600 rounded-full p-1.5 z-10">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-4 border-b border-slate-700/50 pb-3 flex items-center gap-2 pr-8 tracking-tight">
              <History className="w-5 h-5 text-emerald-400" />
              Tournament History
            </h3>
            <div className="overflow-y-auto space-y-3 pr-1 pb-2 flex-grow hide-scrollbar">
              {historyList.map((h, i) => (
                <div key={i} className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5 group hover:border-slate-500 transition shadow">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold text-slate-200 text-sm leading-tight">{h.name}</div>
                    <div className="text-[9px] text-slate-400 bg-slate-800 px-2 py-1 rounded-md border border-slate-700 shrink-0 uppercase tracking-wider">{formatDate(h.createdAt)}</div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-slate-400 flex gap-4 font-medium bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                      <span className="flex gap-1 items-center"><b className="text-amber-400">{h.playersCount}</b> Players</span>
                      <span className="flex gap-1 items-center"><b className="text-emerald-400">{h.courtsCount}</b> Courts</span>
                    </div>
                    <a href={`?id=${h.id}`} className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition font-bold shadow-lg shadow-blue-900/50 flex items-center gap-1.5">
                      Buka
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
