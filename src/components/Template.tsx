import { useState, useEffect } from 'react';

export function Template() {
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem('prompt_templates');
    return saved || '';
  });

  useEffect(() => {
    localStorage.setItem('prompt_templates', templates);
  }, [templates]);

  // Parse templates from text
  const parseTemplates = (text: string): { name: string; content: string }[] => {
    const result: { name: string; content: string }[] = [];
    const lines = text.split('\n');

    let currentName = '';
    let currentContent = '';
    let inContent = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for template name (ends with {)
      if (trimmed.endsWith('{') && !inContent) {
        // Save previous template if exists
        if (currentName && currentContent) {
          result.push({ name: currentName, content: currentContent.trim() });
        }

        currentName = trimmed.substring(0, trimmed.length - 1).trim();
        currentContent = '';
        inContent = true;
      }
      // Check for content end (})
      else if (trimmed === '}' && inContent) {
        inContent = false;
      }
      // Add content line
      else if (inContent) {
        currentContent += line + '\n';
      }
    }

    // Add last template
    if (currentName && currentContent) {
      result.push({ name: currentName, content: currentContent.trim() });
    }

    return result;
  };

  const parsedTemplates = parseTemplates(templates);

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
          Prompt Templates
        </h2>
        <p className="text-neutral-500">
          Create reusable prompt templates for your models
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingBottom: '2rem' }}>
        <div className="h-full flex gap-6">
          {/* Editor Panel */}
          <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="font-semibold text-white">Template Editor</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Format: Template Name{'{'}, then content, then {'}'}
              </p>
            </div>
            <div className="flex-1 overflow-hidden p-5">
              <textarea
                value={templates}
                onChange={(e) => setTemplates(e.target.value)}
                placeholder={`Template Name{\nYour prompt content here...\n}\n\nAnother Template{\nAnother prompt...\n}`}
                className="w-full h-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-purple-400 resize-none"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-96 flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="font-semibold text-white">Preview</h3>
              <p className="text-xs text-neutral-400 mt-1">
                {parsedTemplates.length} template{parsedTemplates.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              {parsedTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">No templates yet</p>
                </div>
              ) : (
                parsedTemplates.map((template, index) => (
                  <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <h4 className="font-semibold text-white text-sm">{template.name}</h4>
                    </div>
                    <pre className="text-xs text-neutral-300 whitespace-pre-wrap font-mono bg-black/30 rounded-lg p-3">
                      {template.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
