# AGENTS.md — Online Dominance Dashboard

> Read this before extending the dashboard. The recent Q2-2026 addition (AI Visibility Layer) introduced a parallel data flow alongside the original Web Dominance Index — touch carefully.

## Project at a glance

- **Owner:** Magnum Estate (real estate agency, Bali, Indonesia)
- **Tracked:** `magnumestate.com` vs 4 fixed competitors (`bali-home-immo.com`, `mirahdevelopments.com`, `cocodevelopmentgroup.com`, `breig-property.com`)
- **Stack:** ESM Node ≥20, Express 4, `better-sqlite3`, vanilla JS frontend (NOT React), deployed on Render
- **Data file:** `data/snapshots.db`
- **Audience:** Internal tool for one client. Not multi-tenant. No auth beyond `SNAPSHOT_TOKEN` Bearer for write endpoints.

## Two parallel scoring tracks

```
Total Dominance = TD_WEIGHT_WEB × Web Dominance + TD_WEIGHT_AI × AI Visibility
                  (default 0.7 × ... + 0.3 × ...)
```

### 1. Web Dominance (original)
- Source: GA4 + GSC + Bright Data SERP + Google Sheets content plan
- Score: `dominanceIndex()` in `server/score.js`
- Persistence: `dominance_history` table in SQLite
- DO NOT change `dominanceIndex` weights or formula without explicit user approval — it's the historical baseline.

### 2. AI Visibility (new, Path A + Path C)
**Path A — Synthetic AI Probe.** We run our own prompts against LLM APIs (Claude, OpenAI, Perplexity, YandexGPT) and analyze the responses. NOT real-user query data — synthetic SOV proxy.
- Prompts: `data/prompts.json`
- Probe: `server/sources/ai-probe.js` — fan-out per (prompt × engine), graceful degradation when API keys missing
- Classifier: `server/sources/ai-classifier.js` — Claude Haiku 4.5 batched sentiment/intent + rule-based brand/competitor mention detection
- Score: `aiVisibilityScore()` in `server/score.js` (SOV 40% + growth 30% + positive 20% + citation 10%)
- Persistence: `ai_visibility_responses` table (per-response) + `snapshots` table with `type='ai-visibility-week'` (weekly aggregate)

**Path C — Google AI Overviews.** Real Google AI Overview blocks parsed from existing Bright Data SERP responses (no extra API cost — same call).
- Parser: `parseAiOverview()` in `server/sources/serp.js`
- Summary: `summarizeAiOverviews()` in `server/sources/ai-overviews.js`
- Persistence: piggybacks existing `snapshots` table with `type='serp'` (`aiOverviews` field added to payload)

## Environment variables

Required for AI Visibility to populate (graceful degradation if missing):
- `ANTHROPIC_API_KEY` — enables Claude probe + Haiku 4.5 classifier
- `OPENAI_API_KEY` — enables ChatGPT probe
- `PERPLEXITY_API_KEY` — enables Perplexity probe (gives citation URLs)
- `YANDEX_GPT_API_KEY` + `YANDEX_GPT_FOLDER_ID` — enables YandexGPT probe

Score weighting:
- `TD_WEIGHT_WEB` (default `0.7`) — Total Dominance weight for Web Dominance
- `TD_WEIGHT_AI` (default `0.3`) — Total Dominance weight for AI Visibility

Existing (Web Dominance):
- `GA4_*`, `GSC_*`, `BRIGHT_DATA_*`, `SEO_PROGRESS_SHEET_ID`, `SNAPSHOT_TOKEN`, `DASHBOARD_URL`

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Source-by-source configuration status |
| GET | `/api/dashboard?startDate&endDate&...` | Combined dashboard data (Web + AI + AI Overviews) |
| POST | `/api/snapshot` | Bearer-protected. Pulls all sources, runs AI probe + classifier, persists weekly aggregate, records dominance |
| POST | `/api/brief/weekly` | Bearer-protected. Generates weekly markdown brief, writes to `briefs/YYYY-MM-DD.md`. `?dryRun=1` returns markdown without writing |
| GET | `/api/briefs` | Lists briefs in `briefs/` directory |
| GET | `/briefs/YYYY-MM-DD.md` | Static-served markdown brief |

