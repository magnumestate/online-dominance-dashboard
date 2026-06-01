import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addDays, toDateString, previousPeriod } from "./utils.js";
import * as ga4 from "./sources/ga4.js";
import * as gsc from "./sources/gsc.js";
import * as serp from "./sources/serp.js";
import * as seoProgress from "./sources/seo-progress.js";
import * as bitrix from "./sources/bitrix.js";
import * as briefing from "./briefing.js";
import * as aiProbe from "./sources/ai-probe.js";
import * as aiClassifier from "./sources/ai-classifier.js";
import { summarizeAiOverviews } from "./sources/ai-overviews.js";
import { dominanceIndex, aiVisibilityScore, totalDominance } from "./score.js";
import { diffSerp } from "./diff.js";
import { generateWeeklyBrief } from "./brief.js";
import {
  writeSnapshot,
  readLatestSnapshot,
  readPreviousSnapshot,
  recordDominance,
  dominanceHistory,
  recordBriefing,
  readLatestBriefing,
  weekStart,
  writeAiResponses,
  readAiResponsesForWeek,
  aiVisibilityHistory,
} from "./cache.js";

dotenv.config({ override: true });

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json());
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    sources: {
      ga4: ga4.isConfigured(),
      gsc: gsc.isConfigured(),
      serp: serp.isConfigured(),
      seoProgress: seoProgress.isConfigured(),
      bitrix: bitrix.isConfigured(),
      briefing: briefing.isConfigured(),
      aiProbe: aiProbe.isConfigured(),
      aiProbeEngines: aiProbe.enabledEngines(),
      aiClassifier: aiClassifier.isConfigured(),
    },
  });
});

function defaultRange(req) {
  const today = new Date();
  const defaultEnd = addDays(today, -1);
  const defaultStart = addDays(defaultEnd, -29);
  const startDate = req.query.startDate || toDateString(defaultStart);
  const endDate = req.query.endDate || toDateString(defaultEnd);
  const prev = previousPeriod(startDate, endDate);
  return { startDate, endDate, prev };
}

async function settled(label, promise) {
  try {
    return { label, ok: true, data: await promise };
  } catch (err) {
    console.error(`[${label}]`, err.message);
    return { label, ok: false, error: err.message };
  }
}

