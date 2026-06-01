import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  weekStart,
  readAiResponsesForWeek,
  aiVisibilityHistory,
  readLatestSnapshot,
  dominanceHistory,
} from "./cache.js";
import { dominanceIndex, aiVisibilityScore, totalDominance } from "./score.js";
import { summarizeAiOverviews } from "./sources/ai-overviews.js";
import * as aiProbe from "./sources/ai-probe.js";

function fmtDelta(curr, prev) {
  if (curr == null || prev == null) return "";
  const d = curr - prev;
  const sign = d > 0 ? "↑+" : d < 0 ? "↓" : "·";
  return `${sign}${Math.abs(d)}`;
}

function fmtPct(value) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function applyTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : "—"));
}

function buildSovNarrative(curr, prev) {
  if (!curr) return "Нет данных AI probe за эту неделю.";
  const cur = curr.sov_pct || 0;
  const pre = prev?.sov_pct;
  const dir = pre == null ? "первая неделя" : cur > pre ? `вырос с ${fmtPct(pre)} до ${fmtPct(cur)}` : cur < pre ? `снизился с ${fmtPct(pre)} до ${fmtPct(cur)}` : `не изменился (${fmtPct(cur)})`;
  return `SOV ${dir}. Brand упомянут в ${curr.mentions_total || 0} ответах из ${curr.stats?.totalResponses || 0}, цитирование (с ссылкой) — ${curr.mentions_cited || 0}.`;
}

function buildMentionsNarrative(curr, prev) {
  if (!curr) return "—";
  const cur = curr.mentions_total || 0;
  const pre = prev?.mentions_total ?? null;
  if (pre == null) return `${cur} brand mentions за неделю (первая неделя данных).`;
  const diff = cur - pre;
  const verb = diff > 0 ? "выросли" : diff < 0 ? "упали" : "остались на уровне";
  return `Brand mentions ${verb} с ${pre} до ${cur} (${diff >= 0 ? "+" : ""}${diff}).`;
}

function buildSentimentNarrative(currStats) {
  if (!currStats?.classifiedCount) {
    return "Sentiment не классифицировался (требует ANTHROPIC_API_KEY и наличие brand mentions).";
  }
  const positive = currStats.classifiedCount > 0 ? Math.round((currStats.brandMentioned ? currStats.brandMentioned / currStats.classifiedCount : 0) * 100) : 0;
  return `Классифицировано ${currStats.classifiedCount} brand-упоминаний (Haiku 4.5).`;
}

function buildAioNarrative(aio) {
  if (!aio || aio.totalKeywords === 0) return "SERP snapshot не содержит данных AI Overviews за эту неделю.";
  return [
    `AI Overview присутствует на ${aio.presentCount}/${aio.totalKeywords} ключах (${Math.round(aio.presenceRate * 100)}%).`,
    `Magnum цитируется в ${aio.brandCitedCount} (${Math.round(aio.brandCitedRate * 100)}% от показов AIO).`,
    aio.threats.length ? `Угроз: ${aio.threats.length} (конкуренты цитируются, мы — нет).` : "",
    aio.blueOcean.length ? `Blue ocean: ${aio.blueOcean.length} ключей где никто не цитирован.` : "",
  ].filter(Boolean).join(" ");
}

function buildAioSummary(aio) {
  if (!aio || aio.totalKeywords === 0) return "нет данных";
  return `${aio.presentCount}/${aio.totalKeywords} keywords с AI Overview, ${aio.brandCitedCount} цитируют Magnum`;
}

function buildTopActions(currWeekResponses, aio) {
  const actions = [];

  if (aio?.threats?.length) {
    for (const threat of aio.threats.slice(0, 3)) {
      actions.push(
        `**"${threat.keyword}"** (${threat.engine}/${threat.lang}, AI Overview) — конкуренты цитируются (${threat.competitors.length}), Magnum нет. ` +
        `→ Подготовить landing page / статью под этот intent, оптимизировать под цитирование AI Overview.`
      );
    }
  }

  if (actions.length < 3 && currWeekResponses?.length) {
    const competitorOnly = currWeekResponses
      .filter((r) => !r.brand_mentioned && r.competitors_mentioned && r.competitors_mentioned !== "[]")
      .slice(0, 3 - actions.length);
    for (const r of competitorOnly) {
      let comps = [];
      try { comps = JSON.parse(r.competitors_mentioned); } catch {}
      actions.push(
        `**"${r.prompt_text}"** (${r.engine}/${r.lang}) — упомянуты ${comps.length} конкурентов (${comps.join(", ")}), Magnum нет. ` +
        `→ Контент-задача: вытащить нас в этот ответ через ускорение отзывов / case studies / SEO-оптимизации.`
      );
    }
  }

  if (actions.length === 0) {
    return "Достаточно данных для топ-3 действий пока нет — запустите больше snapshot-циклов.";
  }
  return actions.map((a, i) => `${i + 1}. ${a}`).join("\n\n");
}

