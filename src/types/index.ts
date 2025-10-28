export interface ReplicateModel {
  owner: string;
  name: string;
  description: string;
  runs: string;
  category: 'image' | 'video' | 'edit';
  version?: string;
  pricing?: string;
}

export interface ModelSchema {
  id: string;
  created_at: string;
  cog_version: string;
  openapi_schema: {
    components: {
      schemas: {
        Input: {
          type: string;
          properties: {
            [key: string]: SchemaProperty;
          };
          required?: string[];
        };
        Output: any;
      };
    };
  };
}

export interface SchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  format?: string;
  allOf?: any[];
  'x-order'?: number;
}

export interface PredictionInput {
  [key: string]: any;
}

export interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: PredictionInput;
  output?: string | string[];
  error?: string;
  metrics?: {
    predict_time?: number;
  };
  created_at: string;
  model: string;
}

export interface SavedResult {
  id: string;
  predictionId: string;
  model: string;
  input: PredictionInput;
  output: string | string[];
  thumbnail?: string;
  createdAt: number;
  type: 'image' | 'video';
}
