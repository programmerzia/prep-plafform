import type { SimStep } from '../kit/types';

/** tenant-isolation: one building, many apartments; whose mail is whose? */
export const MODES = [
  { id: 'none', label: 'No isolation' },
  { id: 'fix', label: 'Isolated' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const REQUESTS = [
  { id: 'list', label: 'GET /invoices' },
  { id: 'attack', label: 'GET /invoices/7 (someone else\'s id)' },
  { id: 'forgot', label: 'forgot the scope in one endpoint' },
] as const;
export type RequestKind = (typeof REQUESTS)[number]['id'];

export const MECHANISMS = [
  { id: 'scope', label: 'global scope (Laravel)' },
  { id: 'rls', label: 'Postgres RLS' },
  { id: 'db', label: 'database-per-tenant' },
] as const;
export type Mechanism = (typeof MECHANISMS)[number]['id'];

export const TENANTS = [
  { id: 1, name: 'Apt 3', colour: 'accent' },
  { id: 2, name: 'Apt 7', colour: 'warn' },
  { id: 3, name: 'Apt 12', colour: 'danger' },
] as const;

export interface Invoice { id: number; tenant_id: number; amount: number }
export const INVOICES: Invoice[] = [
  { id: 1, tenant_id: 1, amount: 120 }, { id: 2, tenant_id: 1, amount: 80 }, { id: 3, tenant_id: 1, amount: 45 },
  { id: 4, tenant_id: 2, amount: 300 }, { id: 5, tenant_id: 2, amount: 15 }, { id: 6, tenant_id: 2, amount: 60 },
  { id: 7, tenant_id: 3, amount: 990 }, { id: 8, tenant_id: 3, amount: 20 }, { id: 9, tenant_id: 3, amount: 75 },
];

export interface IsoState {
  tenant: number;
  request: RequestKind;
  mechanism: Mechanism | null;
  sql: string;
  policy: string | null;
  connection: string;
  rows: Invoice[];
  leaked: number;
  status: number | null;
  done: boolean;
}

export const POLICY = `CREATE POLICY tenant_rows ON invoices
  USING (tenant_id = current_setting('app.tenant')::bigint);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;`;

export function buildSteps(mode: Mode, request: RequestKind, mechanism: Mechanism, tenant: number): SimStep<IsoState>[] {
  const fixed = mode === 'fix';
  const mech = fixed ? mechanism : null;
  const tname = TENANTS.find((t) => t.id === tenant)!.name;
  const attackId = 7; // belongs to tenant 3
  const attackOwner = INVOICES.find((i) => i.id === attackId)!.tenant_id;
  let st: IsoState = { tenant, request, mechanism: mech, sql: '', policy: null, connection: 'shared', rows: [], leaked: 0, status: null, done: false };
  const steps: SimStep<IsoState>[] = [
    {
      state: st,
      en: request === 'attack'
        ? `${tname} is logged in and edits the URL to /invoices/${attackId}, an invoice that belongs to ${TENANTS.find((t) => t.id === attackOwner)!.name}. Predict the response.`
        : request === 'forgot'
          ? `${tname} opens a report page whose endpoint a developer wrote with a raw query, forgetting the tenant filter. Predict how many rows come back.`
          : `${tname} opens /invoices. Predict how many rows come back.`,
      bn: request === 'attack' ? `${tname} URL বদলে /invoices/${attackId} চাইল — অন্য apartment-এর invoice। উত্তর কী হবে?` : `${tname} invoice list চাইল। কয়টা row আসবে?`,
    },
  ];
  const push = (next: IsoState, en: string, bn: string, tone?: 'ok' | 'bad' | 'wait') => {
    st = next;
    steps.push({ state: next, en, bn, tone });
  };
  const clone = (): IsoState => ({ ...st, rows: [...st.rows] });

  // 1. tenant context
  let s = clone();
  if (mech === 'db') {
    s.connection = `tenant_${tenant}`;
    push(s, `Middleware reads the tenant from the subdomain and switches the database connection to "tenant_${tenant}". This database only contains ${tname}'s rows.`, `Middleware tenant চিনে connection বদলাল: tenant_${tenant} database-এ শুধু ${tname}-এর row।`, 'ok');
  } else if (mech === 'rls') {
    s.policy = POLICY;
    push(s, `Middleware sets SET app.tenant = ${tenant} on the connection. The database has a row-level policy that filters every query on invoices by that setting.`, `Middleware SET app.tenant = ${tenant} দিল। Database-এর policy প্রতিটা query-তে filter বসায়।`, 'ok');
  } else if (mech === 'scope') {
    push(s, `Middleware sets the current tenant to ${tname}. The Invoice model has a global scope that appends WHERE tenant_id = ${tenant} to every Eloquent query.`, `Middleware current tenant ঠিক করল। Invoice model-এর global scope প্রতিটা Eloquent query-তে WHERE tenant_id = ${tenant} জোড়ে।`, 'ok');
  } else {
    push(s, `Middleware sets the current tenant to ${tname}. Nothing else happens automatically: every query must remember to filter.`, `Current tenant ঠিক হলো, কিন্তু আর কিছু নয়: প্রতিটা query-তে নিজে filter লিখতে হবে।`, 'wait');
  }

  // 2. the query
  s = clone();
  const scopeApplies = mech === 'scope' && request !== 'forgot';
  const where: string[] = [];
  if (request === 'attack') where.push(`id = ${attackId}`);
  if (scopeApplies) where.push(`tenant_id = ${tenant}`);
  s.sql = `SELECT * FROM invoices${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${request === 'attack' ? ' LIMIT 1' : ''};`;
  if (mech === 'rls') s.sql += `\n-- + policy: AND tenant_id = current_setting('app.tenant')`;
  push(
    s,
    request === 'forgot'
      ? mech === 'scope'
        ? `The report endpoint uses DB::table('invoices') — a raw query. Global scopes live on the Eloquent model, so nothing is appended: ${s.sql}`
        : `The report endpoint runs a raw query with no tenant filter: ${s.sql.split('\n')[0]}`
      : `The app builds the query: ${s.sql.split('\n')[0]}${scopeApplies ? ' (the scope added the tenant_id clause)' : ''}`,
    request === 'forgot' ? 'Report endpoint raw query চালাল, tenant filter নেই।' : 'App query বানাল।',
    request === 'forgot' && mech === 'scope' ? 'bad' : undefined,
  );

  // 3. rows
  s = clone();
  let rows = INVOICES.filter((i) => (request === 'attack' ? i.id === attackId : true));
  if (scopeApplies || mech === 'rls' || mech === 'db') rows = rows.filter((i) => i.tenant_id === tenant);
  s.rows = rows;
  s.leaked = rows.filter((i) => i.tenant_id !== tenant).length;
  push(
    s,
    s.leaked > 0
      ? `The database returns ${rows.length} row${rows.length !== 1 ? 's' : ''}: ${s.leaked} belong${s.leaked === 1 ? 's' : ''} to other apartments. The clerk handed out mail by name only.`
      : mech === 'rls'
        ? `The policy filters inside the database: ${rows.length} row${rows.length !== 1 ? 's' : ''}, all ${tname}'s, even though the SQL never mentioned tenant_id.`
        : mech === 'db'
          ? `The tenant database returns ${rows.length} row${rows.length !== 1 ? 's' : ''}. Other apartments' rows are not in this database at all.`
          : `${rows.length} row${rows.length !== 1 ? 's' : ''}, all ${tname}'s.`,
    s.leaked > 0 ? `${rows.length}টা row এল, তার ${s.leaked}টা অন্য apartment-এর। চিঠি নাম দেখে বিলি হলো।` : `${rows.length}টা row, সব ${tname}-এর।`,
    s.leaked > 0 ? 'bad' : 'ok',
  );

  // 4. response
  s = clone();
  s.done = true;
  if (request === 'attack') {
    s.status = rows.length ? 200 : 404;
    push(
      s,
      s.status === 200 ? `Response 200 with invoice ${attackId} (990 ৳) from another apartment. Broken access control: OWASP #1.` : `Response 404: as far as ${tname} can tell, invoice ${attackId} does not exist. Correct — no 403, no hint that it is real.`,
      s.status === 200 ? '200 — অন্যের invoice দেখা গেল। Broken access control।' : '404 — invoice-টা নেই বলেই মনে হয়। ঠিক।',
      s.status === 200 ? 'bad' : 'ok',
    );
  } else {
    s.status = 200;
    push(s, s.leaked ? `Response 200 with ${rows.length} rows, ${s.leaked} of them leaked.` : `Response 200 with ${rows.length} rows, nothing leaked.`, s.leaked ? `200, ${s.leaked}টা row leak।` : '200, কিছু leak হয়নি।', s.leaked ? 'bad' : 'ok');
  }
  return steps;
}

export function outcome(mode: Mode, request: RequestKind, mechanism: Mechanism, tenant: number): { rows: number; leaked: number; status: number | null } {
  const s = buildSteps(mode, request, mechanism, tenant);
  const last = s[s.length - 1].state;
  return { rows: last.rows.length, leaked: last.leaked, status: last.status };
}

export const COMPARISON = [
  { model: 'Shared schema (tenant_id column)', cost: 'cheapest', isolation: 'app-enforced (scope) or DB-enforced (RLS)', migrations: 'one migration for everyone' },
  { model: 'Schema-per-tenant', cost: 'medium', isolation: 'schema search_path per tenant', migrations: 'run N times, can drift' },
  { model: 'Database-per-tenant', cost: 'highest (connections, backups)', isolation: 'strongest: nothing to filter', migrations: 'run N times, orchestration needed' },
];
