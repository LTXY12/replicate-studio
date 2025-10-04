import Dexie, { type Table } from 'dexie';
import type { SavedResult } from '../types';

export class ResultDatabase extends Dexie {
  results!: Table<SavedResult, string>;

  constructor() {
    super('ReplicateResults');
    this.version(1).stores({
      results: 'id, predictionId, model, createdAt, type'
    });
  }
}

export const db = new ResultDatabase();

export const saveResult = async (result: Omit<SavedResult, 'id'>): Promise<string> => {
  const id = crypto.randomUUID();
  await db.results.add({ ...result, id });
  return id;
};

export const getResults = async (
  filter?: { type?: 'image' | 'video'; model?: string }
): Promise<SavedResult[]> => {
  let query = db.results.orderBy('createdAt').reverse();

  const results = await query.toArray();

  if (filter) {
    return results.filter(r => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.model && r.model !== filter.model) return false;
      return true;
    });
  }

  return results;
};

export const deleteResult = async (id: string): Promise<void> => {
  await db.results.delete(id);
};

export const getResult = async (id: string): Promise<SavedResult | undefined> => {
  return db.results.get(id);
};
