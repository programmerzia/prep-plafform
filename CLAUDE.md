# prep-platform — CLAUDE.md

Personal learning platform for Md. Ziaur Rahman (senior full-stack engineer, Bangladesh) preparing for
senior remote roles across three funnels: Laravel (primary), React/Next (secondary), .NET (opportunistic).
Mentoring sessions happen in Claude chat; this repo is where finished content and practice live.
The learner is rebuilding from fundamentals, retains through practice not reading, needs concrete
real-life explanations, Bangla summaries, and answers hidden until he has tried. He studies mostly on
his phone. Nothing here is a demo — it is his only study environment.

## Stack (do not change without asking)
- Vite + React 18 + TypeScript, React Router, Tailwind CSS
- PWA via vite-plugin-pwa (installable, offline-first, precache app shell + all content)
- State/persistence: IndexedDB through `idb` (progress, drill schedule, settings, stories, notes)
- Content: static JSON in `content/modules/*.json` loaded at build time (Vite glob import). One file = one module.
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` on push to main. `base` in vite.config must be `/prep-platform/`.
- No backend. AI calls go straight from the browser to Gemini / Groq / OpenRouter using a key the user pastes (stored on device only). Offline mode must work with zero network.
- Tests: Vitest for pure logic (spaced repetition, content validation). No test theatre.

## Non-negotiable UX rules
- Mobile-first: 380px wide is the primary viewport. Bottom tab bar. Thumb-sized buttons (min 44px). No dropdowns for choosing topics — use tappable chips/lists.
- Every answer, solution, and model answer is hidden until the user taps "Show". Never render solutions expanded by default.
- Bangla appears everywhere a summary appears. Global toggle: EN / EN+BN. Bangla text uses a font that renders Bengali cleanly (Noto Sans Bengali via CSS, self-hosted in /public/fonts).
- Code blocks scroll horizontally; never wrap code. Font size ≥ 13.5px.
- Simulators are React components in `src/simulators/<id>.tsx`, referenced from a module by id. They must work by touch.
- Plain language in all UI. No jargon in labels.
- Dark mode follows system preference.

## Screens (bottom tabs)
1. **Today** — cards due, streak, "Your path" (next module, weak modules under 60%), 10-minute mobile mode button (drill 8 cards + 1 interview question), daily rhythm in EN and BN.
2. **Learn** — tracks → modules. Locked modules show preview (what / picture / why interviewers ask / Bangla). Unlocked modules show the full lesson (see module schema). "Explain like I'm 12" toggle swaps `lesson.simple` for `lesson.concept`.
3. **Practice** — tasks per module; run locally on his machine; hidden solutions with explanation.
4. **Drill** — spaced repetition. Leitner boxes with intervals [0,1,3,7,21,60] days. "Got it" moves up a box; "Missed" resets to box 0 and increments miss count. Weak spots = most-missed cards.
5. **Interview** — pick module + style (technical / AI-screen / behavioural). AI provider chosen in settings; offline mode shows a question from the module's `interview` list, then model answer + "the sentence you're missing", user self-scores 1–10. AI-screen mode adds a 90-second timer and grades structure (context → decision → trade-off → outcome).
6. **Mock** — 45-minute timed mock per funnel: 6 questions mixed across unlocked modules, scores recorded, written weak-spot report.
7. **More** — Design canvas (draggable labelled boxes + arrows, save/load PNG/JSON), Stories (STAR stories, 2-min and 30-sec versions, rehearsal mode that hides text after 3 seconds), Cheat sheets (one page per track, printable), Glossary (term / plain meaning / Bangla / module link), Progress (mastery per track, mock history), Settings (AI provider + key, language, export/import progress JSON, reset).

Mastery per module = average box level of its cards / 5. A module is "passed" when the mentor marks `status: "unlocked"` in the JSON AND mastery ≥ 60%.

## Content module schema (`content/modules/<id>.json`)
```json
{
  "id": "sql-indexes",
  "track": "sql",                         // see tracks below
  "phase": 1,                             // 1..8 order on the path
  "order": 1,                             // order within track
  "title": "Database indexes",
  "status": "unlocked",                   // "preview" | "unlocked"
  "star": true,                           // inside the 60-day window
  "preview": { "what": "", "picture": "", "why": "", "bn": "" },
  "lesson": {
    "problem": "",                        // the real situation first
    "picture": "",                        // real-life analogy
    "hook": "",                           // one memorable sentence
    "concept": "",                        // markdown, full explanation
    "simple": "",                         // markdown, "explain like I'm 12" version, different analogy
    "wrong": { "lang": "sql", "code": "", "why": "" },
    "right": { "lang": "sql", "code": "", "why": "" },
    "bn": "",                             // Bangla summary
    "crossStack": [ { "concept": "", "laravel": "", "symfony": "", "dotnet": "", "node": "" } ],
    "simulator": "join-fanout",           // optional, id of src/simulators/<id>.tsx
    "docs": [ { "label": "", "url": "" } ] // official docs only, at most 3
  },
  "practice": [ { "task": "", "hint": "", "solution": "", "why": "" } ],
  "interview": [ { "q": "", "model": "", "missing": "", "followUp": "", "bn": "" } ],
  "cards": [ { "q": "", "a": "" } ],
  "glossary": [ { "term": "", "plain": "", "bn": "" } ]
}
```
All markdown fields render with a markdown component (code fences, bold, lists). Validate every module at build time with a Zod schema in `src/content/schema.ts`; fail the build on invalid content.

## Tracks (ids and display names)
php, oop, sql, orm, laravel, symfony, http-api, js-ts, react, next, vue-nuxt, node, dotnet, python-llm, supabase, architecture, cloud-devops, redis, payments, security-auth, pwa-offline, problems, interview, stories

## Simulators to implement (in this order; each is one component, touch-friendly, ≤ 380px)
event-loop (call stack / microtask / macrotask stepper), join-fanout (JOIN vs EXISTS row builder), btree-walk (index lookup vs table scan step counter), lock-race (two users buying the last seat, with/without SELECT FOR UPDATE), idempotent-retry (same request twice, with/without key), cache-stampede (requests hitting an expired key, with/without lock), react-race (two fetches resolving out of order, with/without cleanup), vue-reactivity (destructure loses reactivity), lru-cache (capacity 3, step through gets/sets), queue-backoff (retries with exponential backoff and a dead-letter), tenant-isolation (rows filtered by tenant_id / RLS policy), design-canvas.

## Migration
`legacy/senior-prep.html` contains the first 8 finished modules and two simulators as inline JS (`TOPICS` array, `demoLoop`, `demoJoin`). Migrate their content into module JSON files and the two simulators into React components. Preserve all text, code and Bangla exactly.

Done (2026-09-09) by `scripts/migrate-legacy.mjs`; `src/content/content.test.ts` checks every migrated string against the legacy file. Re-running the script overwrites the 71 generated files, so once a module is hand-edited, do not re-run it.

## Decisions made while scaffolding (2026-09-09)
- Schema leniency: only `id/track/phase/order/title/status` are required. Unlocked modules must have `lesson.concept`, `lesson.bn` and ≥1 card; preview modules must have `preview`. `problem/hook/simple/wrong/right/crossStack/docs/interview/glossary` are optional with empty defaults, because the migrated modules lack them. The lesson page hides empty sections; `right` alone renders under the heading "Code".
- Offline interview falls back to the module's drill cards when its `interview` list is empty (legacy behaviour). Mock does the same.
- Legacy `phase` was 0-based; JSON uses 1..8. Phase names live in `src/content/tracks.ts`. Path order = phase → track order → `order`.
- Legacy `git` topic lives in the `cloud-devops` track; `auth`/`sec` in `security-auth`; `idem`/`sd4` in `payments`; `cache` in `redis`.
- Routing: BrowserRouter with `basename` from `BASE_URL`; the Pages workflow copies `index.html` to `404.html` for deep links.
- Simulators are registered in `src/simulators/index.ts` (id → lazy component); a module referencing an unknown id renders nothing rather than failing the build.
- The AI key is stored in IndexedDB settings and is excluded from progress export.
- PWA icons are generated by `scripts/make-icons.mjs` (no image library needed).

## Working agreements for Claude Code
- Read this file first every session. Keep it updated when architecture decisions change.
- Small commits with clear messages. Run `npm run build` and `npm test` before finishing any task.
- Never expand solutions by default. Never remove Bangla. Never add a dropdown.
- When new module JSON files arrive in `content/modules/`, no code changes should be needed; if they are, fix the loader, not the content.
- Keep a `CHANGELOG.md`.
