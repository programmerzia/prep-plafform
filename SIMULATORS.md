# SIMULATORS.md — spec for all interactive simulators

Audience: a learner who understands best through a concrete story a 10-year-old could follow, then sees the
real code behaviour mirror the story. Every simulator teaches ONE idea by letting the user break it and fix it.

## Shared framework (build once, reuse in every simulator) — `src/simulators/kit/`

Every simulator is `src/simulators/<id>.tsx` exporting `default function` and wrapped in `<SimShell>` which provides:

- **Predict first.** Before the first run, a prompt: "What do you think will happen?" with 2–4 tappable choices.
  After the run, show "You predicted X — actual: Y" in green/amber. Store per-simulator prediction accuracy in IndexedDB
  (shown on Progress as "prediction hit rate").
- **Two modes toggle** at the top: **Broken** / **Fixed** (labels can be renamed per simulator, e.g. "JOIN" / "EXISTS",
  "No lock" / "FOR UPDATE"). The same scenario runs in both; the user is meant to see the difference.
- **Controls:** Step ▸, Auto-play ▶ (with speed 0.5× / 1× / 2×), Pause, Reset. Keyboard: space = step, r = reset.
- **Narration panel:** one plain-language sentence per step (EN), with a small BN line under it when provided.
  Sentences come from the simulator's `steps[]`; never technical jargon without the story word next to it
  ("microtask (the VIP tray)").
- **Story header:** 2–3 sentences of the real-life story (see each spec), collapsible.
- **"What to notice" box** at the end of a run: 2–3 bullets, the single takeaway sentence, and a "Try to break it" challenge.
- **Presets** as chips (never dropdowns). Custom input where specified.
- **Layout:** works at 380px wide (stacked) and ≥ 900px (side by side: state left, narration right). All targets ≥ 44px.
  Reduced-motion respected. Colours from the app theme: green = correct/safe, red = wrong/conflict, amber = waiting.
- **Embedding:** a module references `"simulator": "<id>"`; the Learn screen renders it after the concept.
  Also list all simulators under More → Simulators for free play.

## 1. `btree-walk` — "Finding a name in a phone book"
Story: A phone book sorted by surname vs a pile of loose pages. Finding "Rahman" in the sorted book is a few page-flips;
in the pile you check every page.
State: a table of N rows (preset 16 / 256 / 4,096 / 1,000,000 — the large ones are simulated counts, animate a bar) and,
in Fixed mode, a B-tree drawn as 3 levels of boxes. A search value input (chips of sample values + custom).
Run: Broken (no index) = highlight rows one by one, counter "rows checked". Fixed (index) = highlight the tree path
root → branch → leaf, then jump to the row; counter "steps". Show both counters side by side after the run.
Extras: toggle "LIKE 'Rah%'" (walks a range of leaves) vs "LIKE '%man'" (falls back to full scan even in Fixed mode
with the sentence "the book is sorted by the START of the name"). Toggle "compare as number" to show the type-mismatch
full scan. Second tab: composite index (customer_id, created_at) — filter by created_at only → full scan; by both → path.
Notice: "1,000,000 rows became ~20 steps. A leading wildcard or a cast on the column throws the book away."

## 2. `lock-race` — "Two people, the last seat"
Story: A bus has 1 seat left. Ziaur and Arafat both tap 'Book' in the same second.
State: two lanes (User A, User B), a seat counter, a timeline with steps: READ seats → CHECK > 0 → WRITE seats-1 → COMMIT.
Broken (no lock): both READ 1, both pass CHECK, both WRITE → seats = -1, two tickets. Red.
Fixed ("SELECT … FOR UPDATE" / or "atomic UPDATE WHERE seats > 0"): A takes the lock, B's lane shows a padlock and
"waiting…" until A commits; then B reads 0 and is refused. Green.
Extras: chip to choose the fix: FOR UPDATE / atomic UPDATE / optimistic version column (show the version check fail
and retry). Slider "delay between A and B" to show the race only happens in the overlap window. Preset "3 users, 2 seats".
Show the SQL of each step in a monospace strip.
Notice: "A transaction is not a lock. Reading then writing without a lock is a race. The three fixes and when each fits."

