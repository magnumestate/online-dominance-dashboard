import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  normalizePropertyId,
  parseLeadEvents,
  parseActivityEvents,
  toDateString,
  addDays,
  daysBetween,
  formatDimensionValue,
  buildChannelFilter,
  runReport,
} from "./ga4.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const granularity = (req.query.granularity || "day").toLowerCase();
    const channelGroup = (req.query.channelGroup || "all").toLowerCase();

    const today = new Date();
    const defaultEnd = addDays(today, -1);
    const defaultStart = addDays(defaultEnd, -29);

    const startDate = req.query.startDate || toDateString(defaultStart);
    const endDate = req.query.endDate || toDateString(defaultEnd);

    const dimensionMap = {
      day: "date",
      week: "yearWeek",
      month: "yearMonth",
    };

    const dimensionName = dimensionMap[granularity] || "date";

    const property = normalizePropertyId(process.env.GA4_PROPERTY_ID);
    const leadEvents = parseLeadEvents();
    const activityEvents = parseActivityEvents();

    const channelFilter = buildChannelFilter(channelGroup);

    const trafficResponse = await runReport({
      property,
      startDate,
      endDate,
      dimensions: [dimensionName],
      metrics: ["sessions", "totalUsers", "engagedSessions", "engagementRate"],
      dimensionFilter: channelFilter,
    });

    const leadFilter = leadEvents.length
      ? {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: { values: leadEvents },
                },
              },
              ...(channelFilter ? [channelFilter] : []),
            ],
          },
        }
      : channelFilter;

    const leadResponse = await runReport({
      property,
      startDate,
      endDate,
      dimensions: [dimensionName],
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    });

    const currentLeadTotalResponse = await runReport({
      property,
      startDate,
      endDate,
      dimensions: [],
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    });

    const activityFilter = activityEvents.length
      ? {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: { values: activityEvents },
                },
              },
              ...(channelFilter ? [channelFilter] : []),
            ],
          },
        }
      : channelFilter;

    const activityResponse = activityEvents.length
      ? await runReport({
          property,
          startDate,
          endDate,
          dimensions: ["eventName"],
          metrics: ["eventCount"],
          dimensionFilter: activityFilter,
        })
      : { rows: [] };

    const sourceDimensions = [
      "sessionSource",
      "sessionMedium",
      "sessionDefaultChannelGroup",
    ];

    const sourceTrafficResponse = await runReport({
      property,
      startDate,
      endDate,
      dimensions: sourceDimensions,
      metrics: ["sessions", "totalUsers", "engagedSessions"],
      dimensionFilter: channelFilter,
    });

    const sourceLeadResponse = await runReport({
      property,
      startDate,
      endDate,
      dimensions: sourceDimensions,
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    });

    const trafficRows = trafficResponse.rows || [];
    const leadRows = leadResponse.rows || [];
    const activityRows = activityResponse.rows || [];
    const sourceTrafficRows = sourceTrafficResponse.rows || [];
    const sourceLeadRows = sourceLeadResponse.rows || [];

    const leadByKey = new Map();
    for (const row of leadRows) {
      const key = row.dimensionValues?.[0]?.value || "";
      const value = Number(row.metricValues?.[0]?.value || 0);
      leadByKey.set(key, (leadByKey.get(key) || 0) + value);
    }

    const series = trafficRows.map((row) => {
      const key = row.dimensionValues?.[0]?.value || "";
      const sessions = Number(row.metricValues?.[0]?.value || 0);
      const totalUsers = Number(row.metricValues?.[1]?.value || 0);
      const engagedSessions = Number(row.metricValues?.[2]?.value || 0);
      const engagementRate = Number(row.metricValues?.[3]?.value || 0);
      const leads = Number(leadByKey.get(key) || 0);

      return {
        period: formatDimensionValue(granularity, key),
        sessions,
        totalUsers,
        engagedSessions,
        engagementRate,
        leads,
      };
    }).sort((a, b) => a.period.localeCompare(b.period));

    const activities = activityRows
      .map((row) => {
        const name = row.dimensionValues?.[0]?.value || "";
        const count = Number(row.metricValues?.[0]?.value || 0);
        return { name, count };
      })
      .filter((item) => item.name)
      .sort((a, b) => b.count - a.count);

    const sourceLeadByKey = new Map();
    for (const row of sourceLeadRows) {
      const source = row.dimensionValues?.[0]?.value || "(not set)";
      const medium = row.dimensionValues?.[1]?.value || "(not set)";
      const channel = row.dimensionValues?.[2]?.value || "Unassigned";
      const key = buildSourceKey(source, medium, channel);
      const value = Number(row.metricValues?.[0]?.value || 0);
      sourceLeadByKey.set(key, (sourceLeadByKey.get(key) || 0) + value);
    }

    const trafficSources = sourceTrafficRows
      .map((row) => {
        const source = row.dimensionValues?.[0]?.value || "(not set)";
        const medium = row.dimensionValues?.[1]?.value || "(not set)";
        const channel = row.dimensionValues?.[2]?.value || "Unassigned";
        const sessions = Number(row.metricValues?.[0]?.value || 0);
        const totalUsers = Number(row.metricValues?.[1]?.value || 0);
        const engagedSessions = Number(row.metricValues?.[2]?.value || 0);
        const leads = Number(sourceLeadByKey.get(buildSourceKey(source, medium, channel)) || 0);

        return {
          source,
          medium,
          channel,
          sessions,
          totalUsers,
          engagedSessions,
          engagementRate: sessions ? engagedSessions / sessions : 0,
          leads,
          leadRate: sessions ? leads / sessions : 0,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);

    const totals = series.reduce(
      (acc, item) => {
        acc.sessions += item.sessions;
        acc.totalUsers += item.totalUsers;
        acc.engagedSessions += item.engagedSessions;
        return acc;
      },
      { sessions: 0, totalUsers: 0, engagedSessions: 0, leads: 0 }
    );

    const currentLeadTotalRow = currentLeadTotalResponse.rows?.[0];
    totals.leads = Number(currentLeadTotalRow?.metricValues?.[0]?.value || 0);

    const engagementRateTotal = totals.sessions
      ? totals.engagedSessions / totals.sessions
      : 0;

    const currentTotals = {
      sessions: totals.sessions,
      totalUsers: totals.totalUsers,
      leads: totals.leads,
      engagementRate: engagementRateTotal,
    };

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = daysBetween(start, end);
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(totalDays - 1));

    const previousStartDate = toDateString(previousStart);
    const previousEndDate = toDateString(previousEnd);

    const previousTraffic = await runReport({
      property,
      startDate: previousStartDate,
      endDate: previousEndDate,
      dimensions: [],
      metrics: ["sessions", "totalUsers", "engagedSessions", "engagementRate"],
      dimensionFilter: channelFilter,
    });

    const previousLead = await runReport({
      property,
      startDate: previousStartDate,
      endDate: previousEndDate,
      dimensions: [],
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    });

    const previousTrafficRow = previousTraffic.rows?.[0];
    const previousLeadRow = previousLead.rows?.[0];

    const previousTotals = {
      sessions: Number(previousTrafficRow?.metricValues?.[0]?.value || 0),
      totalUsers: Number(previousTrafficRow?.metricValues?.[1]?.value || 0),
      engagedSessions: Number(previousTrafficRow?.metricValues?.[2]?.value || 0),
      engagementRate: Number(previousTrafficRow?.metricValues?.[3]?.value || 0),
      leads: Number(previousLeadRow?.metricValues?.[0]?.value || 0),
    };

    const dominance = computeDominanceIndex(currentTotals, previousTotals);

    res.json({
      meta: {
        startDate,
        endDate,
        granularity,
        channelGroup,
        previousStartDate,
        previousEndDate,
        leadEvents,
        activityEvents,
      },
      totals: currentTotals,
      previousTotals,
      dominance,
      series,
      activities,
      trafficSources,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to load GA4 data",
      details: error.message,
    });
  }
});

