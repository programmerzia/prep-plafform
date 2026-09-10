import type { SimStep } from '../kit/types';

/** queue-backoff: re-cooking a failed dish, but not forever. */
export const MODES = [
  { id: 'none', label: 'Retry now, forever' },
  { id: 'fix', label: 'Backoff + dead-letter' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const PRESETS = [
  { id: 'normal', label: '6 jobs, some fail' },
  { id: 'poison', label: 'one poison job' },
] as const;
export type Preset = (typeof PRESETS)[number]['id'];

export const ON_ERROR = [
  { id: 'release', label: 'release with delay (retry)' },
  { id: 'fail', label: 'fail() on first error' },
] as const;
export type OnError = (typeof ON_ERROR)[number]['id'];

export interface Options {
  workers: number;
  failureRate: number; // 0..100
  idempotent: boolean;
  onError: OnError;
}

export const MAX_ATTEMPTS = 3;
export const TICKS = 24;

export type JobStatus = 'queued' | 'running' | 'waiting' | 'done' | 'dead';
export interface Job {
  id: number;
  name: string;
  attempts: number;
  status: JobStatus;
  nextAt: number;
  poison: boolean;
  sideEffects: number; // emails sent, charges made…
  enqueuedAt: number;
  doneAt: number | null;
  backoffs: number[];
}

export interface QueueState {
  t: number;
  jobs: Job[];
  workers: number;
  running: number[]; // job ids running this tick
  done: number;
  dead: number;
  attemptsTotal: number;
  throughput: number; // done per 10s
  avgWait: number;
  starved: boolean;
  finished: boolean;
}

const NAMES = ['send invoice', 'resize image', 'sync CRM', 'export CSV', 'send SMS', 'rebuild index'];

/** Deterministic "random": stable per job+attempt so the same settings replay identically. */
export function fails(jobId: number, attempt: number, rate: number, poison: boolean): boolean {
  if (poison) return true;
  const h = (jobId * 7919 + attempt * 104729) % 100;
  return h < rate;
}

export function backoffSeconds(attempt: number, jobId: number): number {
  const base = Math.min(30, 2 ** (attempt - 1)); // 1, 2, 4, 8 … capped
  const jitter = (jobId * 37 + attempt * 11) % 2; // 0 or 1 second of jitter
  return base + jitter;
}

function initial(preset: Preset, workers: number): QueueState {
  const n = 6;
  const jobs: Job[] = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: NAMES[i],
    attempts: 0,
    status: 'queued',
    nextAt: 0,
    poison: preset === 'poison' && i === 0,
    sideEffects: 0,
    enqueuedAt: 0,
    doneAt: null,
    backoffs: [],
  }));
  return { t: 0, jobs, workers, running: [], done: 0, dead: 0, attemptsTotal: 0, throughput: 0, avgWait: 0, starved: false, finished: false };
}

