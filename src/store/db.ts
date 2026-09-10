import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CardState } from '../logic/leitner';
import type { CanvasDoc, HistoryEntry, Note, Settings, Story, Streak } from './types';
import type { SimStats } from '../simulators/kit/stats';

interface PrepDB extends DBSchema {
  cards: { key: string; value: CardState & { key: string } };
  kv: { key: string; value: unknown };
  history: { key: number; value: HistoryEntry; indexes: { d: number } };
  stories: { key: string; value: Story };
  canvases: { key: string; value: CanvasDoc };
  notes: { key: string; value: Note };
}

let dbPromise: Promise<IDBPDatabase<PrepDB>> | null = null;

export function db(): Promise<IDBPDatabase<PrepDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PrepDB>('prep-platform', 1, {
      upgrade(d) {
        d.createObjectStore('cards', { keyPath: 'key' });
        d.createObjectStore('kv');
        const h = d.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        h.createIndex('d', 'd');
        d.createObjectStore('stories', { keyPath: 'id' });
        d.createObjectStore('canvases', { keyPath: 'id' });
        d.createObjectStore('notes', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function loadAll() {
  const d = await db();
  const [cardRows, settings, streak, history, stories, canvases, notes, simStats] = await Promise.all([
    d.getAll('cards'),
    d.get('kv', 'settings') as Promise<Settings | undefined>,
    d.get('kv', 'streak') as Promise<Streak | undefined>,
    d.getAll('history'),
    d.getAll('stories'),
    d.getAll('canvases'),
    d.getAll('notes'),
    d.get('kv', 'simStats') as Promise<SimStats | undefined>,
  ]);
  const cards: Record<string, CardState> = {};
  for (const row of cardRows) {
    const { key, ...state } = row;
    cards[key] = state;
  }
  return { cards, settings, streak, history, stories, canvases, notes, simStats };
}

export async function putCard(key: string, state: CardState) {
  await (await db()).put('cards', { key, ...state });
}
export async function putKv(key: string, value: unknown) {
  await (await db()).put('kv', value, key);
}
export async function addHistory(entry: HistoryEntry): Promise<number> {
  return (await db()).add('history', entry) as Promise<number>;
}
export async function putStory(s: Story) {
  await (await db()).put('stories', s);
}
export async function deleteStory(id: string) {
  await (await db()).delete('stories', id);
}
export async function putCanvas(c: CanvasDoc) {
  await (await db()).put('canvases', c);
}
export async function deleteCanvas(id: string) {
  await (await db()).delete('canvases', id);
}
export async function putNote(n: Note) {
  await (await db()).put('notes', n);
}

export async function clearProgress() {
  const d = await db();
  const tx = d.transaction(['cards', 'history', 'kv'], 'readwrite');
  await Promise.all([tx.objectStore('cards').clear(), tx.objectStore('history').clear(), tx.objectStore('kv').delete('streak'), tx.objectStore('kv').delete('simStats')]);
  await tx.done;
}

export async function replaceAll(data: {
  cards: Record<string, CardState>;
  history: HistoryEntry[];
  stories: Story[];
  canvases: CanvasDoc[];
  notes: Note[];
  streak: Streak;
  settings: Settings;
  simStats: SimStats;
}) {
  const d = await db();
  const tx = d.transaction(['cards', 'history', 'kv', 'stories', 'canvases', 'notes'], 'readwrite');
  await Promise.all([
    tx.objectStore('cards').clear(),
    tx.objectStore('history').clear(),
    tx.objectStore('stories').clear(),
    tx.objectStore('canvases').clear(),
    tx.objectStore('notes').clear(),
  ]);
  for (const [key, state] of Object.entries(data.cards)) await tx.objectStore('cards').put({ key, ...state });
  for (const h of data.history) {
    const { id: _id, ...rest } = h;
    void _id;
    await tx.objectStore('history').add(rest as HistoryEntry);
  }
  for (const s of data.stories) await tx.objectStore('stories').put(s);
  for (const c of data.canvases) await tx.objectStore('canvases').put(c);
  for (const n of data.notes) await tx.objectStore('notes').put(n);
  await tx.objectStore('kv').put(data.streak, 'streak');
  await tx.objectStore('kv').put(data.settings, 'settings');
  await tx.objectStore('kv').put(data.simStats, 'simStats');
  await tx.done;
}
