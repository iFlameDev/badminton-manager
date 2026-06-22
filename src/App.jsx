import React from 'react';
import Header from './components/Header';
import SetupView from './components/SetupView';
import ManagerView from './components/ManagerView';
import { useTournamentStore } from './store/useTournamentStore';

function App() {
  const { currentView } = useTournamentStore();

  return (
    <div className="bg-slate-900 text-slate-200 h-[100dvh] flex flex-col overflow-hidden font-sans antialiased selection:bg-emerald-500/30">
      <Header />
      
      <main className="flex flex-1 overflow-hidden p-4 md:p-6 mx-auto w-full max-w-7xl gap-6 z-10">
        <div className="flex-1 flex flex-col h-full overflow-y-auto hide-scrollbar scroll-smooth">
          {currentView === 'setup' || currentView === 'config' ? <SetupView /> : <ManagerView />}
        </div>
      </main>
    </div>
  );
}

export default App;