function buildSourceKey(source, medium, channel) {
  return `${source}|||${medium}|||${channel}`;
}

function computeDominanceIndex(current, previous) {
  const weights = {
    sessions: 0.35,
    leads: 0.35,
    engagementRate: 0.2,
    totalUsers: 0.1,
  };

  const score = (value, prev) => {
    if (!prev || prev <= 0) return value > 0 ? 1.25 : 0;
    return value / prev;
  };

  const ratioSessions = score(current.sessions, previous.sessions);
  const ratioLeads = score(current.leads, previous.leads);
  const ratioEngagement = score(current.engagementRate, previous.engagementRate);
  const ratioUsers = score(current.totalUsers, previous.totalUsers);

  const weighted =
    ratioSessions * weights.sessions +
    ratioLeads * weights.leads +
    ratioEngagement * weights.engagementRate +
    ratioUsers * weights.totalUsers;

  const index = Math.round(weighted * 100);

  let status = "Stable";
  if (index >= 120) status = "Dominating";
  else if (index <= 90) status = "At Risk";

  return {
    index,
    status,
    breakdown: {
      ratios: {
        sessions: ratioSessions,
        leads: ratioLeads,
        engagementRate: ratioEngagement,
        totalUsers: ratioUsers,
      },
      weights,
    },
  };
}

app.listen(port, () => {
  console.log(`Dashboard running on http://localhost:${port}`);
});
