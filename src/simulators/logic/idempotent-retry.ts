import type { SimStep } from '../kit/types';

/** idempotent-retry: pressing the lift button twice. */
export const MODES = [
  { id: 'none', label: 'No key' },
  { id: 'key', label: 'Idempotency-Key' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const PRESETS = [
  { id: 'lost', label: 'response lost' },
  { id: 'crash', label: 'server crashed after charging' },
  { id: 'newkey', label: 'client makes a NEW key on retry' },
] as const;
export type Failure = (typeof PRESETS)[number]['id'];

export type ReqStatus = 'sent' | 'processing' | 'responded' | 'lost' | 'crashed' | 'replayed';

export interface RequestCard {
  attempt: number;
  key: string | null;
  status: ReqStatus;
  response: string | null;
}

export interface RetryState {
  requests: RequestCard[];
  ledger: { attempt: number; amount: number }[];
  keys: Record<string, string>;
  clientSees: string;
  networkDropped: boolean;
  serverDown: boolean;
  done: boolean;
}

const KEY_1 = 'pay-7f3a…';
const KEY_2 = 'pay-91c0…';

function initial(): RetryState {
  return { requests: [], ledger: [], keys: {}, clientSees: 'Pay 500 ৳', networkDropped: false, serverDown: false, done: false };
}

/**
 * @param sameTx  Fixed mode + crash preset: store the key in the same transaction as the charge,
 *                so a crash rolls both back together.
 */
export function buildSteps(mode: Mode, failure: Failure, sameTx = false): SimStep<RetryState>[] {
  let st = initial();
  const steps: SimStep<RetryState>[] = [
    { state: st, en: 'You press "Pay 500 ৳". Predict how many times the card gets charged, then press Step.', bn: '"Pay" চাপলে। কার্ড থেকে কয়বার টাকা কাটবে অনুমান করো।' },
  ];
  const push = (next: RetryState, en: string, bn: string, tone?: 'ok' | 'bad' | 'wait') => {
    st = next;
    steps.push({ state: next, en, bn, tone });
  };
  const clone = (): RetryState => ({ ...st, requests: st.requests.map((r) => ({ ...r })), ledger: [...st.ledger], keys: { ...st.keys } });
  const hasKey = mode === 'key';

  // Attempt 1
  let s = clone();
  s.requests.push({ attempt: 1, key: hasKey ? KEY_1 : null, status: 'sent', response: null });
  push(s, hasKey ? `Request 1 goes out with header Idempotency-Key: ${KEY_1}. The key was made once, for this payment intent.` : 'Request 1 goes out: POST /pay {amount: 500}. No key.', hasKey ? 'Request 1 গেল, সাথে Idempotency-Key।' : 'Request 1 গেল, কোনো key নেই।');

  s = clone();
  s.requests[0].status = 'processing';
  if (hasKey) {
    push(s, `Server looks up ${KEY_1} in the key store: not seen before. Proceed to charge.`, 'Server key store-এ খুঁজল: আগে দেখেনি। charge করবে।', 'ok');
    s = clone();
  }
  s.ledger.push({ attempt: 1, amount: 500 });
  push(s, 'Server charges the card: 500 ৳ goes on the ledger.', 'Server কার্ড থেকে ৫০০ টাকা কাটল।');

  if (hasKey) {
    if (failure === 'crash') {
      s = clone();
      s.serverDown = true;
      s.requests[0].status = 'crashed';
      if (sameTx) {
        s.ledger = [];
        push(s, 'Server crashes before it can store the key. Charge and key were in ONE transaction, so the charge rolls back too. Ledger is empty.', 'Server crash করল। charge আর key এক transaction-এ ছিল — দুটোই rollback। Ledger খালি।', 'ok');
      } else {
        push(s, 'Server crashes AFTER charging but BEFORE storing the key. The ledger keeps the charge; the key store has nothing.', 'Server charge করার পরে, key রাখার আগে crash করল। Ledger-এ charge আছে, key store খালি।', 'bad');
      }
    } else {
      s = clone();
      s.keys[KEY_1] = 'OK #1001';
      push(s, `Server stores ${KEY_1} → "OK #1001" next to the charge.`, 'Server key-র পাশে ফলাফল রাখল।', 'ok');
    }
  }

  if (failure !== 'crash' || !hasKey) {
    s = clone();
    s.requests[0].status = 'lost';
    s.networkDropped = true;
    push(s, 'The response "OK #1001" is sent, but the network drops it. Your screen still shows a spinner.', 'উত্তর পাঠানো হলো, কিন্তু network-এ হারিয়ে গেল। স্ক্রিনে ঘুরছে।', 'wait');
  } else {
    s = clone();
    s.networkDropped = true;
    push(s, 'No response ever comes: the server is down. Your screen still shows a spinner.', 'কোনো উত্তর এল না — server বন্ধ। স্ক্রিনে ঘুরছে।', 'wait');
  }

  // Retry
  const retryKey = !hasKey ? null : failure === 'newkey' ? KEY_2 : KEY_1;
  s = clone();
  s.serverDown = false;
  s.networkDropped = false;
  s.requests.push({ attempt: 2, key: retryKey, status: 'sent', response: null });
  push(
    s,
    !hasKey
      ? 'You press Pay again. Request 2 goes out, identical to request 1, and the server has no way to tell.'
      : failure === 'newkey'
        ? `You press Pay again. The client generates a fresh key ${KEY_2} for the retry. To the server this is a different payment.`
        : `You press Pay again. Request 2 carries the SAME key ${KEY_1}, because the key belongs to the intent, not the attempt.`,
    !hasKey ? 'আবার Pay চাপলে। Request 2 হুবহু আগেরটার মতো।' : failure === 'newkey' ? 'আবার Pay চাপলে, কিন্তু client নতুন key বানাল।' : 'আবার Pay চাপলে, একই key নিয়ে।',
    failure === 'newkey' && hasKey ? 'bad' : undefined,
  );

  s = clone();
  s.requests[1].status = 'processing';
  const stored = retryKey ? s.keys[retryKey] : undefined;
  if (stored) {
    s.requests[1].status = 'replayed';
    s.requests[1].response = stored;
    s.clientSees = `Paid ✓ ${stored}`;
    push(s, `Server finds ${retryKey} in the key store and replays the stored answer "${stored}". No second charge.`, 'Server key পেল, আগের উত্তরটাই আবার দিল। দ্বিতীয়বার টাকা কাটল না।', 'ok');
  } else {
    if (hasKey) {
      push(s, `Server looks up ${retryKey}: not found${failure === 'crash' && !sameTx ? ' (it was never stored)' : ''}. It charges again.`, 'Server key পেল না। আবার charge করবে।', 'bad');
      s = clone();
    }
    s.ledger.push({ attempt: 2, amount: 500 });
    s.requests[1].status = 'responded';
    s.requests[1].response = 'OK #1002';
    s.clientSees = 'Paid ✓ OK #1002';
    if (hasKey && retryKey) s.keys[retryKey] = 'OK #1002';
    push(s, `Server charges the card again: a second 500 ৳ on the ledger. Response "OK #1002" arrives this time.`, 'আবার ৫০০ টাকা কাটল। এবার উত্তর পৌঁছাল।', s.ledger.length > 1 ? 'bad' : 'ok');
  }

  const final = { ...clone(), done: true };
  const n = final.ledger.length;
  push(
    final,
    n === 1
      ? 'Ledger: 1 charge. Same key, same answer. You paid once.'
      : n === 0
        ? 'Ledger: 0 charges before the retry succeeded once — the crash rolled back cleanly and the retry paid exactly once.'
        : `Ledger: ${n} charges for one press. You paid twice.`,
    n === 1 ? 'Ledger: ১ বার। একই key, একই উত্তর। একবারই দিলে।' : n === 0 ? 'Crash cleanly rollback হলো, retry-তে একবারই দিলে।' : `Ledger: ${n} বার। দুবার দিলে।`,
    n <= 1 ? 'ok' : 'bad',
  );
  return steps;
}

export function chargesFor(mode: Mode, failure: Failure, sameTx = false): number {
  const s = buildSteps(mode, failure, sameTx);
  return s[s.length - 1].state.ledger.length;
}
