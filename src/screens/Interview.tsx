import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { callLLM, PROVIDERS, type ChatMessage } from '../ai/providers';
import { MODES, STRUCTURE, offlineQuestion, parseScore, structureHits, systemPrompt, type OfflineQuestion } from '../ai/interviewer';
import { getModule, UNLOCKED } from '../content/loader';
import { todayNumber } from '../logic/leitner';
import { useStore } from '../store/Store';
import type { InterviewMode } from '../store/types';
import { ModulePicker } from '../ui/ModulePicker';
import { Bn, Button, Card, Chip, Chips, Empty, H2, Muted, Page, Reveal } from '../ui/primitives';
import { Timer } from '../ui/Timer';

type Stage = 'setup' | 'answer' | 'graded';

export function Interview() {
  const [params, setParams] = useSearchParams();
  const tenMin = params.get('mode') === '10min';
  const initial = params.get('module') ?? UNLOCKED[0]?.id;
  const { settings, record } = useStore();
  const nav = useNavigate();

  const [moduleId, setModuleId] = useState<string | undefined>(initial);
  const [mode, setMode] = useState<InterviewMode>('tech');
  const [stage, setStage] = useState<Stage>('setup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [timeUp, setTimeUp] = useState(false);

  const [offline, setOffline] = useState<OfflineQuestion | null>(null);
  const [aiQ, setAiQ] = useState('');
  const [hist, setHist] = useState<ChatMessage[]>([]);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const m = getModule(moduleId);
  const isOffline = settings.ai.provider === 'offline';
  const provName = PROVIDERS[settings.ai.provider].name.split(' —')[0].split(' (')[0];
  const question = isOffline ? offline?.q : aiQ;

  const ask = async () => {
    if (!m) return;
    setError('');
    setAnswer('');
    setFeedback('');
    setScore(null);
    setChecks({});
    setTimeUp(false);
    if (isOffline) {
      const q = offlineQuestion(m);
      if (!q) {
        setError('This module has no questions yet.');
        return;
      }
      setOffline(q);
      setStage('answer');
      return;
    }
    setBusy(true);
    try {
      const q = await callLLM(settings.ai, systemPrompt(m, mode), [{ role: 'user', content: 'Ask me the question.' }]);
      setAiQ(q);
      setHist([{ role: 'user', content: 'Ask me the question.' }, { role: 'assistant', content: q }]);
      setStage('answer');
    } catch (e) {
      setError(`Could not reach the interviewer: ${(e as Error).message}. Choose Gemini/Groq (free) or Offline in Settings.`);
    } finally {
      setBusy(false);
    }
  };

  const grade = async () => {
    if (!m || !answer.trim()) return;
    if (isOffline) {
      if (mode === 'ai') setChecks(structureHits(answer));
      setStage('graded');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const msgs: ChatMessage[] = [...hist, { role: 'user', content: `My answer:\n${answer}\n\nGrade it now in the required format.` }];
      const r = await callLLM(settings.ai, systemPrompt(m, mode), msgs);
      setHist([...msgs, { role: 'assistant', content: r }]);
      const sc = parseScore(r);
      setScore(sc);
      setFeedback(r.replace(/^SCORE:.*\n?/, ''));
      setStage('graded');
      await record({ d: todayNumber(), type: 'interview', moduleId: m.id, mode, score: sc, q: aiQ });
    } catch (e) {
      setError(`Grading failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const selfScore = async (n: number) => {
    if (!m) return;
    setScore(n);
    await record({ d: todayNumber(), type: 'interview', moduleId: m.id, mode, score: n, q: offline?.q ?? '' });
  };

  const structureScore = useMemo(() => Object.values(checks).filter(Boolean).length, [checks]);

  if (stage === 'setup') {
    return (
      <Page title="Interview">
        <Card>
          <Muted>
            An interviewer asks a senior-level question on the topic you choose. Answer out loud first, then type what you said. You get a score, what a strong answer includes, and the one line you missed.
          </Muted>
          <div className="mt-3">
            <ModulePicker value={moduleId} onChange={(id) => { setModuleId(id); if (id) setParams({ module: id }); }} />
          </div>
          <Muted className="mt-3 mb-1">Style</Muted>
          <Chips>
            {(Object.keys(MODES) as InterviewMode[]).map((k) => (
              <Chip key={k} on={mode === k} onClick={() => setMode(k)}>
                {MODES[k]}
              </Chip>
            ))}
          </Chips>
          {mode === 'ai' && <Muted className="mt-2">AI-screen mode: 90 seconds on the clock. Structure your answer context → decision → trade-off → outcome.</Muted>}
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" className="flex-1" disabled={!m || busy} onClick={ask}>
              {busy ? 'Thinking…' : 'Ask me a question'}
            </Button>
          </div>
          <Muted className="mt-2">
            Using: {provName} · <Link to="/more/settings" className="text-accent">change</Link>
          </Muted>
          {error && <div className="mt-2 text-sm text-danger">{error}</div>}
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Interview">
      <Card>
        <div className="flex items-center justify-between">
          <Muted>
            {m?.title} · {MODES[mode]}{offline?.fromCards ? ' · from drill cards' : ''}
          </Muted>
          {mode === 'ai' && stage === 'answer' && <Timer seconds={90} running={!timeUp} onEnd={() => setTimeUp(true)} big />}
        </div>
        <div className="mt-2 text-[17px] font-medium">{question}</div>
        {timeUp && stage === 'answer' && <div className="mt-2 text-sm text-danger">Time. Finish the sentence you're on and grade.</div>}
      </Card>

      {stage === 'answer' && (
        <Card>
          <textarea
            className="min-h-[140px] w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]"
            placeholder="Type the answer you'd say on the call…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3">
            <Button variant="primary" disabled={!answer.trim() || busy} onClick={grade}>
              {busy ? 'Grading…' : 'Grade my answer'}
            </Button>
            <Muted>Answer first. Never look up.</Muted>
          </div>
          {error && <div className="mt-2 text-sm text-danger">{error}</div>}
        </Card>
      )}

      {stage === 'graded' && isOffline && offline && (
        <Card>
          <H2>Check yourself</H2>
          <Muted className="mb-2">Your answer</Muted>
          <div className="mb-3 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[14.5px] dark:bg-[#1f232b]">{answer}</div>
          <Reveal label="Show model answer" hideLabel="Hide model answer">
            <div className="rounded-xl bg-accent-soft/60 p-3 text-[15px] dark:bg-[#12291b]">{offline.model}</div>
            {offline.missing && (
              <div className="mt-2">
                <Muted>The sentence you're missing</Muted>
                <div className="font-medium">{offline.missing}</div>
              </div>
            )}
            {offline.followUp && (
              <div className="mt-2">
                <Muted>Follow-up they'd ask</Muted>
                <div>{offline.followUp}</div>
              </div>
            )}
            {offline.bn && <Bn className="mt-2">{offline.bn}</Bn>}
          </Reveal>

          {mode === 'ai' && (
            <div className="mt-4">
              <Muted className="mb-1">Structure check — tap what your answer actually had</Muted>
              <Chips>
                {STRUCTURE.map((s) => (
                  <Chip key={s} on={!!checks[s]} onClick={() => setChecks({ ...checks, [s]: !checks[s] })}>
                    {s}
                  </Chip>
                ))}
              </Chips>
              <Muted className="mt-1">{structureScore}/4 parts, in this order: context → decision → trade-off → outcome.</Muted>
            </div>
          )}

          <Muted className="mt-4 mb-1">Score yourself honestly (7 = hireable senior)</Muted>
          <Chips>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Chip key={n} on={score === n} onClick={() => selfScore(n)}>
                {n}
              </Chip>
            ))}
          </Chips>
          {score !== null && <ScoreRow score={score} onNext={ask} tenMin={tenMin} onDone={() => nav('/')} />}
        </Card>
      )}

      {stage === 'graded' && !isOffline && (
        <Card>
          <div className={`text-3xl font-semibold ${tone(score)}`}>{score ?? '–'}/10</div>
          <div className="mt-2 whitespace-pre-wrap text-[14.5px]">{feedback}</div>
          <ScoreRow score={score} onNext={ask} tenMin={tenMin} onDone={() => nav('/')} />
        </Card>
      )}

      {stage === 'graded' && !m && <Empty>Pick a module first.</Empty>}
      <Button variant="ghost" onClick={() => setStage('setup')}>Change topic</Button>
    </Page>
  );
}

function tone(score: number | null) {
  if (score === null) return '';
  return score >= 7 ? 'text-accent' : score >= 5 ? 'text-warn' : 'text-danger';
}

function ScoreRow({ score, onNext, tenMin, onDone }: { score: number | null; onNext: () => void; tenMin: boolean; onDone: () => void }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      {score !== null && <span className={`text-2xl font-semibold ${tone(score)}`}>{score}/10</span>}
      {tenMin ? (
        <Button variant="primary" onClick={onDone}>Done — back to Today</Button>
      ) : (
        <Button onClick={onNext}>Next question</Button>
      )}
    </div>
  );
}
