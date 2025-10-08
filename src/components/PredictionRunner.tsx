import { useState, useEffect } from 'react';
import type { ReplicateModel, Prediction, ModelSchema } from '../types';
import { ReplicateClient } from '../lib/replicate';
import { useApiKey } from '../hooks/useApiKey';
import { saveResult, cleanupOldResults } from '../lib/storage';
import { DynamicForm } from './DynamicForm';

interface PredictionRunnerProps {
  model: ReplicateModel;
  onBack: () => void;
}

export function PredictionRunner({ model, onBack }: PredictionRunnerProps) {
  const { apiKey } = useApiKey();
  const [schema, setSchema] = useState<ModelSchema | null>(null);
  const [formValues, setFormValues] = useState<{ [key: string]: any }>({});
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [error, setError] = useState('');

  const modelKey = `${model.owner}/${model.name}`;

  useEffect(() => {
    loadSchema();
  }, [model]);

  useEffect(() => {
    // Load saved form values for this model
    const savedValues = localStorage.getItem(`model_state_${modelKey}`);
    if (savedValues && schema) {
      try {
        setFormValues(JSON.parse(savedValues));
      } catch (e) {
        console.error('Failed to load saved values', e);
      }
    }
  }, [schema, modelKey]);

  const saveFormValues = (values: { [key: string]: any }) => {
    // Clean up empty arrays and empty strings
    const cleanedValues = { ...values };
    Object.keys(cleanedValues).forEach(key => {
      const value = cleanedValues[key];
      if (Array.isArray(value) && value.length === 0) {
        delete cleanedValues[key];
      } else if (value === '' || value === null) {
        delete cleanedValues[key];
      }
    });

    setFormValues(cleanedValues);
    localStorage.setItem(`model_state_${modelKey}`, JSON.stringify(cleanedValues));
  };

  const resetFormValues = () => {
    const properties = schema?.openapi_schema?.components?.schemas?.Input?.properties || {};
    const defaults: { [key: string]: any } = {};
    Object.keys(properties).forEach((key) => {
      if (properties[key].default !== undefined) {
        defaults[key] = properties[key].default;
      }
    });
    setFormValues(defaults);
    localStorage.removeItem(`model_state_${modelKey}`);
  };

  const loadSchema = async () => {
    if (!apiKey) return;
    setLoadingSchema(true);
    setError('');

    try {
      const client = new ReplicateClient(apiKey);
      const modelSchema = await client.getModelSchema(model.owner, model.name);
      setSchema(modelSchema);

      const properties = modelSchema.openapi_schema?.components?.schemas?.Input?.properties || {};
      const defaults: { [key: string]: any } = {};
      Object.keys(properties).forEach((key) => {
        if (properties[key].default !== undefined) {
          defaults[key] = properties[key].default;
        }
      });
      setFormValues(defaults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleRun = async () => {
    if (!apiKey || !schema) return;
    setLoading(true);
    setError('');
    setPrediction(null);

    try {
      const client = new ReplicateClient(apiKey);

      // Clean formValues before sending to API
      const cleanInput = { ...formValues };
      Object.keys(cleanInput).forEach(key => {
        const value = cleanInput[key];
        if (Array.isArray(value) && value.length === 0) {
          delete cleanInput[key];
        } else if (value === '' || value === null || value === undefined) {
          delete cleanInput[key];
        }
      });

      const pred = await client.createPrediction(schema.id, cleanInput);
      setPrediction(pred);

      const finalPred = await client.waitForPrediction(pred.id, (p) => {
        setPrediction(p);
      });

      if (finalPred.status === 'succeeded' && finalPred.output) {
        await saveResult({
          predictionId: finalPred.id,
          model: `${model.owner}/${model.name}`,
          input: formValues,
          output: finalPred.output,
          createdAt: Date.now(),
          type: model.category === 'video' ? 'video' : 'image'
        });

        // Auto cleanup old results to prevent storage issues
        await cleanupOldResults(100); // Keep last 100 results
      }

      setPrediction(finalPred);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!apiKey) return <div className="p-8">API key not set</div>;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-black relative">
      {/* Background Blur Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      {/* Floating Header */}
      <div className="flex-shrink-0 relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Models
            </button>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">
                {model.name}
              </h2>
              <p className="text-sm text-neutral-500">
                {model.owner} · {model.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative z-10" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingBottom: '2rem' }}>
        <div className="h-full flex gap-6">
          {/* Parameters Panel */}
          <div className="w-96 flex flex-col flex-shrink-0 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Parameters
              </h3>
            </div>

            {loadingSchema && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin w-8 h-8 text-neutral-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm text-neutral-500">Loading schema...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="m-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">Error</p>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {schema && !loadingSchema && (
              <>
                <div className="flex-1 overflow-auto p-5">
                  <DynamicForm
                    schema={schema.openapi_schema?.components?.schemas?.Input?.properties || {}}
                    values={formValues}
                    onChange={saveFormValues}
                  />
                </div>

                {/* Run Button Fixed at Bottom */}
                <div className="p-5 border-t border-white/10 flex-shrink-0 space-y-2">
                  <button
                    onClick={handleRun}
                    disabled={loading || loadingSchema}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Running...
                      </span>
                    ) : (
                      '▶ Run Model'
                    )}
                  </button>
                  <button
                    onClick={resetFormValues}
                    disabled={loading || loadingSchema}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white text-sm rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Reset to Default
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Output Panel */}
          <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden min-w-0">
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Output
              </h3>
              {prediction && (
                <>
                  <span className={`px-3 py-1 text-xs font-medium rounded-lg ${
                    prediction.status === 'succeeded'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    prediction.status === 'failed'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {prediction.status}
                  </span>
                  {prediction.metrics?.predict_time && (
                    <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {prediction.metrics.predict_time.toFixed(2)}s
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 overflow-auto p-6">
              {!prediction && (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <svg className="w-20 h-20 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Configure parameters and run the model</p>
                </div>
              )}

              {prediction && prediction.status === 'succeeded' && prediction.output && (
                <div className="space-y-4">
                  {Array.isArray(prediction.output) ? (
                    prediction.output.map((url, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                        {model.category === 'video' ? (
                          <video src={url} controls className="w-full" />
                        ) : (
                          <img src={url} alt="Output" className="w-full" />
                        )}
                        <button
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `output-${Date.now()}-${i}.${model.category === 'video' ? 'mp4' : 'png'}`;
                            a.click();
                          }}
                          className="absolute bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium shadow-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="relative group rounded-xl overflow-hidden border border-white/20 shadow-2xl">
                      {model.category === 'video' ? (
                        <video src={prediction.output} controls className="w-full" />
                      ) : (
                        <img src={prediction.output} alt="Output" className="w-full" />
                      )}
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = prediction.output as string;
                          a.download = `output-${Date.now()}.${model.category === 'video' ? 'mp4' : 'png'}`;
                          a.click();
                        }}
                        className="absolute bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium shadow-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    </div>
                  )}
                </div>
              )}

              {prediction && prediction.status === 'failed' && (
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex gap-4">
                    <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-400 mb-2">Prediction Failed</p>
                      <p className="text-sm text-red-300">{prediction.error || 'An unknown error occurred'}</p>
                    </div>
                  </div>
                </div>
              )}

              {prediction && (prediction.status === 'starting' || prediction.status === 'processing') && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <svg className="animate-spin w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-neutral-400">Processing your request...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
