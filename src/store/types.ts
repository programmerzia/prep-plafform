import type { CardState } from '../logic/leitner';
import type { SimStats } from '../simulators/kit/stats';

export type Lang = 'en' | 'en-bn';
export type Provider = 'offline' | 'gemini' | 'groq' | 'openrouter';

export interface AiSettings {
  provider: Provider;
  key: string;
  model: string;
}

export interface Settings {
  lang: Lang;
  simple: boolean; // "Explain like I'm 12"
  ai: AiSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en-bn',
  simple: false,
  ai: { provider: 'offline', key: '', model: '' },
};

export interface Streak {
  lastDay: number | null;
  streak: number;
}

export type HistoryEntry =
  | { id?: number; d: number; type: 'drill'; key: string; ok: boolean }
  | { id?: number; d: number; type: 'interview'; moduleId: string; mode: InterviewMode; score: number | null; q: string }
  | { id?: number; d: number; type: 'mock'; focus: string; score: number; items: MockItem[]; report: string };

export type InterviewMode = 'tech' | 'ai' | 'behav';

export interface MockItem {
  moduleId: string;
  q: string;
  score: number;
  missing: string;
}

export interface Story {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  long: string; // 2-minute version
  short: string; // 30-second version
  updated: number;
}

export interface CanvasDoc {
  id: string;
  name: string;
  boxes: CanvasBox[];
  arrows: CanvasArrow[];
  updated: number;
}
export interface CanvasBox { id: string; x: number; y: number; w: number; h: number; label: string }
export interface CanvasArrow { id: string; from: string; to: string; label?: string }

export interface Note {
  id: string; // module id
  text: string;
  updated: number;
}

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  cards: Record<string, CardState>;
  settings: Omit<Settings, 'ai'> & { ai?: AiSettings };
  streak: Streak;
  history: HistoryEntry[];
  stories: Story[];
  canvases: CanvasDoc[];
  notes: Note[];
  simStats?: SimStats;
}