function buildEngineTable(currWeekResponses) {
  if (!currWeekResponses?.length) return "_Нет данных за эту неделю._";
  const byEngine = {};
  for (const r of currWeekResponses) {
    const e = r.engine;
    if (!byEngine[e]) byEngine[e] = { total: 0, mentioned: 0, cited: 0 };
    byEngine[e].total++;
    if (r.brand_mentioned) byEngine[e].mentioned++;
    if (r.brand_cited) byEngine[e].cited++;
  }
  const rows = Object.entries(byEngine).map(([engine, s]) => {
    const sov = s.total ? Math.round((s.mentioned / s.total) * 100) : 0;
    return `| ${engine} | ${s.total} | ${s.mentioned} | ${s.cited} | ${sov}% |`;
  });
  return ["| Engine | Responses | Brand mentions | Cited | SOV |", "|---|---:|---:|---:|---:|", ...rows].join("\n");
}

export async function generateWeeklyBrief({ persist = true, dashboardUrl = process.env.DASHBOARD_URL || "" } = {}) {
  const tplPath = path.join(process.cwd(), "templates/brief.md.tpl");
  const tpl = await readFile(tplPath, "utf8");

  const week = weekStart();
  const weekEnd = addDays(week, 6);

  const currWeekResponses = readAiResponsesForWeek(week);
  const aiHistory = aiVisibilityHistory(12);
  const ai = aiVisibilityScore({ responses: currWeekResponses, history: aiHistory });

  const serpCached = readLatestSnapshot("serp");
  const aio = serpCached?.payload ? summarizeAiOverviews(serpCached.payload) : null;

  const ga4Cached = readLatestSnapshot("ga4-totals");
  const gscCached = readLatestSnapshot("gsc-totals");
  const bitrixCached = readLatestSnapshot("bitrix");
  const web = dominanceIndex({
    ga4: ga4Cached ? { totals: ga4Cached.payload.totals, previousTotals: ga4Cached.payload.previousTotals } : null,
    gsc: gscCached?.payload || null,
    bitrix: bitrixCached?.payload || null,
  });
  const total = totalDominance({ webIndex: web.index, aiIndex: ai.index });

  const webHistory = (() => { try { return dominanceHistory(30); } catch { return []; } })();
  const prevWeekAggregate = aiHistory.length >= 2 ? aiHistory[aiHistory.length - 2] : null;

  const vars = {
    week_start: week,
    week_end: weekEnd,
    generated_at: new Date().toISOString(),
    dashboard_url: dashboardUrl || "—",

    total_index: total.index ?? "—",
    total_status: total.status,
    total_delta: "",

    web_index: web.index,
    web_status: web.status,
    web_delta: webHistory.length >= 2 ? fmtDelta(web.index, webHistory[webHistory.length - 2]?.index) : "",

    ai_index: ai.index ?? "—",
    ai_status: ai.status,
    ai_delta: prevWeekAggregate?.ai_visibility_score != null && ai.index != null
      ? fmtDelta(ai.index, prevWeekAggregate.ai_visibility_score)
      : "",

    probe_responses: currWeekResponses.length,
    probe_prompts: aiProbe.isConfigured() ? (await aiProbe.loadPrompts()).length : "—",
    probe_engines: aiProbe.enabledEngines().join(", ") || "none",

    aio_summary: buildAioSummary(aio),
    sov_narrative: buildSovNarrative(
      ai.stats?.totalResponses ? { sov_pct: ai.stats.sov_pct, mentions_total: ai.stats.brandMentioned, mentions_cited: ai.stats.brandCited, stats: ai.stats } : null,
      prevWeekAggregate
    ),
    mentions_narrative: buildMentionsNarrative(
      ai.stats ? { mentions_total: ai.stats.brandMentioned } : null,
      prevWeekAggregate
    ),
    sentiment_narrative: buildSentimentNarrative(ai.stats),
    aio_narrative: buildAioNarrative(aio),
    top_actions: buildTopActions(currWeekResponses, aio),
    engine_table: buildEngineTable(currWeekResponses),

    td_web_weight: Math.round((total.weights?.web || 0.7) * 100),
    td_ai_weight: Math.round((total.weights?.ai || 0.3) * 100),
  };

  const md = applyTemplate(tpl, vars);

  if (persist) {
    const briefsDir = path.join(process.cwd(), "briefs");
    await mkdir(briefsDir, { recursive: true });
    const file = path.join(briefsDir, `${week}.md`);
    await writeFile(file, md, "utf8");
    return { week, file, markdown: md };
  }
  return { week, markdown: md };
}
