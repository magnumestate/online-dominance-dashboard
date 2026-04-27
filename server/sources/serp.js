import { readFile } from "node:fs/promises";
import path from "node:path";

const BRIGHT_DATA_URL = "https://api.brightdata.com/request";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT = 8;

export function isConfigured() {
  return Boolean(process.env.BRIGHT_DATA_API_KEY && process.env.BRIGHT_DATA_SERP_ZONE);
}

async function loadJson(relativePath) {
  const full = path.join(process.cwd(), relativePath);
  const raw = await readFile(full, "utf8");
  return JSON.parse(raw);
}

export async function loadKeywords() {
  const data = await loadJson("data/keywords.json");
  return Object.entries(data).flatMap(([group, items]) =>
    items.map((item) => ({ engine: "google", ...item, group }))
  );
}

export async function loadCompetitors() {
  return loadJson("data/competitors.json");
}

function normalizeDomain(host) {
  if (!host) return "";
  return host.replace(/^www\./, "").toLowerCase();
}

function matchesDomain(itemDomain, target) {
  if (!itemDomain) return false;
  const a = normalizeDomain(itemDomain);
  const b = normalizeDomain(target);
  return a === b || a.endsWith(`.${b}`);
}

function extractHost(link) {
  try {
    return new URL(link).hostname;
  } catch {
    return "";
  }
}

function buildSearchUrl(engine, kw) {
  const q = encodeURIComponent(kw.q);
  const lang = kw.lang || "en";
  const country = (kw.country || "us").toLowerCase();
  if (engine === "yandex") {
    // Bright Data localizes via country param; text= is the query
    return `https://yandex.com/search/?text=${q}`;
  }
  // Bright Data strips `num`; default zone returns top-10
  return `https://www.google.com/search?q=${q}&hl=${lang}&gl=${country}`;
}

async function fetchOneSerp(kw) {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  const zone = process.env.BRIGHT_DATA_SERP_ZONE;
  const engine = (kw.engine || "google").toLowerCase();
  const url = buildSearchUrl(engine, kw);
  const country = (kw.country || "us").toLowerCase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(BRIGHT_DATA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zone, url, format: "json", country }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bright Data ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseOrganic(payload) {
  // Bright Data wraps the SERP response: { status_code, headers, body }
  // body can be a JSON string (Full JSON format) — parse if needed.
  let root = payload?.body ?? payload?.data ?? payload;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }
  const organic = root?.organic || root?.results?.organic || [];
  return organic.map((item, i) => ({
    rank: item.rank ?? item.position ?? item.global_rank ?? i + 1,
    link: item.link || item.url || "",
    // display_link is unreliable (sometimes "› bali" or "325K+ followers"),
    // so derive domain from the actual link URL.
    domain: extractHost(item.link || item.url || ""),
  }));
}

async function pLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

export async function fetchSerpSnapshot() {
  const [keywords, competitors] = await Promise.all([loadKeywords(), loadCompetitors()]);
  const allDomains = [competitors.us, ...competitors.competitors].map((c) => c.domain);
  const enginesUsed = new Set();
  const errors = {};

  const rows = await pLimit(keywords, MAX_CONCURRENT, async (kw) => {
    enginesUsed.add(kw.engine || "google");
    const positions = Object.fromEntries(allDomains.map((d) => [d, null]));
    try {
      const payload = await fetchOneSerp(kw);
      const organic = parseOrganic(payload);
      for (const dom of allDomains) {
        const hit = organic.find((it) => matchesDomain(it.domain, dom));
        positions[dom] = hit ? hit.rank : null;
      }
    } catch (err) {
      errors[kw.q] = err.message;
      console.error(`[serp] ${kw.engine} "${kw.q}":`, err.message);
    }
    return {
      keyword: kw.q,
      engine: kw.engine || "google",
      group: kw.group,
      tag: kw.tag,
      lang: kw.lang,
      country: kw.country,
      positions,
    };
  });

  const groupOrder = [
    "high_priority",
    "location",
    "project",
    "advisor",
    "russian_yandex",
    "multilingual",
    "brand_baseline",
  ];
  rows.sort((a, b) => {
    const ai = groupOrder.indexOf(a.group);
    const bi = groupOrder.indexOf(b.group);
    if (ai !== bi) return ai - bi;
    return a.keyword.localeCompare(b.keyword);
  });

  return {
    keywords: rows,
    competitors,
    enginesUsed: Array.from(enginesUsed),
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

export function summarizeSerp(snapshot) {
  if (!snapshot || !snapshot.competitors) {
    return { ourTop3: 0, ourTop10: 0, ourTop20: 0, theirTop10: 0, total: 0, share10: 0, byEngine: {} };
  }
  const us = snapshot.competitors.us.domain;
  const others = snapshot.competitors.competitors.map((c) => c.domain);

  let ourTop3 = 0;
  let ourTop10 = 0;
  let ourTop20 = 0;
  let theirTop10 = 0;
  const byEngine = {};
  const total = snapshot.keywords.length;

  for (const row of snapshot.keywords) {
    const engine = row.engine || "google";
    if (!byEngine[engine]) byEngine[engine] = { ourTop10: 0, theirTop10: 0, total: 0 };
    byEngine[engine].total++;

    const ourPos = row.positions[us];
    if (ourPos != null) {
      if (ourPos <= 3) ourTop3++;
      if (ourPos <= 10) {
        ourTop10++;
        byEngine[engine].ourTop10++;
      }
      if (ourPos <= 20) ourTop20++;
    }
    for (const d of others) {
      const p = row.positions[d];
      if (p != null && p <= 10) {
        theirTop10++;
        byEngine[engine].theirTop10++;
      }
    }
  }

  const share10 = ourTop10 + theirTop10 > 0 ? ourTop10 / (ourTop10 + theirTop10) : 0;
  return { ourTop3, ourTop10, ourTop20, theirTop10, total, share10, byEngine };
}
