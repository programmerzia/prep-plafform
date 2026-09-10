import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseModule, moduleSchema } from './schema';

const dir = join(process.cwd(), 'content/modules');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('content modules', () => {
  it('has at least the eight migrated modules', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('%s is valid against the schema', (file) => {
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const mod = parseModule(raw, file);
    expect(mod.id).toBe(file.replace(/\.json$/, ''));
  });

  it('has unique ids', () => {
    const ids = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accepts an optional versions list and rejects a malformed row', () => {
    const base = { id: 'x', track: 'php', phase: 1, order: 1, title: 'x', status: 'unlocked', cards: [{ q: 'q', a: 'a' }] };
    const ok = moduleSchema.safeParse({ ...base, lesson: { concept: 'c', bn: 'b', versions: [{ from: 'PHP 7.4', to: 'PHP 8.0', what: 'match', why_it_matters: 'screens' }] } });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.lesson?.versions).toHaveLength(1);
    const none = moduleSchema.safeParse({ ...base, lesson: { concept: 'c', bn: 'b' } });
    expect(none.success && none.data.lesson?.versions).toEqual([]);
    const bad = moduleSchema.safeParse({ ...base, lesson: { concept: 'c', bn: 'b', versions: [{ from: 'a', to: 'b', what: 'c' }] } });
    expect(bad.success).toBe(false);
  });

  it('rejects a preview module without a preview block', () => {
    const r = moduleSchema.safeParse({ id: 'x', track: 'sql', phase: 1, order: 1, title: 'x', status: 'preview' });
    expect(r.success).toBe(false);
  });

  it('rejects an unlocked module without cards', () => {
    const r = moduleSchema.safeParse({
      id: 'x', track: 'sql', phase: 1, order: 1, title: 'x', status: 'unlocked',
      lesson: { concept: 'c', bn: 'b' },
    });
    expect(r.success).toBe(false);
  });
});

describe('legacy migration fidelity', () => {
  const html = readFileSync(join(process.cwd(), 'legacy/senior-prep.html'), 'utf8');
  const src = html.slice(html.indexOf('const PHASES = ['), html.indexOf('const LEITNER_DAYS'));
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const { TOPICS } = new Function(`${src}; return { TOPICS };`)() as { TOPICS: LegacyTopic[] };
  const modules = files.map((f) => parseModule(JSON.parse(readFileSync(join(dir, f), 'utf8')), f));
  // legacy id -> module id, read from the migration script so the two never drift
  const script = readFileSync(join(process.cwd(), 'scripts/migrate-legacy.mjs'), 'utf8');
  const MAP: Record<string, string> = {};
  for (const m of script.matchAll(/^\s+'?([a-z0-9-]+)'?: \['([a-z0-9-]+)', '[a-z-]+'\],$/gm)) MAP[m[1]] = m[2];
  const byId = Object.fromEntries(modules.map((m) => [m.id, m]));

  interface LegacyTopic {
    id: string; phase: number; title: string; ready?: boolean; analogy?: string; concept?: string;
    code?: string; bn?: string; practice?: [string, string][]; cards?: [string, string][]; pre?: [string, string, string];
  }

  it('the migration map covers every legacy topic and every mapped module exists', () => {
    for (const t of TOPICS) {
      expect(MAP[t.id], `no mapping for legacy ${t.id}`).toBeTruthy();
      expect(byId[MAP[t.id]], `missing module for legacy ${t.id}`).toBeTruthy();
      expect(byId[MAP[t.id]].phase).toBe(t.phase + 1);
    }
  });

  it('the eight legacy lessons keep analogy, concept, code, Bangla, practice and cards verbatim', () => {
    for (const t of TOPICS.filter((x) => x.ready)) {
      const m = byId[MAP[t.id]];
      expect(m.title).toBe(t.title);
      expect(m.lesson?.picture).toBe(t.analogy);
      expect(m.lesson?.concept).toBe(t.concept);
      expect(m.lesson?.right?.code).toBe(t.code);
      expect(m.lesson?.bn).toBe(t.bn);
      // solutions are fenced by the migration; the text inside the fence must be untouched
      const unfence = (s: string) => s.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      expect(m.practice.map((p) => [p.task, unfence(p.solution)])).toEqual(t.practice ?? []);
      for (const p of m.practice) expect(p.solution).toMatch(/^```[a-z]*\n[\s\S]*\n```$/);
      expect(m.cards.map((c) => [c.q, c.a])).toEqual(t.cards ?? []);
    }
  });

  it('legacy previews that are still previews keep what / picture / why / Bangla verbatim', () => {
    let stillPreview = 0;
    for (const t of TOPICS.filter((x) => !x.ready)) {
      const m = byId[MAP[t.id]];
      if (m.lesson) continue; // the mentor has since written the lesson; the preview may have been rewritten with it
      stillPreview++;
      expect(m.title).toBe(t.title);
      expect(m.preview).toEqual({ what: t.pre![0], picture: t.pre![1], why: t.pre![2], bn: t.bn });
    }
    expect(stillPreview).toBeGreaterThan(0);
  });

  it('the two legacy simulators are attached to the right modules', () => {
    expect(byId['js-event-loop']?.lesson?.simulator).toBe('event-loop');
    expect(byId['sql-joins-fanout']?.lesson?.simulator).toBe('join-fanout');
  });
});
