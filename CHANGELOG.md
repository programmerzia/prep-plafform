# Changelog

## Unreleased

### Changed
- No locking: every module with a lesson is readable; "Passed" badge at 60% drill mastery replaces the old gate. The UI no longer mentions Claude. Built-in questions are the default interviewer; AI providers are optional.

### Added
- Simulators btree-walk, lock-race, idempotent-retry, cache-stampede, react-race and vue-reactivity, each with a tested state machine.
- Simulator kit (`src/simulators/kit`): predict-first with stored accuracy, Broken/Fixed toggle, presets, Step/Auto-play/Pause/Reset, EN+BN narration, story header, "What to notice". Event-loop and join-fanout rebuilt on it with tested step logic. More → Simulators list; prediction hit rate on Progress.
- Desktop layout from 900px: left sidebar instead of bottom tabs, 1100px centred content, two-column lesson (lesson left; practice, questions, notes right). Phones unchanged.
- Optional `lesson.versions` list rendered as "What changed across versions" (table on wide screens, cards on phones).
- `prebuild` content gate: `scripts/validate-content.ts` runs the Zod schema over every module and fails `npm run build` on the first invalid file, duplicate id, or id/filename mismatch.
- Star field is live: ★ marker in Learn, "60-day progress" line on Today. `design-canvas` is a registered simulator id. crossStack renders as stacked cards under 600px.
- "Drill weak spots" mode: the 10 most-missed cards, reachable from Today and the drill picker. All chips are at least 44px tall.
- `git` track; mock grouping renamed to "Track focus"; markdown/plain-text field policy (see CLAUDE.md).
- Three mentor-delivered modules: core PHP, closures and `this`, subqueries and CTEs.

### Changed
- Migration script skips existing files (use `--force` to regenerate).
- CI builds on Node 24.

## 0.1.0 — 2026-09-09

First scaffold of the platform.

### Added
- Vite + React 18 + TypeScript, Tailwind v4, vite-plugin-pwa (offline-first, precaches app shell, content and fonts), React Router, `idb`, Zod, Vitest.
- GitHub Pages workflow (`.github/workflows/deploy.yml`): tests → build → deploy, with `404.html` fallback for deep links.
- Content loader: every `content/modules/*.json` is validated with the Zod schema in `src/content/schema.ts` at build and test time.
- Spaced repetition (`src/logic/leitner.ts`): Leitner boxes [0,1,3,7,21,60] days, mastery = average box / 5, streak, weak spots. Tested.
- Mock builder and weak-spot report (`src/logic/mock.ts`). Tested.
- Screens: Today, Learn (tracks → modules → lesson/preview), Practice, Drill, Interview (offline + Gemini/Groq/OpenRouter, AI-screen 90 s timer with structure check), Mock (45 min, 6 questions, written report), More (Design canvas, Stories with rehearsal mode, Cheat sheets, Glossary, Progress, Settings with export/import/reset).
- Simulators ported from the legacy page: `event-loop`, `join-fanout`.
- Migration script `scripts/migrate-legacy.mjs`: 71 modules from `legacy/senior-prep.html` (8 unlocked, 63 preview) with text, code and Bangla preserved verbatim; a test checks this against the legacy file.
- Self-hosted Noto Sans Bengali in `public/fonts`.

### Fixed
- Event-loop simulator "Nested" preset printed the queued task's name instead of the running one (greedy regex in the legacy demo).
