import { safeRatio } from "./utils.js";
import { summarizeSerp } from "./sources/serp.js";
import { salesExecutionComponent } from "./sources/bitrix.js";

// v3 weights — added sales_execution as 6th component (CRM pipeline value
// growth from Bitrix24). Other components shrunk uniformly to fit. Total = 100.
const WEIGHTS = {
  nonBrandGrowth: 0.28,
  serpCoverage: 0.22,
  leadGrowth: 0.18,
  trafficGrowth: 0.14,
  seoExecution: 0.08,
  salesExecution: 0.10,
};

const AI_WEIGHTS = {
  sov: 0.40,
  growth: 0.30,
  positive: 0.20,
  citation: 0.10,
};

const TOTAL_DOMINANCE_WEIGHTS = {
  web: Number(process.env.TD_WEIGHT_WEB || 0.7),
  ai: Number(process.env.TD_WEIGHT_AI || 0.3),
};

function clip(value, min = 0, max = 2) {
  return Math.max(min, Math.min(max, value));
}

function statusFor(index) {
  if (index >= 130) return "Dominating";
  if (index >= 110) return "Gaining";
  if (index <= 70) return "At Risk";
  if (index <= 90) return "Slipping";
  return "Stable";
}

export function dominanceIndex({ ga4, gsc, serp, seoProgress, bitrix }) {
  const components = {};
  const explanations = {};

  if (gsc?.brandSplit) {
    const cur = gsc.brandSplit.nonBrand.clicks;
    const prevTotal = gsc.previousTotals?.clicks || 0;
    const prevBrand = (prevTotal && gsc.brandSplit.brand.clicks)
      ? prevTotal * (gsc.brandSplit.brand.clicks / Math.max(1, gsc.totals.clicks))
      : 0;
    const prevNonBrand = Math.max(0, prevTotal - prevBrand);
    components.nonBrandGrowth = clip(safeRatio(cur, prevNonBrand));
    explanations.nonBrandGrowth = `non-brand clicks ${cur} vs ${Math.round(prevNonBrand)}`;
  } else {
    components.nonBrandGrowth = 1;
    explanations.nonBrandGrowth = "GSC not configured — neutral";
  }

  if (serp?.keywords?.length) {
    const summary = summarizeSerp(serp);
    components.serpCoverage = clip(summary.share10 * 2);
    explanations.serpCoverage = `top-10 share ${(summary.share10 * 100).toFixed(1)}% (us:${summary.ourTop10}, them:${summary.theirTop10})`;
  } else {
    components.serpCoverage = 1;
    explanations.serpCoverage = "SERP not configured — neutral";
  }

  if (ga4?.totals && ga4?.previousTotals) {
    components.leadGrowth = clip(safeRatio(ga4.totals.leads, ga4.previousTotals.leads));
    components.trafficGrowth = clip(safeRatio(ga4.totals.sessions, ga4.previousTotals.sessions));
    explanations.leadGrowth = `${ga4.totals.leads} vs ${ga4.previousTotals.leads}`;
    explanations.trafficGrowth = `${ga4.totals.sessions} vs ${ga4.previousTotals.sessions}`;
  } else {
    components.leadGrowth = 1;
    components.trafficGrowth = 1;
    explanations.leadGrowth = "GA4 not configured — neutral";
    explanations.trafficGrowth = "GA4 not configured — neutral";
  }

  if (seoProgress && seoProgress.total > 0) {
    components.seoExecution = clip(seoProgress.pct * 2);
    explanations.seoExecution = `${seoProgress.done}/${seoProgress.total} (${(seoProgress.pct * 100).toFixed(0)}%)`;
  } else {
    components.seoExecution = 1;
    explanations.seoExecution = "SEO progress not configured — neutral";
  }

  if (bitrix?.deals?.current) {
    components.salesExecution = salesExecutionComponent(bitrix);
    const cur = bitrix.deals.current;
    const prev = bitrix.deals.previous;
    const curTotal = (cur.won_value || 0) + (cur.pipeline_value || 0);
    const prevTotal = prev ? (prev.won_value || 0) + (prev.pipeline_value || 0) : 0;
    explanations.salesExecution = `pipeline ${curTotal.toLocaleString()} vs ${prevTotal.toLocaleString()}`;
  } else {
    components.salesExecution = 1;
    explanations.salesExecution = "Bitrix CRM not configured — neutral";
  }

  let weighted = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    weighted += components[key] * weight;
  }

  const index = Math.round(weighted * 100);
  return {
    index,
    status: statusFor(index),
    breakdown: {
      components,
      weights: WEIGHTS,
      explanations,
    },
  };
}

