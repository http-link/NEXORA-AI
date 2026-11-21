# NEXORA AI PRO — മലയാളം Setup Guide

## ആദ്യം ചെയ്യേണ്ടത്

- ഇപ്പോഴുള്ള GitHub repository delete ചെയ്യരുത്.
- നിലവിലുള്ള working project-ന്റെ backup വേറെയായി സൂക്ഷിക്കുക.
- ഈ ZIP extract ചെയ്തശേഷം അതിലെ `NEXORA-AI-main` folder-ന്റെ ഉള്ളിലുള്ള files മാത്രം repository root-ലേക്ക് upload ചെയ്യുക.
- `api`, `lib`, `cloudflare-worker` folders പേരും സ്ഥാനവും മാറ്റരുത്.

## Vercel-ൽ സൂക്ഷിക്കേണ്ട പഴയ variables

നിലവിൽ പ്രവർത്തിക്കുന്ന ഇവ മാറ്റരുത്:

- `NEXORA_USERNAME`
- `NEXORA_PASSWORD`
- `NEXORA_SESSION_SECRET`
- `GROQ_API_KEY`
- `GROQ_MODEL` (ഇപ്പോൾ ഉപയോഗിക്കുന്നുണ്ടെങ്കിൽ)

## പുതിയ optional AI variables

Vercel → Project → Settings → Environment Variables:

- `GROQ_CODING_MODEL` — coding model. ഒഴിവാക്കിയാൽ പഴയ `GROQ_MODEL` ഉപയോഗിക്കും.
- `GROQ_VISION_MODEL` — image analysis model. default `qwen/qwen3.8-27b`.
- `BACKUP_AI_BASE_URL`
- `BACKUP_AI_API_KEY`
- `BACKUP_AI_MODEL`

Backup provider ഉപയോഗിക്കണമെങ്കിൽ അതിന്റെ OpenAI-compatible API details വേണം. ഈ മൂന്ന് variables ഇല്ലെങ്കിൽ Groq മാത്രം ഉപയോഗിക്കും.

## Cloudflare D1 setup — Project Memory / Usage / Global Limit

1. Cloudflare Dashboard തുറക്കുക.
2. **Workers & Pages → D1 SQL Database → Create database** തിരഞ്ഞെടുക്കുക.
3. Database name `nexora-data` നൽകുക.
4. Database തുറന്ന് SQL Console-ൽ ഈ ZIP-ലെ `cloudflare-worker/schema.sql` മുഴുവൻ paste ചെയ്ത് Run ചെയ്യുക.
5. Database Settings-ൽ കാണുന്ന Database ID copy ചെയ്യുക.
6. ZIP-ലെ `cloudflare-worker/wrangler.toml` തുറന്ന് `REPLACE_WITH_YOUR_D1_DATABASE_ID` എന്ന ഭാഗത്ത് ആ ID paste ചെയ്യുക.
7. `cloudflare-worker` folder-ൽ നിന്ന് `npx wrangler deploy` command ഉപയോഗിച്ച് Worker deploy ചെയ്യുക. Wrangler login ആവശ്യപ്പെട്ടാൽ Cloudflare account-ൽ login ചെയ്യുക.
8. Worker Settings → Variables and Secrets-ൽ `NEXORA_DATA_API_TOKEN` എന്ന secret സൃഷ്ടിക്കുക. കുറഞ്ഞത് 32 characters ഉള്ള പുതിയ random value ഉപയോഗിക്കുക.
9. അതേ value Vercel-ൽ `NEXORA_DATA_API_TOKEN` എന്ന Environment Variable ആയി ചേർക്കുക.
10. Worker URL Vercel-ൽ `NEXORA_DATA_API_URL` എന്ന പേരിൽ ചേർക്കുക. URL-ന്റെ അവസാനം `/` ചേർക്കേണ്ടതില്ല.
11. Vercel-ൽ `NEXORA_REQUEST_LIMIT` വേണമെങ്കിൽ `30` ആയി ചേർക്കാം. Default 30 requests / 10 minutes ആണ്.
12. Vercel-ൽ പുതിയ deployment നടത്തുക.

**ശ്രദ്ധിക്കുക:** D1 setup പൂർത്തിയാകുന്നതുവരെ Chat/Groq പ്രവർത്തിക്കും. എന്നാൽ Project Memory, Usage Dashboard, Global D1 Rate Limit എന്നിവയ്ക്ക് Cloudflare setup ആവശ്യമാണ്.

## Image Studio

Image Upload + Analysis നേരിട്ട് Groq Vision വഴി പ്രവർത്തിക്കും. PNG/JPG/WebP, പരമാവധി 6 MB.

Image Generation-ന് വേറിട്ട image provider API ആവശ്യമാണ്. ആ provider-ൽ നിന്ന് ലഭിക്കുന്ന credentials Vercel-ൽ താഴെ ചേർക്കണം:

- `IMAGE_API_BASE_URL`
- `IMAGE_API_KEY`
- `IMAGE_API_MODEL`

Provider key ഇല്ലെങ്കിൽ Image Studio തുറക്കുമെങ്കിലും generation request-ൽ setup message കാണിക്കും. Free unlimited image generation വാഗ്ദാനം ചെയ്യുന്നില്ല.

## Deploy കഴിഞ്ഞ് പരിശോധിക്കുക

1. NEXORA URL തുറക്കുക; login page വരണം.
2. പഴയ username/password ഉപയോഗിച്ച് login ചെയ്യുക.
3. സാധാരണ text chat test ചെയ്യുക.
4. Image attach ചെയ്ത് image analysis test ചെയ്യുക.
5. Long Coding Mode test ചെയ്യുക.
6. Cloudflare setup കഴിഞ്ഞ് Projects → New project test ചെയ്യുക.
7. Project-ൽ code file names-ന് heading നൽകി code block സൃഷ്ടിക്കുക; തുടർന്ന് Export ZIP test ചെയ്യുക.
8. Logout ചെയ്ത് browser back / direct URL test ചെയ്യുക.

API keys, passwords, session secret, Cloudflare token എന്നിവ GitHub code-ലോ browser code-ലോ ചേർക്കരുത്.