app.get("/api/dashboard", async (req, res) => {
  try {
    const granularity = (req.query.granularity || "day").toLowerCase();
    const channelGroup = (req.query.channelGroup || "all").toLowerCase();
    const { startDate, endDate, prev } = defaultRange(req);

    const tasks = [];
    if (ga4.isConfigured()) {
      tasks.push(
        settled(
          "ga4",
          ga4.fetchGa4Dashboard({ startDate, endDate, granularity, channelGroup })
        )
      );
    }
    if (gsc.isConfigured()) {
      tasks.push(
        settled(
          "gsc",
          gsc.fetchGscSnapshot({
            startDate,
            endDate,
            previousStartDate: prev.startDate,
            previousEndDate: prev.endDate,
          })
        )
      );
    }
    if (bitrix.isConfigured()) {
      tasks.push(
        settled(
          "bitrix",
          bitrix.fetchBitrixSnapshot({
            startDate,
            endDate,
            previousStartDate: prev.startDate,
            previousEndDate: prev.endDate,
          })
        )
      );
    }
    const serpCached = readLatestSnapshot("serp");
    const serpPrevCached = serpCached ? readPreviousSnapshot("serp", serpCached.date) : null;
    const seoCached = readLatestSnapshot("seo-progress");

    const results = await Promise.all(tasks);
    const byLabel = Object.fromEntries(results.map((r) => [r.label, r]));

    const ga4Data = byLabel.ga4?.ok ? byLabel.ga4.data : null;
    const gscData = byLabel.gsc?.ok ? byLabel.gsc.data : null;
    const bitrixData = byLabel.bitrix?.ok ? byLabel.bitrix.data : null;
    const serpData = serpCached?.payload || null;
    const seoData = seoCached?.payload || null;

    const dominance = dominanceIndex({
      ga4: ga4Data,
      gsc: gscData,
      bitrix: bitrixData,
    });

    const history = (() => {
      try {
        return dominanceHistory(30);
      } catch {
        return [];
      }
    })();

    const currentWeek = weekStart();
    const aiHistory = (() => {
      try { return aiVisibilityHistory(12); } catch { return []; }
    })();
    const aiResponsesThisWeek = (() => {
      try { return readAiResponsesForWeek(currentWeek); } catch { return []; }
    })();
    const ai = aiVisibilityScore({ responses: aiResponsesThisWeek, history: aiHistory });
    const aiOverviewsSummary = serpData ? summarizeAiOverviews(serpData) : null;
    const totalDom = totalDominance({ webIndex: dominance.index, aiIndex: ai.index });

    const meta = ga4Data?.meta || {
      startDate,
      endDate,
      granularity,
      channelGroup,
      previousStartDate: prev.startDate,
      previousEndDate: prev.endDate,
      leadEvents: [],
      activityEvents: [],
    };

    res.json({
      meta,
      totals: ga4Data?.totals || { sessions: 0, leads: 0, totalUsers: 0, engagementRate: 0 },
      previousTotals: ga4Data?.previousTotals || null,
      series: ga4Data?.series || [],
      activities: ga4Data?.activities || [],
      trafficSources: ga4Data?.trafficSources || [],
      gsc: gscData,
      serp: serpData
        ? { keywords: serpData.keywords, competitors: serpData.competitors, snapshotDate: serpCached.date }
        : null,
      serpDiff:
        serpData && serpPrevCached
          ? {
              ...diffSerp(serpData, serpPrevCached.payload, serpData.competitors?.us?.domain),
              currentDate: serpCached.date,
              previousDate: serpPrevCached.date,
            }
          : null,
      seoProgress: seoData
        ? { ...seoData, snapshotDate: seoCached.date }
        : null,
      bitrix: bitrixData,
      dominance,
      dominanceHistory: history,
      briefing: readLatestBriefing(),
      aiVisibility: ai,
      aiVisibilityHistory: aiHistory,
      aiOverviews: aiOverviewsSummary,
      totalDominance: totalDom,
      sources: {
        ga4: { configured: ga4.isConfigured(), ok: byLabel.ga4?.ok ?? false, error: byLabel.ga4?.error },
        gsc: { configured: gsc.isConfigured(), ok: byLabel.gsc?.ok ?? false, error: byLabel.gsc?.error },
        serp: { configured: serp.isConfigured(), cached: Boolean(serpCached), date: serpCached?.date },
        seoProgress: { configured: seoProgress.isConfigured(), cached: Boolean(seoCached), date: seoCached?.date },
        bitrix: { configured: bitrix.isConfigured(), ok: byLabel.bitrix?.ok ?? false, error: byLabel.bitrix?.error },
        briefing: { configured: briefing.isConfigured() },
        aiProbe: { configured: aiProbe.isConfigured(), engines: aiProbe.enabledEngines(), responsesThisWeek: aiResponsesThisWeek.length },
        aiClassifier: { configured: aiClassifier.isConfigured() },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load dashboard", details: error.message });
  }
});

app.get("/api/gsc", async (req, res) => {
  if (!gsc.isConfigured()) return res.status(400).json({ error: "GSC not configured" });
  try {
    const { startDate, endDate, prev } = defaultRange(req);
    const data = await gsc.fetchGscSnapshot({
      startDate,
      endDate,
      previousStartDate: prev.startDate,
      previousEndDate: prev.endDate,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/serp", async (_req, res) => {
  const cached = readLatestSnapshot("serp");
  if (cached) return res.json({ ...cached.payload, snapshotDate: cached.date });
  if (!serp.isConfigured()) return res.status(400).json({ error: "SERP not configured" });
  try {
    const data = await serp.fetchSerpSnapshot();
    writeSnapshot("serp", data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bitrix", async (req, res) => {
  if (!bitrix.isConfigured()) return res.status(400).json({ error: "Bitrix CRM not configured" });
  try {
    const { startDate, endDate, prev } = defaultRange(req);
    const data = await bitrix.fetchBitrixSnapshot({
      startDate,
      endDate,
      previousStartDate: prev.startDate,
      previousEndDate: prev.endDate,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/seo-progress", async (_req, res) => {
  const cached = readLatestSnapshot("seo-progress");
  if (cached) return res.json({ ...cached.payload, snapshotDate: cached.date });
  if (!seoProgress.isConfigured()) return res.status(400).json({ error: "SEO progress not configured" });
  try {
    const data = await seoProgress.fetchSeoProgress();
    writeSnapshot("seo-progress", data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/briefing", (_req, res) => {
  const latest = readLatestBriefing();
  if (!latest) {
    return res.status(404).json({
      error: "No briefing available yet. Run /api/snapshot first.",
      configured: briefing.isConfigured(),
    });
  }
  res.json(latest);
});

// Regenerate briefing on-demand from cached snapshots — useful for ad-hoc
// regeneration without re-running expensive source fetches.
app.post("/api/briefing/regenerate", async (req, res) => {
  const token = process.env.SNAPSHOT_TOKEN;
  if (!token || req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!briefing.isConfigured()) {
    return res.status(400).json({ error: "ANTHROPIC_API_KEY not set" });
  }

  try {
    const today = new Date();
    const endDate = toDateString(addDays(today, -1));
    const startDate = toDateString(addDays(today, -30));
    const prev = previousPeriod(startDate, endDate);

    const ga4Data = ga4.isConfigured()
      ? await ga4.fetchGa4Dashboard({ startDate, endDate, granularity: "day", channelGroup: "all" })
      : null;
    const gscData = gsc.isConfigured()
      ? await gsc.fetchGscSnapshot({
          startDate, endDate,
          previousStartDate: prev.startDate, previousEndDate: prev.endDate,
        })
      : null;
    const serpCached = readLatestSnapshot("serp");
    const serpPrevCached = serpCached ? readPreviousSnapshot("serp", serpCached.date) : null;
    const serpData = serpCached?.payload || null;
    const serpDiff = serpData && serpPrevCached
      ? diffSerp(serpData, serpPrevCached.payload, serpData.competitors?.us?.domain)
      : null;
    const seoData = readLatestSnapshot("seo-progress")?.payload || null;
    const dominance = dominanceIndex({ ga4: ga4Data, gsc: gscData });

    const facts = briefing.buildFacts({
      meta: ga4Data?.meta,
      totals: ga4Data?.totals,
      previousTotals: ga4Data?.previousTotals,
      dominance,
      gsc: gscData,
      serp: serpData,
      serpDiff,
      seoProgress: seoData,
      dominanceHistory: dominanceHistory(30),
    });

    const result = await briefing.generateBriefing(facts);
    recordBriefing(result, dominance.index, dominance.status);
    res.json({ ok: true, index: dominance.index, status: dominance.status, briefing: result });
  } catch (err) {
    console.error("[briefing/regenerate]", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/snapshot", async (req, res) => {
  const token = process.env.SNAPSHOT_TOKEN;
  if (!token) return res.status(500).json({ error: "SNAPSHOT_TOKEN not set" });
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date();
  const endDate = toDateString(addDays(today, -1));
  const startDate = toDateString(addDays(today, -30));
  const prev = previousPeriod(startDate, endDate);

  const tasks = [];
  if (ga4.isConfigured()) {
    tasks.push(
      settled("ga4", ga4.fetchGa4Dashboard({ startDate, endDate, granularity: "day", channelGroup: "all" }))
    );
  }
  if (gsc.isConfigured()) {
    tasks.push(
      settled("gsc", gsc.fetchGscSnapshot({
        startDate, endDate, previousStartDate: prev.startDate, previousEndDate: prev.endDate,
      }))
    );
  }
  if (serp.isConfigured()) tasks.push(settled("serp", serp.fetchSerpSnapshot()));
  if (seoProgress.isConfigured()) tasks.push(settled("seo-progress", seoProgress.fetchSeoProgress()));
  if (bitrix.isConfigured()) {
    tasks.push(settled("bitrix", bitrix.fetchBitrixSnapshot({
      startDate, endDate,
      previousStartDate: prev.startDate, previousEndDate: prev.endDate,
    })));
  }
  if (aiProbe.isConfigured()) {
    tasks.push(settled("ai-probe", (async () => {
      const probed = await aiProbe.runProbes({ force: req.query.force === "1" });
      const classified = await aiClassifier.classifyResponses({ rows: probed.rows });
      const written = writeAiResponses(classified);
      return {
        engines: probed.engines,
        responsesNew: written,
        responsesCached: probed.cached || 0,
        errors: probed.errors,
        weekStart: probed.weekStart,
      };
    })()));
  }

  const results = await Promise.all(tasks);
  const summary = {};
  for (const r of results) {
    summary[r.label] = { ok: r.ok, error: r.error };
    if (r.ok && (r.label === "serp" || r.label === "seo-progress")) {
      writeSnapshot(r.label, r.data);
    }
    if (r.ok && r.label === "ga4") writeSnapshot("ga4-totals", { totals: r.data.totals, previousTotals: r.data.previousTotals });
    if (r.ok && r.label === "gsc") writeSnapshot("gsc-totals", { totals: r.data.totals, previousTotals: r.data.previousTotals, brandSplit: r.data.brandSplit });
    if (r.ok && r.label === "bitrix") writeSnapshot("bitrix", r.data);
    if (r.ok && r.label === "ai-probe") summary["ai-probe"] = { ...summary["ai-probe"], ...r.data };
  }

  const byLabel = Object.fromEntries(results.map((r) => [r.label, r]));
  const dominance = dominanceIndex({
    ga4: byLabel.ga4?.ok ? byLabel.ga4.data : null,
    gsc: byLabel.gsc?.ok ? byLabel.gsc.data : null,
    bitrix: byLabel.bitrix?.ok
      ? byLabel.bitrix.data
      : readLatestSnapshot("bitrix")?.payload,
  });

  const currentWeek = weekStart();
  const aiResponses = readAiResponsesForWeek(currentWeek);
  const aiHistory = aiVisibilityHistory(12);
  const ai = aiVisibilityScore({ responses: aiResponses, history: aiHistory });

  if (ai.index != null) {
    writeSnapshot("ai-visibility-week", {
      sov_pct: ai.stats.sov_pct,
      mentions_total: ai.stats.brandMentioned,
      mentions_cited: ai.stats.brandCited,
      ai_visibility_score: ai.index,
      breakdown: ai.breakdown,
      stats: ai.stats,
    }, currentWeek);
  }

  const totalDom = totalDominance({ webIndex: dominance.index, aiIndex: ai.index });

  recordDominance(dominance);

  if (briefing.isConfigured()) {
    try {
      const ga4Data = byLabel.ga4?.ok ? byLabel.ga4.data : null;
      const gscData = byLabel.gsc?.ok ? byLabel.gsc.data : null;
      const serpData = byLabel.serp?.ok
        ? byLabel.serp.data
        : readLatestSnapshot("serp")?.payload;
      const serpPrevCached = serpData
        ? readPreviousSnapshot("serp", toDateString(new Date()))
        : null;
      const serpDiffData = serpData && serpPrevCached
        ? diffSerp(serpData, serpPrevCached.payload, serpData.competitors?.us?.domain)
        : null;
      const seoData = byLabel["seo-progress"]?.ok
        ? byLabel["seo-progress"].data
        : readLatestSnapshot("seo-progress")?.payload;

      const facts = briefing.buildFacts({
        meta: ga4Data?.meta,
        totals: ga4Data?.totals,
        previousTotals: ga4Data?.previousTotals,
        dominance,
        gsc: gscData,
        serp: serpData,
        serpDiff: serpDiffData,
        seoProgress: seoData,
        dominanceHistory: dominanceHistory(30),
      });

      const result = await briefing.generateBriefing(facts);
      recordBriefing(result, dominance.index, dominance.status);
      summary.briefing = { ok: true, model: result.model, usage: result.usage };
    } catch (err) {
      console.error("[snapshot/briefing]", err.message);
      summary.briefing = { ok: false, error: err.message };
    }
  } else {
    summary.briefing = { ok: false, error: "ANTHROPIC_API_KEY not configured" };
  }

  res.json({
    ok: true,
    webDominance: { index: dominance.index, status: dominance.status },
    aiVisibility: { index: ai.index, status: ai.status, stats: ai.stats },
    totalDominance: { index: totalDom.index, status: totalDom.status, weights: totalDom.weights },
    summary,
  });
});

app.post("/api/brief/weekly", async (req, res) => {
  const token = process.env.SNAPSHOT_TOKEN;
  if (!token) return res.status(500).json({ error: "SNAPSHOT_TOKEN not set" });
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await generateWeeklyBrief({
      persist: req.query.dryRun !== "1",
      dashboardUrl: process.env.DASHBOARD_URL,
    });
    res.json({ ok: true, week: result.week, file: result.file || null, length: result.markdown.length });
  } catch (err) {
    console.error("[brief]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/briefs", async (_req, res) => {
  try {
    const fs = await import("node:fs/promises");
    const dir = path.join(process.cwd(), "briefs");
    try {
      const entries = await fs.readdir(dir);
      const briefs = entries
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .map((f) => ({ week: f.replace(/\.md$/, ""), path: `/briefs/${f}` }));
      res.json({ briefs });
    } catch {
      res.json({ briefs: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use("/briefs", express.static(path.join(process.cwd(), "briefs")));

app.listen(port, () => {
  console.log(`Dashboard running on http://localhost:${port}`);
});
