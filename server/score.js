import { safeRatio } from "./utils.js";
import { summarizeSerp } from "./sources/serp.js";

const WEIGHTS = {
  nonBrandGrowth: 0.30,
  serpCoverage: 0.25,
  leadGrowth: 0.20,
  trafficGrowth: 0.15,
  seoExecution: 0.10,
};

function clip(value, min = 0, max = 2) {
  return Math.max(min, Math.min(max, value));
}

export function dominanceIndex({ ga4, gsc, serp, seoProgress }) {
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

  let weighted = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    weighted += components[key] * weight;
  }

  const index = Math.round(weighted * 100);
  let status = "Stable";
  if (index >= 130) status = "Dominating";
  else if (index >= 110) status = "Gaining";
  else if (index <= 70) status = "At Risk";
  else if (index <= 90) status = "Slipping";

  return {
    index,
    status,
    breakdown: {
      components,
      weights: WEIGHTS,
      explanations,
    },
  };
}
