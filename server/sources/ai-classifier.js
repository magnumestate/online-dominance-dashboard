import { readFile } from "node:fs/promises";
import path from "node:path";

const CLASSIFIER_MODEL = process.env.AI_CLASSIFIER_MODEL || "claude-haiku-4-5-20251001";
const REQUEST_TIMEOUT_MS = 60_000;
const BATCH_SIZE = 8;

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function loadCompetitors() {
  const raw = await readFile(path.join(process.cwd(), "data/competitors.json"), "utf8");
  return JSON.parse(raw);
}

function brandVariants(name, domain) {
  const stem = (domain || "").replace(/^www\./, "").split(".")[0];
  const variants = new Set([name, stem]);
  variants.add(name.toLowerCase());
  variants.add(name.replace(/\s+/g, ""));
  variants.add(name.replace(/\s+/g, "-"));
  return Array.from(variants).filter((v) => v && v.length >= 3);
}

function detectMention(text, brand) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return brandVariants(brand.name, brand.domain).some((v) => lower.includes(v.toLowerCase()));
}

function detectCitation(text, citations, brand) {
  const target = (brand.domain || "").replace(/^www\./, "").toLowerCase();
  if (!target) return false;
  if ((text || "").toLowerCase().includes(target)) return true;
  return (citations || []).some((c) => {
    if (typeof c !== "string") c = c?.url || "";
    return (c || "").toLowerCase().includes(target);
  });
}

export async function classifyResponses({ rows }) {
  const competitors = await loadCompetitors();
  const us = competitors.us;
  const others = competitors.competitors;

  const enriched = rows.map((row) => {
    const brand_mentioned = detectMention(row.response_text, us) ? 1 : 0;
    const brand_cited = detectCitation(row.response_text, row.response_citations, us) ? 1 : 0;
    const competitors_mentioned = others
      .filter((c) => detectMention(row.response_text, c))
      .map((c) => c.domain);
    return {
      ...row,
      brand_mentioned,
      brand_cited,
      competitors_mentioned,
      sentiment: null,
      intent: null,
    };
  });

  if (!isConfigured()) {
    return enriched.map(stripForStorage);
  }

  const toClassify = enriched.filter((r) => r.brand_mentioned === 1);
  const batches = chunk(toClassify, BATCH_SIZE);
  const decisions = new Map();

  for (const batch of batches) {
    try {
      const result = await classifyBatch(batch, us);
      for (const item of result) {
        decisions.set(item.prompt_id + ":" + item.engine, item);
      }
    } catch (err) {
      console.error("[ai-classifier] batch failed:", err.message);
    }
  }

  return enriched
    .map((row) => {
      const key = row.prompt_id + ":" + row.engine;
      const decision = decisions.get(key);
      if (decision) {
        row.sentiment = decision.sentiment;
        row.intent = decision.intent;
      }
      return row;
    })
    .map(stripForStorage);
}

function stripForStorage(row) {
  return {
    ts: row.ts,
    week_start: row.week_start,
    prompt_id: row.prompt_id,
    prompt_text: row.prompt_text,
    engine: row.engine,
    lang: row.lang,
    brand_mentioned: row.brand_mentioned,
    brand_cited: row.brand_cited,
    competitors_mentioned: JSON.stringify(row.competitors_mentioned || []),
    sentiment: row.sentiment,
    intent: row.intent,
    response_hash: row.response_hash,
    raw_excerpt: row.raw_excerpt,
  };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function classifyBatch(batch, brand) {
  const items = batch.map((r, i) => ({
    idx: i,
    prompt_id: r.prompt_id,
    engine: r.engine,
    excerpt: (r.response_text || "").slice(0, 1500),
  }));

  const system = `You classify how a brand is portrayed in AI-generated text. The brand of interest is "${brand.name}" (domain ${brand.domain}). For each item, return STRICT JSON only — no prose.`;
  const user = `For each item below, decide:
- sentiment: "positive" | "neutral" | "critical" — how the brand is portrayed in this response (positive = recommended/endorsed; neutral = listed without judgment; critical = warned against, criticized, or compared unfavorably).
- intent: "transactional" | "informational" | "comparison" — the apparent intent of the underlying user question.

Return ONLY a JSON array of objects {"idx", "sentiment", "intent"}.

Items:
${JSON.stringify(items, null, 2)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = extractJsonArray(text);
    return json.map((d) => ({
      prompt_id: items[d.idx]?.prompt_id,
      engine: items[d.idx]?.engine,
      sentiment: normalizeEnum(d.sentiment, ["positive", "neutral", "critical"]),
      intent: normalizeEnum(d.intent, ["transactional", "informational", "comparison"]),
    })).filter((d) => d.prompt_id);
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

function normalizeEnum(value, allowed) {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim();
  return allowed.includes(v) ? v : null;
}
