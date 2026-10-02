import React, { useState } from 'react';
import DispatchTracker from './components/DispatchTracker';
import SettingsScreen from './components/SettingsScreen';
import DispatchHistory from './components/DispatchHistory';

function App() {
  const [currentView, setCurrentView] = useState('dispatch'); // 'dispatch' | 'settings' | 'history'

  return (
    <>
      {currentView === 'dispatch' ? (
        <DispatchTracker 
          onOpenSettings={() => setCurrentView('settings')}
          onOpenHistory={() => setCurrentView('history')}
        />
      ) : currentView === 'settings' ? (
        <SettingsScreen onClose={() => setCurrentView('dispatch')} />
      ) : (
        <DispatchHistory onClose={() => setCurrentView('dispatch')} />
      )}
    </>
  );
}

export default App;
