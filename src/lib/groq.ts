// Server-only: Groq chat with several API keys and models.
// GROQ_API_KEY may hold many keys separated by commas. When a key hits its
// rate limit we move to the next key; when every key is limited on a model we
// move to the next model (each model has its own limit on Groq).

const URL = 'https://api.groq.com/openai/v1/chat/completions';

// Best answers first. All three are open on Groq with the same per-key limits.
export const MODELS = [
  { id: 'openai/gpt-oss-120b', extra: { reasoning_effort: 'medium', include_reasoning: false } },
  { id: 'qwen/qwen3.8-27b', extra: { reasoning_format: 'hidden' } },
  { id: 'openai/gpt-oss-20b', extra: { reasoning_effort: 'medium', include_reasoning: false } },
] as const;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function keys(): string[] {
  return (process.env.GROQ_API_KEY ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

// "model|keyIndex" -> time it can be used again
const coolUntil = new Map<string, number>();
let nextKey = 0; // round-robin start, so load spreads over all keys

function waitFrom(res: Response): number {
  // Groq sends retry-after in seconds; fall back to a minute.
  const s = Number(res.headers.get('retry-after'));
  return (Number.isFinite(s) && s > 0 ? s : 60) * 1000;
}

export class CoachLimitError extends Error {
  constructor(public retryInMs: number) {
    super('limit');
  }
}

/**
 * Starts a streamed chat completion, trying every key on every model until one accepts.
 * Resolves once a response has started, with Groq's SSE body and the model used.
 */
export async function streamChat(messages: ChatMessage[], maxTokens = 2500) {
  const all = keys();
  if (!all.length) throw new Error('GROQ_API_KEY is not set');

  let soonest = Infinity;
  let lastError = '';
  for (const model of MODELS) {
    for (let n = 0; n < all.length; n++) {
      const i = (nextKey + n) % all.length;
      const slot = `${model.id}|${i}`;
      const until = coolUntil.get(slot) ?? 0;
      if (until > Date.now()) {
        soonest = Math.min(soonest, until - Date.now());
        continue;
      }
      const res = await fetch(URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${all[i]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.id,
          messages,
          stream: true,
          temperature: 0.4,
          max_completion_tokens: maxTokens,
          ...model.extra,
        }),
      });
      if (res.ok && res.body) {
        nextKey = (i + 1) % all.length;
        return { body: res.body, model: model.id };
      }
      const text = await res.text().catch(() => '');
      if (res.status === 429) {
        const wait = waitFrom(res);
        coolUntil.set(slot, Date.now() + wait);
        soonest = Math.min(soonest, wait);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        coolUntil.set(slot, Date.now() + 3600_000); // bad or revoked key: skip it for an hour
        lastError = `A Groq key was refused (${res.status}).`;
        continue;
      }
      if (res.status >= 500) {
        lastError = `Groq had a problem (${res.status}).`;
        continue; // try the next key/model
      }
      // 400s are about the request itself; another key won't help.
      throw new Error(`Groq rejected the request (${res.status}): ${text.slice(0, 200)}`);
    }
  }
  if (soonest < Infinity) throw new CoachLimitError(soonest);
  throw new Error(lastError || 'No Groq key could answer.');
}

/** Turns Groq's SSE stream into a plain text stream of the answer. */
export function sseToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const data = line.trim().replace(/^data:\s*/, '');
          if (!data || data === '[DONE]' || !line.trim().startsWith('data:')) continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            /* partial or keep-alive line */
          }
        }
      },
    })
  );
}
