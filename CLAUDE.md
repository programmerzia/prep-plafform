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
- No backend. The built-in offline interviewer is the default and needs no setup. AI calls go straight from the browser to Gemini / Groq / OpenRouter using a key the user pastes (stored on device only). Offline mode must work with zero network.
- Tests: Vitest for pure logic (spaced repetition, content validation). No test theatre.

## Non-negotiable UX rules
- Mobile-first: 380px wide is the primary viewport. Bottom tab bar. Thumb-sized buttons (min 44px). No dropdowns for choosing topics — use tappable chips/lists.
- Every answer, solution, and model answer is hidden until the user taps "Show". Never render solutions expanded by default.
- Bangla appears everywhere a summary appears. Global toggle: EN / EN+BN. Bangla text uses a font that renders Bengali cleanly (Noto Sans Bengali via CSS, self-hosted in /public/fonts).
- Code blocks scroll horizontally; never wrap code. Font size ≥ 13.5px.
- Simulators are React components in `src/simulators/<id>.tsx`, referenced from a module by id. They must work by touch. Full spec in `SIMULATORS.md`; every simulator is built on `src/simulators/kit/SimShell` with its pure step logic in `src/simulators/logic/<id>.ts` (tested).
- Plain language in all UI. No jargon in labels. The UI never mentions Claude or any mentor; the learner just sees lessons, previews and his own progress.
- Dark mode follows system preference.

## Screens (bottom tabs)
1. **Today** — cards due, streak, "Your path" (next module, weak modules under 60%), 10-minute mobile mode button (drill 8 cards + 1 interview question), daily rhythm in EN and BN.
2. **Learn** — tracks → modules. Nothing is locked: every module with a `lesson` is readable. Modules without a lesson show the preview (what / picture / why interviewers ask / Bangla). A "Passed" badge is earned at 60% drill mastery. "Explain like I'm 12" toggle swaps `lesson.simple` for `lesson.concept`.
3. **Practice** — tasks per module; run locally on his machine; hidden solutions with explanation.
4. **Drill** — spaced repetition. Leitner boxes with intervals [0,1,3,7,21,60] days. "Got it" moves up a box; "Missed" resets to box 0 and increments miss count. Weak spots = most-missed cards.
5. **Interview** — pick module + style (technical / AI-screen / behavioural). Built-in questions are the default; an AI provider is optional and chosen in Settings. Built-in mode shows a question from the module's `interview` list, then model answer + "the sentence you're missing", user self-scores 1–10. AI-screen mode adds a 90-second timer and grades structure (context → decision → trade-off → outcome).
6. **Mock** — 45-minute timed mock per track focus (Laravel / React-Next / .NET): 6 questions mixed across unlocked modules, scores recorded, written weak-spot report.
7. **More** — Design canvas (draggable labelled boxes + arrows, save/load PNG/JSON), Stories (STAR stories, 2-min and 30-sec versions, rehearsal mode that hides text after 3 seconds), Cheat sheets (one page per track, printable), Glossary (term / plain meaning / Bangla / module link), Progress (mastery per track, mock history), Settings (AI provider + key, language, export/import progress JSON, reset).

