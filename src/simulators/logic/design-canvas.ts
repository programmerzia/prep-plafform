import type { CanvasArrow, CanvasBox, CanvasDoc } from '../../store/types';

/** Pure helpers for the design canvas: palette, templates, snapping, undo/redo. */
export const GRID = 20;
export const BOX_W = 150;
export const BOX_H = 60;

export const PALETTE = ['Client', 'LB', 'Web', 'API', 'Worker', 'Queue', 'Cache', 'DB', 'Replica', 'Search', 'CDN', 'Object store', 'External API'] as const;

export const ARROW_LABELS = ['sync', 'async', 'HTTP', 'gRPC', 'SQL', 'queue', 'cache read', 'webhook', 'replication'] as const;

export function snap(v: number, on: boolean, grid = GRID): number {
  return on ? Math.round(v / grid) * grid : v;
}

export interface History {
  past: CanvasDoc[];
  present: CanvasDoc;
  future: CanvasDoc[];
}

export function makeHistory(doc: CanvasDoc): History {
  return { past: [], present: doc, future: [] };
}

/** Commit a new state. Clears the redo stack; keeps at most 50 undo levels. */
export function commit(h: History, next: CanvasDoc): History {
  return { past: [...h.past.slice(-49), h.present], present: next, future: [] };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest };
}

let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function newBox(label: string, index: number, snapOn: boolean): CanvasBox {
  const x = snap(60 + (index % 4) * 200, snapOn);
  const y = snap(60 + Math.floor(index / 4) * 120, snapOn);
  return { id: nid('b'), x, y, w: BOX_W, h: BOX_H, label };
}

export function newArrow(from: string, to: string, label?: string): CanvasArrow {
  return { id: nid('a'), from, to, label };
}

/** Templates: a few starter boxes for the learner, and a full reference answer kept hidden. */
export interface Template {
  id: string;
  name: string;
  brief: string;
  starter: { boxes: string[] };
  reference: { boxes: [string, number, number][]; arrows: [number, number, string][]; notes: string };
}

const b = (label: string, x: number, y: number): [string, number, number] => [label, x, y];

