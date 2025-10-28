import { useState, useEffect } from 'react';

interface TemplateItem {
  id: string;
  name: string;
  content: string;
}

interface TemplateGroup {
  id: string;
  name: string;
  items: TemplateItem[];
}

export function Template() {
  const [groups, setGroups] = useState<TemplateGroup[]>(() => {
    const saved = localStorage.getItem('prompt_template_groups');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);

  useEffect(() => {
    localStorage.setItem('prompt_template_groups', JSON.stringify(groups));
  }, [groups]);

  const addGroup = () => {
    if (!newGroupName.trim()) return;

    const newGroup: TemplateGroup = {
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

  const addItem = (groupId: string) => {
    if (!newItemName.trim() || !newItemContent.trim()) return;

    const newItem: TemplateItem = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      content: newItemContent.trim()
    };

    setGroups(groups.map(g =>
      g.id === groupId
        ? { ...g, items: [...g.items, newItem] }
        : g
    ));

    setNewItemName('');
    setNewItemContent('');
    setIsAddingNewItem(false);
  };

  const startAddingItem = () => {
    setEditingItem(null);
    setNewItemName('');
    setNewItemContent('');
    setIsAddingNewItem(true);
  };

  const cancelAddingItem = () => {
    setNewItemName('');
    setNewItemContent('');
    setIsAddingNewItem(false);
  };

  const deleteItem = (groupId: string, itemId: string) => {
    setGroups(groups.map(g =>
      g.id === groupId
        ? { ...g, items: g.items.filter(i => i.id !== itemId) }
        : g
    ));
  };

  const updateItem = (groupId: string, itemId: string, updates: Partial<TemplateItem>) => {
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

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-black relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              Prompt Templates
            </h2>
            <p className="text-neutral-500">
              Create template groups and items for reusable prompts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const electron = (window as any).electron;
                if (electron?.fs?.exportTemplates) {
                  const result = await electron.fs.exportTemplates(groups);
                  if (result.success) {
                    alert('Templates exported successfully!');
                  } else if (!result.canceled) {
                    alert('Failed to export templates: ' + result.error);
                  }
                } else {
                  // Web fallback - download as JSON
                  const dataStr = JSON.stringify(groups, null, 2);
                  const dataBlob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(dataBlob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'templates.json';
                  link.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <button
              onClick={async () => {
                const electron = (window as any).electron;
                if (electron?.fs?.importTemplates) {
                  const result = await electron.fs.importTemplates();
                  if (result.success && result.data) {
                    setGroups(result.data);
                    alert('Templates imported successfully!');
                  } else if (!result.canceled) {
                    alert('Failed to import templates: ' + result.error);
                  }
                } else {
                  // Web fallback - use file input
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'application/json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = JSON.parse(event.target?.result as string);
                          setGroups(data);
                          alert('Templates imported successfully!');
                        } catch (error) {
                          alert('Failed to parse JSON file');
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import
            </button>
          </div>
        </div>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg mb-2">No group selected</p>
            <p className="text-sm">Create a new group or select an existing one</p>
          </div>
        ) : (
          <div className="h-full flex gap-6">
            {/* Items List */}
            <div className="w-80 flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
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
                    {selectedGroup.items.length} item{selectedGroup.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={startAddingItem}
                    className="p-1.5 hover:bg-green-500/20 rounded transition-all"
                    title="Add new item"
                  >
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingGroup(selectedGroup.id)}
                    className="p-1.5 hover:bg-white/10 rounded transition-all"
                    title="Rename group"
                  >
                    <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteGroup(selectedGroup.id)}
                    className="p-1.5 hover:bg-red-500/20 rounded transition-all"
                    title="Delete group"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-2">
                {selectedGroup.items.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleItemDragStart(index)}
                    onDragOver={(e) => handleItemDragOver(e, index)}
                    onDragEnd={handleItemDragEnd}
                    onClick={() => {
                      setEditingItem(item.id);
                      setIsAddingNewItem(false);
                    }}
                    className={`p-3 rounded-lg cursor-move transition-all ${
                      editingItem === item.id
                        ? 'bg-purple-600/20 border border-purple-400/50'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    } ${draggedItemIndex === index ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-white text-sm">{item.name}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(selectedGroup.id, item.id);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded transition-all"
                        title="Delete item"
                      >
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 font-mono">{item.content}</p>
                  </div>
                ))}

                {selectedGroup.items.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <svg className="w-12 h-12 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <p className="text-sm">No items yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Item Editor - Only show when editing or adding */}
            {(editingItem || isAddingNewItem) && (
              <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h3 className="font-semibold text-white">
                    {editingItem ? 'Edit Item' : 'Add New Item'}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {editingItem ? 'Modify the selected template item' : 'Create a new template item for this group'}
                  </p>
                </div>

              <div className="flex-1 overflow-auto p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Item Name</label>
                  <input
                    type="text"
                    value={editingItem ? selectedGroup.items.find(i => i.id === editingItem)?.name || '' : newItemName}
                    onChange={(e) => {
                      if (editingItem) {
                        updateItem(selectedGroup.id, editingItem, { name: e.target.value });
                      } else {
                        setNewItemName(e.target.value);
                      }
                    }}
                    placeholder="e.g., 상체, 풀샷, 하이앵글..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-400 focus:bg-white/10 transition-all"
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-semibold text-white mb-2">Content</label>
                  <textarea
                    value={editingItem ? selectedGroup.items.find(i => i.id === editingItem)?.content || '' : newItemContent}
                    onChange={(e) => {
                      if (editingItem) {
                        updateItem(selectedGroup.id, editingItem, { content: e.target.value });
                      } else {
                        setNewItemContent(e.target.value);
                      }
                    }}
                    placeholder="Enter your prompt template content here..."
                    className="flex-1 min-h-[300px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-purple-400 focus:bg-white/10 transition-all resize-none"
                    spellCheck={false}
                  />
                </div>

                <div className="flex gap-3">
                  {editingItem ? (
                    <button
                      onClick={() => setEditingItem(null)}
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl hover:bg-white/15 transition-all text-sm font-medium"
                    >
                      Done Editing
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => addItem(selectedGroup.id)}
                        disabled={!newItemName.trim() || !newItemContent.trim()}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Item
                      </button>
                      <button
                        onClick={cancelAddingItem}
                        className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl hover:bg-white/15 transition-all text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
