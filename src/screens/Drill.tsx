import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ALL_CARDS, getModule, type CardRef } from '../content/loader';
import { isDue, shuffle, todayNumber, weakSpots } from '../logic/leitner';
import { useStore } from '../store/Store';
import { ModulePicker } from '../ui/ModulePicker';
import { Button, Card, Empty, Muted, Page, Pill } from '../ui/primitives';

type Phase = 'pick' | 'run' | 'done';

export function Drill() {
  const [params, setParams] = useSearchParams();
  const moduleId = params.get('module') ?? undefined;
  const tenMin = params.get('mode') === '10min';
  const weakMode = params.get('mode') === 'weak';
  const { cards, gradeCard } = useStore();
  const nav = useNavigate();

  const [queue, setQueue] = useState<CardRef[]>([]);
  const [phase, setPhase] = useState<Phase>('pick');
  const [shown, setShown] = useState(false);
  const [stats, setStats] = useState({ ok: 0, miss: 0 });
  const [forced, setForced] = useState(false);

  const due = useMemo(() => {
    const t = todayNumber();
    return ALL_CARDS.filter((c) => (!moduleId || c.moduleId === moduleId) && isDue(cards[c.key], t));
  }, [cards, moduleId]);

  const start = (list: CardRef[], limit?: number) => {
    const q = shuffle(list);
    setQueue(limit ? q.slice(0, limit) : q);
    setStats({ ok: 0, miss: 0 });
    setShown(false);
    setPhase('run');
  };

  // 10-minute mode: jump straight in with 8 due cards (or any 8 if nothing is due).
  useEffect(() => {
    if (tenMin && phase === 'pick') {
      const pool = due.length ? due : ALL_CARDS;
      start(pool, 8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenMin]);

  // Weak spots: the 10 most-missed cards, regardless of due date.
  const weak = useMemo(() => weakSpots(ALL_CARDS, cards, 10).map((w) => w.card), [cards]);

  useEffect(() => {
    if (weakMode && phase === 'pick' && weak.length) {
      setForced(true);
      start(weak);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weakMode]);

  const cur = queue[0];

  const answer = async (ok: boolean) => {
    if (!cur) return;
    await gradeCard(cur.key, ok);
    setStats((s) => ({ ok: s.ok + (ok ? 1 : 0), miss: s.miss + (ok ? 0 : 1) }));
    setShown(false);
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) setPhase('done');
  };

  if (phase === 'pick') {
    return (
      <Page title="Drill">
        <Card>
          <div className="mb-2 flex justify-between">
            <Muted>{due.length} due</Muted>
            <Muted>{moduleId ? getModule(moduleId)?.title : 'all topics'}</Muted>
          </div>
          <ModulePicker
            value={moduleId}
            onChange={(id) => setParams(id ? { module: id } : {})}
            allLabel="All due"
          />
        </Card>
        <Card>
          {due.length ? (
            <Button variant="primary" full onClick={() => start(due)}>
              Start · {due.length} cards
            </Button>
          ) : (
            <>
              <Empty>Nothing due right now. Come back tomorrow — or drill anyway.</Empty>
              <Button
                full
                onClick={() => {
                  setForced(true);
                  start(ALL_CARDS.filter((c) => !moduleId || c.moduleId === moduleId));
                }}
              >
                Drill everything now
              </Button>
            </>
          )}
          {weak.length > 0 && (
            <Button full className="mt-2" onClick={() => { setForced(true); start(weak); }}>
              Drill weak spots · {weak.length} most-missed
            </Button>
          )}
          {weakMode && weak.length === 0 && <Muted className="mt-2">No missed cards yet. Do a normal drill first.</Muted>}
          <Muted className="mt-3">Say the answer out loud before you reveal it. "Got it" moves a card up a box (1, 3, 7, 21, 60 days). "Missed" sends it back to tomorrow.</Muted>
        </Card>
      </Page>
    );
  }

  if (phase === 'done' || !cur) {
    return (
      <Page title="Drill">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-semibold">
              {stats.ok} <span className="text-neutral-400">/</span> {stats.ok + stats.miss}
            </div>
            <Muted>got it{weakMode ? ' (weak spots)' : forced ? ' (extra drill)' : ''}</Muted>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {tenMin ? (
              <Button variant="primary" full onClick={() => nav(`/interview?mode=10min${moduleId ? `&module=${moduleId}` : ''}`)}>
                Next: 1 interview question →
              </Button>
            ) : (
              <Button variant="primary" full onClick={() => nav('/')}>
                Back to Today
              </Button>
            )}
            <Button full onClick={() => { setPhase('pick'); setParams(moduleId ? { module: moduleId } : weakMode ? { mode: 'weak' } : {}); }}>
              Drill again
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Drill">
      <div className="flex justify-between">
        <Muted>{queue.length} left</Muted>
        <Muted>
          <Pill tone="done">{stats.ok}</Pill> <Pill tone="weak">{stats.miss}</Pill>
        </Muted>
      </div>
      <Card>
        <Muted className="mb-2">{cur.moduleTitle}</Muted>
        <div className="text-[17px] font-medium">{cur.q}</div>
        {shown && <div className="mt-4 rounded-xl bg-accent-soft/60 px-3 py-2 text-[15.5px] dark:bg-[#12291b]">{cur.a}</div>}
        <div className="mt-4 flex gap-2">
          {!shown ? (
            <Button variant="primary" full onClick={() => setShown(true)}>
              Say it out loud, then reveal
            </Button>
          ) : (
            <>
              <Button variant="danger" className="flex-1" onClick={() => answer(false)}>
                Missed it
              </Button>
              <Button variant="ok" className="flex-1" onClick={() => answer(true)}>
                Got it
              </Button>
            </>
          )}
        </div>
      </Card>
      <Button variant="ghost" onClick={() => setPhase('pick')}>Stop</Button>
    </Page>
  );
}
