import { useState } from 'react';
import { useApiKey } from './hooks/useApiKey';
import { Settings } from './components/Settings';
import { ModelSelector } from './components/ModelSelector';
import { PredictionRunner } from './components/PredictionRunner';
import { Gallery } from './components/Gallery';
import type { ReplicateModel } from './types';

type View = 'models' | 'runner' | 'gallery';

function App() {
  const { apiKey } = useApiKey();
  const [showSetup, setShowSetup] = useState(!apiKey);
  const [view, setView] = useState<View>('models');
  const [selectedModel, setSelectedModel] = useState<ReplicateModel | null>(null);

  const handleWorksClick = () => {
    if (selectedModel) {
      setView('runner');
    } else {
      // Load last used model
      const lastModel = localStorage.getItem('last_used_model');
      if (lastModel) {
        try {
          const model = JSON.parse(lastModel);
          setSelectedModel(model);
          setView('runner');
        } catch (e) {
          console.error('Failed to load last used model', e);
        }
      }
    }
  };

  if (showSetup) {
    return <Settings onComplete={() => setShowSetup(false)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      {/* Top Navigation Bar - Always Visible */}
      <nav className="flex-shrink-0 h-14 bg-gradient-to-r from-neutral-900 via-neutral-950 to-black border-b border-white/10 flex items-center justify-center px-6 relative" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={handleWorksClick}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 ${
              view === 'runner'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>WORKS</span>
          </button>
          <button
            onClick={() => {
              setSelectedModel(null);
              setView('models');
            }}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 ${
              view === 'models'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>MODELS</span>
          </button>
          <button
            onClick={() => {
              setSelectedModel(null);
              setView('gallery');
            }}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 ${
              view === 'gallery'
                ? 'bg-white/20 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Gallery</span>
          </button>

          <div className="w-px h-6 bg-white/20 mx-2" />

          <button
            onClick={() => setShowSetup(true)}
            className="px-4 py-1.5 text-sm rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden">
        {view === 'models' && (
          <ModelSelector
            onSelectModel={(model) => {
              setSelectedModel(model);
              localStorage.setItem('last_used_model', JSON.stringify(model));
              setView('runner');
            }}
          />
        )}

        {view === 'runner' && selectedModel && (
          <PredictionRunner
            model={selectedModel}
            onBack={() => {
              setSelectedModel(null);
              setView('models');
            }}
          />
        )}

        {view === 'gallery' && <Gallery />}
      </main>
    </div>
  );
}

export default App;
