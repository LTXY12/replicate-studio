import { useState } from 'react';
import { useApiKey } from '../hooks/useApiKey';

interface ApiKeySetupProps {
  onComplete: () => void;
}

export function ApiKeySetup({ onComplete }: ApiKeySetupProps) {
  const { apiKey, setApiKey } = useApiKey();
  const [input, setInput] = useState(apiKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setApiKey(input.trim());
      onComplete();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-black p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl mb-6 shadow-2xl shadow-purple-500/30 animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Replicate Studio
          </h1>
          <p className="text-lg text-neutral-400">
            Create stunning AI-generated content
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-white mb-4">
                🔑 API Token
              </label>
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="r8_..."
                autoFocus
                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-base focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all placeholder-neutral-500"
              />
              <p className="mt-4 text-sm text-neutral-400 leading-relaxed">
                Get your API token from{' '}
                <a
                  href="https://replicate.com/account/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2"
                >
                  replicate.com/account/api-tokens
                </a>
              </p>
            </div>

            <button
              type="submit"
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white text-base font-semibold rounded-2xl hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
            >
              Get Started →
            </button>

            {apiKey && (
              <button
                type="button"
                onClick={onComplete}
                className="w-full px-6 py-4 bg-white/10 text-white text-base font-medium rounded-2xl hover:bg-white/20 transition-all border border-white/20"
              >
                Use Existing Key
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Powered by Replicate AI
        </p>
      </div>
    </div>
  );
}