export const TEMPLATES: Template[] = [
  {
    id: 'shortener',
    name: 'URL shortener',
    brief: 'Turn a long URL into a 7-character code; redirect fast; count clicks.',
    starter: { boxes: ['Client', 'API', 'DB'] },
    reference: {
      boxes: [b('Client', 40, 200), b('CDN', 240, 60), b('LB', 240, 200), b('API', 440, 200), b('Cache', 640, 80), b('DB', 640, 220), b('Replica', 840, 220), b('Queue', 640, 360), b('Worker', 840, 360)],
      arrows: [[0, 1, 'HTTP'], [0, 2, 'HTTP'], [2, 3, 'sync'], [3, 4, 'cache read'], [3, 5, 'SQL'], [5, 6, 'replication'], [3, 7, 'async'], [7, 8, 'queue']],
      notes: 'Reads dominate (100:1). Redirect path: cache first, DB on miss. Codes from a counter + base62, or hash + collision check. Clicks go through the queue so the redirect never waits on analytics. Replica serves stats pages.',
    },
  },
  {
    id: 'ratelimiter',
    name: 'Rate limiter',
    brief: 'Allow 100 requests per minute per API key across many web servers.',
    starter: { boxes: ['Client', 'API'] },
    reference: {
      boxes: [b('Client', 40, 200), b('LB', 240, 200), b('Web', 440, 120), b('Web', 440, 280), b('Cache', 700, 200), b('API', 900, 200)],
      arrows: [[0, 1, 'HTTP'], [1, 2, 'sync'], [1, 3, 'sync'], [2, 4, 'INCR + TTL'], [3, 4, 'INCR + TTL'], [2, 5, 'sync'], [3, 5, 'sync']],
      notes: 'The counter must be shared, so it lives in Redis, not in web-server memory. Sliding window or token bucket per key; INCR with an expiring key is the simplest. Fail open or closed when Redis is down is a product decision, say it out loud. Return 429 with Retry-After.',
    },
  },
  {
    id: 'notifications',
    name: 'Notification system',
    brief: 'Send email, SMS and push for order events; never send twice; retry failures.',
    starter: { boxes: ['API', 'Queue', 'Worker'] },
    reference: {
      boxes: [b('API', 40, 200), b('Queue', 260, 200), b('Worker', 480, 80), b('Worker', 480, 200), b('Worker', 480, 320), b('External API', 720, 80), b('External API', 720, 200), b('External API', 720, 320), b('DB', 260, 380), b('Queue', 480, 460)],
      arrows: [[0, 1, 'async'], [1, 2, 'email'], [1, 3, 'sms'], [1, 4, 'push'], [2, 5, 'HTTP'], [3, 6, 'HTTP'], [4, 7, 'HTTP'], [0, 8, 'SQL'], [1, 9, 'dead-letter']],
      notes: 'One event → one queue message per channel. Idempotency key = event id + channel, stored in the DB so a retry cannot send twice. Backoff with a max, then dead-letter. Priorities: OTP before marketing. Provider fallback per channel.',
    },
  },
  {
    id: 'saas',
    name: 'Multi-tenant SaaS',
    brief: 'Many companies on one codebase; data must never leak between them.',
    starter: { boxes: ['Client', 'Web', 'DB'] },
    reference: {
      boxes: [b('Client', 40, 200), b('CDN', 240, 60), b('LB', 240, 200), b('Web', 440, 200), b('Cache', 660, 80), b('DB', 660, 220), b('Object store', 660, 360), b('Queue', 440, 380), b('Worker', 660, 480), b('Search', 880, 220)],
      arrows: [[0, 1, 'HTTP'], [0, 2, 'HTTP'], [2, 3, 'sync'], [3, 4, 'tenant:key'], [3, 5, 'RLS / tenant_id'], [3, 6, 'tenant prefix'], [3, 7, 'async'], [7, 8, 'queue'], [8, 9, 'index'], [8, 5, 'SQL']],
      notes: 'Tenant resolved from subdomain in middleware, then carried everywhere: cache key prefix, storage path prefix, queue payload, and a DB scope or RLS. Shared schema first; move noisy tenants to their own DB later. Per-tenant rate limits and backups.',
    },
  },
];

export function templateStarter(t: Template, snapOn: boolean): CanvasDoc {
  return {
    id: `c-${t.id}-${Date.now()}`,
    name: t.name,
    boxes: t.starter.boxes.map((label, i) => newBox(label, i, snapOn)),
    arrows: [],
    notes: `Brief: ${t.brief}\n\nRequirements:\n\nEstimate:\n\nBottleneck:\n\nTrade-off:`,
    updated: Date.now(),
  };
}

export function templateReference(t: Template): CanvasDoc {
  const boxes = t.reference.boxes.map(([label, x, y]) => ({ id: nid('r'), x, y, w: BOX_W, h: BOX_H, label }));
  const arrows = t.reference.arrows.map(([from, to, label]) => newArrow(boxes[from].id, boxes[to].id, label));
  return { id: `ref-${t.id}`, name: `${t.name} — reference`, boxes, arrows, notes: t.reference.notes, updated: Date.now() };
}

/** Talk-through prompts, in the order a design interview expects them. */
export const TALK_PROMPTS = [
  { title: 'Requirements', hint: 'Who uses it, how many, what must never happen? Ask two clarifying questions out loud.' },
  { title: 'Estimate', hint: 'Requests per second, storage per year, read/write ratio. Rough numbers, said with confidence.' },
  { title: 'Sketch', hint: 'Draw the happy path first: client → entry → service → data. Name each box.' },
  { title: 'Bottleneck', hint: 'Point at the box that breaks first at 10× load. Say what you would measure to prove it.' },
  { title: 'Trade-off', hint: 'One thing you chose, what it cost, and when you would choose differently.' },
];
export const TALK_SECONDS = 120;
