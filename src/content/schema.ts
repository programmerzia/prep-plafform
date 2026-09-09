import { z } from 'zod';

export const TRACK_IDS = [
  'php', 'oop', 'sql', 'orm', 'laravel', 'symfony', 'http-api', 'js-ts', 'react', 'next',
  'vue-nuxt', 'node', 'dotnet', 'python-llm', 'supabase', 'architecture', 'cloud-devops',
  'redis', 'payments', 'security-auth', 'pwa-offline', 'problems', 'interview', 'stories',
] as const;

export type TrackId = (typeof TRACK_IDS)[number];

const codeBlock = z.object({
  lang: z.string().default('text'),
  code: z.string(),
  why: z.string().default(''),
});

const crossStackRow = z.object({
  concept: z.string(),
  laravel: z.string().default(''),
  symfony: z.string().default(''),
  dotnet: z.string().default(''),
  node: z.string().default(''),
});

const docLink = z.object({ label: z.string(), url: z.string().url() });

export const previewSchema = z.object({
  what: z.string(),
  picture: z.string(),
  why: z.string(),
  bn: z.string(),
});

export const lessonSchema = z.object({
  problem: z.string().default(''),
  picture: z.string().default(''),
  hook: z.string().default(''),
  concept: z.string(),
  simple: z.string().default(''),
  wrong: codeBlock.optional(),
  right: codeBlock.optional(),
  bn: z.string(),
  crossStack: z.array(crossStackRow).default([]),
  simulator: z.string().optional(),
  docs: z.array(docLink).max(3).default([]),
});

export const practiceSchema = z.object({
  task: z.string(),
  hint: z.string().default(''),
  solution: z.string(),
  why: z.string().default(''),
});

export const interviewSchema = z.object({
  q: z.string(),
  model: z.string(),
  missing: z.string().default(''),
  followUp: z.string().default(''),
  bn: z.string().default(''),
});

export const cardSchema = z.object({ q: z.string(), a: z.string() });

export const glossarySchema = z.object({
  term: z.string(),
  plain: z.string(),
  bn: z.string().default(''),
});

export const moduleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
    track: z.enum(TRACK_IDS),
    phase: z.number().int().min(1).max(8),
    order: z.number().int().min(1),
    title: z.string().min(1),
    status: z.enum(['preview', 'unlocked']),
    star: z.boolean().default(false),
    preview: previewSchema.optional(),
    lesson: lessonSchema.optional(),
    practice: z.array(practiceSchema).default([]),
    interview: z.array(interviewSchema).default([]),
    cards: z.array(cardSchema).default([]),
    glossary: z.array(glossarySchema).default([]),
  })
  .superRefine((m, ctx) => {
    if (m.status === 'preview' && !m.preview) {
      ctx.addIssue({ code: 'custom', message: 'preview modules need a "preview" block', path: ['preview'] });
    }
    if (m.status === 'unlocked' && !m.lesson) {
      ctx.addIssue({ code: 'custom', message: 'unlocked modules need a "lesson" block', path: ['lesson'] });
    }
    if (m.status === 'unlocked' && m.cards.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'unlocked modules need at least one card', path: ['cards'] });
    }
  });

export type Module = z.infer<typeof moduleSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type PracticeTask = z.infer<typeof practiceSchema>;
export type InterviewQuestion = z.infer<typeof interviewSchema>;
export type Card = z.infer<typeof cardSchema>;
export type GlossaryEntry = z.infer<typeof glossarySchema>;

/** Validate one raw module. Throws with a readable message on failure. */
export function parseModule(raw: unknown, source = 'module'): Module {
  const result = moduleSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid content in ${source}:\n${lines.join('\n')}`);
  }
  return result.data;
}
