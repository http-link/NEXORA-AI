import { safeEqual, createSession } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const username = String(process.env.NEXORA_USERNAME || '');
  const password = String(process.env.NEXORA_PASSWORD || '');
  const secret = String(process.env.NEXORA_SESSION_SECRET || '');
  if (!username || !password || password.length < 12 || !secret || secret.length < 32) {
    return res.status(500).json({ error: 'Login is not configured. Check the Vercel environment variables.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const suppliedUser = String(body?.username || '');
  const suppliedPass = String(body?.password || '');

  if (!safeEqual(suppliedUser, username) || !safeEqual(suppliedPass, password)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const token = createSession(secret);
  res.setHeader('Set-Cookie', `nexora_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`);
  return res.status(200).json({ ok: true });
}
