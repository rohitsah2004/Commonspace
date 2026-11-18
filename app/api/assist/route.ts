import { env } from 'cloudflare:workers';
import { authorizeWrite, isOwner, database, json } from '../../../lib/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { assistReady, callModel, AI_MAX_TOKENS } from '../../../lib/ai';
import { buildPrompt } from '../../../lib/assist-prompt';
import { readAssistInput, validatedAssistContent, codeWarnings, AssistInputError } from '../../../lib/assist-content';
import { claimAssistQuota } from '../../../lib/assist-quota';

export async function GET() {
  if (!await isOwner()) return json({ error: 'Owner access required.' }, 403);
  return json({ ready: assistReady(env) });
}
export async function POST(request: Request) {
  const denied = await authorizeWrite(request); if (denied) return denied;
  let input: Awaited<ReturnType<typeof readAssistInput>>;
  try { input = await readAssistInput(request); }
  catch (error) { return json({ error: error instanceof AssistInputError ? error.message : 'Invalid formatting request.' }, error instanceof AssistInputError ? error.status : 400); }
  if (!assistReady(env)) return json({ error: 'AI formatting is not configured. Set the server-side provider key and model.' }, 503);
  const user = await getChatGPTUser(); if (!user) return json({ error: 'Owner access required.' }, 403);
  try {
    if (!await claimAssistQuota(database(), user.userId)) {
      const response = json({ error: 'Daily AI limit reached (30 requests). Try again after midnight UTC.' }, 429);
      response.headers.set('Retry-After', String(Math.ceil((86400000 - Date.now() % 86400000) / 1000))); return response;
    }
  } catch { return json({ error: 'AI request protection is unavailable. Try again later.' }, 503); }
  const controller = new AbortController(); const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 60000); request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  try {
    const prompt = buildPrompt(input.mode, input.text, input.hints);
    const result = await callModel({ ...prompt, maxTokens: AI_MAX_TOKENS, signal: controller.signal });
    const content = validatedAssistContent(result.markdown);
    return json({ content, warnings: codeWarnings(input.text, content.body), usage: result.usage });
  } catch {
    return json({ error: controller.signal.aborted ? 'AI formatting stopped or timed out. Your original text is unchanged.' : 'AI formatting failed or returned an invalid draft. Your original text is unchanged. Try again or use Markdown import.' }, controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
