const base = (process.env.NEXORA_DATA_API_URL || '').replace(/\/$/, '');
const token = process.env.NEXORA_DATA_API_TOKEN || '';
export async function dataApi(path, options = {}) {
  if (!base || !token) throw new Error('Cloudflare project storage is not configured. Set NEXORA_DATA_API_URL and NEXORA_DATA_API_TOKEN in Vercel.');
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Storage service error (${response.status})`);
  return data;
}
