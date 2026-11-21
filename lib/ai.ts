import { env } from 'cloudflare:workers';
import { ASSIST_RESULT_SCHEMA, ASSIST_METADATA_SCHEMA } from './assist-result';

export type AIEnvironment = { OPENAI_API_KEY?: string; AI_MODEL?: string; AI_PROVIDER?: string };
export type AIUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
export const AI_MAX_TOKENS = 6000;
export const AI_MAX_OUTPUT_BYTES = 120000;
const PROVIDER_RESPONSE_LIMIT = 256000;
export class AIProviderError extends Error {
  constructor(public refundable = true) { super('AI formatting is unavailable. Check the server configuration or try again later.'); }
}
const failure = (refundable = true) => new AIProviderError(refundable);
async function backoff(signal: AbortSignal) {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(failure()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 600);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function assistReady(config: AIEnvironment): boolean {
  // Anthropic is intentionally unsupported until a separately verified adapter/key contract exists.
  return (config.AI_PROVIDER?.trim().toLowerCase() || 'openai') === 'openai'
    && !!config.OPENAI_API_KEY?.trim() && /^[a-zA-Z0-9._:/-]{1,160}$/.test(config.AI_MODEL || '');
}

async function boundedJSON(response: Response): Promise<unknown> {
  if (!response.body || Number(response.headers.get('content-length')) > PROVIDER_RESPONSE_LIMIT) throw failure();
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > PROVIDER_RESPONSE_LIMIT) throw failure(); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function callModel({ system, user, maxTokens, signal, metadataOnly = false, responseSchema }: {
  system: string; user: string; maxTokens: number; signal: AbortSignal; metadataOnly?: boolean; responseSchema?: Record<string, unknown>;
}): Promise<{ markdown: string; usage: AIUsage }> {
  try {
    if (!assistReady(env)) throw failure();
    let response!: Response;
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        // Workers supports manual/follow, not error. Reject every 3xx below; never forward the key.
        method: 'POST', signal, redirect: 'manual', headers: {
          Authorization: 'Bearer ' + env.OPENAI_API_KEY!.trim(), 'Content-Type': 'application/json',
        },
        // max_tokens is deprecated; max_completion_tokens caps visible + reasoning tokens.
        body: JSON.stringify({ model: env.AI_MODEL, store: false,
          max_completion_tokens: Math.max(1, Math.min(AI_MAX_TOKENS, Math.floor(maxTokens))),
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          response_format: { type: 'json_schema', json_schema: { name: 'assist_result', strict: true, schema: responseSchema || (metadataOnly ? ASSIST_METADATA_SCHEMA : ASSIST_RESULT_SCHEMA) } } }),
      });
      const transient = response.status === 429 || response.status >= 500;
      if (!response.ok) {
        await response.body?.cancel();
        if (transient && attempt === 0) { await backoff(signal); continue; }
        throw failure(transient || response.status === 401 || response.status === 403 || response.status >= 300 && response.status < 400);
      }
      break;
    }
    const result = await boundedJSON(response) as {
      choices?: { finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }[];
      usage?: Record<string, unknown>;
    };
    const choice = result?.choices?.[0]; const markdown = choice?.message?.content;
    if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof markdown !== 'string' || !markdown.trim()
      || new TextEncoder().encode(markdown).length > AI_MAX_OUTPUT_BYTES || markdown.includes(env.OPENAI_API_KEY!.trim())) throw failure();
    const usage: AIUsage = {};
    for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens'] as const) {
      const value = result.usage?.[key];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) usage[key] = value;
    }
    return { markdown, usage };
  } catch (error) { throw error instanceof AIProviderError ? error : failure(); } // Never echo provider bodies, headers, errors, key, or owner text.
}
