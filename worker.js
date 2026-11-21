const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
function auth(request, env) { return !!env.NEXORA_DATA_API_TOKEN && request.headers.get('Authorization') === `Bearer ${env.NEXORA_DATA_API_TOKEN}`; }
function id() { return crypto.randomUUID(); }
export default {
  async fetch(request, env) {
    if (!auth(request, env)) return json({ error: 'Unauthorized' }, 401);
    if (!env.DB) return json({ error: 'D1 database binding DB is missing.' }, 500);
    const url = new URL(request.url), path = url.pathname, now = Date.now();
    try {
      if (path === '/v1/rate-limit' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const windowMs = Math.min(Math.max(Number(body.window_ms) || 600000, 60000), 3600000);
        const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 500);
        const since = now - windowMs;
        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limit_events WHERE created_at >= ?').bind(since).first();
        if ((row?.n || 0) >= limit) return json({ allowed: false, limit, used: row.n, reset_at: since + windowMs }, 429);
        await env.DB.prepare('INSERT INTO rate_limit_events (created_at) VALUES (?)').bind(now).run();
        return json({ allowed: true, limit, used: (row?.n || 0) + 1 });
      }
      if (path === '/v1/projects' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id,name,description,context,files_json,created_at,updated_at FROM projects ORDER BY updated_at DESC').all();
        return json({ projects: (results || []).map(p => ({ ...p, files: safeJson(p.files_json, []) })) });
      }
      if (path === '/v1/projects' && request.method === 'POST') {
        const b = await request.json(), projectId = id(), name = String(b.name || 'Untitled project').slice(0,100), desc = String(b.description || '').slice(0,1000), context = String(b.context || '').slice(0,12000), files = Array.isArray(b.files) ? b.files.slice(0,100) : [];
        await env.DB.prepare('INSERT INTO projects (id,name,description,context,files_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(projectId,name,desc,context,JSON.stringify(files),now,now).run();
        return json({ project: { id: projectId,name,description:desc,context,files,created_at:now,updated_at:now } }, 201);
      }
      const projectMatch = path.match(/^\/v1\/projects\/([\w-]+)$/);
      if (projectMatch) {
        const projectId = projectMatch[1];
        if (request.method === 'GET') {
          const p = await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(projectId).first();
          return p ? json({ project: { ...p, files: safeJson(p.files_json,[]) } }) : json({ error:'Project not found' },404);
        }
        if (request.method === 'PUT') {
          const b = await request.json();
          await env.DB.prepare('UPDATE projects SET name=?,description=?,context=?,files_json=?,updated_at=? WHERE id=?').bind(String(b.name || 'Untitled project').slice(0,100),String(b.description || '').slice(0,1000),String(b.context || '').slice(0,12000),JSON.stringify(Array.isArray(b.files)?b.files.slice(0,100):[]),now,projectId).run();
          return json({ ok:true, updated_at:now });
        }
        if (request.method === 'DELETE') { await env.DB.prepare('DELETE FROM projects WHERE id=?').bind(projectId).run(); return json({ ok:true }); }
      }
      if (path === '/v1/usage' && request.method === 'POST') {
        const b = await request.json();
        await env.DB.prepare('INSERT INTO usage_logs (provider,model,request_type,prompt_tokens,completion_tokens,created_at) VALUES (?,?,?,?,?,?)').bind(String(b.provider||'unknown').slice(0,50),String(b.model||'unknown').slice(0,100),String(b.request_type||'chat').slice(0,30),Number.isFinite(b.prompt_tokens)?b.prompt_tokens:null,Number.isFinite(b.completion_tokens)?b.completion_tokens:null,now).run();
        return json({ ok:true });
      }
      if (path === '/v1/usage' && request.method === 'GET') {
        const since = now - 86400000;
        const summary = await env.DB.prepare('SELECT COUNT(*) AS requests, SUM(COALESCE(prompt_tokens,0)+COALESCE(completion_tokens,0)) AS tokens FROM usage_logs WHERE created_at>=?').bind(since).first();
        const { results } = await env.DB.prepare('SELECT provider,model,request_type,COUNT(*) AS requests FROM usage_logs WHERE created_at>=? GROUP BY provider,model,request_type ORDER BY requests DESC').bind(since).all();
        return json({ period:'last_24_hours', requests:summary?.requests||0, recorded_tokens:summary?.tokens||0, token_note:'Token totals are recorded only when the provider returns token usage. Requests may show null token counts.', breakdown:results||[] });
      }
      return json({ error:'Not found' },404);
    } catch (e) { return json({ error: e.message || 'Internal error' },500); }
  }
};
function safeJson(value, fallback) { try { return JSON.parse(value || ''); } catch { return fallback; } }
