import { useState, useEffect } from 'react';
import type { SchemaProperty } from '../types';

interface DynamicFormProps {
  schema: { [key: string]: SchemaProperty };
  values: { [key: string]: any };
  onChange: (values: { [key: string]: any }) => void;
}

export function DynamicForm({ schema, values, onChange }: DynamicFormProps) {
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
      const uploadedFile = Array.isArray(value) ? value[0] : null;
      return (
        <div>
          {uploadedFile ? (
            <div className="relative group">
              <div className="border-2 border-white/20 rounded-lg overflow-hidden">
                {uploadedFile.startsWith('data:video') ? (
                  <video src={uploadedFile} className="w-full max-h-48 object-contain bg-black" controls />
                ) : (
                  <img src={uploadedFile} alt="Uploaded" className="w-full max-h-48 object-contain bg-black" />
                )}
              </div>
              <button
                type="button"
                onClick={() => handleChange(key, null)}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
              <p className="text-xs text-neutral-500 mt-2 text-center">✓ File uploaded</p>
            </div>
          ) : (
            <label className="block w-full p-6 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-white/30 hover:bg-white/5 transition-all text-center group">
              <svg className="w-10 h-10 mx-auto mb-3 text-neutral-500 group-hover:text-neutral-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">
                Click to upload or drag & drop
              </p>
              <p className="text-xs text-neutral-600 mt-1">Image or Video files</p>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleChange(key, [event.target?.result as string]);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />
            </label>
          )}
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
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-none"
            placeholder="Describe what you want to create..."
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
