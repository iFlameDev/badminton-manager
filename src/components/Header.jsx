import React, { useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { Settings, CopyPlus, Share2, Users, ShieldAlert, Check } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabaseClient';

export default function Header() {
  const { currentView, setView, config, players, tournamentId, isHost } = useTournamentStore();
  const [shareOpen, setShareOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  
  const isTestingRoute = window.location.href.includes('testing');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSharePlayer = () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${tournamentId}`;
    navigator.clipboard.writeText(url);
    showToast('Link Player disalin!');
    setShareOpen(false);
  };

  const handleShareHost = async () => {
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to Supabase
    try {
      await supabase.from('tournaments').update({ otp }).eq('id', tournamentId);
      const url = `${window.location.origin}${window.location.pathname}?id=${tournamentId}&otp=${otp}`;
      navigator.clipboard.writeText(url);
      showToast('Link Host disalin!');
    } catch (e) {
      showToast("Gagal membuat link Host!");
    }
    setShareOpen(false);
  };

  const handleRandomTest = () => {
    // Generate Random Test Data directly via store or dispatch
    const namesPool = ["Theo", "Budi", "Andi", "Clara", "Kevin", "Rara", "Maya", "Surya", "Hermine", "Dika", "Reza", "Gilang", "Nisa", "Tono", "Putri", "Raditya", "Sisca", "Fajar", "Ayu", "Joko"];
    const tiersPool = ["A", "B", "C", "D"];
    let randomPlayerCount = Math.floor(Math.random() * (20 - 5 + 1)) + 5;
    let randomCourts = randomPlayerCount >= 15 ? 3 : randomPlayerCount >= 10 ? 2 : 1;
    
    let shuffledNames = namesPool.sort(() => 0.5 - Math.random());
    let selectedNames = shuffledNames.slice(0, randomPlayerCount);
    
    let isMarked = config.type.includes('marked');
    let generatedPlayers = selectedNames.map(name => {
      let randTier = tiersPool[Math.floor(Math.random() * tiersPool.length)];
      return {
        name,
        tier: randTier,
        isInactive: false,
        pid: null
      };
    });

    // To apply this, we would need to pass it down to SetupView or handle it inside a store action.
    // For now, we dispatch a custom event that SetupView can listen to, or we expose a generate action in store.
    window.dispatchEvent(new CustomEvent('generate-random-test', { detail: { generatedPlayers, randomCourts } }));
  };

  const isSetup = currentView === 'setup';
  const isManager = currentView === 'manager';
  const isConfig = currentView === 'config';
  const isMarked = config.type.includes('marked');

  return (
    <header className="shrink-0 mx-auto w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] max-w-7xl bg-slate-800 shadow-lg p-4 rounded-2xl flex flex-row justify-between items-center gap-4 mt-4 z-30">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-emerald-400 tracking-tight">Padel Manager</h1>
          <p className="text-amber-400 font-mono mt-0.5 text-xs">Powered by iFlameDev</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isSetup && isTestingRoute && (
          <button onClick={handleRandomTest} className="text-xs bg-blue-600/90 hover:bg-blue-500 text-white px-3 py-2.5 rounded-lg transition font-bold shadow flex items-center gap-1.5 shrink-0">
            <CopyPlus className="w-4 h-4" />
            Random Test
          </button>
        )}
        
        {(isManager || isConfig) && (
          <>
            {tournamentId && isHost && (
              <div className="relative">
                <button 
                  onClick={() => setShareOpen(!shareOpen)} 
                  className={clsx(
                    "p-2.5 rounded-lg transition shadow shrink-0 flex items-center gap-2",
                    shareOpen ? "bg-blue-600 text-white" : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
                  )}
                  title="Share"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                
                {shareOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-2 z-50">
                    <button onClick={handleSharePlayer} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-slate-200 flex items-center gap-3 transition">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-sm">Share to Player</span>
                        <span className="text-[10px] text-slate-400">Akses Read-Only</span>
                      </div>
                    </button>
                    <div className="h-px bg-slate-700 my-1"></div>
                    <button onClick={handleShareHost} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-slate-200 flex items-center gap-3 transition">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-sm">Share to Host</span>
                        <span className="text-[10px] text-slate-400">Beri akses Edit (1x pakai)</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {isHost && (
              <button 
                onClick={() => isConfig ? setView('manager') : setView('config')} 
                className={clsx(
                  "p-2.5 rounded-lg transition shadow shrink-0",
                  isConfig ? "bg-emerald-600/90 hover:bg-emerald-500 text-white" : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
                )}
                title="Config"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-4 bg-slate-800 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-top-5">
          <Check className="w-5 h-5 bg-emerald-500/20 p-1 rounded-full" />
          <span className="font-bold text-sm">{toastMsg}</span>
        </div>
      )}
    </header>
  );
}
