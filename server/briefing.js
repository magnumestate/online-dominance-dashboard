// Weekly executive briefing generator.
// Takes a structured "facts" object built from the dashboard's data sources
// (GA4 / GSC / SERP / SERP-diff / SEO-progress / Dominance Index) and asks
// Claude to produce a strict-JSON briefing in BOTH Russian AND English in a
// single call. The dashboard renders the version matching the user's lang
// toggle, so EN mode never falls through to RU narrative.
//
// Cost: ~3.5K input + ~500 output tokens per call (double output for two
// languages). On Opus 4.7 that's about $0.04/run, ~$2/year on weekly cadence.
//
// Caching note: the system prompt is static, but the cron cadence (weekly)
// far exceeds the longest cache TTL (1h), so prompt caching cannot deliver
// reads for the cron path. We still mark the system prompt with
// cache_control: ephemeral — that way ad-hoc /api/briefing calls inside
// a 5-minute window (e.g. clicking "regenerate" in the UI) do hit cache.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_BRIEFING_MODEL || "claude-opus-4-7";

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for briefing generation");
  client = new Anthropic({ apiKey });
  return client;
}

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `You are a senior marketing analyst at Magnum Estate, a premium Bali real-estate developer. Once a week you write a concise executive briefing for the CEO, CMO, and head of sales.

Your audience hates filler, vague claims, and opinions without numbers. They love specifics: a number, a direction, one action.

TASK
Given a facts JSON for the past week, return STRICTLY ONE JSON object (no markdown wrapping, no commentary outside JSON) with two top-level keys: "ru" and "en". Each key contains an object with five fields: headline, what_grew, what_slipped, actions, watch_next. Both language versions must convey the same facts and recommendations — they are translations of one another, not independent generations.

LANGUAGES
- "ru" → Russian. No transliteration. Anglicisms allowed only for common market terms (SEO, CTR, SERP, brand, non-brand).
- "en" → English. Use natural business English. Keep numbers and product names verbatim from facts.

STYLE
McKinsey memo: short sentences, active voice, past tense for facts, imperative mood for recommendations. No filler.

ANTI-HALLUCINATION (CRITICAL)
Every number in your response must come from the facts JSON. No "approximately", "about", "tens of percent" unless that exact phrasing appears in the data. If a fact is missing, write "no data" / "нет данных" — never invent.

FIELDS (per language)

headline (one sentence, ≤30 words)
What mattered most this week. Contains the dominance index + status or the largest delta.

what_grew (1-2 sentences, ≤50 words)
Positive moves: which metric grew, by how much in % or absolute terms. Past tense.

what_slipped (1-2 sentences, ≤50 words)
Negative moves and losses to competitors: which positions dropped, who outranked us. Past tense.

actions (array of EXACTLY 3 strings; each ≤25 words)
Three concrete actions for next week, ordered by priority. Each starts with a verb ("Publish", "Launch", "Reach out to" / "Опубликовать", "Запустить", "Связаться с"). Each action must address a problem from what_slipped or lock in a win from what_grew.

watch_next (one sentence, ≤30 words)
What to track next week. Future tense. A specific metric or event, not vague wishes.

BANNED
- Markdown (\`**\`, \`#\`, \`*\`, dashed bullets inside fields).
- Meta words: "JSON", "field", "schema", "briefing", "поле", "схема", "брифинг".
- Filler openers ("Last week...", "На прошлой неделе...") in headline — get straight to it.
- Emoji.

EXAMPLE (format only, fictional numbers):
{
  "ru": {
    "headline": "Индекс упал до 52 (At Risk) — non-brand клики просели на 18% при росте брендового трафика на 24%.",
    "what_grew": "Трафик вырос на 55% (826 vs 533 сеансов), вовлечённость — на 18%. Branded клики — 238 (+47%).",
    "what_slipped": "Позиции по 'bali real estate' и 'bali property investment' вне топ-10. Bali Home Immo держит топ-3 по 4 ключам, где мы вне топ-100.",
    "actions": ["Опубликовать страницу /bali-property-investment к пятнице.", "Запустить контент-серию по 'bali real estate' (3 статьи).", "Связаться с PPM Property для backlink-обмена."],
    "watch_next": "Отслеживать non-brand CTR и появление 'Property Investment' в топ-50."
  },
  "en": {
    "headline": "Index dropped to 52 (At Risk) — non-brand clicks fell 18% while branded traffic grew 24%.",
    "what_grew": "Traffic grew 55% (826 vs 533 sessions), engagement +18%. Branded clicks reached 238 (+47%).",
    "what_slipped": "Positions for 'bali real estate' and 'bali property investment' fell out of top-10. Bali Home Immo holds top-3 on 4 keywords where we're outside top-100.",
    "actions": ["Publish /bali-property-investment landing page by Friday.", "Launch a 3-article content series on 'bali real estate'.", "Reach out to PPM Property for backlink exchange."],
    "watch_next": "Track non-brand CTR and the appearance of 'Property Investment' in top-50."
  }
}`;

