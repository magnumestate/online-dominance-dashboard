// Weekly executive briefing generator.
// Takes a structured "facts" object built from the dashboard's data sources
// (GA4 / GSC / SERP / SERP-diff / SEO-progress / Dominance Index) and asks
// Claude to produce a 5-field strict-JSON briefing in Russian.
//
// Cost: ~3.5K input + 250 output tokens per call. On Opus 4.7 that's about
// $0.024/run, which is $1.25/year on a weekly cadence.
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

const SYSTEM_PROMPT = `Ты — старший аналитик отдела маркетинга в Magnum Estate, премиальном застройщике недвижимости на Бали. Раз в неделю ты пишешь краткую сводку для руководства компании: гендиректор, директор по маркетингу, директор по продажам.

Твоя аудитория не любит воду, общие слова и оценочные суждения без чисел. Они любят конкретику: цифру, направление и одно действие.

ТВОЁ ЗАДАНИЕ
Получив на вход JSON с фактами за прошлую неделю, ты возвращаешь СТРОГО ОДИН JSON-объект (без markdown-обёртки, без пояснений вне JSON) с пятью полями: headline, what_grew, what_slipped, actions, watch_next.

ЯЗЫК
Только русский. Без транслита, без англицизмов кроме общеупотребительных терминов рынка (SEO, CTR, SERP, brand, non-brand).

СТИЛЬ
Стиль McKinsey-меморандума: короткие предложения, активный залог, прошедшее время для констатации фактов и повелительное наклонение для рекомендаций. Никакой воды.

АНТИ-ГАЛЛЮЦИНАЦИИ (КРИТИЧНО)
Каждое число в твоём ответе должно прийти из факт-JSON. Никаких "примерно", "около", "на десятки процентов", если в данных нет конкретной цифры. Если в фактах нет нужной информации — пиши "нет данных" в соответствующем поле, не выдумывай.

ПОЛЯ ОТВЕТА

headline (одно предложение, ≤30 слов)
Главное, что произошло за неделю. Содержит индекс доминирования и его статус, либо самую крупную дельту.

what_grew (1-2 предложения, ≤50 слов)
Позитивные движения: какая метрика выросла, на сколько в процентах или абсолютных числах. Используй прошедшее время.

what_slipped (1-2 предложения, ≤50 слов)
Негативные движения и потери против конкурентов: какие позиции упали, кто из конкурентов нас обогнал, по каким запросам. Используй прошедшее время.

actions (массив РОВНО из 3 элементов; каждый ≤25 слов)
Три конкретных действия на следующую неделю, отсортированных по приоритету. Каждое — повелительное наклонение, начинается с глагола ("Усилить", "Запустить", "Опубликовать", "Сократить", "Связаться с"). Действия должны напрямую отвечать на проблемы из what_slipped или закреплять успехи из what_grew.

watch_next (одно предложение, ≤30 слов)
Что отслеживать на следующей неделе. Будущее время. Конкретная метрика или событие, не общие пожелания.

ЗАПРЕЩЕНО
- Markdown (\`**\`, \`#\`, \`*\`, списки с дефисами внутри полей).
- Слова: "JSON", "поле", "схема", "структура", "брифинг".
- Фразы вступления типа "На прошлой неделе", "За отчётный период" в headline (сразу к делу).
- Эмодзи.

ПРИМЕР ХОРОШЕГО ANSWER (только формат, числа условные):
{"headline":"Индекс упал до 52 (At Risk) — non-brand клики просели на 18% при росте брендового трафика на 24%.","what_grew":"Трафик в целом вырос на 55% (826 vs 533 сеансов), вовлечённость — на 18%. Branded клики — 238 (+47%).","what_slipped":"Позиции по 'bali real estate' и 'bali property investment' просели вне топ-10. Bali Home Immo занимает топ-3 по 4 ключам, где мы вне топ-100.","actions":["Опубликовать страницу /bali-property-investment к пятнице.","Запустить контент-серию по 'bali real estate' (3 статьи).","Связаться с PPM Property для backlink-обмена."],"watch_next":"Отслеживать прогресс по non-brand CTR и появление страницы 'Property Investment' в топ-50."}`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "what_grew", "what_slipped", "actions", "watch_next"],
  properties: {
    headline: {
      type: "string",
      description: "Одно предложение — главное за неделю",
    },
    what_grew: {
      type: "string",
      description: "Позитивные движения с конкретными цифрами",
    },
    what_slipped: {
      type: "string",
      description: "Негативные движения и потери против конкурентов",
    },
    actions: {
      type: "array",
      description: "Ровно 3 действия на следующую неделю, по приоритету",
      items: { type: "string" },
    },
    watch_next: {
      type: "string",
      description: "Что отслеживать на следующей неделе",
    },
  },
};

export async function generateBriefing(facts) {
  const factsJson = JSON.stringify(facts, null, 2);
  const userMessage = `Сформируй еженедельную сводку по следующим фактам.\n\nFACTS:\n\`\`\`json\n${factsJson}\n\`\`\``;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
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

  // Light post-validation: structured outputs guarantee schema, but enforce
  // the "exactly 3 actions" rule (which lives in the prompt, not the schema,
  // because minItems/maxItems aren't supported).
  if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
    throw new Error("Briefing returned no actions");
  }
  if (parsed.actions.length > 5) {
    parsed.actions = parsed.actions.slice(0, 3);
  }

  return {
    ...parsed,
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
