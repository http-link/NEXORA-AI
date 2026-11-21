export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
import { dataApi } from '../lib/data-api.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  const id = String(req.query?.id || '');
  if (!id) return res.status(400).json({ error:'Project id is required.' });
  try {
    if (req.method === 'GET') return res.status(200).json(await dataApi(`/v1/projects/${encodeURIComponent(id)}`));
    if (req.method === 'PUT') return res.status(200).json(await dataApi(`/v1/projects/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(req.body || {}) }));
    if (req.method === 'DELETE') return res.status(200).json(await dataApi(`/v1/projects/${encodeURIComponent(id)}`, { method:'DELETE' }));
    return res.status(405).json({ error:'Method not allowed.' });
  } catch(e) { return res.status(503).json({ error:e.message }); }
}
