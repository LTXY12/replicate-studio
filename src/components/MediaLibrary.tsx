import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMediaGroups, saveMediaGroups, type MediaGroup, type MediaItem } from '../lib/storage';

export function MediaLibrary() {
  const [groups, setGroups] = useState<MediaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [uploadQueue, setUploadQueue] = useState<{ groupId: string, files: any[] } | null>(null);

  // Load from IndexedDB/localStorage on mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const loadedGroups = await getMediaGroups();
        setGroups(loadedGroups);
      } catch (error) {
        console.error('Error loading media groups:', error);
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, []);

  // Save to localStorage when groups change
  useEffect(() => {
    if (loading) return; // Skip saving during initial load

    const save = async () => {
      try {
        await saveMediaGroups(groups);
      } catch (error: any) {
        alert(`저장 실패: ${error?.message || String(error)}\n\n그룹 개수: ${groups.length}\n총 아이템 수: ${groups.reduce((sum, g) => sum + g.items.length, 0)}`);
      }
    };
    save();
  }, [groups, loading]);

  // Process upload queue - one file at a time to avoid storage issues
  useEffect(() => {
    if (!uploadQueue || uploadingFile) return;

    const processQueue = async () => {
      setUploadingFile(true);
      const { groupId, files } = uploadQueue;

      if (files.length === 0) {
        setUploadQueue(null);
        setUploadingFile(false);
        return;
      }

      const electron = (window as any).electron;

      try {
        // Process files one by one, updating state after each
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgress({
            current: i + 1,
            total: files.length,
            fileName: file.name
          });

          const fileResult = await electron.fs.readInputFile(file.path);

          if (fileResult.success) {
            const newItem: MediaItem = {
              id: crypto.randomUUID(),
              name: file.name,
              dataUrl: fileResult.data,
              type: fileResult.data.startsWith('data:video') ? 'video' : 'image'
            };

            // Update state immediately for each file (save will be handled by useEffect with debounce)
            setGroups(prevGroups =>
              prevGroups.map(g =>
                g.id === groupId
                  ? { ...g, items: [...g.items, newItem] }
                  : g
              )
            );

            // Small delay between files to allow React to process state updates
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } catch (error) {
        console.error('Error processing files:', error);
        alert('Error uploading files. Please try again.');
      }

      // Clear state
      setUploadingFile(false);
      setUploadProgress({ current: 0, total: 0, fileName: '' });
      setUploadQueue(null);
    };

    processQueue();
  }, [uploadQueue, uploadingFile]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const navigatePreview = (direction: number) => {
    if (!selectedGroup) return;

    const newIndex = previewIndex + direction;
    if (newIndex >= 0 && newIndex < selectedGroup.items.length) {
      setPreviewIndex(newIndex);
      setPreviewMedia(selectedGroup.items[newIndex].dataUrl);
    }
  };

  // Keyboard navigation for preview
  useEffect(() => {
    if (!previewMedia || !selectedGroup) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePreview(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigatePreview(1);
      } else if (e.key === 'Escape') {
        setPreviewMedia(null);
        setPreviewIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMedia, previewIndex, selectedGroup]);

  const addGroup = () => {
    if (!newGroupName.trim()) return;

    const newGroup: MediaGroup = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      items: []
    };

    setGroups([...groups, newGroup]);
    setNewGroupName('');
    setSelectedGroupId(newGroup.id);
  };

  const deleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
  };

  const updateGroupName = (groupId: string, name: string) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, name } : g));
  };

  const deleteItem = (groupId: string, itemId: string) => {
    setGroups(groups.map(g =>
      g.id === groupId
        ? { ...g, items: g.items.filter(i => i.id !== itemId) }
        : g
    ));
  };

  const updateItem = (groupId: string, itemId: string, updates: Partial<MediaItem>) => {
    setGroups(groups.map(g =>
      g.id === groupId
        ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, ...updates } : i) }
        : g
    ));
  };

  const handleGroupDragStart = (index: number) => {
    setDraggedGroupIndex(index);
  };

  const handleGroupDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedGroupIndex === null || draggedGroupIndex === index) return;

    const newGroups = [...groups];
    const draggedGroup = newGroups[draggedGroupIndex];
    newGroups.splice(draggedGroupIndex, 1);
    newGroups.splice(index, 0, draggedGroup);

    setGroups(newGroups);
    setDraggedGroupIndex(index);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupIndex(null);
  };

  const handleItemDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || !selectedGroupId) return;

    const groupIndex = groups.findIndex(g => g.id === selectedGroupId);
    if (groupIndex === -1) return;

    const items = [...groups[groupIndex].items];
    if (draggedItemIndex === index) return;

    const draggedItem = items[draggedItemIndex];
    items.splice(draggedItemIndex, 1);
    items.splice(index, 0, draggedItem);

    const newGroups = [...groups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], items };
    setGroups(newGroups);
    setDraggedItemIndex(index);
  };

  const handleItemDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleFileUpload = async (groupId: string) => {
    if (!groupId || uploadQueue) return;

    const electron = (window as any).electron;
    if (electron?.fs?.selectInputFile) {
      try {
        const result = await electron.fs.selectInputFile();

        if (result.success && result.files && result.files.length > 0) {
          // Start the queue
          setUploadQueue({ groupId, files: result.files });
        }
      } catch (error) {
        console.error('Error selecting files:', error);
      }
    } else {
      // Web fallback - support multiple files
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        if (files.length === 0) {
          setUploadingFile(false);
          return;
        }

        const newItems: MediaItem[] = [];

        for (const file of files) {
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const newItem: MediaItem = {
                id: crypto.randomUUID(),
                name: file.name,
                dataUrl: event.target?.result as string,
                type: file.type.startsWith('video') ? 'video' : 'image'
              };
              newItems.push(newItem);
              resolve();
            };
            reader.readAsDataURL(file);
          });
        }

        setGroups(groups.map(g =>
          g.id === groupId
            ? { ...g, items: [...g.items, ...newItems] }
            : g
        ));
        setUploadingFile(false);
      };
      input.click();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-black relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
          Media Library
        </h2>
        <p className="text-neutral-500">
          Manage images and videos for reuse across models
        </p>
      </div>

      {/* Group List Bar */}
      <div className="flex-shrink-0 relative z-10 border-b border-white/10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingBottom: '0.75rem' }}>
        <div className="flex items-center gap-2 overflow-x-auto">
          {groups.map((group, index) => (
            <button
              key={group.id}
              draggable
              onDragStart={() => handleGroupDragStart(index)}
              onDragOver={(e) => handleGroupDragOver(e, index)}
              onDragEnd={handleGroupDragEnd}
              onClick={() => setSelectedGroupId(group.id)}
              className={`px-4 py-2 rounded-lg text-sm transition-all flex-shrink-0 cursor-move ${
                selectedGroupId === group.id
                  ? 'bg-white/20 text-white font-semibold'
                  : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
              } ${draggedGroupIndex === index ? 'opacity-50' : ''}`}
            >
              {group.name} ({group.items.length})
            </button>
          ))}

          {/* Add Group Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  addGroup();
                }
              }}
              placeholder="New group name..."
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-400 w-40"
            />
            <button
              onClick={addGroup}
              className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all"
              title="Add group"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingBottom: '2rem', paddingTop: '1rem' }}>
        {!selectedGroup ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500">
            <svg className="w-20 h-20 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg mb-2">No group selected</p>
            <p className="text-sm">Create a new group or select an existing one</p>
          </div>
        ) : (
          <div className="h-full flex gap-6">
            {/* Items Grid */}
            <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex-1">
                  {editingGroup === selectedGroup.id ? (
                    <input
                      type="text"
                      value={selectedGroup.name}
                      onChange={(e) => updateGroupName(selectedGroup.id, e.target.value)}
                      onBlur={() => setEditingGroup(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          setEditingGroup(null);
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white focus:outline-none"
                    />
                  ) : (
                    <h3 className="font-semibold text-white">{selectedGroup.name}</h3>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    {uploadingFile && uploadProgress.total > 0
                      ? `Uploading ${uploadProgress.current}/${uploadProgress.total} - ${uploadProgress.fileName}`
                      : `${selectedGroup.items.length} item${selectedGroup.items.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFileUpload(selectedGroup.id)}
                    disabled={uploadingFile}
                    className="p-2 hover:bg-green-500/20 rounded-lg transition-all disabled:opacity-50"
                    title="Upload media"
                  >
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingGroup(selectedGroup.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                    title="Rename group"
                  >
                    <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteGroup(selectedGroup.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                    title="Delete group"
                  >
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-3 gap-4">
                  {selectedGroup.items.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => handleItemDragStart(index)}
                      onDragOver={(e) => handleItemDragOver(e, index)}
                      onDragEnd={handleItemDragEnd}
                      className={`group relative rounded-xl overflow-hidden border-2 transition-all ${
                        editingItem === item.id
                          ? 'border-purple-400 ring-2 ring-purple-400/50'
                          : 'border-white/10 hover:border-white/30'
                      } ${draggedItemIndex === index ? 'opacity-50' : ''}`}
                      onClick={() => {
                        setEditingItem(item.id);
                      }}
                    >
                      <div
                        className="aspect-video bg-black cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewMedia(item.dataUrl);
                          setPreviewIndex(index);
                        }}
                      >
                        {item.type === 'video' ? (
                          <video src={item.dataUrl} className="w-full h-full object-contain" />
                        ) : (
                          <img src={item.dataUrl} alt={item.name} className="w-full h-full object-contain" />
                        )}
                      </div>
                      <div className="p-2 bg-black/50 backdrop-blur-sm">
                        {editingItem === item.id ? (
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(selectedGroup.id, item.id, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-xs text-white focus:outline-none"
                          />
                        ) : (
                          <p className="text-xs text-white truncate">{item.name}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(selectedGroup.id, item.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {selectedGroup.items.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">No media files yet</p>
                    <p className="text-xs mt-1">Click the + button to upload</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image/Video Preview Modal */}
      {previewMedia && selectedGroup && createPortal(
        <div
          className="fixed bg-black/95 backdrop-blur-sm flex flex-col z-50"
          style={{ top: '56px', left: 0, right: 0, bottom: 0 }}
          onClick={() => {
            setPreviewMedia(null);
            setPreviewIndex(-1);
          }}
        >
          <div className="flex justify-end p-4 flex-shrink-0">
            <button
              onClick={() => {
                setPreviewMedia(null);
                setPreviewIndex(-1);
              }}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            {/* Left Arrow */}
            {previewIndex > 0 && (
              <button
                onClick={() => navigatePreview(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Image/Video */}
            {previewMedia.startsWith('data:video') ? (
              <video src={previewMedia} style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} className="object-contain" controls autoPlay />
            ) : (
              <img src={previewMedia} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} className="object-contain" />
            )}

            {/* Right Arrow */}
            {previewIndex < selectedGroup.items.length - 1 && (
              <button
                onClick={() => navigatePreview(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-lg text-white text-sm">
              {previewIndex + 1} / {selectedGroup.items.length}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
