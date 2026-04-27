import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA4_PROPERTY_ID;
const keyFile = process.env.GA4_SERVICE_ACCOUNT_KEYFILE;

if (!propertyId) {
  throw new Error("GA4_PROPERTY_ID is required");
}
if (!keyFile) {
  throw new Error("GA4_SERVICE_ACCOUNT_KEYFILE is required");
}

const client = new BetaAnalyticsDataClient({
  keyFilename: keyFile,
});

export function normalizePropertyId(id) {
  if (!id) return "";
  return id.startsWith("properties/") ? id : `properties/${id}`;
}

function parseEvents(rawValue) {
  return (rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseLeadEvents() {
  return parseEvents(process.env.LEAD_EVENTS);
}

export function parseActivityEvents() {
  return parseEvents(process.env.ACTIVITY_EVENTS);
}

export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function daysBetween(start, end) {
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endMs = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}

export function formatDimensionValue(granularity, value) {
  if (!value) return "";
  if (granularity === "day") {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (granularity === "week") {
    return `${value.slice(0, 4)}-W${value.slice(4)}`;
  }
  if (granularity === "month") {
    return `${value.slice(0, 4)}-${value.slice(4)}`;
  }
  return value;
}

export function buildChannelFilter(channelGroup) {
  if (!channelGroup || channelGroup === "all") return null;

  if (channelGroup === "social") {
    return {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        inListFilter: {
          values: ["Organic Social", "Paid Social"],
        },
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
      stringFilter: {
        matchType: "EXACT",
        value,
      },
    },
  };
}

export async function runReport({
  property,
  startDate,
  endDate,
  dimensions,
  metrics,
  dimensionFilter,
}) {
  const [response] = await client.runReport({
    property,
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dimensionFilter,
  });

  return response;
}