## 3. `idempotent-retry` — "Pressing the lift button twice"
Story: You press 'Pay' — the screen freezes, so you press again. Did you pay twice?
State: a client, a network with a "drop response" toggle, a server ledger (list of charges), and a key store.
Broken: request 1 → charge → response lost → client retries → charge again → ledger shows 2 charges. Red.
Fixed: request carries Idempotency-Key; server stores key → result; retry with same key returns the stored result,
ledger shows 1 charge. Green.
Extras: chips for failure point: "response lost" / "server crashed after charging, before storing key" (shows why the
key must be saved in the same transaction as the charge) / "client generates a NEW key on retry" (shows double charge —
the key must be per intent, not per attempt). Show request/response cards with headers.
Notice: "Same key, same answer. Store the key with the result, in the same transaction."

## 4. `cache-stampede` — "Everyone wants the newspaper the second it sells out"
Story: A shop keeps one copy of today's paper on the counter (cache). At 9:00 it expires. 1,000 customers arrive at 9:00:01.
State: a cache box with a countdown, a DB with a load meter (0–100%), a crowd of request dots.
Broken: cache expires → all dots go to the DB → load meter red → "DB overloaded" → slow responses.
Fixed: chips for strategy: "lock + single refresh" (one dot goes to DB, the rest wait then read cache),
"stale-while-revalidate" (everyone gets the old paper immediately, one dot refreshes in the background),
"jittered TTL" (many caches expire at different times — show 5 cache boxes with staggered countdowns).
Extras: slider for request count and TTL. Show Laravel snippet for the chosen strategy (Cache::lock, Cache::flexible).
Notice: "Expiry is a moment; 1,000 requests in that moment is a stampede. Serve stale, refresh once."

## 5. `react-race` — "Two coffees, the second arrives first"
Story: You type "ja" then "jav" in a search box. Two requests go out. The "ja" results arrive LAST and overwrite "jav".
State: an input with a typing animation, two request arrows with adjustable latency sliders, a results panel, and the
useEffect code with the cleanup lines highlighted when active.
Broken (no cleanup): the later response overwrites the correct one → results show "ja" for query "jav". Red.
Fixed: chips for fix: "ignore flag in cleanup" (`let cancelled = true` in return), "AbortController" (arrow shows ✕ aborted),
"React Query / key-based cache" (explained, shows cached result).
Extras: chip "Strict Mode double-invoke" to show effect running twice in dev and why cleanup makes it harmless.
Show the dependency array; toggle "missing dependency" to show the stale closure.
Notice: "An effect can be out of date by the time its response arrives. Cleanup is how it says 'ignore me'."

## 6. `vue-reactivity` — "The spreadsheet cell that stopped updating"
Story: A spreadsheet: change cell A1, cell B1 (=A1*2) updates by itself. Now you copy the NUMBER out of A1 into a note —
the note never updates.
State: a small "spreadsheet" with a ref `count`, a computed `double`, a watcher log, and a component template preview.
Broken: chips for the classic breakages: `const { count } = reactive(state)` (destructure loses reactivity),
`let count = state.count` (copies the value), replacing a reactive array with `state.items = newArray` vs mutating,
reading `.value` in template (shows the error), `watch(state.count)` (watches a number, not a source).
Fixed: `toRefs`, `storeToRefs`, `computed`, `watch(() => state.count)`. Each fix highlights the code delta.
Extras: side panel "Vue 2 vs Vue 3" showing `Vue.set` era vs Proxy era for the array case.
Notice: "Reactivity lives in the wrapper, not the value. Destructure the wrapper, keep the wrapper."

