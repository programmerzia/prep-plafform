import type { Module } from '../content/schema';
import { shuffle } from './leitner';

export interface MockQuestion {
  moduleId: string;
  moduleTitle: string;
  q: string;
  model: string;
  missing: string;
  bn: string;
  fromCards: boolean;
}

export const MOCK_MINUTES = 45;
export const MOCK_SIZE = 6;

/**
 * Six questions mixed across the unlocked modules of a track focus: round-robin over
 * shuffled modules so no module dominates. Interview questions first, drill cards as fallback.
 */
export function buildMock(modules: Module[], random: () => number = Math.random, size = MOCK_SIZE): MockQuestion[] {
  const pools = shuffle(
    modules
      .filter((m) => m.status === 'unlocked')
      .map((m) => ({
        m,
        qs: shuffle(
          m.interview.length
            ? m.interview.map((x) => ({ q: x.q, model: x.model, missing: x.missing, bn: x.bn, fromCards: false }))
            : m.cards.map((c) => ({ q: c.q, model: c.a, missing: '', bn: '', fromCards: true })),
          random,
        ),
      }))
      .filter((p) => p.qs.length > 0),
    random,
  );
  const out: MockQuestion[] = [];
  let i = 0;
  while (out.length < size && pools.some((p) => p.qs.length)) {
    const p = pools[i % pools.length];
    const q = p.qs.shift();
    if (q) out.push({ moduleId: p.m.id, moduleTitle: p.m.title, ...q });
    i++;
  }
  return out;
}

export interface ScoredItem {
  moduleId: string;
  moduleTitle: string;
  q: string;
  score: number;
  missing: string;
}

/** Written weak-spot report: average, then modules under 7 with the sentence that was missing. */
export function mockReport(items: ScoredItem[]): { avg: number; text: string } {
  if (!items.length) return { avg: 0, text: 'No questions answered.' };
  const avg = Math.round((items.reduce((s, x) => s + x.score, 0) / items.length) * 10) / 10;
  const byModule = new Map<string, ScoredItem[]>();
  for (const it of items) byModule.set(it.moduleTitle, [...(byModule.get(it.moduleTitle) ?? []), it]);
  const weak = [...byModule.entries()]
    .map(([title, xs]) => ({ title, avg: xs.reduce((s, x) => s + x.score, 0) / xs.length, xs }))
    .filter((x) => x.avg < 7)
    .sort((a, b) => a.avg - b.avg);
  const strong = [...byModule.entries()].filter(([, xs]) => xs.every((x) => x.score >= 7)).map(([t]) => t);
  const lines: string[] = [];
  lines.push(`Average ${avg}/10 across ${items.length} questions. ${avg >= 7 ? 'Hireable-senior level today.' : 'Below the 7 bar — fix the weak spots below before the next mock.'}`);
  if (weak.length) {
    lines.push('');
    lines.push('Weak spots:');
    for (const w of weak) {
      lines.push(`• ${w.title} — ${Math.round(w.avg * 10) / 10}/10`);
      for (const x of w.xs) {
        if (x.score < 7) lines.push(`   ${x.q}${x.missing ? ` → say: "${x.missing}"` : ''}`);
      }
    }
  }
  if (strong.length) {
    lines.push('');
    lines.push(`Solid: ${strong.join(', ')}.`);
  }
  lines.push('');
  lines.push('Next: drill the weak modules until they pass 60%, then re-run this mock in three days.');
  return { avg, text: lines.join('\n') };
}
