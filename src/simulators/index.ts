import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Registry: module JSON references a simulator by id; the component lives in src/simulators/<id>.tsx */
export const SIMULATORS: Record<string, LazyExoticComponent<ComponentType>> = {
  'event-loop': lazy(() => import('./event-loop')),
  'join-fanout': lazy(() => import('./join-fanout')),
  'design-canvas': lazy(() => import('./design-canvas')),
};

/** Listing for More → Simulators. Order follows SIMULATORS.md. */
export const SIM_LIST: { id: string; title: string; story: string; moduleId?: string }[] = [
  { id: 'event-loop', title: 'JavaScript event loop', story: 'A restaurant with one chef: the VIP tray always before the next ticket.', moduleId: 'js-event-loop' },
  { id: 'join-fanout', title: 'JOIN vs EXISTS fan-out', story: 'One order, three items, one bill counted three times.', moduleId: 'sql-joins-fanout' },
  { id: 'design-canvas', title: 'Design canvas', story: 'Drawing the building before laying bricks.' },
];

export const PLANNED_SIMULATORS = [
  'btree-walk', 'lock-race', 'idempotent-retry', 'cache-stampede', 'react-race',
  'vue-reactivity', 'lru-cache', 'queue-backoff', 'tenant-isolation',
];
