import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, COMPARISON, INVOICES, MECHANISMS, MODES, outcome, REQUESTS, TENANTS, type IsoState, type Mechanism, type Mode, type RequestKind } from './logic/tenant-isolation';

const TONE: Record<string, string> = {
  accent: 'border-accent bg-accent-soft/60 dark:bg-[#123a22]',
  warn: 'border-warn bg-warn-soft dark:bg-[#2c2410]',
  danger: 'border-danger bg-danger-soft dark:bg-[#3a1512]',
};

export default function TenantIsolationSimulator() {
  const [mode, setMode] = useState<Mode>('none');
  const [request, setRequest] = useState<RequestKind>('list');
  const [mechanism, setMechanism] = useState<Mechanism>('scope');
  const [tenant, setTenant] = useState(1);
  const steps = useMemo(() => buildSteps(mode, request, mechanism, tenant), [mode, request, mechanism, tenant]);
  const out = outcome(mode, request, mechanism, tenant);
  const tname = TENANTS.find((t) => t.id === tenant)!.name;

  const prediction = useMemo(() => {
    if (request === 'attack') {
      return { question: `${tname} requests invoice 7, which belongs to Apt 12. What comes back?`, choices: [{ id: '404', label: '404 — not found' }, { id: '200', label: '200 — the invoice (leak)' }, { id: '403', label: '403 — forbidden' }], correct: String(out.status), actual: `${out.status}${out.leaked ? ' with a leaked row' : ''}` };
    }
    return { question: `${tname} asks for the invoice list. How many rows come back?`, choices: [{ id: '3', label: '3 (only mine)' }, { id: '9', label: '9 (everyone\'s)' }, { id: '0', label: '0' }], correct: String(out.rows), actual: `${out.rows} rows, ${out.leaked} leaked` };
  }, [request, tname, out]);

  return (
    <SimShell<IsoState>
      id="tenant-isolation"
      title="One building, many apartments; whose mail is whose?"
      story="An apartment building's mailroom. Every letter has an apartment number. A careless clerk hands out mail by name only, so apartment 3 gets apartment 7's letters. Isolation you have to remember is isolation you will forget once."
      storyBn="একটা building-এর mailroom। প্রতিটা চিঠিতে apartment নম্বর আছে। অসাবধান clerk নাম দেখে চিঠি দেয় — Apt 3 পায় Apt 7-এর চিঠি। যে isolation মনে রাখতে হয়, সেটা একদিন ভুলে যাবেই।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...REQUESTS]}
      preset={request}
      onPreset={(p) => setRequest(p as RequestKind)}
      extras={
        <div className="flex flex-col gap-2">
          <Chips>
            <Muted className="self-center">Logged in as</Muted>
            {TENANTS.map((t) => (
              <Chip key={t.id} on={tenant === t.id} onClick={() => setTenant(t.id)}>{t.name}</Chip>
            ))}
          </Chips>
          {mode === 'fix' && (
            <Chips>
              {MECHANISMS.map((m) => (
                <Chip key={m.id} on={mechanism === m.id} onClick={() => setMechanism(m.id)}>{m.label}</Chip>
              ))}
            </Chips>
          )}
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'A global scope protects every Eloquent query, but a raw query or withoutGlobalScope() steps around it: one forgotten endpoint leaks.',
          'Row-level security lives in the database, so even a query that forgets tenant_id gets filtered. Database-per-tenant has nothing to filter at all.',
          'Answer an attack with 404, not 403: a 403 confirms the id exists.',
        ],
        takeaway: "Isolation you have to remember is isolation you will forget once. Put it where you can't forget: a scope or the database.",
        takeawayBn: 'যে isolation মনে রাখতে হয়, সেটা একদিন ভুলবেই। এমন জায়গায় রাখো যেখানে ভোলা যায় না: scope বা database-এ।',
        challenge: 'Pick "Isolated" with the global scope, then "forgot the scope in one endpoint". Now switch to Postgres RLS.',
      }}
      render={(st) => <Mailroom st={st} />}
    />
  );
}

function Mailroom({ st }: { st: IsoState }) {
  const tname = TENANTS.find((t) => t.id === st.tenant)!.name;
  const colourOf = (tid: number) => TENANTS.find((t) => t.id === tid)!.colour;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className={`rounded-full border px-2.5 py-0.5 ${TONE[colourOf(st.tenant)]}`}>current tenant: {tname}</span>
        <span className="rounded-full border border-line px-2.5 py-0.5 dark:border-[#2a2e38]">connection: {st.connection}</span>
        {st.mechanism && <span className="rounded-full border border-line px-2.5 py-0.5 dark:border-[#2a2e38]">{MECHANISMS.find((m) => m.id === st.mechanism)!.label}</span>}
      </div>
      <div>
        <Muted className="mb-1">invoices table (colour = apartment)</Muted>
        <div className="grid grid-cols-3 gap-1 text-[12px]">
          {INVOICES.map((i) => {
            const inDb = st.connection === 'shared' || i.tenant_id === st.tenant;
            const returned = st.rows.some((r) => r.id === i.id);
            const leaked = returned && i.tenant_id !== st.tenant;
            return (
              <div key={i.id} className={`rounded-md border px-1.5 py-1 ${inDb ? TONE[colourOf(i.tenant_id)] : 'border-dashed border-line opacity-30 dark:border-[#2a2e38]'} ${returned ? 'ring-2 ' + (leaked ? 'ring-danger' : 'ring-accent') : ''}`}>
                #{i.id} · {TENANTS.find((t) => t.id === i.tenant_id)!.name} · {i.amount}৳{leaked ? ' ✕' : ''}
              </div>
            );
          })}
        </div>
      </div>
      <pre className="m-0 text-[12.5px]">{st.sql || '-- query appears here'}{st.policy ? `\n\n${st.policy}` : ''}</pre>
      <div className={`rounded-xl border p-2 text-[13px] ${st.leaked ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : st.rows.length ? 'border-accent bg-accent-soft/50 dark:bg-[#123a22]' : 'border-line dark:border-[#2a2e38]'}`}>
        <div className="flex justify-between">
          <Muted>result</Muted>
          {st.status && <span className={`font-semibold ${st.status === 200 && st.leaked ? 'text-danger' : 'text-accent'}`}>HTTP {st.status}</span>}
        </div>
        <div>{st.rows.length ? `${st.rows.length} row${st.rows.length !== 1 ? 's' : ''}${st.leaked ? `, ${st.leaked} from other apartments` : ''}` : st.done ? 'no rows' : '…'}</div>
      </div>
      {st.done && (
        <div className="overflow-x-auto rounded-xl border border-line dark:border-[#2a2e38]">
          <table className="min-w-full text-[12px]">
            <thead><tr className="text-left text-neutral-500"><th className="px-2 py-1">Model</th><th className="px-2 py-1">Cost</th><th className="px-2 py-1">Isolation</th><th className="px-2 py-1">Migrations</th></tr></thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.model} className="border-t border-line align-top dark:border-[#2a2e38]"><td className="px-2 py-1 font-medium">{r.model}</td><td className="px-2 py-1">{r.cost}</td><td className="px-2 py-1">{r.isolation}</td><td className="px-2 py-1">{r.migrations}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
