import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { weekStart, findCachedResponse } from "../cache.js";

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_CONCURRENT = 4;
const MAX_TOKENS = 700;

const ENGINE_CONFIG = {
  claude: {
    envKey: "ANTHROPIC_API_KEY",
    model: process.env.AI_PROBE_CLAUDE_MODEL || "claude-sonnet-4-6",
    call: callClaude,
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    model: process.env.AI_PROBE_OPENAI_MODEL || "gpt-4o",
    call: callOpenAI,
  },
  perplexity: {
    envKey: "PERPLEXITY_API_KEY",
    model: process.env.AI_PROBE_PERPLEXITY_MODEL || "sonar-pro",
    call: callPerplexity,
  },
  yandex_gpt: {
    envKey: "YANDEX_GPT_API_KEY",
    model: process.env.AI_PROBE_YANDEX_MODEL || "yandexgpt",
    call: callYandexGPT,
  },
};

export function enabledEngines() {
  return Object.entries(ENGINE_CONFIG)
    .filter(([, cfg]) => Boolean(process.env[cfg.envKey]))
    .map(([name]) => name);
}

export function isConfigured() {
  return enabledEngines().length > 0;
}

export async function loadPrompts() {
  const file = path.join(process.cwd(), "data/prompts.json");
  const raw = await readFile(file, "utf8");
  const data = JSON.parse(raw);
  return data.prompts.filter((p) => p.id && p.text);
}

function langInstruction(lang) {
  if (lang === "ru") return "Отвечайте на русском языке.";
  if (lang === "fr") return "Répondez en français.";
  return null;
}

function hashResponse(text) {
  return crypto.createHash("sha256").update(text || "").digest("hex").slice(0, 32);
}

async function withTimeout(fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude({ promptText, lang, model }) {
  const systemBits = ["You are a helpful AI assistant."];
  const langExtra = langInstruction(lang);
  if (langExtra) systemBits.push(langExtra);

  return withTimeout(async (signal) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system: systemBits.join(" "),
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return { text, citations: [] };
  });
}

async function callOpenAI({ promptText, lang, model }) {
  const systemBits = ["You are a helpful AI assistant."];
  const langExtra = langInstruction(lang);
  if (langExtra) systemBits.push(langExtra);

  return withTimeout(async (signal) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: systemBits.join(" ") },
          { role: "user", content: promptText },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return { text, citations: [] };
  });
}

async function callPerplexity({ promptText, lang, model }) {
  const systemBits = ["You are a helpful AI assistant. Cite sources."];
  const langExtra = langInstruction(lang);
  if (langExtra) systemBits.push(langExtra);

  return withTimeout(async (signal) => {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "content-type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: systemBits.join(" ") },
          { role: "user", content: promptText },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Perplexity ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    const citations = Array.isArray(data.citations) ? data.citations : [];
    return { text, citations };
  });
}

async function callYandexGPT({ promptText, lang, model }) {
  const folderId = process.env.YANDEX_GPT_FOLDER_ID;
  if (!folderId) throw new Error("YANDEX_GPT_FOLDER_ID not set");

  return withTimeout(async (signal) => {
    const res = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${process.env.YANDEX_GPT_API_KEY}`,
        "content-type": "application/json",
      },
      signal,
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/${model}`,
        completionOptions: { stream: false, temperature: 0.3, maxTokens: String(MAX_TOKENS) },
        messages: [
          { role: "system", text: langInstruction(lang) || "You are a helpful assistant." },
          { role: "user", text: promptText },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`YandexGPT ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.result?.alternatives?.[0]?.message?.text?.trim() || "";
    return { text, citations: [] };
  });
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

export async function runProbes({ force = false } = {}) {
  const prompts = await loadPrompts();
  const engines = enabledEngines();
  if (engines.length === 0) {
    return { rows: [], engines: [], skipped: prompts.length, errors: {} };
  }

  const week = weekStart();
  const ts = new Date().toISOString();
  const tasks = [];
  for (const p of prompts) {
    for (const engine of engines) {
      tasks.push({ prompt: p, engine });
    }
  }

  const errors = {};
  let cached = 0;
  const rows = await pLimit(tasks, MAX_CONCURRENT, async ({ prompt, engine }) => {
    if (!force) {
      const existing = findCachedResponse(prompt.id, engine, week);
      if (existing) {
        cached++;
        return null;
      }
    }
    const cfg = ENGINE_CONFIG[engine];
    try {
      const { text, citations } = await cfg.call({
        promptText: prompt.text,
        lang: prompt.lang,
        model: cfg.model,
      });
      return {
        ts,
        week_start: week,
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        engine,
        lang: prompt.lang,
        response_text: text,
        response_citations: citations,
        response_hash: hashResponse(text),
        raw_excerpt: text.slice(0, 500),
      };
    } catch (err) {
      const key = `${engine}:${prompt.id}`;
      errors[key] = err.message;
      console.error(`[ai-probe] ${key}:`, err.message);
      return null;
    }
  });

  return {
    rows: rows.filter(Boolean),
    engines,
    cached,
    skipped: 0,
    errors,
    fetchedAt: ts,
    weekStart: week,
  };
}