export function buildSteps(mode: Mode, preset: Preset, opts: Options): SimStep<QueueState>[] {
  const rate = preset === 'poison' ? 0 : opts.failureRate;
  let st = initial(preset, opts.workers);
  const steps: SimStep<QueueState>[] = [
    { state: st, en: `${st.jobs.length} tickets on the rail, ${opts.workers} cook${opts.workers > 1 ? 's' : ''}. ${preset === 'poison' ? 'One dish can never be cooked.' : `${rate}% of attempts fail.`} Predict how many are done after ${TICKS}s.`, bn: `রেলে ${st.jobs.length}টা টিকিট, ${opts.workers} জন cook। ${TICKS}s পরে কয়টা শেষ হবে অনুমান করো।` },
  ];
  const clone = (): QueueState => ({ ...st, jobs: st.jobs.map((j) => ({ ...j, backoffs: [...j.backoffs] })), running: [] });

  for (let t = 1; t <= TICKS; t++) {
    const s = clone();
    s.t = t;
    const lines: string[] = [];
    let tone: 'ok' | 'bad' | 'wait' | undefined;
    // pick jobs: queued first (FIFO), then waiting ones whose time has come
    const ready = s.jobs.filter((j) => j.status === 'queued' || (j.status === 'waiting' && j.nextAt <= t)).sort((a, b) => a.nextAt - b.nextAt || a.id - b.id);
    const picked = ready.slice(0, s.workers);
    for (const j of picked) {
      j.attempts += 1;
      s.attemptsTotal += 1;
      s.running.push(j.id);
      j.sideEffects += 1; // the job's side effect happens on every attempt
      const failed = fails(j.id, j.attempts, rate, j.poison);
      if (!failed) {
        j.status = 'done';
        j.doneAt = t;
        s.done += 1;
        lines.push(`"${j.name}" succeeds${j.attempts > 1 ? ` on attempt ${j.attempts}` : ''}`);
        continue;
      }
      if (mode === 'none') {
        j.status = 'queued';
        j.nextAt = -1; // straight back to the FRONT of the rail: it sorts before everything else
        lines.push(`"${j.name}" fails (attempt ${j.attempts}) → back on the rail immediately`);
        tone = 'bad';
      } else if (opts.onError === 'fail') {
        j.status = 'dead';
        s.dead += 1;
        lines.push(`"${j.name}" throws → fail(): straight to the failed-jobs tray, no retry`);
        tone = 'wait';
      } else if (j.attempts >= MAX_ATTEMPTS) {
        j.status = 'dead';
        s.dead += 1;
        lines.push(`"${j.name}" fails attempt ${j.attempts} of ${MAX_ATTEMPTS} → dead-letter tray (failed_jobs)`);
        tone = 'wait';
      } else {
        const wait = backoffSeconds(j.attempts, j.id);
        j.status = 'waiting';
        j.nextAt = t + wait;
        j.backoffs.push(wait);
        lines.push(`"${j.name}" fails attempt ${j.attempts} → release(${wait}s), retry at ${t + wait}s`);
        tone = tone ?? 'wait';
      }
    }
    const queuedBehind = s.jobs.filter((j) => j.status === 'queued' && !picked.includes(j)).length;
    if (mode === 'none' && picked.some((j) => j.status === 'queued' && j.attempts > 1) && queuedBehind > 0) {
      s.starved = true;
      lines.push(`${queuedBehind} other ticket${queuedBehind > 1 ? 's' : ''} wait behind the failing one`);
    }
    const doneJobs = s.jobs.filter((j) => j.doneAt !== null);
    s.avgWait = doneJobs.length ? Math.round((doneJobs.reduce((a, j) => a + (j.doneAt! - j.enqueuedAt), 0) / doneJobs.length) * 10) / 10 : 0;
    s.throughput = Math.round((s.done / t) * 10 * 10) / 10;
    const idle = picked.length === 0;
    const en = idle ? `${t}s: cooks idle — ${s.jobs.filter((j) => j.status === 'waiting').length > 0 ? 'the failed tickets are waiting out their backoff' : 'nothing left to cook'}.` : `${t}s: ${lines.join('; ')}.`;
    if (tone === 'ok' || (!tone && !idle)) tone = 'ok';
    st = s;
    steps.push({ state: s, en, bn: idle ? `${t}s: cook-রা বসে আছে।` : `${t}s: ${picked.length}টা টিকিট রান্না হলো।`, tone: idle ? undefined : tone });
    const allSettled = s.jobs.every((j) => j.status === 'done' || j.status === 'dead');
    if (allSettled) break;
  }
  const final = clone();
  final.finished = true;
  const stuck = final.jobs.filter((j) => j.status !== 'done' && j.status !== 'dead');
  const dup = final.jobs.filter((j) => j.sideEffects > 1);
  const dupNote = !opts.idempotent && dup.length ? ` Not idempotent: ${dup.map((j) => `"${j.name}" ran its side effect ${j.sideEffects}×`).join(', ')}.` : '';
  steps.push({
    state: final,
    en: `${final.t}s: ${final.done} done, ${final.dead} in the dead-letter tray${stuck.length ? `, ${stuck.length} still stuck` : ''}. ${final.attemptsTotal} attempts in total.${final.starved ? ' Other tickets starved behind the failing one.' : ''}${dupNote}`,
    bn: `${final.t}s: ${final.done}টা শেষ, ${final.dead}টা failed tray-তে${stuck.length ? `, ${stuck.length}টা আটকে` : ''}।`,
    tone: stuck.length || final.starved ? 'bad' : 'ok',
  });
  return steps;
}

export function summary(mode: Mode, preset: Preset, opts: Options): { done: number; dead: number; attempts: number } {
  const s = buildSteps(mode, preset, opts);
  const last = s[s.length - 1].state;
  return { done: last.done, dead: last.dead, attempts: last.attemptsTotal };
}

export function laravelJob(mode: Mode, onError: OnError): string {
  if (mode === 'none') return `class SendInvoice implements ShouldQueue
{
    public $tries = 0;          // 0 = unlimited (the bug)
    public $backoff = 0;        // retry immediately
    public function handle() { Mail::send(...); }
}`;
  if (onError === 'fail') return `class SendInvoice implements ShouldQueue
{
    public $tries = 1;
    public function handle() {
        try { Mail::send(...); }
        catch (PermanentException $e) { $this->fail($e); }   // no point retrying
    }
    public function failed(Throwable $e) { Log::error(...); }  // dead-letter hook
}`;
  return `class SendInvoice implements ShouldQueue
{
    public $tries = 3;                       // then failed_jobs (dead-letter)
    public $backoff = [1, 2, 4];             // seconds between attempts (+ jitter in Horizon)
    public function retryUntil() { return now()->addMinutes(10); }
    public function handle() { Mail::send(...); }
    public function failed(Throwable $e) { Log::error(...); }  // runs once, on dead-letter
}`;
}
