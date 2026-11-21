# NEXORA AI PRO — Integrated private build

This release keeps the existing private login, chat UI, local chat history, theme toggle and Groq chat integration, and adds the PRO workspace UI and optional cloud services.

## 1. Vercel environment variables

Keep the variables already working in your current Vercel project:

- `NEXORA_USERNAME`
- `NEXORA_PASSWORD` (12+ characters)
- `NEXORA_SESSION_SECRET` (random, 32+ characters)
- `GROQ_API_KEY`
- `GROQ_MODEL` (optional; existing model can remain)

Recommended optional model settings:

- `GROQ_CODING_MODEL` — coding model; defaults to `GROQ_MODEL`, then `openai/gpt-oss-120b`.
- `GROQ_VISION_MODEL` — vision model; defaults to `qwen/qwen3.8-27b`.

Optional backup provider (OpenAI-compatible chat-completions endpoint):

- `BACKUP_AI_BASE_URL` — base URL, without `/chat/completions` (for example provider's OpenAI-compatible `/v1` base).
- `BACKUP_AI_API_KEY`
- `BACKUP_AI_MODEL`

Optional image generation provider (OpenAI-compatible Images API):

- `IMAGE_API_BASE_URL` — base URL, without `/images/generations`.
- `IMAGE_API_KEY`
- `IMAGE_API_MODEL`

Image generation is intentionally reported as not configured until all three image variables are supplied. No provider or free unlimited generation is assumed.

## 2. Cloudflare D1 — project memory, usage and shared limits

The project includes `cloudflare-worker/worker.js`, `schema.sql`, and `wrangler.toml`.

1. Create a D1 database in Cloudflare named `nexora-data`.
2. Run the SQL in `cloudflare-worker/schema.sql` against that database.
3. In `wrangler.toml`, replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the database ID and deploy the Worker from the `cloudflare-worker` directory.
4. In the Worker settings, create a secret named `NEXORA_DATA_API_TOKEN` with a long random value.
5. Add the same value to Vercel as `NEXORA_DATA_API_TOKEN`.
6. Add the deployed Worker URL to Vercel as `NEXORA_DATA_API_URL` (for example `https://nexora-data.<your-subdomain>.workers.dev`).
7. Optionally set `NEXORA_REQUEST_LIMIT` in Vercel (default 30 requests per 10 minutes).

The Worker uses the D1 binding name `DB`. Keep the token private; never place it in browser code or GitHub. The shared limiter records requests centrally in D1. It is a simple shared quota gate, not a transactional billing-grade limiter; simultaneous bursts may briefly race.

Until these Cloudflare variables are configured, chat continues to work through Groq, but Project Memory and the Usage Dashboard will show a setup message. The global D1 limit is not active until configured.

## 3. Feature notes

- **Multi-model:** Groq coding/vision model selection is supported. Optional backup chat provider is used if Groq fails. The backup is not used for image input.
- **Long Coding Mode:** asks for staged output and can make up to two automatic continuation calls when the model emits NEXORA's continuation marker. It cannot guarantee unlimited output; provider token and request limits still apply.
- **Project Memory:** stores project name, description, rolling context and captured source files in D1. To make file capture reliable, ask NEXORA to label each file clearly (for example `index.html`, `style.css`) immediately before its fenced code block.
- **Image analysis:** accepts PNG/JPEG/WebP images up to 6 MB in the chat composer. It uses the configured Groq vision model.
- **Image generation:** requires an OpenAI-compatible image-generation provider and its own credentials. It is not supplied by the Groq chat endpoint.
- **Usage Dashboard:** records requests and provider-reported token counts when returned by the provider. It does not read a provider's remaining account quota; use the provider dashboard for authoritative remaining limits.
- **Project ZIP Export:** packages captured project files. It does not include API keys, environment secrets or files that were never captured.
- **Chat history:** remains browser-local in this release, as in the previous working version. Project memory is cloud-persisted separately.

## 4. Deploy

1. Back up the currently working GitHub repository first.
2. Upload the contents of this project folder to the repository root, preserving `api/`, `lib/`, `cloudflare-worker/`, and `middleware.js` paths.
3. Vercel deploys the API routes using Node.js built-in ZIP compression; no extra npm package is required.
4. Confirm deployment is Ready, then test login, chat, logout and login again.
5. Configure Cloudflare D1 and optional provider variables as described above, then redeploy Vercel after changing its environment variables.

## Security

- Never commit API keys, passwords, session secrets or the Cloudflare data token.
- If a secret was ever pasted into a chat or public repository, rotate it.
- Protect every public deployment alias/domain connected to this repository.
- Middleware protects site and API routes. Login and logout endpoints remain accessible by design.
