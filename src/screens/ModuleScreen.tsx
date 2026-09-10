import { Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getModule, MODULES } from '../content/loader';
import { phaseName } from '../content/tracks';
import { useStore } from '../store/Store';
import { useMastery } from '../store/derive';
import { Markdown } from '../ui/Markdown';
import { Bn, Button, Card, Chip, Chips, CodeBlock, H2, H3, MasteryPill, Muted, Page, Reveal } from '../ui/primitives';
import { SIMULATORS } from '../simulators';

const STACK_LABEL = { laravel: 'Laravel', symfony: 'Symfony', dotnet: '.NET', node: 'Node' } as const;

export function ModuleScreen() {
  const { moduleId } = useParams();
  const m = getModule(moduleId);
  if (!m) return <Page back="/learn" title="Not found">No such module.</Page>;
  // Anything with a lesson is readable. Without one, the preview says what the module will cover.
  return m.lesson ? <LessonView id={m.id} /> : <PreviewView id={m.id} />;
}

function PreviewView({ id }: { id: string }) {
  const m = getModule(id)!;
  const stop = MODULES.indexOf(m) + 1;
  const p = m.preview ?? { what: '', picture: '', why: '', bn: '' };
  return (
    <Page back={`/learn/${m.track}`} title={m.title}>
      <Card>
        <Muted>
          Stop {stop} of {MODULES.length} · {phaseName(m.phase)}
        </Muted>
        <H3>What it is</H3>
        <p>{p.what}</p>
        <H3>Picture it</H3>
        <div className="rounded-xl bg-warn-soft px-3 py-2 dark:bg-[#2c2410]">{p.picture}</div>
        <H3>Why interviewers ask</H3>
        <p>{p.why}</p>
        <H3>বাংলায়</H3>
        <Bn>{p.bn}</Bn>
        <div className="bn mt-4 rounded-xl bg-accent-soft/60 px-3 py-2 text-[15px] dark:bg-[#12291b]">
          No lesson written yet. When it lands, the lesson, code, Bangla summary and drill cards appear here.
        </div>
      </Card>
    </Page>
  );
}

