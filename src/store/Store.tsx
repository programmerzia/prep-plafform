import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { grade, freshCard, todayNumber, touchStreak as bumpStreak, type CardState } from '../logic/leitner';
import * as dbApi from './db';
import {
  DEFAULT_SETTINGS,
  type CanvasDoc,
  type ExportBundle,
  type HistoryEntry,
  type Note,
  type Settings,
  type Story,
  type Streak,
} from './types';

interface StoreValue {
  ready: boolean;
  cards: Record<string, CardState>;
  settings: Settings;
  streak: Streak;
  history: HistoryEntry[];
  stories: Story[];
  canvases: CanvasDoc[];
  notes: Note[];
  gradeCard: (key: string, ok: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  record: (entry: HistoryEntry) => Promise<void>;
  saveStory: (s: Story) => Promise<void>;
  removeStory: (id: string) => Promise<void>;
  saveCanvas: (c: CanvasDoc) => Promise<void>;
  removeCanvas: (id: string) => Promise<void>;
  saveNote: (n: Note) => Promise<void>;
  exportBundle: () => ExportBundle;
  importBundle: (b: ExportBundle) => Promise<void>;
  resetProgress: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [streak, setStreak] = useState<Streak>({ lastDay: null, streak: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [canvases, setCanvases] = useState<CanvasDoc[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    let alive = true;
    dbApi
      .loadAll()
      .then((d) => {
        if (!alive) return;
        setCards(d.cards);
        setSettings({ ...DEFAULT_SETTINGS, ...(d.settings ?? {}), ai: { ...DEFAULT_SETTINGS.ai, ...(d.settings?.ai ?? {}) } });
        setStreak(d.streak ?? { lastDay: null, streak: 0 });
        setHistory(d.history);
        setStories(d.stories);
        setCanvases(d.canvases);
        setNotes(d.notes);
      })
      .catch((e) => console.error('IndexedDB unavailable', e))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const touch = useCallback(async () => {
    const next = bumpStreak(streak, todayNumber());
    setStreak(next);
    await dbApi.putKv('streak', next);
  }, [streak]);

  const gradeCard = useCallback(
    async (key: string, ok: boolean) => {
      const today = todayNumber();
      const next = grade(cards[key] ?? freshCard(), ok, today);
      setCards((c) => ({ ...c, [key]: next }));
      const entry: HistoryEntry = { d: today, type: 'drill', key, ok };
      setHistory((h) => [...h, entry]);
      await Promise.all([dbApi.putCard(key, next), dbApi.addHistory(entry), touch()]);
    },
    [cards, touch],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch, ai: { ...settings.ai, ...(patch.ai ?? {}) } };
      setSettings(next);
      await dbApi.putKv('settings', next);
    },
    [settings],
  );

  const record = useCallback(
    async (entry: HistoryEntry) => {
      setHistory((h) => [...h, entry]);
      await Promise.all([dbApi.addHistory(entry), touch()]);
    },
    [touch],
  );

  const saveStory = useCallback(async (s: Story) => {
    setStories((list) => [...list.filter((x) => x.id !== s.id), s].sort((a, b) => b.updated - a.updated));
    await dbApi.putStory(s);
  }, []);
  const removeStory = useCallback(async (id: string) => {
    setStories((list) => list.filter((x) => x.id !== id));
    await dbApi.deleteStory(id);
  }, []);
  const saveCanvas = useCallback(async (c: CanvasDoc) => {
    setCanvases((list) => [...list.filter((x) => x.id !== c.id), c].sort((a, b) => b.updated - a.updated));
    await dbApi.putCanvas(c);
  }, []);
  const removeCanvas = useCallback(async (id: string) => {
    setCanvases((list) => list.filter((x) => x.id !== id));
    await dbApi.deleteCanvas(id);
  }, []);
  const saveNote = useCallback(async (n: Note) => {
    setNotes((list) => [...list.filter((x) => x.id !== n.id), n]);
    await dbApi.putNote(n);
  }, []);

  const exportBundle = useCallback(
    (): ExportBundle => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      cards,
      // The API key never leaves the device, even in an export.
      settings: { lang: settings.lang, simple: settings.simple },
      streak,
      history,
      stories,
      canvases,
      notes,
    }),
    [cards, settings, streak, history, stories, canvases, notes],
  );

  const importBundle = useCallback(
    async (b: ExportBundle) => {
      if (b.version !== 1 || typeof b.cards !== 'object') throw new Error('Not a progress file from this app.');
      const nextSettings: Settings = {
        ...settings,
        lang: b.settings?.lang ?? settings.lang,
        simple: b.settings?.simple ?? settings.simple,
      };
      const data = {
        cards: b.cards ?? {},
        history: b.history ?? [],
        stories: b.stories ?? [],
        canvases: b.canvases ?? [],
        notes: b.notes ?? [],
        streak: b.streak ?? { lastDay: null, streak: 0 },
        settings: nextSettings,
      };
      await dbApi.replaceAll(data);
      const fresh = await dbApi.loadAll();
      setCards(fresh.cards);
      setHistory(fresh.history);
      setStories(fresh.stories);
      setCanvases(fresh.canvases);
      setNotes(fresh.notes);
      setStreak(data.streak);
      setSettings(nextSettings);
    },
    [settings],
  );

  const resetProgress = useCallback(async () => {
    await dbApi.clearProgress();
    setCards({});
    setHistory([]);
    setStreak({ lastDay: null, streak: 0 });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready, cards, settings, streak, history, stories, canvases, notes,
      gradeCard, updateSettings, record, saveStory, removeStory, saveCanvas, removeCanvas, saveNote,
      exportBundle, importBundle, resetProgress,
    }),
    [ready, cards, settings, streak, history, stories, canvases, notes, gradeCard, updateSettings, record, saveStory, removeStory, saveCanvas, removeCanvas, saveNote, exportBundle, importBundle, resetProgress],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
