import type { TrackId } from './schema';
export type { TrackId };

export const TRACKS: Record<TrackId, string> = {
  php: 'PHP',
  oop: 'OOP',
  sql: 'SQL',
  orm: 'Eloquent & ORMs',
  laravel: 'Laravel',
  symfony: 'Symfony',
  'http-api': 'HTTP & APIs',
  'js-ts': 'JavaScript & TypeScript',
  react: 'React',
  next: 'Next.js',
  'vue-nuxt': 'Vue & Nuxt',
  node: 'Node',
  dotnet: '.NET',
  'python-llm': 'Python & LLMs',
  supabase: 'Supabase',
  architecture: 'Architecture & system design',
  'cloud-devops': 'Cloud, DevOps & Git',
  redis: 'Redis & caching',
  payments: 'Payments',
  'security-auth': 'Security & auth',
  'pwa-offline': 'PWA & offline',
  problems: 'Coding problems',
  interview: 'Interviews',
  stories: 'Your stories',
};

export const TRACK_ORDER = Object.keys(TRACKS) as TrackId[];

/** Phase names, 1-based. Text preserved from the legacy app. */
export const PHASES = [
  'Phase 1 — Foundations (OOP, SQL, JS core, Git)',
  'Phase 2 — Laravel inside out',
  'Phase 3 — Senior backend & data',
  'Phase 4 — React, Next.js, Vue',
  'Phase 5 — Node & Python services',
  'Phase 6 — System design & architecture',
  'Phase 7 — Coding problems (explained, not memorised)',
  'Phase 8 — Interviews: AI screens, behavioural, negotiation',
];

export function phaseName(phase: number): string {
  return PHASES[phase - 1] ?? `Phase ${phase}`;
}

export function phaseShort(phase: number): string {
  return phaseName(phase).split(' — ')[1] ?? phaseName(phase);
}

/** Interview funnels: which tracks belong to each mock-interview funnel. */
export const FUNNELS: Record<'laravel' | 'react-next' | 'dotnet', { name: string; tracks: TrackId[] }> = {
  laravel: {
    name: 'Laravel (primary)',
    tracks: ['php', 'oop', 'sql', 'orm', 'laravel', 'symfony', 'http-api', 'redis', 'payments', 'security-auth', 'architecture', 'cloud-devops', 'problems'],
  },
  'react-next': {
    name: 'React / Next (secondary)',
    tracks: ['js-ts', 'react', 'next', 'vue-nuxt', 'node', 'http-api', 'pwa-offline', 'problems'],
  },
  dotnet: {
    name: '.NET (opportunistic)',
    tracks: ['dotnet', 'oop', 'sql', 'http-api', 'architecture', 'problems'],
  },
};

export type FunnelId = keyof typeof FUNNELS;
