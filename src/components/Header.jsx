import React from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { Settings, CopyPlus } from 'lucide-react';
import clsx from 'clsx';

export default function Header() {
  const { currentView, setView, config, players } = useTournamentStore();

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
          <h1 className="text-xl md:text-2xl font-bold text-emerald-400 tracking-tight">Padel DNA</h1>
          <p className="text-amber-400 font-mono mt-0.5 text-xs">Padel Manager - React</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isSetup && (
          <button onClick={handleRandomTest} className="text-xs bg-blue-600/90 hover:bg-blue-500 text-white px-3 py-2.5 rounded-lg transition font-bold shadow flex items-center gap-1.5 shrink-0">
            <CopyPlus className="w-4 h-4" />
            Random Test
          </button>
        )}
        
        {(isManager || isConfig) && (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
