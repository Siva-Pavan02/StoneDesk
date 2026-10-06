import React, { lazy, Suspense, useState } from 'react';
import PilotApp from './components/pilot/PilotApp';
import { useLanguage } from './i18n/LanguageContext';
const DispatchTracker = lazy(() => import('./components/DispatchTracker'));
const SettingsScreen = lazy(() => import('./components/SettingsScreen'));
const DispatchHistory = lazy(() => import('./components/DispatchHistory'));
const LoadingListScreen = lazy(() => import('./components/LoadingListScreen'));

function App() {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState('home');

  return (
    <Suspense fallback={<p role="status" className="p-6 bg-gray-50 text-gray-900">{t('loading')}</p>}>
      {currentView === 'home' ? (
        <PilotApp onOpenLoadingLists={() => setCurrentView('loading-lists')} onOpenLegacySettings={() => setCurrentView('settings')} />
      ) : currentView === 'dispatch' ? (
        <DispatchTracker 
          onOpenSettings={() => setCurrentView('settings')}
          onOpenHistory={() => setCurrentView('history')}
          onOpenLoadingLists={() => setCurrentView('loading-lists')}
        />
      ) : currentView === 'settings' ? (
        <SettingsScreen onClose={() => setCurrentView('home')} />
      ) : currentView === 'loading-lists' ? (
        <LoadingListScreen onClose={() => setCurrentView('home')} />
      ) : (
        <DispatchHistory onClose={() => setCurrentView('dispatch')} />
      )}
    </Suspense>
  );
}

export default App;
