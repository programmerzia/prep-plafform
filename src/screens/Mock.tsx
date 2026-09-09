import { useState } from 'react';
import { UNLOCKED } from '../content/loader';
import { TRACK_FOCUS, type TrackFocusId } from '../content/tracks';
import { Markdown } from '../ui/Markdown';
import { todayNumber } from '../logic/leitner';
import { buildMock, mockReport, MOCK_MINUTES, type MockQuestion, type ScoredItem } from '../logic/mock';
import { useStore } from '../store/Store';
import { Bn, Button, Card, Chip, Chips, Empty, H2, Muted, Page, Reveal } from '../ui/primitives';
import { Timer } from '../ui/Timer';

type Stage = 'setup' | 'run' | 'report';

export function Mock() {
  const { record, history } = useStore();
  const [focus, setFocus] = useState<TrackFocusId>('laravel');
  const [stage, setStage] = useState<Stage>('setup');
  const [qs, setQs] = useState<MockQuestion[]>([]);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState('');
  const [scored, setScored] = useState<ScoredItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [report, setReport] = useState<{ avg: number; text: string } | null>(null);

  const available = UNLOCKED.filter((m) => TRACK_FOCUS[focus].tracks.includes(m.track));

  const start = () => {
    const list = buildMock(available);
    setQs(list);
    setI(0);
    setScored([]);
    setAnswer('');
    setRevealed(false);
    setTimeUp(false);
    setStage('run');
  };

  const finish = async (items: ScoredItem[]) => {
    const r = mockReport(items);
    setReport(r);
    setStage('report');
    await record({
      d: todayNumber(),
      type: 'mock',
      focus,
      score: r.avg,
      items: items.map((x) => ({ moduleId: x.moduleId, q: x.q, score: x.score, missing: x.missing })),
      report: r.text,
    });
  };

  const score = async (n: number) => {
    const q = qs[i];
    const items = [...scored, { moduleId: q.moduleId, moduleTitle: q.moduleTitle, q: q.q, score: n, missing: q.missing }];
    setScored(items);
    if (i + 1 >= qs.length || timeUp) {
      await finish(items);
      return;
    }
    setI(i + 1);
    setAnswer('');
    setRevealed(false);
  };

  const pastMocks = history.filter((h) => h.type === 'mock').slice(-5).reverse();

  if (stage === 'setup') {
    return (
      <Page title="Mock">
        <Card>
          <Muted>{MOCK_MINUTES} minutes, 6 questions mixed across the unlocked modules of one track focus. Answer each out loud, type the gist, self-score. You get a written weak-spot report at the end.</Muted>
          <Muted className="mt-2 mb-1">Track focus</Muted>
          <Chips>
            {(Object.keys(TRACK_FOCUS) as TrackFocusId[]).map((f) => (
              <Chip key={f} on={focus === f} onClick={() => setFocus(f)}>
                {TRACK_FOCUS[f].name}
              </Chip>
            ))}
          </Chips>
          <Muted className="mt-2">{available.length} unlocked modules in this track focus.</Muted>
          <Button variant="primary" full className="mt-3" disabled={!available.length} onClick={start}>
            Start {MOCK_MINUTES}-minute mock
          </Button>
        </Card>
        <Card>
          <H2>Past mocks</H2>
          {pastMocks.length === 0 && <Empty>None yet.</Empty>}
          {pastMocks.map((h, k) =>
            h.type === 'mock' ? (
              <div key={k} className="border-t border-line py-2 first:border-0 dark:border-[#2a2e38]">
                <div className="flex justify-between text-[15px]">
                  <span>{TRACK_FOCUS[h.focus as TrackFocusId]?.name ?? h.focus}</span>
                  <span className="font-semibold">{h.score}/10</span>
                </div>
                <Reveal label="Show report" hideLabel="Hide report">
                  <pre className="whitespace-pre-wrap text-[13.5px]">{h.report}</pre>
                </Reveal>
              </div>
            ) : null,
          )}
        </Card>
      </Page>
    );
  }

  if (stage === 'report' && report) {
    return (
      <Page title="Mock report">
        <Card>
          <div className={`text-4xl font-semibold ${report.avg >= 7 ? 'text-accent' : report.avg >= 5 ? 'text-warn' : 'text-danger'}`}>{report.avg}/10</div>
          <pre className="mt-3 whitespace-pre-wrap text-[14px]">{report.text}</pre>
          <Bn className="mt-3">দুর্বল module-গুলো আগে drill করো, ৬০% পার হলে তিন দিন পরে আবার mock দাও।</Bn>
          <Button variant="primary" full className="mt-4" onClick={() => setStage('setup')}>
            Done
          </Button>
        </Card>
      </Page>
    );
  }

  const q = qs[i];
  return (
    <Page title="Mock">
      <div className="flex items-center justify-between">
        <Muted>
          Question {i + 1} of {qs.length} · {q.moduleTitle}
        </Muted>
        <Timer seconds={MOCK_MINUTES * 60} running={!timeUp} onEnd={() => setTimeUp(true)} />
      </div>
      {timeUp && <div className="text-sm text-danger">Time is up. Score this one and the report will be written.</div>}
      <Card>
        <div className="text-[17px] font-medium">{q.q}</div>
      </Card>
      <Card>
        <textarea
          className="min-h-[120px] w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]"
          placeholder="Say it out loud, then type the gist…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        {!revealed ? (
          <Button variant="primary" full className="mt-2" disabled={!answer.trim()} onClick={() => setRevealed(true)}>
            Show model answer
          </Button>
        ) : (
          <>
            <div className="mt-3 rounded-xl bg-accent-soft/60 p-3 text-[15px] dark:bg-[#12291b]">{q.fromCards ? q.model : <Markdown text={q.model} />}</div>
            {q.missing && (
              <div className="mt-2">
                <Muted>The sentence you're missing</Muted>
                <Markdown text={q.missing} className="font-medium" />
              </div>
            )}
            {q.bn && <Bn className="mt-2">{q.bn}</Bn>}
            <Muted className="mt-3 mb-1">Score yourself (7 = hireable senior)</Muted>
            <Chips>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Chip key={n} onClick={() => score(n)}>
                  {n}
                </Chip>
              ))}
            </Chips>
          </>
        )}
      </Card>
      <Button variant="ghost" onClick={() => setStage('setup')}>Abandon mock</Button>
    </Page>
  );
}
