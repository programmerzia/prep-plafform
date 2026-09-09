import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Registry: module JSON references a simulator by id; the component lives in src/simulators/<id>.tsx */
export const SIMULATORS: Record<string, LazyExoticComponent<ComponentType>> = {
  'event-loop': lazy(() => import('./event-loop')),
  'join-fanout': lazy(() => import('./join-fanout')),
  'design-canvas': lazy(() => import('./design-canvas')),
};

export const PLANNED_SIMULATORS = [
  'btree-walk', 'lock-race', 'idempotent-retry', 'cache-stampede', 'react-race',
  'vue-reactivity', 'lru-cache', 'queue-backoff', 'tenant-isolation',
];
