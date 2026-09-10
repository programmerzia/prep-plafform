import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, chargesFor, MODES, PRESETS, type Failure, type Mode, type RetryState } from './logic/idempotent-retry';

export default function IdempotentRetrySimulator() {
  const [mode, setMode] = useState<Mode>('none');
  const [failure, setFailure] = useState<Failure>('lost');
  const [sameTx, setSameTx] = useState(false);
  const steps = useMemo(() => buildSteps(mode, failure, sameTx), [mode, failure, sameTx]);
  const charges = chargesFor(mode, failure, sameTx);

  const prediction = useMemo(
    () => ({
      question: 'You press Pay, the screen freezes, you press again. How many times is the card charged?',
      choices: [
        { id: '1', label: 'Once' },
        { id: '2', label: 'Twice' },
        { id: '0', label: 'Never' },
      ],
      correct: String(charges),
      actual: charges === 1 ? 'charged once' : charges === 0 ? 'no charge stuck' : `charged ${charges} times`,
    }),
    [charges],
  );

  return (
    <SimShell<RetryState>
      id="idempotent-retry"
      title="Pressing the lift button twice"
      story="You press 'Pay' — the screen freezes, so you press again. Pressing a lift button twice does not call two lifts, because the button remembers it was pressed. An idempotency key is the payment remembering it was already made."
      storyBn="Pay চাপলে, স্ক্রিন আটকে গেল, আবার চাপলে। Lift-এর বোতাম দুবার চাপলে দুটো lift আসে না — বোতামের মনে থাকে। Idempotency key = payment-এর মনে থাকা।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...PRESETS]}
      preset={failure}
      onPreset={(p) => setFailure(p as Failure)}
      extras={
        mode === 'key' && failure === 'crash' ? (
          <Chips>
            <Chip on={!sameTx} onClick={() => setSameTx(false)}>store key after the charge (separate)</Chip>
            <Chip on={sameTx} onClick={() => setSameTx(true)}>store key in the SAME transaction</Chip>
          </Chips>
        ) : null
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'A retry is only safe when the server can recognise it. The key is that recognition.',
          'Store the key with the result, in the same transaction as the charge. A crash between them leaves a charge with no memory of it.',
          'The key belongs to the intent ("this payment"), not to the attempt. A new key per retry is just a new payment.',
        ],
        takeaway: 'Same key, same answer. Store the key with the result, in the same transaction.',
        takeawayBn: 'একই key, একই উত্তর। Key আর ফলাফল একই transaction-এ রাখো।',
        challenge: 'Switch to Idempotency-Key, pick "server crashed after charging", and find the setting that still charges once.',
      }}
      render={(st) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center text-[12.5px]">
            <div className="rounded-xl border border-line p-2 dark:border-[#2a2e38]">
              <Muted>Client</Muted>
              <div className="font-semibold">{st.clientSees}</div>
              {st.networkDropped && <div className="text-warn">spinner…</div>}
            </div>
            <div className={`rounded-xl border p-2 ${st.networkDropped ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : 'border-line dark:border-[#2a2e38]'}`}>
              <Muted>Network</Muted>
              <div className="font-semibold">{st.networkDropped ? '✕ dropped' : '→ ok'}</div>
            </div>
            <div className={`rounded-xl border p-2 ${st.serverDown ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : 'border-line dark:border-[#2a2e38]'}`}>
              <Muted>Server</Muted>
              <div className="font-semibold">{st.serverDown ? '💥 crashed' : 'up'}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {st.requests.map((r) => (
              <div key={r.attempt} className={`rounded-xl border p-2 text-[12.5px] ${r.status === 'lost' || r.status === 'crashed' ? 'border-danger/50' : r.status === 'replayed' ? 'border-accent' : 'border-line dark:border-[#2a2e38]'}`}>
                <div className="font-semibold">Request {r.attempt} · {label(r.status)}</div>
                <pre className="m-0 mt-1 text-[12px]">{`POST /pay HTTP/1.1\n${r.key ? `Idempotency-Key: ${r.key}\n` : ''}Content-Type: application/json\n\n{"amount": 500}`}</pre>
                {r.response && <div className="mt-1 text-accent">← {r.response}</div>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            <div className={`rounded-xl border p-2 ${st.ledger.length > 1 ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : 'border-line dark:border-[#2a2e38]'}`}>
              <Muted>Ledger (charges)</Muted>
              {st.ledger.length === 0 ? <div className="text-neutral-400">empty</div> : st.ledger.map((l) => <div key={l.attempt}>−500 ৳ (request {l.attempt})</div>)}
              <div className={`mt-1 text-xl font-semibold ${st.ledger.length > 1 ? 'text-danger' : st.ledger.length === 1 ? 'text-accent' : ''}`}>{st.ledger.length}</div>
            </div>
            <div className="rounded-xl border border-line p-2 dark:border-[#2a2e38]">
              <Muted>Key store</Muted>
              {Object.keys(st.keys).length === 0 ? <div className="text-neutral-400">empty</div> : Object.entries(st.keys).map(([k, v]) => <div key={k}><code>{k}</code> → {v}</div>)}
            </div>
          </div>
        </div>
      )}
    />
  );
}

function label(s: string) {
  return { sent: 'sent', processing: 'processing', responded: 'responded', lost: 'response lost', crashed: 'server crashed', replayed: 'replayed from key store' }[s] ?? s;
}
