import { useState, useEffect } from 'react';
import type { SchemaProperty } from '../types';

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

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

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

    setSelectedTemplates([...selectedTemplates, newTemplate]);
    setSelectedGroupId('');
    setSelectedItemId('');
  };

  const removeTemplate = (index: number) => {
    setSelectedTemplates(selectedTemplates.filter((_, i) => i !== index));
  };

  const applyTemplates = () => {
    const combined = selectedTemplates.map(t => t.content).join('\n\n');
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
  };

  const handleTemplateDragEnd = () => {
    setDraggedTemplateIndex(null);
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
                <div className="flex gap-2">
                  <button
                    onClick={applyTemplates}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-medium text-white transition-all"
                  >
                    Apply to Prompt
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium text-white transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {selectedTemplates.map((template, index) => (
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
  const [formData, setFormData] = useState<{ [key: string]: any }>(values);

  useEffect(() => {
    setFormData(values);
  }, [values]);

  const handleChange = (key: string, value: any) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    onChange(newData);
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
          {uploadedFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="border-2 border-white/20 rounded-lg overflow-hidden">
                    {file.startsWith('data:video') ? (
                      <video src={file} className="w-full h-32 object-cover bg-black" controls />
                    ) : (
                      <img src={file} alt={`Uploaded ${index + 1}`} className="w-full h-32 object-cover bg-black" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newFiles = uploadedFiles.filter((_, i) => i !== index);
                      handleChange(key, newFiles);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
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
                  if (result.success && result.data) {
                    handleChange(key, [...uploadedFiles, result.data]);
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
          {isDataUrl ? (
            <div className="relative group">
              <div className="border-2 border-white/20 rounded-lg overflow-hidden">
                {value.startsWith('data:video') ? (
                  <video src={value} className="w-full max-h-48 object-contain bg-black" controls />
                ) : (
                  <img src={value} alt="Uploaded" className="w-full max-h-48 object-contain bg-black" />
                )}
              </div>
              <button
                type="button"
                onClick={() => handleChange(key, '')}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
              <p className="text-xs text-neutral-500 mt-2 text-center">✓ File uploaded</p>
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
                      if (result.success && result.data) {
                        handleChange(key, result.data);
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

  return (
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
  );
}
