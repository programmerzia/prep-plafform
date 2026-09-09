import type { Module } from '../content/schema';
import type { InterviewMode } from '../store/types';

export const MODES: Record<InterviewMode, string> = {
  tech: 'Technical deep-dive',
  ai: 'AI screening',
  behav: 'Behavioural',
};

export const STRUCTURE = ['Context', 'Decision', 'Trade-off', 'Outcome'] as const;

export function systemPrompt(m: Module, mode: InterviewMode): string {
  const notes = m.lesson?.concept ? 'Reference notes: ' + m.lesson.concept : '';
  return `You are interviewing a candidate for a senior full-stack remote role (Laravel/PHP primary, React/Next and .NET secondary). Topic: ${m.title}. ${notes}
Mode: ${
    mode === 'tech'
      ? 'technical deep-dive — ask one concrete, scenario-based question a strong senior would be asked; push on trade-offs.'
      : mode === 'ai'
        ? 'automated AI screening — ask one question that expects a structured answer (context, decision, trade-off, outcome). When grading, judge the STRUCTURE first: did the answer go context → decision → trade-off → outcome in that order?'
        : 'behavioural — ask one STAR-style leadership/ownership question relevant to the topic.'
  }
When ASKING: output only the question, 1–3 sentences, no preamble.
When GRADING: respond in exactly this format:
SCORE: <1-10>
VERDICT: <one blunt sentence>
WHAT WAS GOOD: <1-2 bullets>
WHAT WAS MISSING: <2-3 bullets, specific>
SAY THIS NEXT TIME: <a 3-5 sentence model answer in first person, spoken register>
FOLLOW-UP: <one harder follow-up question>
বাংলায় এক লাইনে: <one-line Bangla takeaway>
Be honest and demanding; a 7 means hireable-senior, 9+ means exceptional.`;
}

export interface OfflineQuestion {
  q: string;
  model: string;
  missing: string;
  followUp: string;
  bn: string;
  fromCards: boolean;
}

/** Offline bank: the module's interview list; if empty, fall back to its drill cards (as the legacy app did). */
export function offlineQuestion(m: Module, random: () => number = Math.random): OfflineQuestion | null {
  if (m.interview.length) {
    const x = m.interview[Math.floor(random() * m.interview.length)];
    return { q: x.q, model: x.model, missing: x.missing, followUp: x.followUp, bn: x.bn, fromCards: false };
  }
  if (m.cards.length) {
    const c = m.cards[Math.floor(random() * m.cards.length)];
    return { q: c.q, model: c.a, missing: '', followUp: '', bn: '', fromCards: true };
  }
  return null;
}

export function parseScore(text: string): number | null {
  const m = text.match(/SCORE:\s*(\d+)/);
  return m ? Math.max(1, Math.min(10, +m[1])) : null;
}

/** Simple structure grader for AI-screen mode when offline: which of the four parts did the answer name? */
export function structureHits(answer: string): Record<(typeof STRUCTURE)[number], boolean> {
  const a = answer.toLowerCase();
  return {
    Context: /\b(context|situation|we had|the system|at the time|background)\b/.test(a),
    Decision: /\b(decided|decision|chose|i picked|we went with|so i)\b/.test(a),
    'Trade-off': /\b(trade-?off|instead of|downside|cost|risk|alternative|but)\b/.test(a),
    Outcome: /\b(outcome|result|as a result|reduced|improved|went from|ended up|shipped)\b/.test(a),
  };
}
