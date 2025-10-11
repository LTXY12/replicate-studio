import { useState, useEffect } from 'react';
import type { SavedResult } from '../types';
import { getResults, deleteResult } from '../lib/storage';

export function Gallery() {
  const [results, setResults] = useState<SavedResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedResult, setSelectedResult] = useState<SavedResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const itemsPerPage = 50;

  const loadResults = async () => {
    try {
      const data = await getResults(filter === 'all' ? undefined : { type: filter });
      setResults(data);
      setCurrentPage(1); // Reset to first page when filter changes
    } catch (error) {
      console.error('Failed to load results:', error);
      setResults([]);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadResults();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Load results on mount and when filter changes
  useEffect(() => {
    loadResults();
  }, [filter]);

  // Auto-refresh when window gains focus (in case files were added externally)
  useEffect(() => {
    const handleFocus = () => {
      loadResults();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Calculate pagination
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = results.slice(startIndex, endIndex);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this result?')) {
      await deleteResult(id);
      loadResults();
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Navigation functions for modal
  const navigatePrevious = () => {
    if (!selectedResult) return;
    const currentIndex = currentResults.findIndex(r => r.id === selectedResult.id);
    if (currentIndex > 0) {
      setSelectedResult(currentResults[currentIndex - 1]);
    }
  };

  const navigateNext = () => {
    if (!selectedResult) return;
    const currentIndex = currentResults.findIndex(r => r.id === selectedResult.id);
    if (currentIndex < currentResults.length - 1) {
      setSelectedResult(currentResults[currentIndex + 1]);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedResult) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      } else if (e.key === 'Escape') {
        setSelectedResult(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResult, currentResults]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-black relative">
      {/* Background Blur Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '6rem', paddingBottom: '1.5rem' }}>
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Gallery
          </h1>
          <p className="text-neutral-500 mb-6">
            Browse and manage your generated content
          </p>

          {/* Filter Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-1">
              {[
                { id: 'all' as const, label: 'All', icon: '🎨' },
                { id: 'image' as const, label: 'Images', icon: '🖼️' },
                { id: 'video' as const, label: 'Videos', icon: '🎬' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  className={`px-4 h-9 text-sm rounded-lg transition-all ${
                    filter === cat.id
                      ? 'bg-white text-black font-medium shadow-lg'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="mr-1.5">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 h-9 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {results.length} {results.length === 1 ? 'result' : 'results'}
              {totalPages > 1 && (
                <span className="text-neutral-600">
                  · Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-auto relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingBottom: '2rem' }}>
        <div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <svg className="w-20 h-20 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No results yet. Start creating!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {currentResults.map((result) => (
                <div key={result.id} className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all">
                  <div
                    className="aspect-square cursor-pointer"
                    onClick={() => setSelectedResult(result)}
                  >
                    {result.type === 'video' ? (
                      <video
                        src={Array.isArray(result.output) ? result.output[0] : result.output}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={Array.isArray(result.output) ? result.output[0] : result.output}
                        alt=""
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    )}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 pointer-events-none">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(
                          Array.isArray(result.output) ? result.output[0] : result.output,
                          `${result.model.replace('/', '-')}.${result.type === 'video' ? 'mp4' : 'png'}`
                        );
                      }}
                      className="w-full px-3 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 pointer-events-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(result.id);
                      }}
                      className="w-full px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 pointer-events-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>

                  <div className="p-3 border-t border-white/10">
                    <div className="text-xs font-medium truncate text-white" title={result.id}>{result.id}</div>
                    <div className="text-xs text-neutral-500 truncate mt-1" title={result.model}>{result.model}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          currentPage === pageNum
                            ? 'bg-white text-black shadow-lg'
                            : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-white/10'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {selectedResult && (
        <div
          className="fixed bg-black/95 backdrop-blur-xl flex"
          style={{ top: '56px', left: 0, right: 0, bottom: 0, zIndex: 40 }}
          onClick={() => setSelectedResult(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setSelectedResult(null)}
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full transition-all z-10"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous Button */}
          {currentResults.findIndex(r => r.id === selectedResult.id) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigatePrevious();
              }}
              className="absolute w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full transition-all z-10"
              style={{ left: 'calc(384px + 1.5rem)', top: '50%', transform: 'translateY(-50%)' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Button */}
          {currentResults.findIndex(r => r.id === selectedResult.id) < currentResults.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateNext();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full transition-all z-10"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Left Panel - Info */}
          <div
            className="w-96 flex-shrink-0 bg-white/5 backdrop-blur-xl border-r border-white/20 p-8 flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Details</h2>

            <div className="space-y-6 flex-1">
              <div>
                <div className="text-neutral-400 mb-2 text-xs uppercase tracking-wide">Filename</div>
                <div className="text-white font-medium break-all">{selectedResult.id}</div>
              </div>

              <div>
                <div className="text-neutral-400 mb-2 text-xs uppercase tracking-wide">Model</div>
                <div className="text-white font-medium">{selectedResult.model}</div>
              </div>

              <div>
                <div className="text-neutral-400 mb-2 text-xs uppercase tracking-wide">Type</div>
                <div className="text-white font-medium capitalize">{selectedResult.type}</div>
              </div>

              <div>
                <div className="text-neutral-400 mb-2 text-xs uppercase tracking-wide">Created</div>
                <div className="text-white font-medium">{new Date(selectedResult.createdAt).toLocaleString()}</div>
              </div>

              {selectedResult.input.prompt && (
                <div>
                  <div className="text-neutral-400 mb-2 text-xs uppercase tracking-wide">Prompt</div>
                  <div className="text-white text-sm leading-relaxed">{selectedResult.input.prompt}</div>
                </div>
              )}

              {Object.entries(selectedResult.input).map(([key, value]) => {
                if (key === 'prompt' || typeof value === 'object') return null;
                return (
                  <div key={key}>
                    <div className="text-neutral-400 mb-2 text-xs uppercase tracking-wide">{key}</div>
                    <div className="text-white text-sm">{String(value)}</div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-white/20">
              <button
                onClick={() =>
                  handleDownload(
                    Array.isArray(selectedResult.output) ? selectedResult.output[0] : selectedResult.output,
                    `${selectedResult.model.replace('/', '-')}.${selectedResult.type === 'video' ? 'mp4' : 'png'}`
                  )
                }
                className="w-full px-4 py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button
                onClick={() => {
                  handleDelete(selectedResult.id);
                  setSelectedResult(null);
                }}
                className="w-full px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>

          {/* Right Panel - Image Display */}
          <div
            className="flex-1 flex items-center justify-center p-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ minHeight: 0 }}
          >
            {selectedResult.type === 'video' ? (
              <video
                src={Array.isArray(selectedResult.output) ? selectedResult.output[0] : selectedResult.output}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                className="rounded-2xl shadow-2xl"
                controls
                autoPlay
              />
            ) : (
              <img
                src={Array.isArray(selectedResult.output) ? selectedResult.output[0] : selectedResult.output}
                alt=""
                onClick={() => setFullscreenImage(Array.isArray(selectedResult.output) ? selectedResult.output[0] : selectedResult.output)}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                className="rounded-2xl shadow-2xl cursor-zoom-in hover:opacity-90 transition-opacity"
              />
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal (Original Size) */}
      {fullscreenImage && (
        <div
          className="fixed bg-black/95 backdrop-blur-xl flex items-center justify-center p-8"
          style={{ top: '56px', left: 0, right: 0, bottom: 0, zIndex: 50 }}
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full transition-all z-10"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="overflow-auto max-w-full max-h-full">
            <img
              src={fullscreenImage}
              alt="Fullscreen"
              onClick={(e) => e.stopPropagation()}
              className="cursor-default rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
