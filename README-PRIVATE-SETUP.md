# NEXORA AI — Private Vercel build

## What's changed
- Added a private sign-in page.
- Added signed, HttpOnly, Secure, SameSite=Strict session cookies (7-day expiry).
- Protected website routes with `middleware.js`.
- Protected `/api/chat` independently as well.
- Added sign-out.
- Added a best-effort per-server-instance throttle (30 requests / 10 minutes per IP).

## Vercel environment variables
In Vercel → Project → Settings → Environment Variables, add these variables for Production (and Preview only if you want preview deployments protected too):

1. `NEXORA_USERNAME` — choose your own login username.
2. `NEXORA_PASSWORD` — choose a strong unique password (at least 12 characters).
3. `NEXORA_SESSION_SECRET` — a random secret of at least 32 characters.
4. `GROQ_API_KEY` — your existing Groq API key.
5. `GROQ_MODEL` — optional; keep your current model value if already configured.

Do not put any of these secrets in `index.html`, `script.js`, or GitHub source code. After adding/changing variables, redeploy the project.

## Deploy
Upload/push the complete contents of this folder to the same GitHub repository connected to Vercel. Keep the `api/`, `lib/`, and `middleware.js` paths exactly as shown. Vercel should detect the API functions and middleware automatically.

## Important security notes
- The browser chat list is still stored in that browser's localStorage. It is not synced to a server or shared between devices. Clearing browser data can erase it.
- The included in-memory throttle is best-effort only: Vercel serverless instances do not share memory. It helps with simple bursts but is not a guaranteed global quota limit. A persistent rate-limit store or edge firewall is needed for a hard global limit.
- The login protects access through the deployed Vercel site and its API. Do not share your password. If the project has other public deployment aliases/domains, protect or disable those deployments too.
