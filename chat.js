import { dataApi } from '../lib/data-api.js';
export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '12mb' } } };

const SYSTEM_PROMPT = `You are NEXORA AI, created by VEX Creative Designs. You are a premium coding, learning and software-development assistant. Help build complete websites and applications, debug carefully, explain in simple English or Malayalam according to the user's language, and preserve existing project requirements. For large tasks, work in clearly numbered stages, produce complete files, keep track of decisions and next steps, and never pretend a task is complete when it is not. When asked about your identity, say you are NEXORA AI by VEX Creative Designs. Never claim to be an underlying model or provider. Be accurate about limitations and never invent API capabilities. When working inside an active NEXORA Project, preserve its saved context. For each source file, put its exact relative filename on a separate Markdown heading immediately before its fenced code block (example: ### src/index.js), so NEXORA can save and export it.`;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
function parseBody(body) { if (typeof body === 'string') { try { return JSON.parse(body); } catch { return null; } } return body; }
async function callGroq({ key, model, messages, temperature = 0.5, max_tokens = 8000 }) {
  const r = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages, temperature, max_tokens }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d?.error?.message || `AI provider error (${r.status})`); e.status = r.status; throw e; }
  return { content: d?.choices?.[0]?.message?.content || '', usage: d?.usage || null };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const body = parseBody(req.body);
  if (!body || !Array.isArray(body.messages)) return res.status(400).json({ error: 'messages must be an array.' });
  const messages = body.messages.filter(m => m && ['user','assistant'].includes(m.role) && (typeof m.content === 'string' || Array.isArray(m.content))).slice(-24);
  if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'The last message must be from the user.' });
  const last = messages[messages.length - 1];
  if (Array.isArray(last.content)) {
    for (const part of last.content) if (part.type === 'image_url' && String(part.image_url?.url || '').length > 9_000_000) return res.status(413).json({ error: 'Image is too large. Please use an image under 6 MB.' });
  }
  const primaryKey = (process.env.GROQ_API_KEY || '').trim();
  if (!primaryKey) return res.status(500).json({ error: 'GROQ_API_KEY is missing in Vercel.' });
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
  const requestedMode = String(body.mode || 'auto');
  const useVision = hasImage || requestedMode === 'vision';
  const model = useVision ? (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b').trim() : (process.env.GROQ_CODING_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim();
  if (process.env.NEXORA_DATA_API_URL && process.env.NEXORA_DATA_API_TOKEN) {
    try { await dataApi('/v1/rate-limit', { method: 'POST', body: JSON.stringify({ limit: Number(process.env.NEXORA_REQUEST_LIMIT || 30), window_ms: 600000 }) }); }
    catch (limitError) { if (/429|limit/i.test(limitError.message)) return res.status(429).json({ error: 'NEXORA usage limit reached. Please wait a little and try again.' }); return res.status(503).json({ error: 'Global usage control is configured but unavailable. Please retry shortly.' }); }
  }
  const backupKey = (process.env.BACKUP_AI_API_KEY || '').trim();
  const backupModel = (process.env.BACKUP_AI_MODEL || '').trim();
  const backupUrl = (process.env.BACKUP_AI_BASE_URL || '').trim();
  try {
    const projectContext = String(body.project_context || '').slice(0, 12000);
    const longMode = body.long_mode === true;
    const system = SYSTEM_PROMPT + (projectContext ? `\n\nACTIVE PROJECT MEMORY (treat as authoritative context; preserve existing decisions):\n${projectContext}` : '') + (longMode ? '\n\nLONG CODING MODE: For substantial builds, work in coherent stages. Complete the current stage with full files and explicit file paths. If more implementation is required, end your response with the exact marker [[NEXORA_CONTINUE]] so the platform can request the next stage automatically. Do not use the marker if the task is complete.' : '');
    const enriched = [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 30000) : m.content }))];
    let reply, provider = 'Groq', usedModel = model, tokenUsage = null;
    try { const result = await callGroq({ key: primaryKey, model, messages: enriched, max_tokens: 8000 }); reply = result.content; tokenUsage = result.usage; }
    catch (primaryError) {
      if (!backupKey || !backupModel || !backupUrl || hasImage) throw primaryError;
      const r = await fetch(`${backupUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${backupKey}` }, body: JSON.stringify({ model: backupModel, messages: enriched, temperature: 0.5, max_tokens: 8000 }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message || `Backup provider error (${r.status})`);
      reply = d?.choices?.[0]?.message?.content || ''; tokenUsage = d?.usage || null; provider = 'Backup'; usedModel = backupModel;
    }
    reply = String(reply || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').trim();
    let continued = 0;
    let shouldContinue = longMode && reply.endsWith('[[NEXORA_CONTINUE]]');
    while (shouldContinue && continued < 2) {
      reply = reply.replace(/\s*\[\[NEXORA_CONTINUE\]\]\s*$/, '').trim();
      enriched.push({ role:'assistant', content:reply });
      enriched.push({ role:'user', content:'Continue with the next implementation stage. Avoid repeating completed content. Provide complete remaining files and preserve all previous decisions. If another stage is still needed, end with [[NEXORA_CONTINUE]].' });
      const next = await callGroq({ key:primaryKey, model, messages:enriched, max_tokens:8000 });
      const nextText = String(next.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').trim();
      shouldContinue = nextText.endsWith('[[NEXORA_CONTINUE]]');
      reply += '\n\n' + nextText.replace(/\s*\[\[NEXORA_CONTINUE\]\]\s*$/, '').trim();
      tokenUsage = next.usage || tokenUsage;
      continued++;
    }
    if (shouldContinue) reply += '\n\nMore stages remain. Ask NEXORA to continue to proceed.';
    if (!reply) return res.status(502).json({ error: 'The AI returned an empty reply. Please try again.' });
    let usage = null;
    if (process.env.NEXORA_DATA_API_URL && process.env.NEXORA_DATA_API_TOKEN) {
      try { usage = await dataApi('/v1/usage', { method: 'POST', body: JSON.stringify({ provider, model: usedModel, prompt_tokens: tokenUsage?.prompt_tokens ?? null, completion_tokens: tokenUsage?.completion_tokens ?? null, request_type: hasImage ? 'vision' : 'chat' }) }); } catch {}
    }
    return res.status(200).json({ reply, provider, model: usedModel, usage });
  } catch (err) {
    const status = err.status === 429 ? 429 : 502;
    return res.status(status).json({ error: err.message || 'Could not reach an AI provider.' });
  }
}