## 7. `lru-cache` — "A small shelf: the least-used item falls off"
Story: A shelf holds 3 books. Every time you read one you move it to the front. A 4th book pushes off the one at the back.
State: shelf (capacity chips 2/3/4), an op log, a hash-map view (key → node) and a doubly-linked list view with head/tail.
Ops: chips `get(k)` and `set(k, v)` with sample keys + custom. Each op animates: move to front, evict tail, hit/miss counter.
Extras: "Show the code" panel with a Map-based JS implementation (Map preserves insertion order) and a PHP version;
"Why O(1)?" toggle highlights the hash-map lookup and the list re-link. Challenge: "Make a hit rate of 60% with capacity 2".
Notice: "Hash map for the lookup, linked list for the order. Map in JS gives you both."

## 8. `queue-backoff` — "Re-cooking a failed dish, but not forever"
Story: A kitchen ticket rail. A dish fails (out of stock). Re-try later; wait longer each time; after 3 tries the
ticket goes to the manager's tray (dead-letter).
State: a queue rail with job cards, N workers (chips 1/2/4), a failure-rate slider, a timeline with backoff bars, a
failed-jobs tray. Each job shows attempts, next retry in Xs.
Broken: retry immediately forever → the same job hammers the failing service, others starve. Red.
Fixed: exponential backoff with jitter (bars 1s, 2s, 4s…), max attempts → dead-letter, optional "release with delay" vs "fail".
Extras: toggle "job not idempotent" to show the side effect happening twice on retry (links to idempotent-retry);
show the Laravel Job properties for the chosen setting (`$tries`, `$backoff = [1, 5, 30]`, `retryUntil`, `failed()`),
and Horizon-style metrics (throughput, wait time). Preset "one poison job".
Notice: "Retry with growing gaps, give up on purpose, and make the job safe to run twice."

## 9. `tenant-isolation` — "One building, many apartments; whose mail is whose?"
Story: An apartment building's mailroom. Every letter has an apartment number. A careless clerk hands out mail by
name only — apartment 3 gets apartment 7's letters.
State: a table `invoices` with rows coloured by tenant (3 tenants), a query builder strip (SELECT … WHERE …), a
"current tenant" chip, and the result grid.
Broken: query without tenant_id → result shows other tenants' rows in red. Chip "forgot the scope in one endpoint".
Fixed: chips for mechanism: "global scope (Laravel)" — every query gets WHERE tenant_id = ?; "Postgres RLS" — show the
policy `USING (tenant_id = current_setting('app.tenant')::bigint)` and the same unscoped query now returning only the
tenant's rows; "database-per-tenant" — show a connection switch instead of a filter.
Extras: "attack" chip: change the id in the URL to another tenant's invoice; show 404 under scope/RLS vs 200 without.
Comparison card: shared schema vs schema-per-tenant vs db-per-tenant (cost, isolation, migration effort).
Notice: "Isolation you have to remember is isolation you will forget once. Put it where you can't forget: a scope or the database."

## 10. `design-canvas` — "Drawing the building before laying bricks"
Already exists under More. Make it embeddable by id and add: a palette of labelled boxes (Client, LB, Web, API, Worker,
Queue, Cache, DB, Replica, Search, CDN, Object store, External API), arrows with labels (sync/async, protocol), a notes
side panel, undo/redo, snap-to-grid, export PNG/JSON, import JSON, and 4 starter templates (URL shortener, rate limiter,
notification system, multi-tenant SaaS) each with a hidden "reference answer" the user can reveal after drawing their own.
A "talk through it" mode: a 2-minute timer and prompts (requirements → estimate → sketch → bottleneck → trade-off).

## Acceptance for every simulator
- Predict-first prompt shown on first open; prediction accuracy stored.
- Broken and Fixed both runnable; narration sentence for every step; BN line where provided in the spec's Notice.
- Works by touch at 380px; side-by-side at ≥ 900px.
- No dropdowns. Reset restores initial state. Auto-play can be paused.
- Registered in the simulator registry and listed under More → Simulators.
- A short Vitest test for the pure step logic (state machine), not the rendering.
