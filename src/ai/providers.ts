import type { AiSettings, Provider } from '../store/types';

export interface ProviderInfo {
  name: string;
  help: string;
  model?: string;
  url?: string;
}

/** Ported from the legacy app. Keys are pasted by the user and never leave the device except to the provider. */
export const PROVIDERS: Record<Provider, ProviderInfo> = {
  offline: {
    name: 'Offline (built-in questions)',
    help: 'No AI. You get a real interview question, answer it, reveal a model answer, and score yourself honestly. Always works.',
  },
  gemini: {
    name: 'Google Gemini — free',
    help: 'Free tier, no card. Get a key at aistudio.google.com → Get API key. Default model: gemini-2.5-flash',
    model: 'gemini-2.5-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/',
  },
  groq: {
    name: 'Groq — free',
    help: 'Free tier, ~30 requests/min. Get a key at console.groq.com/keys. Default model: llama-3.3-70b-versatile',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
  },
  openrouter: {
    name: 'OpenRouter — free models',
    help: 'Free models with a free key at openrouter.ai/keys. Default model: meta-llama/llama-3.3-70b-instruct:free',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    url: 'https://openrouter.ai/api/v1/chat/completions',
  },
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function callLLM(ai: AiSettings, system: string, messages: ChatMessage[]): Promise<string> {
  const P = PROVIDERS[ai.provider];
  const model = ai.model || P.model || '';
  if (ai.provider === 'offline') throw new Error('offline');
  if (!ai.key) throw new Error('No API key saved. Open More → Settings.');

  if (ai.provider === 'gemini') {
    const body = {
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 1000 },
    };
    const r = await fetch(`${P.url}${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.key },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.candidates) throw new Error(d.error?.message || 'No response');
    return d.candidates[0].content.parts.map((x: { text?: string }) => x.text || '').join('\n');
  }

  // OpenAI-compatible (groq, openrouter)
  const r = await fetch(P.url!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.key}` },
    body: JSON.stringify({ model, max_tokens: 1000, messages: [{ role: 'system', content: system }, ...messages] }),
  });
  const d = await r.json();
  if (!d.choices) throw new Error(d.error?.message || 'No response');
  return d.choices[0].message.content as string;
}
