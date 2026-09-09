// One-off migration: legacy/senior-prep.html (TOPICS array) -> content/modules/*.json
// Text, code and Bangla are copied verbatim. Only structure changes.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

// Existing files are left alone so hand edits survive. Pass --force to regenerate everything.
const FORCE = process.argv.includes('--force');

const html = readFileSync('legacy/senior-prep.html', 'utf8');
const start = html.indexOf('const PHASES = [');
const end = html.indexOf('const LEITNER_DAYS');
const src = html.slice(start, end);
const { TOPICS } = new Function(`${src}; return { TOPICS };`)();

// legacy id -> { id, track }
const MAP = {
  idx: ['sql-indexes', 'sql'],
  sql2: ['sql-joins-fanout', 'sql'],
  sqlw: ['sql-window-functions', 'sql'],
  sqln: ['sql-schema-design', 'sql'],
  php8: ['php-modern', 'php'],
  oop: ['oop-interface-vs-abstract', 'oop'],
  oop2: ['oop-traits-static-immutability', 'oop'],
  solid: ['oop-solid', 'oop'],
  patt: ['oop-design-patterns', 'oop'],
  loop: ['js-event-loop', 'js-ts'],
  jscore: ['js-closures-this-prototypes', 'js-ts'],
  jsasync: ['js-promises-async', 'js-ts'],
  ts: ['ts-essentials', 'js-ts'],
  http: ['http-rest-caching-cors', 'http-api'],
  git: ['git-merge-rebase-recovery', 'git'],
  n1: ['eloquent-n-plus-one', 'orm'],
  life: ['laravel-request-lifecycle', 'laravel'],
  cont: ['laravel-service-container', 'laravel'],
  elo2: ['eloquent-relations-advanced', 'orm'],
  elo3: ['eloquent-scopes-casts-query-builder', 'orm'],
  valid: ['laravel-validation-resources', 'laravel'],
  auth: ['laravel-auth-policies', 'security-auth'],
  mw: ['laravel-middleware-rate-limiting', 'laravel'],
  queue: ['laravel-queues-jobs', 'laravel'],
  events: ['laravel-events-listeners', 'laravel'],
  cachel: ['laravel-cache-sessions-octane', 'laravel'],
  test: ['laravel-testing-pest', 'laravel'],
  deploy: ['laravel-deploy-zero-downtime', 'cloud-devops'],
  tx: ['sql-transactions-locking', 'sql'],
  idem: ['idempotency-keys-retries', 'payments'],
  cache: ['caching-strategies-stampedes', 'redis'],
  tenant: ['multi-tenancy', 'architecture'],
  api: ['api-design-versioning-webhooks', 'http-api'],
  perf: ['php-profiling-performance', 'laravel'],
  sec: ['security-owasp-laravel', 'security-auth'],
  search: ['search-reporting-replicas', 'sql'],
  dotnet: ['dotnet-parallels', 'dotnet'],
  react: ['react-effects-race-conditions', 'react'],
  state: ['react-state-context-memo', 'react'],
  hooks: ['react-custom-hooks-react-query', 'react'],
  next: ['next-app-router-rendering', 'next'],
  nextapi: ['next-api-routes-auth-caching', 'next'],
  vue: ['vue-reactivity', 'vue-nuxt'],
  vue2: ['vue-composables-pinia', 'vue-nuxt'],
  fe: ['frontend-performance', 'react'],
  node1: ['node-event-loop-streams-workers', 'node'],
  node2: ['node-express-nest-patterns', 'node'],
  py1: ['python-essentials', 'python-llm'],
  py2: ['python-fastapi-cv-scoring', 'python-llm'],
  llm: ['llm-integration', 'python-llm'],
  sd0: ['system-design-method', 'architecture'],
  sd1: ['design-url-shortener-rate-limiter', 'architecture'],
  sd2: ['design-notification-job-scheduler', 'architecture'],
  sd3: ['design-multi-tenant-saas-corebari', 'architecture'],
  sd4: ['design-payments-ledgers', 'payments'],
  sd5: ['design-scaling', 'architecture'],
  arch: ['architecture-monolith-vs-microservices', 'architecture'],
  obs: ['observability', 'cloud-devops'],
  'p-debounce': ['problem-debounce', 'problems'],
  'p-twosum': ['problem-two-sum', 'problems'],
  'p-arr': ['problem-arrays-strings', 'problems'],
  'p-map': ['problem-hash-maps-sets', 'problems'],
  'p-stack': ['problem-stacks-queues-lru', 'problems'],
  'p-rec': ['problem-recursion-trees', 'problems'],
  'p-sql': ['problem-sql', 'problems'],
  'p-refac': ['problem-refactoring', 'problems'],
  aiscr: ['interview-ai-screening', 'interview'],
  behav: ['interview-behavioural-star', 'interview'],
  story: ['stories-your-stories', 'stories'],
  live: ['interview-live-coding', 'interview'],
  nego: ['interview-negotiation', 'interview'],
};

const LANG = { idx: 'sql', sql2: 'sql', n1: 'php', oop: 'php', life: 'php', loop: 'js', 'p-debounce': 'js', 'p-twosum': 'php' };
const SIM = { loop: 'event-loop', sql2: 'join-fanout' };

mkdirSync('content/modules', { recursive: true });
const orderByTrack = {};
let written = 0, skipped = 0;
for (const t of TOPICS) {
  const m = MAP[t.id];
  if (!m) throw new Error(`No mapping for legacy id ${t.id}`);
  const [id, track] = m;
  orderByTrack[track] = (orderByTrack[track] ?? 0) + 1;
  const base = { id, track, phase: t.phase + 1, order: orderByTrack[track], title: t.title };
  let mod;
  if (t.ready) {
    const lesson = {
      picture: t.analogy,
      concept: t.concept,
      right: { lang: LANG[t.id] ?? 'text', code: t.code },
      bn: t.bn,
    };
    if (SIM[t.id]) lesson.simulator = SIM[t.id];
    mod = {
      ...base,
      status: 'unlocked',
      star: true,
      lesson,
      // Solutions are markdown in the new schema; the legacy strings are raw code (+ prose), so fence them.
      practice: (t.practice ?? []).map(([task, solution]) => ({ task, solution: '```' + (LANG[t.id] ?? '') + '\n' + solution + '\n```' })),
      interview: [],
      cards: (t.cards ?? []).map(([q, a]) => ({ q, a })),
      glossary: [],
    };
  } else {
    const [what, picture, why] = t.pre;
    mod = { ...base, status: 'preview', star: false, preview: { what, picture, why, bn: t.bn } };
  }
  const out = `content/modules/${id}.json`;
  if (existsSync(out) && !FORCE) { skipped++; continue; }
  writeFileSync(out, JSON.stringify(mod, null, 2) + '\n');
  written++;
}
console.log(`wrote ${written} modules, skipped ${skipped} existing (${TOPICS.filter((t) => t.ready).length} unlocked in legacy)`);
