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
import { dominanceIndex } from "./score.js";
import { diffSerp } from "./diff.js";
import {
  writeSnapshot,
  readLatestSnapshot,
  readPreviousSnapshot,
  recordDominance,
  dominanceHistory,
} from "./cache.js";

dotenv.config();

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
      serp: serpData,
      seoProgress: seoData,
      bitrix: bitrixData,
    });

    const history = (() => {
      try {
        return dominanceHistory(30);
      } catch {
        return [];
      }
    })();

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
      sources: {
        ga4: { configured: ga4.isConfigured(), ok: byLabel.ga4?.ok ?? false, error: byLabel.ga4?.error },
        gsc: { configured: gsc.isConfigured(), ok: byLabel.gsc?.ok ?? false, error: byLabel.gsc?.error },
        serp: { configured: serp.isConfigured(), cached: Boolean(serpCached), date: serpCached?.date },
        seoProgress: { configured: seoProgress.isConfigured(), cached: Boolean(seoCached), date: seoCached?.date },
        bitrix: { configured: bitrix.isConfigured(), ok: byLabel.bitrix?.ok ?? false, error: byLabel.bitrix?.error },
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
  }

  const byLabel = Object.fromEntries(results.map((r) => [r.label, r]));
  const dominance = dominanceIndex({
    ga4: byLabel.ga4?.ok ? byLabel.ga4.data : null,
    gsc: byLabel.gsc?.ok ? byLabel.gsc.data : null,
    serp: byLabel.serp?.ok ? byLabel.serp.data : readLatestSnapshot("serp")?.payload,
    seoProgress: byLabel["seo-progress"]?.ok
      ? byLabel["seo-progress"].data
      : readLatestSnapshot("seo-progress")?.payload,
    bitrix: byLabel.bitrix?.ok
      ? byLabel.bitrix.data
      : readLatestSnapshot("bitrix")?.payload,
  });

  recordDominance(dominance);
  res.json({ ok: true, index: dominance.index, status: dominance.status, summary });
});

app.listen(port, () => {
  console.log(`Dashboard running on http://localhost:${port}`);
});
