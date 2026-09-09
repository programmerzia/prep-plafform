// Prebuild gate: every content/modules/*.json must pass the Zod schema, or the build stops.
// Runs on plain Node (type stripping), no bundler involved.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleSchema } from '../src/content/schema.ts';

const dir = join(process.cwd(), 'content/modules');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const seen = new Map<string, string>();
const problems: string[] = [];

for (const file of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (e) {
    problems.push(`${file}: not valid JSON — ${(e as Error).message}`);
    continue;
  }
  const result = moduleSchema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) problems.push(`${file}: ${issue.path.join('.') || '(root)'} — ${issue.message}`);
    continue;
  }
  const id = result.data.id;
  if (`${id}.json` !== file) problems.push(`${file}: id "${id}" does not match the file name`);
  if (seen.has(id)) problems.push(`${file}: duplicate id "${id}" (also in ${seen.get(id)})`);
  seen.set(id, file);
}

if (problems.length) {
  console.error(`Content validation failed (${problems.length} problem${problems.length > 1 ? 's' : ''}):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`Content OK: ${files.length} modules validated.`);
