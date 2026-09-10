import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, CASES, finalView, FIXES, MODES, type Case, type Mode, type VueState } from './logic/vue-reactivity';

export default function VueReactivitySimulator() {
  const [mode, setMode] = useState<Mode>('broken');
  const [c, setCase] = useState<Case>('destructure');
  const [fixById, setFixById] = useState<Record<string, string>>({});
  const fix = fixById[c] ?? FIXES[c][0].id;
  const steps = useMemo(() => buildSteps(mode, c, fix), [mode, c, fix]);
  const fin = finalView(mode, c, fix);

  const prediction = useMemo(() => {
    if (c === 'watch') {
      return { question: 'After two +1 clicks, how many lines does the watcher log?', choices: [{ id: '2', label: '2 lines' }, { id: '0', label: 'Nothing' }, { id: '1', label: '1 line' }], correct: String(fin.logs), actual: `${fin.logs} line${fin.logs !== 1 ? 's' : ''}` };
    }
    if (c === 'array') {
      return { question: 'After load(["Rahman", "Islam"]), what does the list show?', choices: [{ id: 'Rahman, Islam', label: 'Rahman, Islam' }, { id: 'Ahmed', label: 'Ahmed (unchanged)' }, { id: '', label: 'Empty' }], correct: fin.view, actual: fin.view || 'empty' };
    }
    return { question: 'After two +1 clicks, what does the screen show for count?', choices: [{ id: '2', label: '2' }, { id: '0', label: '0' }, { id: 'undefined', label: 'undefined' }], correct: fin.view, actual: fin.view };
  }, [c, fin]);

  return (
    <SimShell<VueState>
      id="vue-reactivity"
      title="The spreadsheet cell that stopped updating"
      story="A spreadsheet: change cell A1 and cell B1 (=A1*2) updates by itself. Now you copy the NUMBER out of A1 into a note. The note never updates, because the note holds a value, not the cell. Vue's reactivity lives in the wrapper (ref, reactive proxy), not in the value you pull out of it."
      storyBn="Spreadsheet: A1 বদলালে B1 (=A1*2) নিজে বদলায়। কিন্তু A1-এর সংখ্যাটা copy করে note-এ রাখলে note আর বদলায় না। Vue-র reactivity থাকে wrapper-এ, value-তে না।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...CASES]}
      preset={c}
      onPreset={(p) => setCase(p as Case)}
      extras={
        <div className="flex flex-col gap-2">
          {mode === 'fixed' && FIXES[c].length > 1 && (
            <Chips>
              {FIXES[c].map((f) => (
                <Chip key={f.id} on={fix === f.id} onClick={() => setFixById({ ...fixById, [c]: f.id })}>{f.label}</Chip>
              ))}
            </Chips>
          )}
          {c === 'array' && (
            <div className="rounded-xl border border-line p-2 text-[12.5px] dark:border-[#2a2e38]">
              <div className="font-semibold">Vue 2 vs Vue 3</div>
              <div><b>Vue 2</b> (getters/setters): <code>this.items[0] = x</code> and adding a new key were invisible; you needed <code>Vue.set(this.items, 0, x)</code> / <code>this.$set</code>.</div>
              <div><b>Vue 3</b> (Proxy): index assignment and new keys are tracked. What still breaks is replacing the proxy variable itself with a plain array, as shown here.</div>
            </div>
          )}
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'reactive() returns a proxy; destructuring or copying pulls a plain value out of it and the link is gone.',
          'toRefs / toRef / storeToRefs / computed keep a live link. Assign through the wrapper (ref.value) or mutate it (splice, push).',
          'Templates unwrap top-level refs for you; watch() needs a source (getter, ref, reactive), not a value.',
        ],
        takeaway: 'Reactivity lives in the wrapper, not the value. Destructure the wrapper, keep the wrapper.',
        takeawayBn: 'Reactivity থাকে wrapper-এ, value-তে না। Wrapper-টাই রাখো।',
        challenge: 'Pick "watch(state.count)" and predict whether the SCREEN updates even though the watcher is silent.',
      }}
      render={(st) => <Sheet st={st} c={c} />}
    />
  );
}

function Sheet({ st, c }: { st: VueState; c: Case }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-xl border border-line p-2 dark:border-[#2a2e38]">
          <Muted>source (state)</Muted>
          <div className="font-mono">{c === 'array' ? `items: [${st.items.map((i) => `'${i}'`).join(', ')}]` : `count: ${st.count}`}</div>
        </div>
        <div className={`rounded-xl border p-2 ${st.warning ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : 'border-accent bg-accent-soft/50 dark:bg-[#123a22]'}`}>
          <Muted>template (screen)</Muted>
          <div className="text-xl font-semibold">{st.view || '∅'}</div>
        </div>
      </div>
      {c !== 'array' && c !== 'value' && c !== 'watch' && (
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <div className="rounded-xl border border-line p-2 dark:border-[#2a2e38]"><Muted>A1 (count)</Muted><div className="font-mono">{st.view}</div></div>
          <div className="rounded-xl border border-line p-2 dark:border-[#2a2e38]"><Muted>B1 = A1 × 2 (computed)</Muted><div className="font-mono">{st.double}</div></div>
        </div>
      )}
      <div className="rounded-xl border border-line p-2 text-[12.5px] dark:border-[#2a2e38]">
        <Muted>watcher log</Muted>
        {st.watchLog.length ? st.watchLog.map((l, i) => <div key={i} className="font-mono">{l}</div>) : <div className="text-neutral-400">(nothing yet)</div>}
      </div>
      {st.warning && <div className="rounded-xl bg-danger-soft px-3 py-2 text-[12.5px] text-danger dark:bg-[#3a1512]">{st.warning}</div>}
      <pre className="m-0 text-[12.5px]">
        {st.code.map((line, i) => (
          <div key={i} className={st.changed.includes(i + 1) ? 'rounded bg-accent-soft dark:bg-[#123a22]' : ''}>
            {st.changed.includes(i + 1) ? '+ ' : '  '}{line}
          </div>
        ))}
      </pre>
    </div>
  );
}