function LessonView({ id }: { id: string }) {
  const m = getModule(id)!;
  const L = m.lesson!;
  const { settings, updateSettings, notes, saveNote } = useStore();
  const mastery = useMastery()[m.id];
  const nav = useNavigate();
  const [note, setNote] = useState(notes.find((n) => n.id === m.id)?.text ?? '');
  const simple = settings.simple && L.simple;
  const Sim = L.simulator ? SIMULATORS[L.simulator] : undefined;

  return (
    <Page back={`/learn/${m.track}`} title={m.title}>
      <div className="flex items-center justify-between">
        <Muted>{phaseName(m.phase)}</Muted>
        <MasteryPill pct={mastery} />
      </div>

      <Card>
        {L.problem && (
          <>
            <H3>The situation</H3>
            <Markdown text={L.problem} />
          </>
        )}
        {L.picture && (
          <>
            <H3>Picture it</H3>
            <div className="rounded-xl bg-warn-soft px-3 py-2 dark:bg-[#2c2410]">
              <Markdown text={L.picture} />
            </div>
          </>
        )}
        {L.hook && (
          <>
            <H3>Remember this</H3>
            <p className="text-[17px] font-semibold">{L.hook}</p>
          </>
        )}
        <div className="mt-4 flex items-center justify-between">
          <H3>{simple ? 'Explained simply' : 'Concept'}</H3>
          <Chip on={settings.simple} onClick={() => updateSettings({ simple: !settings.simple })}>
            Explain like I'm 12
          </Chip>
        </div>
        {settings.simple && !L.simple && <Muted className="mb-2">No simple version for this module yet — showing the full one.</Muted>}
        <Markdown text={simple ? L.simple : L.concept} className="text-[15.5px]" />

        {L.wrong && (
          <>
            <H3>The wrong way</H3>
            <CodeBlock code={L.wrong.code} lang={L.wrong.lang} />
            {L.wrong.why && <Markdown text={L.wrong.why} className="mt-1 text-[14.5px]" />}
          </>
        )}
        {L.right && (
          <>
            <H3>{L.wrong ? 'The right way' : 'Code'}</H3>
            <CodeBlock code={L.right.code} lang={L.right.lang} />
            {L.right.why && <Markdown text={L.right.why} className="mt-1 text-[14.5px]" />}
          </>
        )}

        {Sim && (
          <>
            <H3>Try it</H3>
            <Suspense fallback={<Muted>Loading simulator…</Muted>}>
              <Sim />
            </Suspense>
          </>
        )}

        <H3>বাংলা সারসংক্ষেপ</H3>
        {settings.lang === 'en-bn' ? <Bn>{L.bn}</Bn> : <Muted>Bangla is off. Turn on EN+BN in Settings.</Muted>}

        {L.crossStack.length > 0 && (
          <>
            <H3>Across stacks</H3>
            {/* Under 600px: one card per concept. 600px and up: the table. */}
            <div className="flex flex-col gap-2 min-[600px]:hidden">
              {L.crossStack.map((r, i) => (
                <div key={i} className="rounded-xl border border-line p-3 text-[14px] dark:border-[#2a2e38]">
                  <div className="mb-1 font-semibold">{r.concept}</div>
                  {(['laravel', 'symfony', 'dotnet', 'node'] as const).map((k) =>
                    r[k] ? (
                      <div key={k} className="flex gap-2 py-0.5">
                        <span className="w-16 shrink-0 text-neutral-500">{STACK_LABEL[k]}</span>
                        <span className="min-w-0 flex-1">{r[k]}</span>
                      </div>
                    ) : null,
                  )}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto min-[600px]:block">
              <table className="min-w-full text-[13.5px]">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pr-3">Concept</th><th className="pr-3">Laravel</th><th className="pr-3">Symfony</th><th className="pr-3">.NET</th><th>Node</th>
                  </tr>
                </thead>
                <tbody>
                  {L.crossStack.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top dark:border-[#2a2e38]">
                      <td className="py-1 pr-3 font-medium">{r.concept}</td><td className="py-1 pr-3">{r.laravel}</td><td className="py-1 pr-3">{r.symfony}</td><td className="py-1 pr-3">{r.dotnet}</td><td className="py-1">{r.node}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {L.docs.length > 0 && (
          <>
            <H3>Official docs</H3>
            <ul className="list-disc pl-5">
              {L.docs.map((d) => (
                <li key={d.url}><a className="text-accent underline" href={d.url} target="_blank" rel="noreferrer">{d.label}</a></li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {m.practice.length > 0 && (
        <Card>
          <H2>Practice</H2>
          <Muted>Write your answer in a real editor or on paper first. Reveal only to check.</Muted>
          <div className="mt-3 flex flex-col gap-4">
            {m.practice.map((p, i) => (
              <PracticeItem key={i} index={i} task={p.task} hint={p.hint} solution={p.solution} why={p.why} />
            ))}
          </div>
          <Link to={`/practice/${m.id}`} className="mt-3 inline-block text-sm font-medium text-accent">Open in Practice →</Link>
        </Card>
      )}

      {m.interview.length > 0 && (
        <Card>
          <H2>Interview questions</H2>
          <Muted>{m.interview.length} questions with model answers. Answers stay hidden in the Interview tab until you have tried.</Muted>
        </Card>
      )}

      <Card>
        <H2>My notes</H2>
        <textarea
          className="min-h-[90px] w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]"
          placeholder="What clicked, what didn't, the sentence you want to remember…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveNote({ id: m.id, text: note, updated: Date.now() })}
        />
      </Card>

      <Chips className="pb-2">
        <Button variant="primary" className="flex-1" onClick={() => nav(`/drill?module=${m.id}`)}>
          Drill this topic ({m.cards.length})
        </Button>
        <Button className="flex-1" onClick={() => nav(`/interview?module=${m.id}`)}>
          Interview me on it
        </Button>
      </Chips>
    </Page>
  );
}

export function PracticeItem({ index, task, hint, solution, why }: { index: number; task: string; hint: string; solution: string; why: string }) {
  return (
    <div className="rounded-xl border border-line p-3 dark:border-[#2a2e38]">
      <div className="mb-2 flex gap-2 text-[15.5px]">
        <span className="font-semibold">{index + 1}.</span>
        <Markdown text={task} className="min-w-0 flex-1" />
      </div>
      {hint && (
        <div className="mb-2">
          <Reveal label="Show hint" hideLabel="Hide hint">
            <Markdown text={hint} className="text-[14.5px]" />
          </Reveal>
        </div>
      )}
      <Reveal label="Show solution" hideLabel="Hide solution">
        <Markdown text={solution} className="text-[14.5px]" />
        {why && <Markdown text={why} className="mt-2 text-[14.5px]" />}
      </Reveal>
    </div>
  );
}
