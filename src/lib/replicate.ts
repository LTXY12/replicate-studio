import type { Prediction, PredictionInput, ModelSchema } from '../types';

const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : 'https://api.replicate.com/v1';

export class ReplicateClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private getHeaders(): HeadersInit {
    // Use proxy in development
    if (import.meta.env.DEV) {
      return {
        'X-API-Key': this.apiToken,
        'Content-Type': 'application/json'
      } as HeadersInit;
    }

    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    } as HeadersInit;
  }

  async createPrediction(
    model: string,
    input: PredictionInput
  ): Promise<Prediction> {
    const response = await fetch(`${API_BASE}/predictions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        version: model,
        input
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create prediction');
    }

    return response.json();
  }

  async getPrediction(id: string): Promise<Prediction> {
    const response = await fetch(`${API_BASE}/predictions/${id}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get prediction');
    }

    return response.json();
  }

  async waitForPrediction(
    id: string,
    onUpdate?: (prediction: Prediction) => void
  ): Promise<Prediction> {
    let prediction = await this.getPrediction(id);

    while (
      prediction.status === 'starting' ||
      prediction.status === 'processing'
    ) {
      onUpdate?.(prediction);
      await new Promise(resolve => setTimeout(resolve, 1000));
      prediction = await this.getPrediction(id);
    }

    onUpdate?.(prediction);
    return prediction;
  }

  async getModelVersion(owner: string, name: string): Promise<string> {
    const response = await fetch(
      `${API_BASE}/models/${owner}/${name}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error('Failed to get model info');
    }

    const data = await response.json();
    return data.latest_version?.id || '';
  }

  async getModelSchema(owner: string, name: string): Promise<ModelSchema> {
    // First get the model to find the latest version
    const modelResponse = await fetch(
      `${API_BASE}/models/${owner}/${name}`,
      { headers: this.getHeaders() }
    );

    if (!modelResponse.ok) {
      const error = await modelResponse.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to get model info');
    }

    const modelData = await modelResponse.json();
    const versionId = modelData.latest_version?.id;

    if (!versionId) {
      throw new Error('No version found for this model');
    }

    // Then get the version details with schema
    const versionResponse = await fetch(
      `${API_BASE}/models/${owner}/${name}/versions/${versionId}`,
      { headers: this.getHeaders() }
    );

    if (!versionResponse.ok) {
      const error = await versionResponse.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to get version details');
    }

    const versionData = await versionResponse.json();

    // Override the id with the actual version id from the model
    return {
      ...versionData,
      id: versionId
    };
  }

  async getCollectionModels(collectionSlug: string): Promise<any[]> {
    const response = await fetch(
      `${API_BASE}/collections/${collectionSlug}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to get collection');
    }

    const data = await response.json();
    return data.models || [];
  }

  async getModelPricing(owner: string, name: string): Promise<string | null> {
    try {
      const url = `https://replicate.com/${owner}/${name}`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const html = await response.text();

      // Try to find pricing in JSON data embedded in <script> tag
      const scriptMatch = html.match(/<script[^>]*>(\{"billingConfig".*?\})<\/script>/);
      if (scriptMatch) {
        try {
          const jsonData = JSON.parse(scriptMatch[1]);
          const prices = jsonData.billingConfig?.current_tiers?.[0]?.prices?.[0];
          if (prices) {
            const mainPrice = `${prices.price} ${prices.title}`;
            const additionalInfo = prices.description ? ` (${prices.description})` : '';
            return mainPrice + additionalInfo;
          }
        } catch (e) {
          // JSON parse failed, continue to fallback
        }
      }

      // Fallback: Look for pricing text pattern in HTML
      // Match per-second pricing or other pricing patterns
      const pricingPattern = /\$[\d.]+\s+per\s+[^<]+(?:\s+or\s+around\s+\d+\s+images\s+for\s+\$1)?/i;
      const match = html.match(pricingPattern);

      if (match) {
        return match[0].trim();
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch model pricing:', error);
      return null;
    }
  }
}
