import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Registry: module JSON references a simulator by id; the component lives in src/simulators/<id>.tsx */
export const SIMULATORS: Record<string, LazyExoticComponent<ComponentType>> = {
  'event-loop': lazy(() => import('./event-loop')),
  'join-fanout': lazy(() => import('./join-fanout')),
  'btree-walk': lazy(() => import('./btree-walk')),
  'lock-race': lazy(() => import('./lock-race')),
  'idempotent-retry': lazy(() => import('./idempotent-retry')),
  'cache-stampede': lazy(() => import('./cache-stampede')),
  'react-race': lazy(() => import('./react-race')),
  'vue-reactivity': lazy(() => import('./vue-reactivity')),
  'lru-cache': lazy(() => import('./lru-cache')),
  'queue-backoff': lazy(() => import('./queue-backoff')),
  'tenant-isolation': lazy(() => import('./tenant-isolation')),
  'design-canvas': lazy(() => import('./design-canvas')),
};

/** Listing for More → Simulators. Order follows SIMULATORS.md. */
export const SIM_LIST: { id: string; title: string; story: string; moduleId?: string }[] = [
  { id: 'event-loop', title: 'JavaScript event loop', story: 'A restaurant with one chef: the VIP tray always before the next ticket.', moduleId: 'js-event-loop' },
  { id: 'join-fanout', title: 'JOIN vs EXISTS fan-out', story: 'One order, three items, one bill counted three times.', moduleId: 'sql-joins-fanout' },
  { id: 'btree-walk', title: 'Index lookup vs table scan', story: 'Finding a name in a phone book: a few page-flips, or every page.', moduleId: 'sql-indexes' },
  { id: 'lock-race', title: 'Two users, the last seat', story: 'Read, check, write: without a lock the bus gets oversold.', moduleId: 'sql-transactions-locking' },
  { id: 'idempotent-retry', title: 'Idempotency keys and retries', story: 'Pressing the lift button twice: did you pay twice?', moduleId: 'idempotency-keys-retries' },
  { id: 'cache-stampede', title: 'Cache stampede', story: 'Everyone wants the newspaper the second it sells out.', moduleId: 'caching-strategies-stampedes' },
  { id: 'react-race', title: 'React effect race', story: 'Two coffees, the second arrives first.', moduleId: 'react-effects-race-conditions' },
  { id: 'vue-reactivity', title: 'Vue reactivity', story: 'The spreadsheet cell that stopped updating.', moduleId: 'vue-reactivity' },
  { id: 'lru-cache', title: 'LRU cache', story: 'A small shelf: the least-used item falls off.', moduleId: 'problem-stacks-queues-lru' },
  { id: 'queue-backoff', title: 'Queue retries and backoff', story: 'Re-cooking a failed dish, but not forever.', moduleId: 'laravel-queues-jobs' },
  { id: 'tenant-isolation', title: 'Tenant isolation', story: 'One building, many apartments; whose mail is whose?', moduleId: 'multi-tenancy' },
  { id: 'design-canvas', title: 'Design canvas', story: 'Drawing the building before laying bricks.' },
];

export const PLANNED_SIMULATORS: string[] = [];
