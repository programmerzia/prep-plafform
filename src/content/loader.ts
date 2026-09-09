import { parseModule, type Module, type Card } from './schema';
import { TRACK_ORDER } from './tracks';

// One JSON file = one module. Dropping a new file in content/modules is enough.
const files = import.meta.glob('../../content/modules/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

function load(): Module[] {
  const seen = new Set<string>();
  const list: Module[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const mod = parseModule(raw, path);
    if (seen.has(mod.id)) throw new Error(`Duplicate module id "${mod.id}" in ${path}`);
    seen.add(mod.id);
    list.push(mod);
  }
  return list.sort(byPath);
}

/** Path order: phase, then track order, then order within the track. */
export function byPath(a: Module, b: Module): number {
  if (a.phase !== b.phase) return a.phase - b.phase;
  const ta = TRACK_ORDER.indexOf(a.track);
  const tb = TRACK_ORDER.indexOf(b.track);
  if (ta !== tb) return ta - tb;
  return a.order - b.order;
}

export const MODULES: Module[] = load();
export const MODULE_BY_ID: Record<string, Module> = Object.fromEntries(MODULES.map((m) => [m.id, m]));

export function getModule(id: string | undefined): Module | undefined {
  return id ? MODULE_BY_ID[id] : undefined;
}

export const UNLOCKED: Module[] = MODULES.filter((m) => m.status === 'unlocked');

export interface CardRef {
  key: string;
  moduleId: string;
  moduleTitle: string;
  q: string;
  a: string;
}

export function cardKey(moduleId: string, index: number): string {
  return `${moduleId}:${index}`;
}

export function cardsOf(m: Module): CardRef[] {
  return m.cards.map((c: Card, i) => ({ key: cardKey(m.id, i), moduleId: m.id, moduleTitle: m.title, q: c.q, a: c.a }));
}

export const ALL_CARDS: CardRef[] = UNLOCKED.flatMap(cardsOf);

export function modulesInTrack(track: string): Module[] {
  return MODULES.filter((m) => m.track === track).sort((a, b) => a.order - b.order);
}
