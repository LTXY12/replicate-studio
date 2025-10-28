import { useState, useMemo, useEffect } from 'react';
import type { ReplicateModel } from '../types';
import { PRESET_MODELS } from '../config/models';
import { ReplicateClient } from '../lib/replicate';
import { useApiKey } from '../hooks/useApiKey';

interface ModelSelectorProps {
  onSelectModel: (model: ReplicateModel) => void;
}

export function ModelSelector({ onSelectModel }: ModelSelectorProps) {
  const { apiKey } = useApiKey();
  const [category, setCategory] = useState<'all' | 'image' | 'video' | 'edit' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [models, setModels] = useState<ReplicateModel[]>(PRESET_MODELS);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('favorite_models');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  useEffect(() => {
    if (apiKey) {
      // Load cached models first
      const cachedModels = localStorage.getItem('cached_models');
      const cachedTimestamp = localStorage.getItem('cached_models_timestamp');

      if (cachedModels && cachedTimestamp) {
        try {
          const models = JSON.parse(cachedModels);
          setModels(models);
          console.log(`Loaded ${models.length} models from cache`);
        } catch (e) {
          console.error('Failed to load cached models', e);
          loadCollectionModels();
        }
      } else {
        // No cache, load from API
        loadCollectionModels();
      }
    }
  }, [apiKey]);

  const loadCollectionModels = async () => {
    if (!apiKey) return;

    setLoading(true);
    try {
      const client = new ReplicateClient(apiKey);

      const [textToImage, textToVideo, imageEditing] = await Promise.all([
        client.getCollectionModels('text-to-image'),
        client.getCollectionModels('text-to-video'),
        client.getCollectionModels('image-editing')
      ]);

      const allModels: ReplicateModel[] = [];

      // Add essential models that might not be in collections
      const essentialModels: ReplicateModel[] = [
        // Wan 2.2 series
        { owner: 'wan-video', name: 'wan-2.2-i2v-a14b', description: 'Image-to-video at 720p and 480p with Wan 2.2 A14B', category: 'video', runs: '0' },
        { owner: 'wan-video', name: 'wan-2.2-i2v-fast', description: 'Fast PrunaAI optimized Wan 2.2 A14B image-to-video', category: 'video', runs: '0' },
        { owner: 'wan-video', name: 'wan-2.2-t2v-fast', description: 'Fast PrunaAI optimized Wan 2.2 A14B text-to-video', category: 'video', runs: '0' },
        { owner: 'wan-video', name: 'wan-2.2-s2v', description: 'Wan 2.2 Scene-to-Video', category: 'video', runs: '0' },
        { owner: 'wan-video', name: 'wan-2.2-animate-animation', description: 'Wan 2.2 Animate - Animation mode', category: 'video', runs: '0' },
        { owner: 'wan-video', name: 'wan-2.2-animate-replace', description: 'Wan 2.2 Animate - Character replacement mode', category: 'video', runs: '0' },
        { owner: 'prunaai', name: 'wan-2.2-image', description: 'PrunaAI optimized Wan 2.2 image generation', category: 'image', runs: '0' },
        // Wan 2.5 series
        { owner: 'wan-video', name: 'wan-2.5-t2v', description: 'Wan 2.5 Text-to-Video', category: 'video', runs: '0' },
        // Wan 2.1 series
        { owner: 'wavespeedai', name: 'wan-2.1-i2v-720p', description: 'Wan 2.1 14B image-to-video 720p', category: 'video', runs: '0' },
        { owner: 'wavespeedai', name: 'wan-2.1-i2v-480p', description: 'Wan 2.1 14B image-to-video 480p', category: 'video', runs: '0' },
        { owner: 'wavespeedai', name: 'wan-2.1-t2v-720p', description: 'Wan 2.1 14B text-to-video 720p', category: 'video', runs: '0' },
        { owner: 'wavespeedai', name: 'wan-2.1-t2v-480p', description: 'Wan 2.1 14B text-to-video 480p', category: 'video', runs: '0' },
        { owner: 'lucataco', name: 'wan-2.1-1.3b-vid2vid', description: 'Wan 2.1 1.3b Video-to-Video', category: 'video', runs: '0' },
        { owner: 'fofr', name: 'wan2.1-with-lora', description: 'Run Wan2.1 14b or 1.3b with LoRA', category: 'video', runs: '0' },
        // VACE models
        { owner: 'prunaai', name: 'vace-14b', description: 'Faster VACE-14B model optimized with Pruna', category: 'video', runs: '0' },
        { owner: 'prunaai', name: 'vace-1.3b', description: 'VACE-1.3B model optimized with Pruna', category: 'video', runs: '0' },
      ];

      // Add essential models first
      allModels.push(...essentialModels);

      // Process text-to-image models
      textToImage.forEach((model: any) => {
        const exists = allModels.some(m => m.owner === model.owner && m.name === model.name);
        if (!exists) {
          allModels.push({
            owner: model.owner,
            name: model.name,
            description: model.description || '',
            category: 'image',
            runs: formatRunCount(model.run_count)
          });
        }
      });

      // Process text-to-video models
      textToVideo.forEach((model: any) => {
        const exists = allModels.some(m => m.owner === model.owner && m.name === model.name);
        if (!exists) {
          allModels.push({
            owner: model.owner,
            name: model.name,
            description: model.description || '',
            category: 'video',
            runs: formatRunCount(model.run_count)
          });
        }
      });

      // Process image-editing models
      imageEditing.forEach((model: any) => {
        const exists = allModels.some(m => m.owner === model.owner && m.name === model.name);
        if (!exists) {
          allModels.push({
            owner: model.owner,
            name: model.name,
            description: model.description || '',
            category: 'edit',
            runs: formatRunCount(model.run_count)
          });
        }
      });

      // Sort by run count
      allModels.sort((a, b) => {
        const aCount = parseRunCount(a.runs);
        const bCount = parseRunCount(b.runs);
        return bCount - aCount;
      });

      console.log(`Loaded ${allModels.length} models total`);
      setModels(allModels);

      // Cache the models
      localStorage.setItem('cached_models', JSON.stringify(allModels));
      localStorage.setItem('cached_models_timestamp', Date.now().toString());
    } catch (error) {
      console.error('Failed to load collection models:', error);
      // Fallback to preset models
      setModels(PRESET_MODELS);
    } finally {
      setLoading(false);
    }
  };

  const formatRunCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const parseRunCount = (runs: string): number => {
    if (runs.endsWith('M')) {
      return parseFloat(runs) * 1000000;
    } else if (runs.endsWith('K')) {
      return parseFloat(runs) * 1000;
    }
    return parseInt(runs) || 0;
  };

  const toggleFavorite = (modelKey: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(modelKey)) {
      newFavorites.delete(modelKey);
    } else {
      newFavorites.add(modelKey);
    }
    setFavorites(newFavorites);
    localStorage.setItem('favorite_models', JSON.stringify([...newFavorites]));
  };

  const filteredModels = useMemo(() => {
    let filtered = models;
    if (category === 'favorites') {
      filtered = filtered.filter((m) => favorites.has(`${m.owner}/${m.name}`));
    } else if (category !== 'all') {
      filtered = filtered.filter((m) => m.category === category);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.owner.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [models, category, searchQuery, favorites]);

  const handleCustomModel = () => {
    if (!customModel.includes('/')) return;
    const [owner, name] = customModel.split('/');
    onSelectModel({ owner, name, description: 'Custom model', category: 'image', runs: '' });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-black relative">
      {/* Background Blur Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header Section */}
      <div className="flex-shrink-0 relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '2rem', paddingBottom: '1.5rem' }}>
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Explore Models
          </h1>
          <p className="text-neutral-500 mb-6">
            {loading ? 'Loading models...' : `Choose from ${models.length}+ popular models or load your own`}
          </p>

          {/* Search and Filter Bar */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, owner, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all"
              />
            </div>

            <button
              onClick={loadCollectionModels}
              disabled={loading}
              className="h-11 px-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Refresh models from API"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm">Refresh</span>
            </button>

            <div className="flex gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-1">
              {[
                { id: 'all', label: 'All', icon: '⚡' },
                { id: 'favorites', label: 'Favorites', icon: '⭐' },
                { id: 'image', label: 'Image', icon: '🖼️' },
                { id: 'video', label: 'Video', icon: '🎬' },
                { id: 'edit', label: 'Edit', icon: '✨' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  className={`px-4 h-9 text-sm rounded-lg transition-all ${
                    category === cat.id
                      ? 'bg-white text-black font-medium shadow-lg'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="mr-1.5">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Model Section */}
          <div className="mt-4 flex gap-3 items-center p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
            <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <input
              type="text"
              placeholder="Load custom model: owner/model-name"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-neutral-500"
            />
            <button
              onClick={handleCustomModel}
              disabled={!customModel.includes('/')}
              className="px-5 h-9 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Load
            </button>
          </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="flex-1 overflow-auto relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingBottom: '2rem' }}>
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <svg className="animate-spin w-12 h-12 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-neutral-400">Loading models from Replicate...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No models found matching your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredModels.map((model) => {
                const modelKey = `${model.owner}/${model.name}`;
                const isFavorite = favorites.has(modelKey);
                return (
                  <div
                    key={modelKey}
                    className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer relative"
                    onClick={() => onSelectModel(model)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(modelKey);
                      }}
                      className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all z-10"
                    >
                      {isFavorite ? (
                        <span className="text-xl">⭐</span>
                      ) : (
                        <span className="text-xl opacity-30 group-hover:opacity-100 transition-opacity">☆</span>
                      )}
                    </button>

                    <div className="flex items-start justify-between mb-3 pr-8">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate mb-1">
                          {model.name}
                        </h3>
                        <p className="text-xs text-neutral-500">
                          by {model.owner}
                        </p>
                      </div>
                      <span className={`ml-3 px-2.5 py-1 text-xs font-medium rounded-lg flex-shrink-0 ${
                        model.category === 'image'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        model.category === 'video'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {model.category === 'image' ? '🖼️ Image' : model.category === 'video' ? '🎬 Video' : '✨ Edit'}
                      </span>
                    </div>

                    <p className="text-sm text-neutral-400 mb-4 line-clamp-2 min-h-[2.5rem]">
                      {model.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {model.runs}
                      </div>
                      <div className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg group-hover:bg-white group-hover:text-black transition-all">
                        Open →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
