import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/Store';
import { useDueCards, useMastery, usePath, useWeakSpots } from '../store/derive';
import { Bar, Big, Bn, Button, Card, H2, ListRow, MasteryPill, Muted, Pill } from '../ui/primitives';
import { phaseName } from '../content/tracks';

export function Today() {
  const { streak } = useStore();
  const due = useDueCards();
  const mastery = useMastery();
  const path = usePath();
  const weak = useWeakSpots(5);
  const nav = useNavigate();
  const pct = Math.round((100 * path.withLessons) / path.total);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-3 pb-24">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold">Rebuild</h1>
        <Muted>Senior full-stack prep — retrieval over reading</Muted>
      </header>

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <Big>{due.length}</Big>
            <Muted>cards due now</Muted>
          </div>
          <div className="text-right">
            <Big>{streak.streak}</Big>
            <Muted>day streak</Muted>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => nav('/drill')}>
            Start drill
          </Button>
          <Button className="flex-1" onClick={() => nav('/interview')}>
            Interview
          </Button>
        </div>
        <Button full className="mt-2" onClick={() => nav('/drill?mode=10min')}>
          ⏱ 10-minute mobile mode · 8 cards + 1 question
        </Button>
      </Card>

      <Card>
        <H2>Your path</H2>
        <div className="flex justify-between">
          <Muted>
            {path.withLessons} of {path.total} topics have a lesson · {path.passed.length} passed
          </Muted>
          <Muted>{pct}%</Muted>
        </div>
        <div className="my-2">
          <Bar pct={pct} />
        </div>
        {path.starred.length > 0 && (
          <div className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-[15px] dark:bg-[#2c2410]">
            <span aria-hidden>★</span> 60-day progress: {path.starredPassed.length} of {path.starred.length} starred modules passed
          </div>
        )}
        {path.weak.length > 0 && (
          <div className="mb-3">
            <Muted className="mb-1.5">Finish these first (under 60% in drills)</Muted>
            <div className="flex flex-col gap-1.5">
              {path.weak.map((m) => (
                <ListRow key={m.id} to={`/learn/${m.track}/${m.id}`} right={<MasteryPill pct={mastery[m.id] ?? 0} />}>
                  {m.title}
                </ListRow>
              ))}
            </div>
          </div>
        )}
        {path.next ? (
          <div>
            <Muted className="mb-1.5">Next on the path · {phaseName(path.next.phase)}</Muted>
            <ListRow to={`/learn/${path.next.track}/${path.next.id}`} right={<Pill>preview</Pill>}>
              {path.next.title}
            </ListRow>
            <Muted className="mt-2">No lesson written yet. The preview shows what it will cover.</Muted>
          </div>
        ) : (
          <Muted>Every topic has a lesson.</Muted>
        )}
        <Muted className="mt-3">
          Daily rhythm: 5 min drill of due cards → one new topic → one interview question on it → write your LinkedIn draft when a topic passes 60%.
        </Muted>
        <Bn className="mt-2">প্রতিদিন: ৫ মিনিট due card drill → একটা নতুন topic → তার ওপর একটা interview প্রশ্ন → topic ৬০% পার হলে LinkedIn draft।</Bn>
      </Card>

      <Card>
        <H2>How this works</H2>
        <p className="text-[15px]">
          One topic at a time. Read the lesson once, then never re-read it — answer the drill cards instead. Cards you miss come back tomorrow; cards you know come back in 3, 7, then 21 days. The interviewer grades you like a recruiter and tells you the exact sentence you were missing.
        </p>
        <Muted className="mt-2">Everything you do here is saved on this device.</Muted>
      </Card>

      <Card>
        <H2>Weak spots</H2>
        {weak.length ? (
          <div className="flex flex-col gap-2">
            {weak.map((w) => (
              <div key={w.card.key} className="flex items-start gap-2 text-[15px]">
                <Pill tone="weak">{w.miss}×</Pill>
                <span>{w.card.q}</span>
              </div>
            ))}
            <Link to="/drill?mode=weak" className="inline-flex min-h-[44px] items-center text-accent text-sm font-medium">Drill weak spots →</Link>
          </div>
        ) : (
          <Muted>Do a drill first.</Muted>
        )}
      </Card>
    </div>
  );
}