## Cron schedule (Render)

- **Mon 06:00 UTC (`weekly-snapshot`):** POST `/api/snapshot` — pulls SERP, GA4, GSC, runs AI probe (`force=0` so already-cached responses for the week are skipped). Writes weekly aggregate.
- **Mon 01:00 UTC (`weekly-ai-brief`):** POST `/api/brief/weekly` — generates and persists the brief. Runs BEFORE snapshot so it summarizes the previous week's data; if you want it to use this Monday's snapshot, swap the order or move brief to Tue.

## Key design decisions (don't reverse without reason)

1. **Synthetic ≠ real user data.** AI Visibility Score is from prompts WE choose. Brief and dashboard copy MUST acknowledge this. If you change framing, update the brief template too.
2. **Web Dominance is frozen.** The original `dominanceIndex` formula is the baseline. Add new metrics as siblings (like AI Visibility), not by reweighting existing components.
3. **Vanilla JS frontend.** Do NOT introduce React/Vue/build steps. The dashboard is a static `index.html` + `app.js` + `styles.css` served by Express. Keep new components inline.
4. **`better-sqlite3` is already installed.** Don't add another DB. New tables go in `getDb()` init in `server/cache.js`.
5. **Engine fan-out is concurrency-limited (`MAX_CONCURRENT=4`)** in `ai-probe.js`. Bumping it risks rate limits at OpenAI/Anthropic.
6. **Sentiment classification is opt-in** (only runs if `ANTHROPIC_API_KEY` set). The score gracefully gives a neutral 1.0 component if classifier didn't run.
7. **Brief uses simple `{{var}}` template substitution** — no Handlebars/templating dep. Keep `templates/brief.md.tpl` plain markdown.

## How to add a new probe engine

1. Add an entry to `ENGINE_CONFIG` in `server/sources/ai-probe.js` with `envKey`, `model`, `call` function
2. Implement the `call` function (model-specific HTTP call to provider's API)
3. Add the engine name to `data/prompts.json` `engines` array (informational only)
4. Add `<ENGINE>_API_KEY` to `render.yaml` envVars

## How to add a new prompt

Edit `data/prompts.json` and add an item to the `prompts` array. Required fields: `id` (unique kebab-case), `lang` (`en`/`ru`/`fr`), `tag` (free-form), `text` (the prompt). Run `/api/snapshot?force=1` to test.

## Testing locally

```bash
PORT=3000 node server/index.js
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/dashboard?startDate=2026-04-01&endDate=2026-04-26' | head -c 500

# Snapshot (requires SNAPSHOT_TOKEN env)
curl -X POST -H "Authorization: Bearer $SNAPSHOT_TOKEN" http://localhost:3000/api/snapshot

# Brief (dry-run, no file write)
curl -X POST -H "Authorization: Bearer $SNAPSHOT_TOKEN" 'http://localhost:3000/api/brief/weekly?dryRun=1'
```

## Where to look first when something breaks

- **AI Visibility shows "No data":** check `/api/health` for `aiProbe.configured`, verify env vars set, check `data/snapshots.db` for rows in `ai_visibility_responses`
- **Brief generation fails:** check `templates/brief.md.tpl` exists, check `briefs/` directory writable, look at server logs
- **AI Overviews always null:** check Bright Data response shape — `parseAiOverview` looks at `ai_overview` / `aiOverview` / `generative_ai` / `sge` keys; if Bright Data uses a new key, add it to the candidate list
- **Hero scores `—`:** API returned `null` for that metric — check the appropriate source `isConfigured()` and recent snapshot date
