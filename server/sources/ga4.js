import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { previousPeriod } from "../utils.js";

let client = null;

function getClient() {
  if (client) return client;
  const keyFile = process.env.GA4_SERVICE_ACCOUNT_KEYFILE;
  if (!keyFile) throw new Error("GA4_SERVICE_ACCOUNT_KEYFILE is required");
  client = new BetaAnalyticsDataClient({ keyFilename: keyFile });
  return client;
}

export function isConfigured() {
  return Boolean(
    process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_KEYFILE
  );
}

export function normalizePropertyId(id) {
  if (!id) return "";
  return id.startsWith("properties/") ? id : `properties/${id}`;
}

function parseEvents(rawValue) {
  return (rawValue || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseLeadEvents() {
  return parseEvents(process.env.LEAD_EVENTS);
}

export function parseActivityEvents() {
  return parseEvents(process.env.ACTIVITY_EVENTS);
}

export function formatDimensionValue(granularity, value) {
  if (!value) return "";
  if (granularity === "day") {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (granularity === "week") return `${value.slice(0, 4)}-W${value.slice(4)}`;
  if (granularity === "month") return `${value.slice(0, 4)}-${value.slice(4)}`;
  return value;
}

export function buildChannelFilter(channelGroup) {
  if (!channelGroup || channelGroup === "all") return null;

  if (channelGroup === "social") {
    return {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        inListFilter: { values: ["Organic Social", "Paid Social"] },
      },
    };
  }

  const map = {
    "organic-social": "Organic Social",
    "paid-social": "Paid Social",
    "paid-search": "Paid Search",
    organic: "Organic Search",
    referral: "Referral",
  };
  const value = map[channelGroup];
  if (!value) return null;
  return {
    filter: {
      fieldName: "sessionDefaultChannelGroup",
      stringFilter: { matchType: "EXACT", value },
    },
  };
}

async function runReport({ property, startDate, endDate, dimensions, metrics, dimensionFilter }) {
  const [response] = await getClient().runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dimensionFilter,
  });
  return response;
}

function buildSourceKey(source, medium, channel) {
  return `${source}|||${medium}|||${channel}`;
}

