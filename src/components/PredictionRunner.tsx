import { useState, useEffect, useRef } from 'react';
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
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [filenamePrefix, setFilenamePrefix] = useState(() => {
    return localStorage.getItem('filename_prefix') || 'output';
  });
  const [showFilenameInput, setShowFilenameInput] = useState(false);
  const [tempFilenameInput, setTempFilenameInput] = useState(filenamePrefix);
  const [inputSizeWarning, setInputSizeWarning] = useState('');
  const [maxRetries] = useState(() => {
    const saved = localStorage.getItem('auto_retry_count');
    return saved ? parseInt(saved) : 0;
  });
  const [currentAttemptDisplay, setCurrentAttemptDisplay] = useState(0);
  const [totalAttemptsDisplay, setTotalAttemptsDisplay] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false); // true when waiting between retries
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const shouldStopAfterCurrentRef = useRef(false); // Use ref to access latest value in async callbacks
  const abortControllerRef = useRef<AbortController | null>(null); // Use ref to maintain same controller reference
  const [pricing, setPricing] = useState<string | null>(null);

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

    try {
      localStorage.setItem(`model_state_${modelKey}`, JSON.stringify(cleanedValues));
    } catch (error) {
      console.error('Error saving form values to localStorage:', error);
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        alert('Storage quota exceeded. Form data with large images cannot be saved. Please use fewer or smaller images.');
      }
    }
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirmed = () => {
    const properties = schema?.openapi_schema?.components?.schemas?.Input?.properties || {};
    const defaults: { [key: string]: any } = {};
    Object.keys(properties).forEach((key) => {
      if (properties[key].default !== undefined) {
        defaults[key] = properties[key].default;
      }
    });
    setFormValues(defaults);
    localStorage.removeItem(`model_state_${modelKey}`);
    setShowResetConfirm(false);
  };

  const handleResetCancelled = () => {
    setShowResetConfirm(false);
  };

  const handleFilenameChange = () => {
    setFilenamePrefix(tempFilenameInput);
    localStorage.setItem('filename_prefix', tempFilenameInput);
    setShowFilenameInput(false);
  };

  const handleTempFolderSelect = async () => {
    const electron = (window as any).electron;
    if (electron?.fs?.selectDirectory) {
      const result = await electron.fs.selectDirectory();
      if (result.success && result.path) {
        // Folder changed successfully
      }
    }
  };

  const loadSchema = async (forceRefresh = false) => {
    if (!apiKey) return;

    // Try to load from cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedSchema = localStorage.getItem(`schema_${modelKey}`);
      const cachedPricing = localStorage.getItem(`pricing_${modelKey}`);

      if (cachedSchema) {
        try {
          const modelSchema = JSON.parse(cachedSchema);
          setSchema(modelSchema);

          // Load cached pricing
          if (cachedPricing) {
            setPricing(cachedPricing);
          }

          const properties = modelSchema.openapi_schema?.components?.schemas?.Input?.properties || {};
          const defaults: { [key: string]: any } = {};
          Object.keys(properties).forEach((key) => {
            if (properties[key].default !== undefined) {
              defaults[key] = properties[key].default;
            }
          });
          setFormValues(defaults);
          setLoadingSchema(false);
          return;
        } catch (e) {
          // Cache invalid, continue to fetch
        }
      }
    }

    setLoadingSchema(true);

    try {
      const client = new ReplicateClient(apiKey);
      const modelSchema = await client.getModelSchema(model.owner, model.name);
      setSchema(modelSchema);

      // Cache the schema
      localStorage.setItem(`schema_${modelKey}`, JSON.stringify(modelSchema));

      // Fetch and cache pricing from HTML
      const pricingInfo = await client.getModelPricing(model.owner, model.name);
      if (pricingInfo) {
        setPricing(pricingInfo);
        localStorage.setItem(`pricing_${modelKey}`, pricingInfo);
      }

      const properties = modelSchema.openapi_schema?.components?.schemas?.Input?.properties || {};
      const defaults: { [key: string]: any } = {};
      Object.keys(properties).forEach((key) => {
        if (properties[key].default !== undefined) {
          defaults[key] = properties[key].default;
        }
      });
      setFormValues(defaults);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load model';
      // Show error in Output panel
      setPrediction({
        id: 'schema-error',
        status: 'failed',
        error: `Failed to load model schema: ${errorMsg}`,
        created_at: new Date().toISOString(),
        model: `${model.owner}/${model.name}`,
        input: {},
        output: undefined,
        metrics: undefined
      });
    } finally {
      setLoadingSchema(false);
    }
  };

  // Calculate total size of input images
  const calculateInputSize = (values: { [key: string]: any }): number => {
    let totalSize = 0;

    for (const value of Object.values(values)) {
      if (typeof value === 'string' && value.startsWith('data:')) {
        // Base64 data URL
        const base64 = value.split(',')[1];
        if (base64) {
          // Base64 encoding increases size by ~33%, so decode to get actual size
          totalSize += (base64.length * 3) / 4;
        }
      } else if (Array.isArray(value)) {
        // Array of images
        for (const item of value) {
          if (typeof item === 'string' && item.startsWith('data:')) {
            const base64 = item.split(',')[1];
            if (base64) {
              totalSize += (base64.length * 3) / 4;
            }
          }
        }
      }
    }

    return totalSize;
  };

  const handleStopClick = () => {
    // Always show confirmation dialog
    setShowStopConfirm(true);
  };

  const handleStopConfirmed = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setShowStopConfirm(false);
      shouldStopAfterCurrentRef.current = false;
    }
  };

  const handleStopWait = () => {
    // Wait for current prediction to finish, then stop (no more retries)
    shouldStopAfterCurrentRef.current = true;
    setShowStopConfirm(false);
  };

  const handleRun = async (currentAttempt = 0) => {
    if (!apiKey || !schema) return;

    // Check input size (20MB limit) on first attempt
    if (currentAttempt === 0) {
      const inputSize = calculateInputSize(formValues);
      const sizeMB = (inputSize / (1024 * 1024)).toFixed(2);

      if (inputSize > 20 * 1024 * 1024) {
        setInputSizeWarning(`⚠️ Warning: Input images total ${sizeMB}MB (exceeds 20MB limit). This may cause prediction failures.`);
      } else {
        setInputSizeWarning('');
      }

      // Set total attempts for display
      setTotalAttemptsDisplay(maxRetries + 1);
      // Reset stop flag
      shouldStopAfterCurrentRef.current = false;
    }

    // Create new abort controller (only on first attempt)
    if (currentAttempt === 0) {
      abortControllerRef.current = new AbortController();
    }

    // Use the ref controller for all operations
    const controller = abortControllerRef.current;
    if (!controller) {
      return;
    }

    setLoading(true);
    setIsRetrying(false);
    setCurrentAttemptDisplay(currentAttempt + 1);
    setPrediction(null);

    try {
      // Check if aborted
      if (controller.signal.aborted) {
        throw new Error('Aborted by user');
      }
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

      // Manual polling loop with abort checking
      let finalPred = pred;
      while (
        finalPred.status === 'starting' ||
        finalPred.status === 'processing'
      ) {
        if (controller.signal.aborted) {
          throw new Error('Aborted by user');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (controller.signal.aborted) {
          throw new Error('Aborted by user');
        }

        finalPred = await client.getPrediction(pred.id);
        setPrediction(finalPred);
      }

      // Check if user requested to stop after current attempt (applies to both success and failure)
      if (shouldStopAfterCurrentRef.current) {
        if (finalPred.status === 'succeeded' && finalPred.output) {
          await saveResult({
            predictionId: finalPred.id,
            model: `${model.owner}/${model.name}`,
            input: formValues,
            output: finalPred.output,
            createdAt: Date.now(),
            type: model.category === 'video' ? 'video' : 'image'
          });
          await cleanupOldResults(100);
        }

        setPrediction(finalPred);

        // Cleanup and stop - DO NOT RETRY
        setLoading(false);
        abortControllerRef.current = null;
        setIsRetrying(false);
        setCurrentAttemptDisplay(0);
        setTotalAttemptsDisplay(0);
        shouldStopAfterCurrentRef.current = false;
        return; // IMPORTANT: Exit function, don't continue
      }

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
      } else if (finalPred.status === 'failed' || finalPred.status === 'canceled') {
        // Auto retry on failure if enabled
        if (currentAttempt < maxRetries) {
          const nextAttempt = currentAttempt + 1;
          setIsRetrying(true);

          // Wait 2 seconds before retry (check abort and shouldStopAfterCurrent during wait)
          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 2000);
              controller.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Aborted by user'));
              });
            });
          } catch (abortErr) {
            // Cleanup on abort during retry wait
            setLoading(false);
            abortControllerRef.current = null;
            setIsRetrying(false);
            setCurrentAttemptDisplay(0);
            setTotalAttemptsDisplay(0);
            return;
          }

          // Check if user clicked Wait button during the wait period
          if (shouldStopAfterCurrentRef.current) {
            setLoading(false);
            abortControllerRef.current = null;
            setIsRetrying(false);
            setCurrentAttemptDisplay(0);
            setTotalAttemptsDisplay(0);
            shouldStopAfterCurrentRef.current = false;
            return;
          }

          // Retry with incremented attempt count (don't cleanup, continue with same controller)
          return handleRun(nextAttempt);
        }
      }

      setPrediction(finalPred);

      // Cleanup on successful completion
      setLoading(false);
      abortControllerRef.current = null;
      setIsRetrying(false);
      setCurrentAttemptDisplay(0);
      setTotalAttemptsDisplay(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed';

      // Set prediction with error for display in Output panel
      setPrediction({
        id: 'error',
        status: 'failed',
        error: errorMsg,
        created_at: new Date().toISOString(),
        model: `${model.owner}/${model.name}`,
        input: formValues,
        output: undefined,
        metrics: undefined
      });

      // Auto retry on error (unless aborted)
      if (errorMsg !== 'Aborted by user' && currentAttempt < maxRetries) {
        const nextAttempt = currentAttempt + 1;
        setIsRetrying(true);

        // Wait 2 seconds before retry (check abort and shouldStopAfterCurrent during wait)
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 2000);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Aborted by user'));
            });
          });
        } catch (abortErr) {
          // Cleanup on abort during retry wait
          setLoading(false);
          abortControllerRef.current = null;
          setIsRetrying(false);
          setCurrentAttemptDisplay(0);
          setTotalAttemptsDisplay(0);
          return;
        }

        // Check if user clicked Wait button during the wait period
        if (shouldStopAfterCurrentRef.current) {
          setLoading(false);
          abortControllerRef.current = null;
          setIsRetrying(false);
          setCurrentAttemptDisplay(0);
          setTotalAttemptsDisplay(0);
          shouldStopAfterCurrentRef.current = false;
          return;
        }

        // Retry with incremented attempt count (don't cleanup, continue with same controller)
        return handleRun(nextAttempt);
      }

      // Cleanup on error (not retrying)
      setLoading(false);
      abortControllerRef.current = null;
      setIsRetrying(false);
      setCurrentAttemptDisplay(0);
      setTotalAttemptsDisplay(0);
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
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Parameters
              </h3>
              <button
                onClick={() => loadSchema(true)}
                disabled={loadingSchema}
                className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                title="Refresh schema"
              >
                <svg className={`w-4 h-4 text-white ${loadingSchema ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
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

            {schema && !loadingSchema && (
              <>
                <div className="flex-1 overflow-auto p-5">
                  <DynamicForm
                    schema={schema.openapi_schema?.components?.schemas?.Input?.properties || {}}
                    values={formValues}
                    onChange={saveFormValues}
                    modelKey={modelKey}
                  />
                </div>

                {/* File Settings and Run Button Fixed at Bottom */}
                <div className="p-5 border-t border-white/10 flex-shrink-0 space-y-3">
                  {/* File Settings */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <button
                        onClick={() => {
                          setShowFilenameInput(!showFilenameInput);
                          setTempFilenameInput(filenamePrefix);
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white text-xs rounded-lg hover:bg-white/10 transition-all text-left truncate"
                      >
                        📝 {filenamePrefix}
                      </button>
                      {showFilenameInput && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-neutral-900 border border-white/20 rounded-lg shadow-2xl z-20">
                          <input
                            type="text"
                            value={tempFilenameInput}
                            onChange={(e) => setTempFilenameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFilenameChange();
                              if (e.key === 'Escape') setShowFilenameInput(false);
                            }}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/30 mb-2"
                            placeholder="Filename prefix"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleFilenameChange}
                              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-all"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setShowFilenameInput(false)}
                              className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleTempFolderSelect}
                      className="px-3 py-2 bg-white/5 border border-white/10 text-white text-xs rounded-lg hover:bg-white/10 transition-all whitespace-nowrap"
                      title="Select temp folder"
                    >
                      📁 Temp Folder
                    </button>
                  </div>

                  {inputSizeWarning && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-xs">
                      {inputSizeWarning}
                    </div>
                  )}

                  {loading ? (
                    <div className="space-y-2">
                      {/* Progress indicator - always show when loading */}
                      <div className="text-center text-sm text-white/70">
                        Attempt {currentAttemptDisplay} / {totalAttemptsDisplay}
                        {isRetrying && ' (waiting to retry...)'}
                      </div>
                      <button
                        onClick={handleStopClick}
                        className="w-full px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-xl hover:from-red-500 hover:to-orange-500 transition-all shadow-lg shadow-red-500/20"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Stop
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pricing && (
                        <div className="text-center py-2 px-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <div className="text-xs text-emerald-300/70">Pricing</div>
                          <div className="text-sm font-semibold text-emerald-300">{pricing}</div>
                        </div>
                      )}
                      <button
                        onClick={() => handleRun(0)}
                        disabled={loadingSchema}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                      >
                        ▶ Run Model
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleResetClick}
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
                      <div key={i} className="relative group flex items-center justify-center">
                        {model.category === 'video' ? (
                          <video
                            src={url}
                            controls
                            className="rounded-xl border border-white/20 shadow-2xl"
                            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                          />
                        ) : (
                          <img
                            src={url}
                            alt="Output"
                            onClick={() => setFullscreenImage(url)}
                            className="rounded-xl border border-white/20 shadow-2xl cursor-zoom-in hover:opacity-90 transition-opacity"
                            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                          />
                        )}
                        <button
                          onClick={async () => {
                            const electron = (window as any).electron;
                            if (electron?.fs?.selectDownloadPath) {
                              // Use Electron save dialog
                              const result = await electron.fs.selectDownloadPath();
                              if (result.success && result.path) {
                                // Download file and save to selected path
                                const response = await fetch(url);
                                const blob = await response.blob();
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const base64 = reader.result as string;
                                  await electron.fs.saveFile(result.path, base64);
                                };
                                reader.readAsDataURL(blob);
                              }
                            } else {
                              // Browser fallback
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `output-${Date.now()}-${i}.${model.category === 'video' ? 'mp4' : 'png'}`;
                              a.click();
                            }
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
                    <div className="relative group flex items-center justify-center">
                      {model.category === 'video' ? (
                        <video
                          src={prediction.output}
                          controls
                          className="rounded-xl border border-white/20 shadow-2xl"
                          style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                        />
                      ) : (
                        <img
                          src={prediction.output}
                          alt="Output"
                          onClick={() => setFullscreenImage(prediction.output as string)}
                          className="rounded-xl border border-white/20 shadow-2xl cursor-zoom-in hover:opacity-90 transition-opacity"
                          style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                        />
                      )}
                      <button
                        onClick={async () => {
                          const electron = (window as any).electron;
                          if (electron?.fs?.selectDownloadPath) {
                            // Use Electron save dialog
                            const result = await electron.fs.selectDownloadPath();
                            if (result.success && result.path) {
                              // Download file and save to selected path
                              const response = await fetch(prediction.output as string);
                              const blob = await response.blob();
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const base64 = reader.result as string;
                                await electron.fs.saveFile(result.path, base64);
                              };
                              reader.readAsDataURL(blob);
                            }
                          } else {
                            // Browser fallback
                            const a = document.createElement('a');
                            a.href = prediction.output as string;
                            a.download = `output-${Date.now()}.${model.category === 'video' ? 'mp4' : 'png'}`;
                            a.click();
                          }
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

      {/* Fullscreen Image Modal */}
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
          <img
            src={fullscreenImage}
            alt="Fullscreen"
            onClick={(e) => e.stopPropagation()}
            className="max-w-none max-h-none cursor-default rounded-xl shadow-2xl"
            style={{ maxWidth: 'calc(100vw - 64px)', maxHeight: 'calc(100vh - 56px - 64px)', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Stop Confirmation Modal */}
      {showStopConfirm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleStopWait}
        >
          <div
            className="bg-neutral-900 border border-white/20 rounded-2xl p-6 max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">Stop Prediction?</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  The prediction is currently running. Stopping now may still incur charges from Replicate API.
                </p>
                <ul className="mt-3 text-sm text-neutral-400 space-y-1">
                  <li>• <strong className="text-white">Stop Now</strong>: Abort immediately</li>
                  <li>• <strong className="text-white">Wait</strong>: Complete current attempt, then stop (no more retries)</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStopConfirmed}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all"
              >
                Stop Now
              </button>
              <button
                onClick={handleStopWait}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
              >
                Wait
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleResetCancelled}
        >
          <div
            className="bg-neutral-900 border border-white/20 rounded-2xl p-6 max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">Reset to Default?</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  This will reset all form values to their default settings. Any unsaved changes will be lost.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResetConfirmed}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleResetCancelled}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all border border-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