Mastery per module = average box level of its cards / 5. A module is "passed" when drill mastery ≥ 60%. Nothing else gates it; `status` only records whether the mentor has written the lesson (`unlocked`) or only the preview (`preview`).

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
    "docs": [ { "label": "", "url": "" } ], // official docs only, at most 3
    "versions": [ { "from": "PHP 7.4", "to": "PHP 8.0", "what": "", "why_it_matters": "" } ] // optional
  },
  "practice": [ { "task": "", "hint": "", "solution": "", "why": "" } ],
  "interview": [ { "q": "", "model": "", "missing": "", "followUp": "", "bn": "" } ],
  "cards": [ { "q": "", "a": "" } ],
  "glossary": [ { "term": "", "plain": "", "bn": "" } ]
}
```
All markdown fields render with a markdown component (code fences, bold, lists). Validate every module at build time with a Zod schema in `src/content/schema.ts`; fail the build on invalid content. This is enforced by `npm run validate:content` (`scripts/validate-content.ts`), wired as `prebuild`, plus the content tests.

## Tracks (ids and display names)
php, oop, sql, orm, laravel, symfony, http-api, js-ts, react, next, vue-nuxt, node, dotnet, python-llm, supabase, architecture, cloud-devops, git, redis, payments, security-auth, pwa-offline, problems, interview, stories

## Simulators to implement (in this order; each is one component, touch-friendly, ≤ 380px)
event-loop (call stack / microtask / macrotask stepper), join-fanout (JOIN vs EXISTS row builder), btree-walk (index lookup vs table scan step counter), lock-race (two users buying the last seat, with/without SELECT FOR UPDATE), idempotent-retry (same request twice, with/without key), cache-stampede (requests hitting an expired key, with/without lock), react-race (two fetches resolving out of order, with/without cleanup), vue-reactivity (destructure loses reactivity), lru-cache (capacity 3, step through gets/sets), queue-backoff (retries with exponential backoff and a dead-letter), tenant-isolation (rows filtered by tenant_id / RLS policy), design-canvas.

## Migration
`legacy/senior-prep.html` contains the first 8 finished modules and two simulators as inline JS (`TOPICS` array, `demoLoop`, `demoJoin`). Migrate their content into module JSON files and the two simulators into React components. Preserve all text, code and Bangla exactly.

Done (2026-09-09) by `scripts/migrate-legacy.mjs`; `src/content/content.test.ts` checks every migrated string against the legacy file. The script skips files that already exist, so hand edits are safe; `--force` regenerates all 71 legacy files.

## Decisions made while scaffolding (2026-09-09)
- Schema leniency: only `id/track/phase/order/title/status` are required. Unlocked modules must have `lesson.concept`, `lesson.bn` and ≥1 card; preview modules must have `preview`. `problem/hook/simple/wrong/right/crossStack/docs/interview/glossary` are optional with empty defaults, because the migrated modules lack them. The lesson page hides empty sections; `right` alone renders under the heading "Code".
- Offline interview falls back to the module's drill cards when its `interview` list is empty (legacy behaviour). Mock does the same.
- Legacy `phase` was 0-based; JSON uses 1..8. Phase names live in `src/content/tracks.ts`. Path order = phase → track order → `order`.
- Legacy `auth`/`sec` live in `security-auth`; `idem`/`sd4` in `payments`; `cache` in `redis`; `deploy`/`obs` in `cloud-devops`; the git topic in its own `git` track.
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

## Decisions (2026-09-09, second pass)
- Markdown fields (rendered with the markdown component): `lesson.concept`, `lesson.simple`, `lesson.problem`, `lesson.picture`, `lesson.wrong.why`, `lesson.right.why`, `practice.task`, `practice.hint`, `practice.solution`, `practice.why`, `interview.model`, `interview.missing`. Code inside them goes in fenced blocks.
- Plain-text fields (never parsed as markdown): `lesson.hook`, every `bn`, all `preview.*`, `cards[].q/a`, `glossary[].*`. Drill cards and offline questions drawn from cards render as plain text.
- Migrated practice solutions are wrapped in a code fence by the migration script so they render as code; the text inside the fence is the legacy text unchanged, and the fidelity test compares the inside of the fence.
- Cheat sheets are the one place answers may be shown expanded, because they are printed reference pages.
- The mock's grouping of tracks is called "Track focus" in the UI and code (`TRACK_FOCUS` in `src/content/tracks.ts`). The word "funnel" is not used in the UI.
- `git` is its own track.
- When a mentor delivers an unlocked module that supersedes a legacy preview, keep the preview only if it still covers something the new module does not, and give it a later `order`. Example: `js-closures-this` (unlocked) is order 2, `js-closures-this-prototypes` (preview, prototypes still untaught) is order 3.

## Decisions (2026-09-10)
- No locking. `src/content/loader.ts` exposes `LESSONS` (modules with a lesson, all readable) and `WITH_CARDS` (modules that can be drilled, interviewed on, passed). `status` stays in the schema as the mentor's marker but gates nothing in the UI.
- "Passed" = `isPassed(mastery)` in `src/logic/leitner.ts`, 60% or more. Shown by `MasteryPill` as "✓ Passed · N%" in Learn, Today, the lesson header and Progress.
- The UI never names Claude. Preview screens say a lesson is not written yet; Today's next stop says the same.
- Interviewer provider `offline` is labelled "Built-in questions (default)"; AI providers are presented as optional in Settings.
- `lesson.versions` (optional, plain text) renders as "What changed across versions" right after the concept: a table from 600px up, stacked cards below. Use it when a topic's answer depends on the version (PHP 7→8, Laravel 10→11, React 18→19).
- Simulator kit (2026-09-10): `SimShell` owns predict-first, Broken/Fixed modes, presets, Step/Auto-play/Pause/Reset, narration EN+BN, story header and the notice box. A simulator only supplies `steps[]` (pure, from `logic/<id>.ts`), a `render(state)` and its texts. Prediction accuracy is stored in IndexedDB (`simStats`) and shown on Progress and More → Simulators. `SIM_LIST` in `src/simulators/index.ts` is the free-play listing.