export async function fetchGa4Dashboard({
  startDate,
  endDate,
  granularity = "day",
  channelGroup = "all",
}) {
  const property = normalizePropertyId(process.env.GA4_PROPERTY_ID);
  const leadEvents = parseLeadEvents();
  const activityEvents = parseActivityEvents();
  const channelFilter = buildChannelFilter(channelGroup);

  const dimensionMap = { day: "date", week: "yearWeek", month: "yearMonth" };
  const dimensionName = dimensionMap[granularity] || "date";

  const leadFilter = leadEvents.length
    ? {
        andGroup: {
          expressions: [
            { filter: { fieldName: "eventName", inListFilter: { values: leadEvents } } },
            ...(channelFilter ? [channelFilter] : []),
          ],
        },
      }
    : channelFilter;

  const activityFilter = activityEvents.length
    ? {
        andGroup: {
          expressions: [
            { filter: { fieldName: "eventName", inListFilter: { values: activityEvents } } },
            ...(channelFilter ? [channelFilter] : []),
          ],
        },
      }
    : channelFilter;

  const sourceDimensions = [
    "sessionSource",
    "sessionMedium",
    "sessionDefaultChannelGroup",
  ];

  const prev = previousPeriod(startDate, endDate);

  const reports = await Promise.all([
    runReport({
      property,
      startDate,
      endDate,
      dimensions: [dimensionName],
      metrics: ["sessions", "totalUsers", "engagedSessions", "engagementRate"],
      dimensionFilter: channelFilter,
    }),
    runReport({
      property,
      startDate,
      endDate,
      dimensions: [dimensionName],
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    }),
    runReport({
      property,
      startDate,
      endDate,
      dimensions: [],
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    }),
    activityEvents.length
      ? runReport({
          property,
          startDate,
          endDate,
          dimensions: ["eventName"],
          metrics: ["eventCount"],
          dimensionFilter: activityFilter,
        })
      : Promise.resolve({ rows: [] }),
    runReport({
      property,
      startDate,
      endDate,
      dimensions: sourceDimensions,
      metrics: ["sessions", "totalUsers", "engagedSessions"],
      dimensionFilter: channelFilter,
    }),
    runReport({
      property,
      startDate,
      endDate,
      dimensions: sourceDimensions,
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    }),
    runReport({
      property,
      startDate: prev.startDate,
      endDate: prev.endDate,
      dimensions: [],
      metrics: ["sessions", "totalUsers", "engagedSessions", "engagementRate"],
      dimensionFilter: channelFilter,
    }),
    runReport({
      property,
      startDate: prev.startDate,
      endDate: prev.endDate,
      dimensions: [],
      metrics: ["eventCount"],
      dimensionFilter: leadFilter,
    }),
  ]);

  const [
    trafficResponse,
    leadResponse,
    currentLeadTotalResponse,
    activityResponse,
    sourceTrafficResponse,
    sourceLeadResponse,
    previousTraffic,
    previousLead,
  ] = reports;

  const leadByKey = new Map();
  for (const row of leadResponse.rows || []) {
    const key = row.dimensionValues?.[0]?.value || "";
    const value = Number(row.metricValues?.[0]?.value || 0);
    leadByKey.set(key, (leadByKey.get(key) || 0) + value);
  }

  const series = (trafficResponse.rows || [])
    .map((row) => {
      const key = row.dimensionValues?.[0]?.value || "";
      return {
        period: formatDimensionValue(granularity, key),
        sessions: Number(row.metricValues?.[0]?.value || 0),
        totalUsers: Number(row.metricValues?.[1]?.value || 0),
        engagedSessions: Number(row.metricValues?.[2]?.value || 0),
        engagementRate: Number(row.metricValues?.[3]?.value || 0),
        leads: Number(leadByKey.get(key) || 0),
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const activities = (activityResponse.rows || [])
    .map((row) => ({
      name: row.dimensionValues?.[0]?.value || "",
      count: Number(row.metricValues?.[0]?.value || 0),
    }))
    .filter((item) => item.name)
    .sort((a, b) => b.count - a.count);

  const sourceLeadByKey = new Map();
  for (const row of sourceLeadResponse.rows || []) {
    const source = row.dimensionValues?.[0]?.value || "(not set)";
    const medium = row.dimensionValues?.[1]?.value || "(not set)";
    const channel = row.dimensionValues?.[2]?.value || "Unassigned";
    const key = buildSourceKey(source, medium, channel);
    const value = Number(row.metricValues?.[0]?.value || 0);
    sourceLeadByKey.set(key, (sourceLeadByKey.get(key) || 0) + value);
  }

  const trafficSources = (sourceTrafficResponse.rows || [])
    .map((row) => {
      const source = row.dimensionValues?.[0]?.value || "(not set)";
      const medium = row.dimensionValues?.[1]?.value || "(not set)";
      const channel = row.dimensionValues?.[2]?.value || "Unassigned";
      const sessions = Number(row.metricValues?.[0]?.value || 0);
      const totalUsers = Number(row.metricValues?.[1]?.value || 0);
      const engagedSessions = Number(row.metricValues?.[2]?.value || 0);
      const leads = Number(
        sourceLeadByKey.get(buildSourceKey(source, medium, channel)) || 0
      );
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

  const previousTrafficRow = previousTraffic.rows?.[0];
  const previousLeadRow = previousLead.rows?.[0];
  const previousTotals = {
    sessions: Number(previousTrafficRow?.metricValues?.[0]?.value || 0),
    totalUsers: Number(previousTrafficRow?.metricValues?.[1]?.value || 0),
    engagedSessions: Number(previousTrafficRow?.metricValues?.[2]?.value || 0),
    engagementRate: Number(previousTrafficRow?.metricValues?.[3]?.value || 0),
    leads: Number(previousLeadRow?.metricValues?.[0]?.value || 0),
  };

  return {
    meta: {
      startDate,
      endDate,
      granularity,
      channelGroup,
      previousStartDate: prev.startDate,
      previousEndDate: prev.endDate,
      leadEvents,
      activityEvents,
    },
    totals: currentTotals,
    previousTotals,
    series,
    activities,
    trafficSources,
  };
}
