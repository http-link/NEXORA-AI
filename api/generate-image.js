export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const endpoint = (process.env.IMAGE_API_BASE_URL || '').replace(/\/$/, '');
  const key = process.env.IMAGE_API_KEY || '';
  const model = process.env.IMAGE_API_MODEL || '';
  if (!endpoint || !key || !model) return res.status(503).json({ error: 'Image generation provider is not configured yet. Add IMAGE_API_BASE_URL, IMAGE_API_KEY and IMAGE_API_MODEL in Vercel. NEXORA will not pretend generation is available until configured.' });
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt || prompt.length > 3000) return res.status(400).json({ error: 'Enter an image prompt under 3000 characters.' });
  try {
    const r = await fetch(`${endpoint}/images/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: d?.error?.message || `Image provider error (${r.status})` });
    return res.status(200).json({ image: d?.data?.[0]?.url || (d?.data?.[0]?.b64_json ? `data:image/png;base64,${d.data[0].b64_json}` : null), revised_prompt: d?.data?.[0]?.revised_prompt || null });
  } catch { return res.status(502).json({ error: 'Could not connect to image provider.' }); }
}
