export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
import { dataApi } from '../lib/data-api.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return res.status(200).json(await dataApi('/v1/projects'));
    if (req.method === 'POST') return res.status(200).json(await dataApi('/v1/projects', { method: 'POST', body: JSON.stringify(req.body || {}) }));
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) { return res.status(503).json({ error: e.message }); }
}
