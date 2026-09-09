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

  interface LegacyTopic {
    id: string; phase: number; title: string; ready?: boolean; analogy?: string; concept?: string;
    code?: string; bn?: string; practice?: [string, string][]; cards?: [string, string][]; pre?: [string, string, string];
  }

  it('every legacy topic exists once with the same title and phase', () => {
    for (const t of TOPICS) {
      const found = modules.filter((m) => m.title === t.title);
      expect(found, t.title).toHaveLength(1);
      expect(found[0].phase).toBe(t.phase + 1);
      expect(found[0].status).toBe(t.ready ? 'unlocked' : 'preview');
    }
  });

  it('unlocked topics keep analogy, concept, code, Bangla, practice and cards verbatim', () => {
    for (const t of TOPICS.filter((x) => x.ready)) {
      const m = modules.find((x) => x.title === t.title)!;
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

  it('preview topics keep what / picture / why / Bangla verbatim', () => {
    for (const t of TOPICS.filter((x) => !x.ready)) {
      const m = modules.find((x) => x.title === t.title)!;
      expect(m.preview).toEqual({ what: t.pre![0], picture: t.pre![1], why: t.pre![2], bn: t.bn });
    }
  });

  it('the two simulators are attached to the right modules', () => {
    expect(modules.find((m) => m.id === 'js-event-loop')?.lesson?.simulator).toBe('event-loop');
    expect(modules.find((m) => m.id === 'sql-joins-fanout')?.lesson?.simulator).toBe('join-fanout');
  });
});
