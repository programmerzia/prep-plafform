import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, comparisons, MODES, PRESETS, QUERIES, SAMPLE_NAMES, type Mode, type Query, type Tab, type WalkState } from './logic/btree-walk';

const fmt = (x: number) => x.toLocaleString('en-US');

export default function BtreeWalkSimulator() {
  const [mode, setMode] = useState<Mode>('scan');
  const [preset, setPreset] = useState<string>('16');
  const [tab, setTab] = useState<Tab>('single');
  const [query, setQuery] = useState<Query>('eq');
  const [name, setName] = useState('Rahman');
  const [custom, setCustom] = useState('');
  const steps = useMemo(() => buildSteps(mode, preset, tab, query, name), [mode, preset, tab, query, name]);
  const n = Number(preset);
  const last = steps[steps.length - 1].state;
  const usesIndex = !last.reason;

  const prediction = useMemo(
    () => ({
      question: `How many rows will the database check to find "${name}" among ${fmt(n)}?`,
      choices: [
        { id: 'all', label: `All ${fmt(n)}` },
        { id: 'half', label: `About half (${fmt(Math.round(n / 2))})` },
        { id: 'log', label: `About ${comparisons(n)}` },
      ],
      correct: usesIndex ? 'log' : 'all',
      actual: usesIndex ? `${last.steps} steps` : `${fmt(n)} rows`,
    }),
    [n, name, usesIndex, last.steps],
  );

  const selectTab = (t: Tab) => {
    setTab(t);
    setQuery(t === 'single' ? 'eq' : 'both');
  };

  return (
    <SimShell<WalkState>
      id="btree-walk"
      title="Finding a name in a phone book"
      story="A phone book sorted by surname vs a pile of loose pages. Finding 'Rahman' in the sorted book is a few page-flips: open in the middle, pick a side, repeat. In the pile you check every page, and you cannot stop early because another Rahman might be further down."
      storyBn="সাজানো ফোনবুক বনাম এলোমেলো পাতার স্তূপ। সাজানো বইয়ে কয়েকটা পাতা উল্টালেই হয়; স্তূপে প্রতিটা পাতা দেখতে হয়।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...PRESETS]}
      preset={preset}
      onPreset={setPreset}
      extras={
        <div className="flex flex-col gap-2">
          <Chips>
            <Chip on={tab === 'single'} onClick={() => selectTab('single')}>Single column (surname)</Chip>
            <Chip on={tab === 'composite'} onClick={() => selectTab('composite')}>Composite (customer_id, created_at)</Chip>
          </Chips>
          <Chips>
            {QUERIES[tab].map((q) => (
              <Chip key={q.id} on={query === q.id} onClick={() => setQuery(q.id)}>
                {q.label}
              </Chip>
            ))}
          </Chips>
          {tab === 'single' && (
            <div className="flex flex-wrap items-center gap-2">
              <Muted>Search for:</Muted>
              {SAMPLE_NAMES.map((s) => (
                <Chip key={s} on={name === s} onClick={() => setName(s)}>{s}</Chip>
              ))}
              <input
                className="min-h-[44px] w-32 rounded-xl border border-line bg-transparent px-3 text-[14px] dark:border-[#2a2e38]"
                placeholder="custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onBlur={() => custom.trim() && setName(custom.trim())}
              />
            </div>
          )}
          <pre className="m-0 text-[13px]">SELECT * FROM {tab === 'single' ? 'people' : 'orders'} {QUERIES[tab].find((q) => q.id === query)!.sql(name)};</pre>
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          `${fmt(n)} rows became ${comparisons(n)} comparisons with the sorted book.`,
          "A leading wildcard (LIKE '%man') or a cast on the column (surname = 12345) throws the book away: full scan even with the index.",
          'A composite index is sorted by its FIRST column. Filter without it and the values are scattered.',
        ],
        takeaway: '1,000,000 rows became ~20 steps. A leading wildcard or a cast on the column throws the book away.',
        takeawayBn: '১০ লক্ষ row হয়ে গেল ~২০ ধাপ। শুরুতে wildcard বা column-এ cast দিলে বইটা আর কাজে লাগে না।',
        challenge: "Switch to the sorted book, then pick LIKE '%man' and predict before stepping.",
      }}
      render={(st) => <Walk st={st} mode={mode} name={name} />}
    />
  );
}

