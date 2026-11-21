import { dataApi } from '../lib/data-api.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try { if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' }); return res.status(200).json(await dataApi('/v1/usage')); }
  catch (e) { return res.status(503).json({ error: e.message }); }
}
