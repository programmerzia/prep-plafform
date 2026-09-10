import type { SimStep } from '../kit/types';

/** lock-race: two people, the last seat. */
export const MODES = [
  { id: 'none', label: 'No lock' },
  { id: 'fix', label: 'With a fix' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const PRESETS = [
  { id: '2x1', label: '2 users, 1 seat' },
  { id: '3x2', label: '3 users, 2 seats' },
] as const;

export const FIXES = [
  { id: 'forUpdate', label: 'SELECT … FOR UPDATE' },
  { id: 'atomic', label: 'atomic UPDATE WHERE seats > 0' },
  { id: 'optimistic', label: 'version column' },
] as const;
export type Fix = (typeof FIXES)[number]['id'];

export type Phase = 'READ' | 'CHECK' | 'WRITE' | 'COMMIT' | 'UPDATE';
export type Status = 'idle' | 'running' | 'waiting' | 'ticket' | 'refused' | 'retry';

export interface Lane {
  name: string;
  phaseIndex: number;
  status: Status;
  read: number | null;
  readVersion: number | null;
  attempts: number;
  sql: string;
}

export interface RaceState {
  seats: number;
  version: number;
  lanes: Lane[];
  lockHolder: string | null;
  tickets: number;
  sql: string;
  done: boolean;
}

const NAMES = ['Ziaur', 'Arafat', 'Nadia'];

export function phasesFor(mode: Mode, fix: Fix): Phase[] {
  if (mode === 'fix' && fix === 'atomic') return ['UPDATE', 'COMMIT'];
  return ['READ', 'CHECK', 'WRITE', 'COMMIT'];
}

export function sqlFor(phase: Phase, mode: Mode, fix: Fix, lane?: Lane): string {
  const lock = mode === 'fix' && fix === 'forUpdate' ? ' FOR UPDATE' : '';
  switch (phase) {
    case 'READ':
      return mode === 'fix' && fix === 'optimistic' ? 'SELECT seats, version FROM buses WHERE id = 1;' : `SELECT seats FROM buses WHERE id = 1${lock};`;
    case 'CHECK':
      return `-- app code: if (seats > 0) proceed   // seats = ${lane?.read ?? '?'}`;
    case 'WRITE':
      return mode === 'fix' && fix === 'optimistic'
        ? `UPDATE buses SET seats = seats - 1, version = version + 1 WHERE id = 1 AND version = ${lane?.readVersion ?? '?'};`
        : 'UPDATE buses SET seats = seats - 1 WHERE id = 1;';
    case 'UPDATE':
      return 'UPDATE buses SET seats = seats - 1 WHERE id = 1 AND seats > 0;  -- affected rows tells you if you got it';
    case 'COMMIT':
      return 'COMMIT;';
  }
}

function initial(preset: string): RaceState {
  const users = preset === '3x2' ? 3 : 2;
  const seats = preset === '3x2' ? 2 : 1;
  return {
    seats,
    version: 1,
    lanes: NAMES.slice(0, users).map((name) => ({ name, phaseIndex: -1, status: 'idle', read: null, readVersion: null, attempts: 0, sql: '' })),
    lockHolder: null,
    tickets: 0,
    sql: '',
    done: false,
  };
}

/**
 * Discrete scheduler: tick 0, 1, 2… Lane k starts at tick k*delay. Every tick each started
 * lane performs one phase, in lane order. Each performed action is one step.
 */
export function buildSteps(mode: Mode, preset: string, fix: Fix = 'forUpdate', delay = 0): SimStep<RaceState>[] {
  const phases = phasesFor(mode, fix);
  let st = initial(preset);
  const steps: SimStep<RaceState>[] = [
    {
      state: st,
      en: `${st.seats} seat${st.seats > 1 ? 's' : ''} left. ${st.lanes.map((l) => l.name).join(' and ')} tap "Book" ${delay === 0 ? 'in the same second' : `${delay} step${delay > 1 ? 's' : ''} apart`}. Predict how many tickets get sold.`,
      bn: `${st.seats}টা সিট বাকি। ${st.lanes.length} জন একসাথে "Book" চাপল। কয়টা টিকিট বিক্রি হবে অনুমান করো।`,
    },
  ];
  const push = (next: RaceState, en: string, bn: string, tone?: 'ok' | 'bad' | 'wait') => {
    st = next;
    steps.push({ state: next, en, bn, tone });
  };
  const clone = (): RaceState => ({ ...st, lanes: st.lanes.map((l) => ({ ...l })) });

  for (let tick = 0; tick < 40; tick++) {
    const active = st.lanes.some((l) => !['ticket', 'refused'].includes(l.status));
    if (!active) break;
    st.lanes.forEach((_, k) => {
      const s = clone();
      const lane = s.lanes[k];
      if (['ticket', 'refused'].includes(lane.status)) return;
      if (tick < k * delay) return; // has not tapped yet
      const nextPhase = phases[lane.phaseIndex + 1];
      if (!nextPhase) return;

      // Locks: FOR UPDATE takes the row lock at READ; atomic UPDATE takes it at UPDATE.
      const wantsLock = (mode === 'fix' && fix === 'forUpdate' && nextPhase === 'READ') || (mode === 'fix' && fix === 'atomic' && nextPhase === 'UPDATE');
      if (wantsLock && s.lockHolder && s.lockHolder !== lane.name) {
        lane.status = 'waiting';
        s.sql = `-- ${lane.name}: waiting for the row lock held by ${s.lockHolder}`;
        lane.sql = s.sql;
        push(s, `${lane.name} tries to read the seat row, but ${s.lockHolder} holds the lock. ${lane.name} waits (padlock).`, `${lane.name} অপেক্ষা করছে — ${s.lockHolder}-এর হাতে তালা।`, 'wait');
        return;
      }

      lane.phaseIndex += 1;
      lane.status = 'running';
      lane.sql = sqlFor(nextPhase, mode, fix, lane);
      s.sql = `${lane.name}: ${lane.sql}`;

      switch (nextPhase) {
        case 'READ': {
          if (wantsLock) s.lockHolder = lane.name;
          lane.read = s.seats;
          lane.readVersion = s.version;
          push(
            s,
            `${lane.name} reads seats = ${s.seats}${wantsLock ? ' and takes the row lock' : ''}${mode === 'fix' && fix === 'optimistic' ? ` (version ${s.version})` : ''}.`,
            `${lane.name} পড়ল seats = ${s.seats}${wantsLock ? ', তালা নিল' : ''}।`,
            wantsLock ? 'ok' : undefined,
          );
          return;
        }
        case 'CHECK': {
          if ((lane.read ?? 0) > 0) {
            push(s, `${lane.name} checks: ${lane.read} > 0, so the app says "go ahead".`, `${lane.name} দেখল ${lane.read} > 0 — এগোও।`, mode === 'none' && s.lanes.filter((l) => l.status === 'running').length > 1 ? 'bad' : undefined);
          } else {
            lane.status = 'refused';
            if (s.lockHolder === lane.name) s.lockHolder = null;
            push(s, `${lane.name} checks: ${lane.read} > 0 is false. Refused — no seat. Correct.`, `${lane.name}: সিট নেই, না বলা হলো। ঠিক।`, 'ok');
          }
          return;
        }
        case 'WRITE': {
          if (mode === 'fix' && fix === 'optimistic' && lane.readVersion !== s.version) {
            lane.status = 'retry';
            lane.attempts += 1;
            lane.phaseIndex = -1;
            lane.read = null;
            push(s, `${lane.name}'s UPDATE … WHERE version = ${lane.readVersion} touches 0 rows: someone changed the row (version is ${s.version}). Retry from READ.`, `${lane.name}-এর version মেলেনি — আবার পড়া শুরু।`, 'wait');
            return;
          }
          s.seats -= 1;
          if (mode === 'fix' && fix === 'optimistic') s.version += 1;
          push(s, `${lane.name} writes seats = seats - 1 → ${s.seats}.`, `${lane.name} লিখল seats = ${s.seats}।`, s.seats < 0 ? 'bad' : undefined);
          return;
        }
        case 'UPDATE': {
          if (wantsLock) s.lockHolder = lane.name;
          if (s.seats > 0) {
            s.seats -= 1;
            lane.read = 1;
            push(s, `${lane.name}: UPDATE … WHERE seats > 0 → 1 row affected. Seat taken, seats = ${s.seats}.`, `${lane.name}-এর UPDATE ১টা row বদলাল — সিট পেল।`, 'ok');
          } else {
            lane.read = 0;
            push(s, `${lane.name}: UPDATE … WHERE seats > 0 → 0 rows affected. No seat.`, `${lane.name}-এর UPDATE কোনো row বদলায়নি — সিট নেই।`, 'ok');
          }
          return;
        }
        case 'COMMIT': {
          if (s.lockHolder === lane.name) s.lockHolder = null;
          const got = mode === 'fix' && fix === 'atomic' ? lane.read === 1 : true;
          if (got) {
            lane.status = 'ticket';
            s.tickets += 1;
            const over = s.tickets > initial(preset).seats;
            push(s, `${lane.name} commits and gets a ticket.${s.lockHolder === null && mode === 'fix' && fix !== 'optimistic' ? ' The lock is released.' : ''}${over ? ' That is one ticket too many.' : ''}`, `${lane.name} commit করল, টিকিট পেল।${over ? ' একটা টিকিট বেশি!' : ''}`, over ? 'bad' : 'ok');
          } else {
            lane.status = 'refused';
            push(s, `${lane.name} commits nothing: refused. Correct.`, `${lane.name} কিছু পেল না — ঠিক।`, 'ok');
          }
          return;
        }
      }
    });
  }
  const seats0 = initial(preset).seats;
  const over = st.tickets > seats0;
  const final = { ...clone(), done: true, sql: '' };
  push(
    final,
    over
      ? `Result: ${st.tickets} tickets for ${seats0} seat${seats0 > 1 ? 's' : ''}, seats = ${st.seats}. Two people read the same number and both wrote. A transaction alone is not a lock.`
      : `Result: ${st.tickets} ticket${st.tickets !== 1 ? 's' : ''} for ${seats0} seat${seats0 > 1 ? 's' : ''}, seats = ${st.seats}. Nobody was oversold.`,
    over ? `ফল: ${seats0} সিটে ${st.tickets} টিকিট। দুজনেই একই সংখ্যা পড়ে লিখেছে — transaction মানেই lock না।` : `ফল: ${seats0} সিটে ${st.tickets} টিকিট। কেউ বেশি বিক্রি হয়নি।`,
    over ? 'bad' : 'ok',
  );
  return steps;
}

export function ticketsSold(mode: Mode, preset: string, fix: Fix = 'forUpdate', delay = 0): number {
  const s = buildSteps(mode, preset, fix, delay);
  return s[s.length - 1].state.tickets;
}