const PER_LANG_BLOCK = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "what_grew", "what_slipped", "actions", "watch_next"],
  properties: {
    headline:     { type: "string" },
    what_grew:    { type: "string" },
    what_slipped: { type: "string" },
    actions:      { type: "array", items: { type: "string" } },
    watch_next:   { type: "string" },
  },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ru", "en"],
  properties: {
    ru: PER_LANG_BLOCK,
    en: PER_LANG_BLOCK,
  },
};

export async function generateBriefing(facts) {
  const factsJson = JSON.stringify(facts, null, 2);
  const userMessage = `Generate the weekly executive briefing for the following facts. Return both languages (ru, en).\n\nFACTS:\n\`\`\`json\n${factsJson}\n\`\`\``;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: {
        type: "json_schema",
        schema: SCHEMA,
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Empty response from Claude");

  const parsed = JSON.parse(textBlock.text);

  // Validate both languages and the "exactly 3 actions" rule per language.
  for (const lang of ["ru", "en"]) {
    const block = parsed[lang];
    if (!block) throw new Error(`Briefing missing "${lang}" block`);
    if (!Array.isArray(block.actions) || block.actions.length === 0) {
      throw new Error(`Briefing returned no actions for "${lang}"`);
    }
    if (block.actions.length > 5) block.actions = block.actions.slice(0, 3);
  }

  // Backward-compat: flat top-level fields default to Russian so older
  // dashboard builds (or the markdown weekly brief generator) keep working.
  return {
    ...parsed.ru,        // legacy flat fields = ru by default
    ru: parsed.ru,
    en: parsed.en,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Facts builder — shapes raw dashboard data into a clean JSON
// the LLM can reason over. Pure function, no I/O.
// ─────────────────────────────────────────────────────────────

function pctDelta(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function summarizeSerpForFacts(serp) {
  if (!serp?.keywords?.length || !serp.competitors) return null;

  const us = serp.competitors.us.domain;
  const competitorMap = new Map(
    serp.competitors.competitors.map((c) => [c.domain, c.name])
  );

  let ourTop3 = 0;
  let ourTop10 = 0;
  let ourTop20 = 0;
  let theirTop10 = 0;

  const wins = []; // we hold #1-#10 and beat all competitors
  const opportunities = []; // we're outside top-100, competitor in top-10

  for (const row of serp.keywords) {
    const ourPos = row.positions[us];

    if (ourPos != null) {
      if (ourPos <= 3) ourTop3++;
      if (ourPos <= 10) ourTop10++;
      if (ourPos <= 20) ourTop20++;
    }

    let bestCompetitor = null;
    let bestCompetitorPos = null;
    for (const [domain, name] of competitorMap) {
      const p = row.positions[domain];
      if (p != null) {
        if (p <= 10) theirTop10++;
        if (bestCompetitorPos == null || p < bestCompetitorPos) {
          bestCompetitor = name;
          bestCompetitorPos = p;
        }
      }
    }

    if (ourPos != null && ourPos <= 10 &&
        (bestCompetitorPos == null || ourPos < bestCompetitorPos)) {
      wins.push({ keyword: row.keyword, our_position: ourPos, engine: row.engine });
    }

    if (ourPos == null && bestCompetitorPos != null && bestCompetitorPos <= 10) {
      opportunities.push({
        keyword: row.keyword,
        engine: row.engine,
        leader: bestCompetitor,
        leader_position: bestCompetitorPos,
      });
    }
  }

  const share10 = ourTop10 + theirTop10 > 0
    ? Number((ourTop10 / (ourTop10 + theirTop10)).toFixed(3))
    : 0;

  return {
    total_keywords: serp.keywords.length,
    snapshot_date: serp.snapshotDate || null,
    our_top3: ourTop3,
    our_top10: ourTop10,
    our_top20: ourTop20,
    competitors_top10: theirTop10,
    our_share_of_top10: share10,
    keywords_we_dominate: wins.slice(0, 5),
    keywords_competitors_lead_we_miss: opportunities.slice(0, 5),
  };
}

export function buildFacts({
  meta,
  totals,
  previousTotals,
  dominance,
  gsc,
  serp,
  serpDiff,
  seoProgress,
  dominanceHistory,
}) {
  const facts = {
    period: {
      start: meta?.startDate ?? null,
      end: meta?.endDate ?? null,
      previous_start: meta?.previousStartDate ?? null,
      previous_end: meta?.previousEndDate ?? null,
    },
    dominance_index: dominance ? {
      current: dominance.index,
      status: dominance.status,
      components: dominance.breakdown?.components ?? null,
      previous_30d_history: (dominanceHistory || []).slice(-7).map((h) => ({
        date: h.date,
        index: h.index,
      })),
    } : null,
    ga4: (totals && previousTotals) ? {
      sessions: {
        current: totals.sessions,
        previous: previousTotals.sessions,
        delta_pct: pctDelta(totals.sessions, previousTotals.sessions),
      },
      leads: {
        current: totals.leads,
        previous: previousTotals.leads,
        delta_pct: pctDelta(totals.leads, previousTotals.leads),
      },
      total_users: {
        current: totals.totalUsers,
        previous: previousTotals.totalUsers,
        delta_pct: pctDelta(totals.totalUsers, previousTotals.totalUsers),
      },
      engagement_rate: {
        current: totals.engagementRate,
        previous: previousTotals.engagementRate,
      },
    } : null,
    gsc: gsc ? {
      total_clicks: gsc.totals?.clicks ?? null,
      total_impressions: gsc.totals?.impressions ?? null,
      avg_ctr: gsc.totals?.ctr ?? null,
      avg_position: gsc.totals?.position ?? null,
      previous_total_clicks: gsc.previousTotals?.clicks ?? null,
      brand: {
        clicks: gsc.brandSplit?.brand?.clicks ?? null,
        impressions: gsc.brandSplit?.brand?.impressions ?? null,
      },
      non_brand: {
        clicks: gsc.brandSplit?.nonBrand?.clicks ?? null,
        impressions: gsc.brandSplit?.nonBrand?.impressions ?? null,
      },
      top_non_brand_queries: (gsc.topNonBrand || []).slice(0, 5).map((q) => ({
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
        position: Number((q.position || 0).toFixed(1)),
      })),
    } : null,
    serp: summarizeSerpForFacts(serp),
    serp_diff: serpDiff ? {
      risers: (serpDiff.risers || []).slice(0, 5).map((r) => ({
        keyword: r.keyword,
        engine: r.engine,
        from: r.previousPosition,
        to: r.currentPosition,
        delta: r.delta,
      })),
      fallers: (serpDiff.fallers || []).slice(0, 5).map((r) => ({
        keyword: r.keyword,
        engine: r.engine,
        from: r.previousPosition,
        to: r.currentPosition,
        delta: r.delta,
      })),
      new_entrants_count: serpDiff.newEntrants?.length || 0,
      lost_count: serpDiff.lost?.length || 0,
    } : null,
    seo_progress: seoProgress ? {
      total: seoProgress.total,
      done: seoProgress.done,
      not_done: seoProgress.notDone,
      pct_done: seoProgress.pct,
      top_clusters: (seoProgress.clusters || []).slice(0, 5).map((c) => ({
        name: c.cluster,
        done: c.done,
        total: c.total,
        pct: c.pct,
      })),
    } : null,
  };

  return facts;
}
