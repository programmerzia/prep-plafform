import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../../store/Store';
import { Bn, Button, Chip, Chips, Muted } from '../../ui/primitives';
import { playDelay } from './stats';
import type { SimShellProps } from './types';

const SPEEDS = [0.5, 1, 2];

/**
 * Shared frame for every simulator: predict-first prompt, Broken/Fixed toggle, presets,
 * Step / Auto-play / Pause / Reset, narration (EN + BN), story header, "What to notice".
 * Stacked at 380px; from 900px the state sits left and the narration right.
 */
export function SimShell<S>(props: SimShellProps<S>) {
  const { id, title, story, storyBn, modes, mode, onMode, presets, preset, onPreset, extras, steps, render, prediction, notice } = props;
  const { settings, recordPrediction } = useStore();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [storyOpen, setStoryOpen] = useState(true);
  const [picked, setPicked] = useState<string | null>(null); // prediction choice for this scenario
  const [scored, setScored] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const last = steps.length - 1;
  const done = index >= last;
  const current = steps[Math.min(index, last)];
  // A new scenario means a fresh prediction and a fresh run. Simulators memoise `steps` on
  // every input (mode, preset, extras), so a new steps array is the signal.
  const prevSteps = useRef(steps);
  useEffect(() => {
    if (prevSteps.current !== steps) {
      prevSteps.current = steps;
      setIndex(0);
      setPlaying(false);
      setPicked(null);
      setScored(false);
    }
  }, [steps]);

  const reset = useCallback(() => {
    setIndex(0);
    setPlaying(false);
  }, []);

  const step = useCallback(() => {
    if (!picked) return;
    setIndex((i) => Math.min(last, i + 1));
  }, [picked, last]);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(last, i + 1)), playDelay(speed, reducedMotion));
    return () => clearTimeout(t);
  }, [playing, index, done, last, speed, reducedMotion]);

  // Score the prediction once the run reaches the end.
  useEffect(() => {
    if (done && picked && !scored) {
      setScored(true);
      void recordPrediction(id, picked === prediction.correct);
    }
  }, [done, picked, scored, id, prediction.correct, recordPrediction]);

  // Keyboard: space = step, r = reset (only when the shell is on screen and focus is not in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
      if (!rootRef.current || !rootRef.current.isConnected) return;
      if (e.key === ' ') {
        e.preventDefault();
        step();
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, reset]);

  const hit = picked === prediction.correct;
  const pickedLabel = prediction.choices.find((c) => c.id === picked)?.label;

  return (
    <div ref={rootRef} className={`flex flex-col gap-3 text-[14.5px] ${reducedMotion ? 'motion-reduce' : ''}`} data-sim={id}>
      {/* Story header */}
      <div className="rounded-xl bg-warn-soft px-3 py-2 dark:bg-[#2c2410]">
        <button className="flex w-full min-h-[44px] items-center justify-between text-left font-semibold" onClick={() => setStoryOpen((o) => !o)} aria-expanded={storyOpen}>
          <span>{title}</span>
          <span aria-hidden>{storyOpen ? '▾' : '▸'}</span>
        </button>
        {storyOpen && (
          <div>
            <p className="m-0">{story}</p>
            {storyBn && settings.lang === 'en-bn' && <p className="bn m-0 mt-1 text-[14px]">{storyBn}</p>}
          </div>
        )}
      </div>

      {/* Mode + presets */}
      <div className="flex flex-col gap-2">
        <Chips>
          {modes.map((m) => (
            <Chip key={m.id} on={mode === m.id} onClick={() => onMode(m.id)}>
              {m.label}
            </Chip>
          ))}
        </Chips>
        {presets && presets.length > 0 && (
          <Chips>
            {presets.map((p) => (
              <Chip key={p.id} on={preset === p.id} onClick={() => onPreset?.(p.id)}>
                {p.label}
              </Chip>
            ))}
          </Chips>
        )}
        {extras}
      </div>

      <div className="flex flex-col gap-3 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_340px] min-[900px]:items-start min-[900px]:gap-4">
        {/* State (left on desktop) */}
        <div className="flex min-w-0 flex-col gap-3">
          {!picked ? (
            <div className="rounded-xl border border-line p-3 dark:border-[#2a2e38]">
              <div className="mb-2 font-semibold">What do you think will happen?</div>
              <Muted className="mb-2">{prediction.question}</Muted>
              <Chips>
                {prediction.choices.map((c) => (
                  <Chip key={c.id} onClick={() => setPicked(c.id)}>
                    {c.label}
                  </Chip>
                ))}
              </Chips>
            </div>
          ) : (
            done && (
              <div className={`rounded-xl px-3 py-2 ${hit ? 'bg-accent-soft text-accent dark:bg-[#123a22] dark:text-[#8fe3ad]' : 'bg-warn-soft text-warn dark:bg-[#3a2c10] dark:text-[#f0c36a]'}`}>
                You predicted <b>{pickedLabel}</b> — actual: <b>{prediction.actual}</b>. {hit ? 'Spot on.' : 'Watch the steps again to see why.'}
              </div>
            )
          )}

          <div>{render(current.state, Math.min(index, last), steps)}</div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={!picked || done} onClick={step} aria-label="Step">
              Step ▸
            </Button>
            {playing ? (
              <Button onClick={() => setPlaying(false)}>Pause ❚❚</Button>
            ) : (
              <Button disabled={!picked || done} onClick={() => setPlaying(true)}>
                Auto-play ▶
              </Button>
            )}
            <Button onClick={reset}>Reset</Button>
            <Chips>
              {SPEEDS.map((s) => (
                <Chip key={s} on={speed === s} onClick={() => setSpeed(s)} aria-label={`Speed ${s}x`}>
                  {s}×
                </Chip>
              ))}
            </Chips>
          </div>
          <Muted>
            Step {Math.min(index, last)} of {last}. Keyboard: space = step, r = reset.
          </Muted>
        </div>

        {/* Narration (right on desktop) */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-xl border border-line p-3 dark:border-[#2a2e38]">
            <Muted className="mb-1">What is happening</Muted>
            <div className={`min-h-[48px] transition-opacity ${toneClass(current.tone)}`}>{picked ? current.en : 'Pick a prediction first, then press Step.'}</div>
            {picked && current.bn && <Bn className="mt-2 text-[14px]">{current.bn}</Bn>}
            {picked && index > 0 && (
              <ol className="mt-3 list-decimal pl-5 text-[13px] text-neutral-500 dark:text-neutral-400">
                {steps.slice(1, Math.min(index, last) + 1).map((s, i) => (
                  <li key={i} className={i === Math.min(index, last) - 1 ? 'font-medium text-ink dark:text-neutral-100' : ''}>
                    {s.en}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {done && picked && <NoticeBox notice={notice} showBn={settings.lang === 'en-bn'} />}
        </div>
      </div>
    </div>
  );
}

function toneClass(t?: 'ok' | 'bad' | 'wait') {
  if (t === 'ok') return 'text-accent';
  if (t === 'bad') return 'text-danger';
  if (t === 'wait') return 'text-warn';
  return '';
}

function NoticeBox({ notice, showBn }: { notice: SimShellProps<unknown>['notice']; showBn: boolean }) {
  return (
    <div className="rounded-xl border border-accent/40 bg-accent-soft/40 p-3 dark:bg-[#12291b]">
      <div className="mb-1 font-semibold">What to notice</div>
      <ul className="m-0 list-disc pl-5">
        {notice.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <p className="mt-2 mb-0 font-semibold">{notice.takeaway}</p>
      {showBn && notice.takeawayBn && <p className="bn mt-1 mb-0 text-[14px]">{notice.takeawayBn}</p>}
      <p className="mt-2 mb-0">
        <span className="font-medium">Try to break it:</span> {notice.challenge}
      </p>
    </div>
  );
}

export type { ReactNode };
