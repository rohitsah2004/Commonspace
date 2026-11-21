import { env } from 'cloudflare:workers';
import { authorizeWrite, isOwner, database, json } from '../../../lib/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { assistReady, callModel, AI_MAX_TOKENS, AIProviderError } from '../../../lib/ai';
import { buildPrompt } from '../../../lib/assist-prompt';
import { readAssistInput, validatedAssistContent, codeWarnings, AssistInputError } from '../../../lib/assist-content';
import { claimAssistQuota, refundAssistQuota } from '../../../lib/assist-quota';

import { protectLiterals } from '../../../lib/assist-protection';
import { secretWarnings } from '../../../lib/assist-secrets';
import { loadAssistTaxonomy, normalizeAssistTags } from '../../../lib/assist-taxonomy';
import { validateAssistResult, validateAssistMetadata } from '../../../lib/assist-result';

import { isBookMode } from '../../../lib/book/input';
import { bookAssist } from '../../../lib/book/assist';

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
  if (isBookMode(input.mode) && input.book) return bookAssist(request, { ...input, book: input.book }, user.userId);
  const secrets = secretWarnings(input.text + '\n' + (input.hints.tags || []).join('\n'));
  if (secrets.length && !input.secretConsent) return json({ error: 'This looks like it contains a secret. Redact it or explicitly confirm sending.', secretWarnings: secrets }, 409);
  let protectedInput: ReturnType<typeof protectLiterals>;
  try { protectedInput = protectLiterals(input.text); } catch { return json({ error: 'Close your fenced code blocks before formatting.' }, 400); }
  let taxonomy: Awaited<ReturnType<typeof loadAssistTaxonomy>>;
  try { taxonomy = await loadAssistTaxonomy(database()); } catch { return json({ error: 'Could not load your tag taxonomy. Try again.' }, 503); }
  const reservedAt = Date.now();
  try {
    if (!await claimAssistQuota(database(), user.userId, reservedAt)) {
      const response = json({ error: 'Daily AI limit reached (30 requests). Try again after midnight UTC.' }, 429);
      response.headers.set('Retry-After', String(Math.ceil((86400000 - Date.now() % 86400000) / 1000))); return response;
    }
  } catch { return json({ error: 'AI request protection is unavailable. Try again later.' }, 503); }
  const controller = new AbortController(); const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 60000); request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  let receivedOutput = false;
  try {
    const prompt = buildPrompt(input.mode, protectedInput.text, input.hints, taxonomy);
    const result = await callModel({ ...prompt, metadataOnly: input.mode === 'metadata', maxTokens: input.mode === 'metadata' ? 1500 : AI_MAX_TOKENS, signal: controller.signal });
    receivedOutput = true;
    const parsed: unknown = JSON.parse(result.markdown);
    if (input.mode === 'metadata') {
      const metadata = validateAssistMetadata(parsed);
      return json({ metadata: { tags: normalizeAssistTags(metadata.tags, taxonomy.tags), excerpt: metadata.excerpt }, warnings: [], usage: result.usage });
    }
    const draft = validateAssistResult(parsed);
    if (JSON.stringify([draft.title, draft.subtitle, draft.excerpt, draft.tags]).includes('⟦KEEP_')) throw Error('Protected token in metadata.');
    draft.markdown = protectedInput.restore(draft.markdown);
    if (input.mode === 'cheatsheet' && draft.type !== 'cheatsheet') throw Error('Wrong content type.');
    const content = validatedAssistContent(draft, taxonomy.tags);
    const warnings = codeWarnings(input.text, content.body);
    if (warnings.length) throw Error('Code changed during document conversion.');
    return json({ content, warnings, usage: result.usage });
  } catch (error) {
    if (receivedOutput || controller.signal.aborted || error instanceof AIProviderError && error.refundable) {
      try { await refundAssistQuota(database(), user.userId, reservedAt); } catch { return json({ error: 'AI failed and the quota refund could not be confirmed. Your original text is unchanged.' }, 503); }
    }
    return json({ error: controller.signal.aborted ? 'AI formatting stopped or timed out. Your original text is unchanged.' : receivedOutput ? 'The AI response did not pass draft validation. Your original text is unchanged. Try again or use Markdown import.' : 'OpenAI could not complete formatting. Try again or check the server API access and credits. Your original text is unchanged.' }, controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