function Walk({ st, mode, name }: { st: WalkState; mode: Mode; name: string }) {
  const showRows = Math.min(st.n, 16);
  const pct = st.n ? Math.round((100 * st.rowsChecked) / st.n) : 0;
  const lit = (box: string) => st.path.includes(box);
  const leafWalk = st.path.filter((p) => p === 'leaf').length;
  return (
    <div className="flex flex-col gap-3">
      {mode === 'index' && (
        <div className="flex flex-col items-center gap-1">
          <TreeBox label="root" on={lit('root')} />
          <div className="text-neutral-400">↓</div>
          <div className="flex gap-2">
            <TreeBox label="A–H" on={false} dim />
            <TreeBox label="branch I–R" on={lit('branch')} />
            <TreeBox label="S–Z" on={false} dim />
          </div>
          <div className="text-neutral-400">↓</div>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <TreeBox key={i} label={i === 1 ? `leaf: ${name.slice(0, 3)}…` : 'leaf'} on={(i === 1 && lit('leaf')) || (i > 1 && leafWalk >= i)} dim={i !== 1 && leafWalk < i} />
            ))}
          </div>
          {st.reason && <Muted className="text-danger">{st.reason}</Muted>}
        </div>
      )}

      <div>
        <div className="mb-1 flex justify-between">
          <Muted>{st.n > 16 ? `first 16 of ${fmt(st.n)} rows` : `${st.n} rows`}</Muted>
          <Muted>{st.scanning ? `rows checked: ${fmt(st.rowsChecked)}` : `steps: ${st.steps}`}</Muted>
        </div>
        {st.n > 16 && (
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2a2e38]">
            <div className={`h-full transition-all ${st.scanning ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${st.scanning ? pct : st.found ? 100 : 0}%` }} />
          </div>
        )}
        <div className="grid grid-cols-4 gap-1 text-[12px]">
          {Array.from({ length: showRows }, (_, i) => {
            const rowIndex = st.n > 16 ? Math.round((i / 16) * st.n) : i;
            const isTarget = st.n > 16 ? i === Math.floor((st.target / st.n) * 16) : i === st.target;
            const checked = st.scanning && st.rowsChecked > rowIndex;
            const hit = isTarget && st.found;
            return (
              <div
                key={i}
                className={`truncate rounded-md border px-1.5 py-1 ${hit ? 'border-accent bg-accent-soft dark:bg-[#123a22]' : checked ? 'border-danger/40 bg-danger-soft dark:bg-[#3a1512]' : 'border-line dark:border-[#2a2e38]'}`}
              >
                {isTarget ? name : `row ${fmt(rowIndex + 1)}`}
              </div>
            );
          })}
        </div>
      </div>

      {st.done && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-danger-soft p-2 dark:bg-[#3a1512]">
            <div className="text-xl font-semibold text-danger">{fmt(st.compare.scan)}</div>
            <Muted>rows checked without index</Muted>
          </div>
          <div className="rounded-xl bg-accent-soft p-2 dark:bg-[#123a22]">
            <div className="text-xl font-semibold text-accent">{st.compare.index}</div>
            <Muted>steps with index</Muted>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeBox({ label, on, dim = false }: { label: string; on: boolean; dim?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1 text-[12px] transition-colors ${on ? 'border-accent bg-accent-soft font-semibold dark:bg-[#123a22]' : 'border-line dark:border-[#2a2e38]'} ${dim ? 'opacity-40' : ''}`}>
      {label}
    </div>
  );
}