export function aiVisibilityScore({ responses, history }) {
  const components = {};
  const explanations = {};

  if (!responses || responses.length === 0) {
    return {
      index: null,
      status: "No data",
      breakdown: {
        components: {},
        weights: AI_WEIGHTS,
        explanations: { all: "No AI probe responses recorded yet" },
      },
      stats: { totalResponses: 0 },
    };
  }

  const total = responses.length;
  const brandMentioned = responses.filter((r) => r.brand_mentioned).length;
  const brandCited = responses.filter((r) => r.brand_cited).length;

  let totalMentions = 0;
  let usMentions = 0;
  for (const r of responses) {
    if (r.brand_mentioned) {
      usMentions++;
      totalMentions++;
    }
    const compsRaw = typeof r.competitors_mentioned === "string"
      ? safeJsonArray(r.competitors_mentioned)
      : (r.competitors_mentioned || []);
    totalMentions += compsRaw.length;
  }
  const sov = totalMentions ? usMentions / totalMentions : 0;
  components.sov = clip(sov * 2);
  explanations.sov = `SOV ${(sov * 100).toFixed(1)}% (${usMentions} brand vs ${totalMentions - usMentions} competitor mentions across ${total} responses)`;

  if (Array.isArray(history) && history.length >= 2) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const ratio = prev?.sov_pct ? last.sov_pct / prev.sov_pct : 1;
    components.growth = clip(ratio);
    explanations.growth = `SOV w/w ${(last.sov_pct * 100).toFixed(1)}% vs ${(prev.sov_pct * 100).toFixed(1)}%`;
  } else {
    components.growth = 1;
    explanations.growth = "Insufficient history for growth (need ≥2 weeks)";
  }

  const classified = responses.filter((r) => r.sentiment != null);
  if (classified.length > 0) {
    const usPositive = responses.filter((r) => r.brand_mentioned && r.sentiment === "positive").length;
    const positiveRatio = brandMentioned ? usPositive / brandMentioned : 0;
    components.positive = clip(positiveRatio * 2);
    explanations.positive = `${usPositive}/${brandMentioned} brand mentions are positive (${(positiveRatio * 100).toFixed(0)}%)`;
  } else {
    components.positive = 1;
    explanations.positive = "Sentiment classification not run (ANTHROPIC_API_KEY missing or batch failed)";
  }

  const citationRatio = brandMentioned ? brandCited / brandMentioned : 0;
  components.citation = clip(citationRatio * 2);
  explanations.citation = `${brandCited}/${brandMentioned} brand mentions include domain citation`;

  let weighted = 0;
  for (const [key, w] of Object.entries(AI_WEIGHTS)) {
    weighted += components[key] * w;
  }
  const index = Math.round(weighted * 100);

  return {
    index,
    status: statusFor(index),
    breakdown: { components, weights: AI_WEIGHTS, explanations },
    stats: {
      totalResponses: total,
      brandMentioned,
      brandCited,
      sov_pct: sov,
      classifiedCount: classified.length,
    },
  };
}

export function totalDominance({ webIndex, aiIndex, weights = TOTAL_DOMINANCE_WEIGHTS }) {
  if (webIndex == null && aiIndex == null) {
    return { index: null, status: "No data", weights, breakdown: {} };
  }
  if (webIndex == null) return { index: aiIndex, status: statusFor(aiIndex), weights, breakdown: { aiOnly: true } };
  if (aiIndex == null) return { index: webIndex, status: statusFor(webIndex), weights, breakdown: { webOnly: true } };
  const blended = Math.round(weights.web * webIndex + weights.ai * aiIndex);
  return {
    index: blended,
    status: statusFor(blended),
    weights,
    breakdown: { webIndex, aiIndex },
  };
}

function safeJsonArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
