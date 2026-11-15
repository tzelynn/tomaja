import type { ItemId } from './content-types';

export type Rating = 'again' | 'hard' | 'good';

/** Per-item progress. Opaque `card` is the scheduler's JSON card. */
export interface ItemState {
  itemId: ItemId;
  card: {
    stability: number;
    dueAt: string;
    scheduledDays: number;
    reps: number;
    lapses: number;
    [k: string]: unknown;
  };
  /** ms epoch of the last scheduler review; 0 if never. The merge key. */
  lastReview: number;
  /** ms epoch when the item was first planted (lesson completed). */
  plantedAt: number;
  lastRating: Rating;
  /** Tomatoes earned from this item. */
  tomatoes: number;
  ripenedAt: number | null;
}

export interface Settings {
  newPerDay: number;
  audio: boolean;
  romajiHelp: boolean;
}

export const DEFAULT_SETTINGS: Settings = { newPerDay: 10, audio: true, romajiHelp: true };

export interface ProfileBlob {
  data: Settings;
  updatedAt: number;
}

export interface SyncRequest {
  cursor: number;
  items: ItemState[];
  days: string[];
  profile?: ProfileBlob;
}

export interface SyncResponse {
  cursor: number;
  items: ItemState[];
  days: string[];
  profile?: ProfileBlob;
}

export const SYNC_LIMITS = {
  maxItemsPerRequest: 500,
  maxBodyBytes: 256 * 1024,
  maxStateBytes: 1024,
  maxDaysPerRequest: 4000,
} as const;

export const ITEM_ID_PATTERN = /^[a-z]:[^\s]{1,40}$/u;
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Merge rule shared by client and server: greater lastReview wins whole. */
export function newerItem(a: ItemState | undefined, b: ItemState): boolean {
  return !a || b.lastReview > a.lastReview;
}
