import { useState } from 'react';
import { useApiKey } from './hooks/useApiKey';
import { ApiKeySetup } from './components/ApiKeySetup';
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

  if (showSetup) {
    return <ApiKeySetup onComplete={() => setShowSetup(false)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      {/* Minimal Floating Navigation */}
      {!selectedModel && (
        <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-3 py-3 shadow-2xl">
          <button
            onClick={() => setView('models')}
            className={`px-5 py-2.5 text-sm rounded-full transition-all flex items-center gap-2 ${
              view === 'models'
                ? 'bg-white text-black font-semibold shadow-lg'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Models</span>
          </button>
          <button
            onClick={() => setView('gallery')}
            className={`px-5 py-2.5 text-sm rounded-full transition-all flex items-center gap-2 ${
              view === 'gallery'
                ? 'bg-white text-black font-semibold shadow-lg'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Gallery</span>
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <button
            onClick={() => setShowSetup(true)}
            className="px-4 py-2.5 text-sm rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>API Key</span>
          </button>
        </nav>
      )}

      {/* Content Area */}
      <main className="flex-1 overflow-hidden">
        {view === 'models' && !selectedModel && (
          <ModelSelector
            onSelectModel={(model) => {
              setSelectedModel(model);
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
