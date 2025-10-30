import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SchemaProperty } from '../types';
import { getMediaGroups, type MediaGroup } from '../lib/storage';

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

interface SelectedTemplate {
  groupId: string;
  itemId: string;
  groupName: string;
  itemName: string;
  content: string;
}

interface DynamicFormProps {
  schema: { [key: string]: SchemaProperty };
  values: { [key: string]: any };
  onChange: (values: { [key: string]: any }) => void;
  modelKey?: string;
}

interface PromptFieldWithTemplatesProps {
  value: string;
  groups: TemplateGroup[];
  onChange: (value: string) => void;
  modelKey: string;
}

function PromptFieldWithTemplates({ value, groups, onChange, modelKey }: PromptFieldWithTemplatesProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedTemplates, setSelectedTemplates] = useState<SelectedTemplate[]>(() => {
    // Load saved selected templates for this model
    const saved = localStorage.getItem(`selected_templates_${modelKey}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [draggedTemplateIndex, setDraggedTemplateIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string>('');

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const editingGroup = groups.find(g => g.id === editingGroupId);

  // Save selected templates whenever they change
  useEffect(() => {
    localStorage.setItem(`selected_templates_${modelKey}`, JSON.stringify(selectedTemplates));
  }, [selectedTemplates, modelKey]);

  const addTemplate = () => {
    if (!selectedGroupId || !selectedItemId) return;

    const group = groups.find(g => g.id === selectedGroupId);
    const item = group?.items.find(i => i.id === selectedItemId);

    if (!group || !item) return;

    const newTemplate: SelectedTemplate = {
      groupId: group.id,
      itemId: item.id,
      groupName: group.name,
      itemName: item.name,
      content: item.content
    };

    const newTemplates = [...selectedTemplates, newTemplate];
    setSelectedTemplates(newTemplates);
    setSelectedGroupId('');
    setSelectedItemId('');

    // Auto-apply after adding
    const combined = newTemplates.map(t => t.content).join('\n\n');
    onChange(combined);
  };

  const removeTemplate = (index: number) => {
    const newTemplates = selectedTemplates.filter((_, i) => i !== index);
    setSelectedTemplates(newTemplates);
    // Auto-apply after removing
    const combined = newTemplates.map(t => t.content).join('\n\n');
    onChange(combined);
  };

  const clearAll = () => {
    setSelectedTemplates([]);
    onChange('');
  };

  const handleTemplateDragStart = (index: number) => {
    setDraggedTemplateIndex(index);
  };

  const handleTemplateDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTemplateIndex === null || draggedTemplateIndex === index) return;

    const newTemplates = [...selectedTemplates];
    const draggedTemplate = newTemplates[draggedTemplateIndex];
    newTemplates.splice(draggedTemplateIndex, 1);
    newTemplates.splice(index, 0, draggedTemplate);

    setSelectedTemplates(newTemplates);
    setDraggedTemplateIndex(index);

    // Auto-apply after reordering
    const combined = newTemplates.map(t => t.content).join('\n\n');
    onChange(combined);
  };

  const handleTemplateDragEnd = () => {
    setDraggedTemplateIndex(null);
  };

  const startEditing = (index: number) => {
    const template = selectedTemplates[index];
    setEditingIndex(index);
    setEditingGroupId(template.groupId);
    setEditingItemId(template.itemId);
  };

  const updateTemplate = () => {
    if (editingIndex === null || !editingGroupId || !editingItemId) return;

    const group = groups.find(g => g.id === editingGroupId);
    const item = group?.items.find(i => i.id === editingItemId);

    if (!group || !item) return;

    const newTemplates = [...selectedTemplates];
    newTemplates[editingIndex] = {
      groupId: group.id,
      itemId: item.id,
      groupName: group.name,
      itemName: item.name,
      content: item.content
    };

    setSelectedTemplates(newTemplates);
    setEditingIndex(null);
    setEditingGroupId('');
    setEditingItemId('');

    // Auto-apply after updating
    const combined = newTemplates.map(t => t.content).join('\n\n');
    onChange(combined);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingGroupId('');
    setEditingItemId('');
  };

  return (
    <div className="space-y-3">
      {groups.length > 0 && (
        <div className="space-y-3">
          {/* Template Selector */}
          <div className="flex items-center gap-2">
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setSelectedItemId('');
              }}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-400 focus:bg-white/10 transition-all"
            >
              <option value="" className="bg-neutral-900">Select group...</option>
              {groups.map(group => (
                <option key={group.id} value={group.id} className="bg-neutral-900">
                  {group.name}
                </option>
              ))}
            </select>

            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              disabled={!selectedGroupId}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-400 focus:bg-white/10 transition-all disabled:opacity-50"
            >
              <option value="" className="bg-neutral-900">Select template...</option>
              {selectedGroup?.items.map(item => (
                <option key={item.id} value={item.id} className="bg-neutral-900">
                  {item.name}
                </option>
              ))}
            </select>

            <button
              onClick={addTemplate}
              disabled={!selectedGroupId || !selectedItemId}
              className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add template"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Selected Templates List */}
          {selectedTemplates.length > 0 && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-400">
                  Selected Templates ({selectedTemplates.length})
                </span>
                <button
                  onClick={clearAll}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium text-white transition-all"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-1.5">
                {selectedTemplates.map((template, index) => (
                  editingIndex === index ? (
                    // Editing mode
                    <div key={index} className="p-2 bg-purple-600/20 border border-purple-400/50 rounded space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-neutral-400">{index + 1}.</span>
                        <span className="text-xs text-neutral-400">Editing</span>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={editingGroupId}
                          onChange={(e) => {
                            setEditingGroupId(e.target.value);
                            setEditingItemId('');
                          }}
                          className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs focus:outline-none focus:border-purple-400"
                        >
                          <option value="" className="bg-neutral-900">Select group...</option>
                          {groups.map(group => (
                            <option key={group.id} value={group.id} className="bg-neutral-900">
                              {group.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editingItemId}
                          onChange={(e) => setEditingItemId(e.target.value)}
                          disabled={!editingGroupId}
                          className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs focus:outline-none focus:border-purple-400 disabled:opacity-50"
                        >
                          <option value="" className="bg-neutral-900">Select template...</option>
                          {editingGroup?.items.map(item => (
                            <option key={item.id} value={item.id} className="bg-neutral-900">
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={updateTemplate}
                          disabled={!editingGroupId || !editingItemId}
                          className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-medium text-white transition-all disabled:opacity-50"
                        >
                          Update
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="flex-1 px-2 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-xs font-medium text-white transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleTemplateDragStart(index)}
                      onDragOver={(e) => handleTemplateDragOver(e, index)}
                      onDragEnd={handleTemplateDragEnd}
                      className={`flex items-center justify-between p-2 bg-white/5 border border-white/10 rounded cursor-move transition-all ${
                        draggedTemplateIndex === index ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-neutral-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                        <span className="text-xs font-mono text-neutral-500">{index + 1}.</span>
                        <span className="text-xs font-semibold text-purple-400">{template.groupName}</span>
                        <span className="text-xs text-neutral-500">→</span>
                        <span className="text-xs text-white truncate">{template.itemName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditing(index)}
                          className="p-1 hover:bg-blue-500/20 rounded transition-all flex-shrink-0"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeTemplate(index)}
                          className="p-1 hover:bg-red-500/20 rounded transition-all flex-shrink-0"
                          title="Remove"
                        >
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-y min-h-[120px]"
        placeholder="Describe what you want to create..."
      />
    </div>
  );
}

export function DynamicForm({ schema, values, onChange, modelKey = '' }: DynamicFormProps) {
  const [formData, setFormData] = useState<{ [key: string]: any}>(values);
  const [mediaGroups, setMediaGroups] = useState<MediaGroup[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [currentFieldKey, setCurrentFieldKey] = useState<string>('');
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedFieldKey, setDraggedFieldKey] = useState<string>('');

  // Load media groups from IndexedDB
  useEffect(() => {
    const loadGroups = async () => {
      const groups = await getMediaGroups();
      setMediaGroups(groups);
    };
    loadGroups();
  }, []);

  useEffect(() => {
    setFormData(values);
  }, [values]);

  const handleChange = (key: string, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    onChange(newData);
  };

  const openMediaSelector = async (fieldKey: string, multi: boolean) => {
    // Reload media groups to get latest data
    const groups = await getMediaGroups();
    setMediaGroups(groups);

    setCurrentFieldKey(fieldKey);
    setIsMultiSelect(multi);
    setSelectedGroupId('');
    setSelectedMediaIds(new Set());
    setShowMediaModal(true);
  };

  const applyMedia = () => {
    const group = mediaGroups.find(g => g.id === selectedGroupId);
    if (!group) return;

    const selectedMedia = group.items.filter(item => selectedMediaIds.has(item.id));

    if (isMultiSelect) {
      // Array field - append to existing
      const current = Array.isArray(formData[currentFieldKey]) ? formData[currentFieldKey] : [];
      const newValues = [...current, ...selectedMedia.map(m => m.dataUrl)];
      handleChange(currentFieldKey, newValues);
    } else {
      // Single field - replace
      if (selectedMedia.length > 0) {
        handleChange(currentFieldKey, selectedMedia[0].dataUrl);
      }
    }

    setShowMediaModal(false);
  };

  const handleDragStart = (fieldKey: string, index: number) => {
    setDraggedIndex(index);
    setDraggedFieldKey(fieldKey);
  };

  const handleDragOver = (e: React.DragEvent, fieldKey: string, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedFieldKey !== fieldKey) return;

    const items = Array.isArray(formData[fieldKey]) ? [...formData[fieldKey]] : [];
    if (draggedIndex === index) return;

    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);

    handleChange(fieldKey, items);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggedFieldKey('');
  };

  const renderField = (key: string, prop: SchemaProperty) => {
    const value = formData[key] ?? prop.default;

    if (prop.enum && prop.enum.length > 0) {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleChange(key, e.target.value)}
          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
        >
          {prop.enum.map((option) => (
            <option key={option} value={option} className="bg-neutral-900">{option}</option>
          ))}
        </select>
      );
    }

    if (prop.type === 'boolean') {
      return (
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleChange(key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-purple-600 transition-all" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-neutral-400 group-hover:text-white transition-colors">
            {value ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      );
    }

    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <div className="space-y-2">
          <input
            type="number"
            value={value ?? prop.default ?? ''}
            min={prop.minimum}
            max={prop.maximum}
            step={prop.type === 'integer' ? 1 : 0.1}
            onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
          />
          {(prop.minimum !== undefined || prop.maximum !== undefined) && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Range: {prop.minimum ?? '-∞'} to {prop.maximum ?? '∞'}
            </div>
          )}
        </div>
      );
    }

    if (prop.type === 'array' && (prop.format === 'uri' || key.includes('image') || key.includes('video'))) {
      const uploadedFiles = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-3">
          {/* Media Library Button */}
          <button
            type="button"
            onClick={() => openMediaSelector(key, true)}
            className="w-full px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 hover:border-purple-500 rounded-lg text-sm font-medium text-purple-300 hover:text-purple-200 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Select from Media Library
          </button>

          {uploadedFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(key, index)}
                  onDragOver={(e) => handleDragOver(e, key, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group ${draggedIndex === index && draggedFieldKey === key ? 'opacity-50' : ''}`}
                >
                  <div className="absolute top-1 left-1 p-1 bg-white/10 rounded cursor-move z-10">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                  <div
                    className="border-2 border-white/20 rounded-lg overflow-hidden cursor-pointer hover:border-white/40 transition-all"
                    onClick={() => setPreviewMedia(file)}
                  >
                    {file.startsWith('data:video') ? (
                      <video src={file} className="w-full h-32 object-contain bg-black" />
                    ) : (
                      <img src={file} alt={`Uploaded ${index + 1}`} className="w-full h-32 object-contain bg-black" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newFiles = uploadedFiles.filter((_, i) => i !== index);
                      handleChange(key, newFiles);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium transition-all opacity-0 group-hover:opacity-100 z-10"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="block w-full p-6 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-white/30 hover:bg-white/5 transition-all text-center group">
            <svg className="w-10 h-10 mx-auto mb-3 text-neutral-500 group-hover:text-neutral-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">
              {uploadedFiles.length > 0 ? 'Add more files' : 'Click to upload or drag & drop'}
            </p>
            <p className="text-xs text-neutral-600 mt-1">Multiple images or videos supported</p>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onClick={async (e) => {
                // Use Electron file dialog if available
                const electron = (window as any).electron;
                if (electron?.fs?.selectInputFile) {
                  e.preventDefault();
                  const result = await electron.fs.selectInputFile();
                  if (result.success && result.files && result.files.length > 0) {
                    // Read all files first, then update once
                    const newFiles: string[] = [];
                    for (const file of result.files) {
                      const fileResult = await electron.fs.readInputFile(file.path);
                      if (fileResult.success) {
                        newFiles.push(fileResult.data);
                      }
                    }
                    if (newFiles.length > 0) {
                      handleChange(key, [...uploadedFiles, ...newFiles]);
                    }
                  }
                }
              }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                const newFiles: string[] = [];

                for (const file of files) {
                  const reader = new FileReader();
                  await new Promise((resolve) => {
                    reader.onload = (event) => {
                      newFiles.push(event.target?.result as string);
                      resolve(null);
                    };
                    reader.readAsDataURL(file);
                  });
                }

                handleChange(key, [...uploadedFiles, ...newFiles]);
              }}
              className="hidden"
            />
          </label>
        </div>
      );
    }

    if (prop.format === 'uri' || key.includes('image') || key.includes('video')) {
      const isDataUrl = value && value.startsWith && value.startsWith('data:');
      return (
        <div className="space-y-3">
          {/* Media Library Button */}
          <button
            type="button"
            onClick={() => openMediaSelector(key, false)}
            className="w-full px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 hover:border-purple-500 rounded-lg text-sm font-medium text-purple-300 hover:text-purple-200 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Select from Media Library
          </button>

          {isDataUrl ? (
            <div className="relative group">
              <div
                className="border-2 border-white/20 rounded-lg overflow-hidden cursor-pointer hover:border-white/40 transition-all"
                onClick={() => setPreviewMedia(value)}
              >
                {value.startsWith('data:video') ? (
                  <video src={value} className="w-full max-h-48 object-contain bg-black" />
                ) : (
                  <img src={value} alt="Uploaded" className="w-full max-h-48 object-contain bg-black" />
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleChange(key, '');
                }}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
              <p className="text-xs text-neutral-500 mt-2 text-center">✓ File uploaded (Click to preview)</p>
            </div>
          ) : (
            <>
              <input
                type="url"
                value={value || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-neutral-950 text-neutral-500">or</span>
                </div>
              </div>
              <label className="block w-full p-4 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-white/30 hover:bg-white/5 transition-all text-center group">
                <svg className="w-8 h-8 mx-auto mb-2 text-neutral-500 group-hover:text-neutral-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">Upload file</p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onClick={async (e) => {
                    // Use Electron file dialog if available
                    const electron = (window as any).electron;
                    if (electron?.fs?.selectInputFile) {
                      e.preventDefault();
                      const result = await electron.fs.selectInputFile();
                      if (result.success && result.files && result.files.length > 0) {
                        // Read first selected file
                        const fileResult = await electron.fs.readInputFile(result.files[0].path);
                        if (fileResult.success) {
                          handleChange(key, fileResult.data);
                        }
                      }
                    }
                  }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        handleChange(key, event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      );
    }

    if (prop.type === 'string') {
      if (key === 'prompt' || prop.description?.toLowerCase().includes('prompt')) {
        // Load template groups from new structure
        const loadTemplateGroups = (): TemplateGroup[] => {
          const saved = localStorage.getItem('prompt_template_groups');
          if (saved) {
            try {
              return JSON.parse(saved);
            } catch {
              return [];
            }
          }
          return [];
        };

        const groups = loadTemplateGroups();

        return (
          <PromptFieldWithTemplates
            value={value || ''}
            groups={groups}
            onChange={(newValue) => handleChange(key, newValue)}
            modelKey={modelKey}
          />
        );
      }

      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => handleChange(key, e.target.value)}
          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
          placeholder={prop.description}
        />
      );
    }

    return null;
  };

  const sortedKeys = Object.keys(schema).sort((a, b) => {
    const orderA = schema[a]['x-order'] ?? 999;
    const orderB = schema[b]['x-order'] ?? 999;
    return orderA - orderB;
  });

  const selectedGroup = mediaGroups.find(g => g.id === selectedGroupId);

  return (
    <>
      <div className="space-y-5">
        {sortedKeys.map((key) => {
          const prop = schema[key];
          return (
            <div key={key} className="group">
              <label className="block text-sm font-semibold text-white mb-2">
                {prop.title || key}
              </label>
              {prop.description && (
                <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
                  {prop.description}
                </p>
              )}
              {renderField(key, prop)}
            </div>
          );
        })}
      </div>

      {/* Media Selection Modal */}
      {showMediaModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setShowMediaModal(false)}>
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-white/20 rounded-2xl w-[90vw] h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="text-xl font-bold text-white">Select from Media Library</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  {isMultiSelect ? 'Select multiple media files' : 'Select one media file'}
                </p>
              </div>
              <button
                onClick={() => setShowMediaModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Group Selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-white mb-2">Select Group</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    setSelectedMediaIds(new Set());
                  }}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-400 transition-all"
                >
                  <option value="" className="bg-neutral-900">Select a group...</option>
                  {mediaGroups.map(group => (
                    <option key={group.id} value={group.id} className="bg-neutral-900">
                      {group.name} ({group.items.length} items)
                    </option>
                  ))}
                </select>
              </div>

              {/* Media Grid */}
              {selectedGroup && selectedGroup.items.length > 0 ? (
                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    Select Media {isMultiSelect && `(${selectedMediaIds.size} selected)`}
                  </label>
                  <div className="grid grid-cols-4 gap-6">
                    {selectedGroup.items.map(item => {
                      const isSelected = selectedMediaIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            const newSet = new Set(selectedMediaIds);
                            if (isMultiSelect) {
                              if (isSelected) {
                                newSet.delete(item.id);
                              } else {
                                newSet.add(item.id);
                              }
                            } else {
                              newSet.clear();
                              newSet.add(item.id);
                            }
                            setSelectedMediaIds(newSet);
                          }}
                          className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                            isSelected ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          <div className="aspect-video bg-black relative">
                            {item.type === 'video' ? (
                              <video src={item.dataUrl} className="w-full h-full object-contain" />
                            ) : (
                              <img src={item.dataUrl} alt={item.name} className="w-full h-full object-contain" />
                            )}
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-black/50">
                            <p className="text-xs text-white truncate">{item.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedGroup ? (
                <div className="text-center py-12 text-neutral-500">
                  <p>No media in this group</p>
                </div>
              ) : (
                <div className="text-center py-12 text-neutral-500">
                  <p>Please select a group first</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setShowMediaModal(false)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={applyMedia}
                disabled={selectedMediaIds.size === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply ({selectedMediaIds.size})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image/Video Preview Modal */}
      {previewMedia && createPortal(
        <div
          className="fixed bg-black/95 backdrop-blur-sm flex flex-col z-50"
          style={{ top: '56px', left: 0, right: 0, bottom: 0 }}
          onClick={() => setPreviewMedia(null)}
        >
          <div className="flex justify-end p-4 flex-shrink-0">
            <button
              onClick={() => setPreviewMedia(null)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {previewMedia.startsWith('data:video') ? (
              <video src={previewMedia} style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} className="object-contain" controls autoPlay />
            ) : (
              <img src={previewMedia} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} className="object-contain" />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
