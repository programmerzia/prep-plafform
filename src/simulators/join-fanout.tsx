import { useMemo, useState } from 'react';
import { Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, MODES, PRESETS, realRevenue, sumOf, type JoinState, type Mode } from './logic/join-fanout';

export default function JoinFanoutSimulator() {
  const [mode, setMode] = useState<Mode>('join');
  const [preset, setPreset] = useState<string>('42');
  const steps = useMemo(() => buildSteps(mode, preset), [mode, preset]);
  const real = realRevenue(preset);
  const joinSum = sumOf('join', preset);
  const actual = sumOf(mode, preset);

  const prediction = useMemo(() => {
    const choices = [{ id: 'real', label: String(real) }];
    if (joinSum !== real) choices.push({ id: 'join', label: String(joinSum) });
    choices.push({ id: 'zero', label: '0' });
    return { question: 'What will SUM(o.total) return?', choices, correct: actual === real ? 'real' : 'join', actual: String(actual) };
  }, [real, joinSum, actual]);

  return (
    <SimShell<JoinState>
      id="join-fanout"
      title="One order, three items, one bill"
      story="Ziaur has order 10 (total 500, items: product 42, 7, 42) and order 11 (total 200, item: product 7). A report asks for revenue from orders that contain product 42. Joining the items table copies the order row once per item — the bill gets counted three times."
      storyBn="Order 10-এর ৩টা item। items table JOIN করলে order-এর row ৩ বার আসে — একই বিল ৩ বার গোনা হয়।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...PRESETS]}
      preset={preset}
      onPreset={setPreset}
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'JOIN brings rows in; each matching child row copies the parent row.',
          'EXISTS only asks yes/no per parent and stops at the first hit — the parent stays one row.',
          'GROUP BY does not fix fan-out: the copies sit inside the same group. DISTINCT hides it and breaks legitimate duplicates.',
        ],
        takeaway: 'Never bring a one-to-many table into the row set just to filter. Ask it a yes/no question with EXISTS.',
        takeawayBn: 'শুধু filter করার জন্য one-to-many table JOIN কোরো না — EXISTS দিয়ে "আছে কি?" জিজ্ঞেস করো।',
        challenge: 'Switch to "no product filter" in JOIN mode and predict how far off the SUM will be.',
      }}
      render={(st) => {
        const cols = mode === 'join' ? 'grid-cols-5' : 'grid-cols-3';
        return (
          <div className="flex flex-col gap-2">
            <Muted>Rows the database builds before SUM runs:</Muted>
            <div className="overflow-hidden rounded-xl border border-line text-[13px] dark:border-[#2a2e38]">
              <div className={`grid ${cols} bg-neutral-100 px-2 py-1.5 font-semibold dark:bg-[#1f232b]`}>
                <span>customer</span><span>o.id</span><span>o.total</span>
                {mode === 'join' && (<><span>i.id</span><span>i.product</span></>)}
              </div>
              {st.rows.length ? (
                st.rows.map((r, k) => (
                  <div key={k} className={`grid ${cols} border-t border-line px-2 py-1.5 dark:border-[#2a2e38] ${r.o.id === st.cursorOrder ? 'bg-warn-soft/60 dark:bg-[#2c2410]' : ''}`}>
                    <span>Ziaur</span><span>{r.o.id}</span><span>{r.o.total}</span>
                    {r.i && (<><span>{r.i.id}</span><span>{r.i.product_id}</span></>)}
                  </div>
                ))
              ) : (
                <div className="p-2 text-neutral-500">no rows yet</div>
              )}
            </div>
            <div className="mt-1 flex justify-between">
              <div>
                <Muted>SUM(o.total) the query returns</Muted>
                <div className={`text-2xl font-semibold ${st.sum === null ? 'text-neutral-400' : st.sum === st.real ? 'text-accent' : 'text-danger'}`}>{st.sum ?? '…'}</div>
              </div>
              <div className="text-right">
                <Muted>real revenue</Muted>
                <div className="text-2xl font-semibold">{st.real}</div>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
