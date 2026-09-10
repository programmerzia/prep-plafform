/** Prediction accuracy per simulator. Pure helpers; storage lives in the store. */
export interface SimStat {
  asked: number;
  hits: number;
}

export type SimStats = Record<string, SimStat>;

export function recordPrediction(stats: SimStats, id: string, hit: boolean): SimStats {
  const cur = stats[id] ?? { asked: 0, hits: 0 };
  return { ...stats, [id]: { asked: cur.asked + 1, hits: cur.hits + (hit ? 1 : 0) } };
}

/** Percentage 0..100, or null when nothing has been predicted yet. */
export function hitRate(stat: SimStat | undefined): number | null {
  if (!stat || stat.asked === 0) return null;
  return Math.round((100 * stat.hits) / stat.asked);
}

export function overallHitRate(stats: SimStats): number | null {
  const all = Object.values(stats).reduce((a, s) => ({ asked: a.asked + s.asked, hits: a.hits + s.hits }), { asked: 0, hits: 0 });
  return hitRate(all);
}

/** Auto-play delay in ms for a speed multiplier. */
export function playDelay(speed: number, reducedMotion = false): number {
  const base = reducedMotion ? 1600 : 1200;
  return Math.round(base / speed);
}
