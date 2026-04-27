import { google } from "googleapis";

const BRAND_TERMS = ["magnum", "magnum estate", "magnumestate"];

let webmasters = null;

function getClient() {
  if (webmasters) return webmasters;
  const keyFile = process.env.GSC_SERVICE_ACCOUNT_KEYFILE || process.env.GA4_SERVICE_ACCOUNT_KEYFILE;
  if (!keyFile) throw new Error("GSC_SERVICE_ACCOUNT_KEYFILE (or GA4_SERVICE_ACCOUNT_KEYFILE) is required");
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  webmasters = google.searchconsole({ version: "v1", auth });
  return webmasters;
}

export function isConfigured() {
  return Boolean(
    process.env.GSC_SITE_URL &&
      (process.env.GSC_SERVICE_ACCOUNT_KEYFILE || process.env.GA4_SERVICE_ACCOUNT_KEYFILE)
  );
}

function isBrandQuery(query) {
  if (!query) return false;
  const q = query.toLowerCase();
  return BRAND_TERMS.some((term) => q.includes(term));
}

async function querySearchAnalytics({ siteUrl, startDate, endDate, dimensions = [], rowLimit = 1000 }) {
  const client = getClient();
  const res = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      type: "web",
    },
  });
  return res.data.rows || [];
}

export async function fetchGscSnapshot({ startDate, endDate, previousStartDate, previousEndDate }) {
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) throw new Error("GSC_SITE_URL is required");

  const [totals, queries, prevTotals] = await Promise.all([
    querySearchAnalytics({ siteUrl, startDate, endDate, dimensions: [] }),
    querySearchAnalytics({ siteUrl, startDate, endDate, dimensions: ["query"], rowLimit: 1000 }),
    previousStartDate && previousEndDate
      ? querySearchAnalytics({
          siteUrl,
          startDate: previousStartDate,
          endDate: previousEndDate,
          dimensions: [],
        })
      : Promise.resolve([]),
  ]);

  const current = totals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const previous = prevTotals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  let brandClicks = 0;
  let brandImpressions = 0;
  let nonBrandClicks = 0;
  let nonBrandImpressions = 0;

  const topQueries = [];
  for (const row of queries) {
    const query = row.keys?.[0] || "";
    const brand = isBrandQuery(query);
    if (brand) {
      brandClicks += row.clicks || 0;
      brandImpressions += row.impressions || 0;
    } else {
      nonBrandClicks += row.clicks || 0;
      nonBrandImpressions += row.impressions || 0;
    }
    topQueries.push({
      query,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
      brand,
    });
  }

  topQueries.sort((a, b) => b.clicks - a.clicks);

  return {
    totals: {
      clicks: current.clicks || 0,
      impressions: current.impressions || 0,
      ctr: current.ctr || 0,
      position: current.position || 0,
    },
    previousTotals: {
      clicks: previous.clicks || 0,
      impressions: previous.impressions || 0,
      ctr: previous.ctr || 0,
      position: previous.position || 0,
    },
    brandSplit: {
      brand: { clicks: brandClicks, impressions: brandImpressions },
      nonBrand: { clicks: nonBrandClicks, impressions: nonBrandImpressions },
    },
    topQueries: topQueries.slice(0, 50),
    topNonBrand: topQueries.filter((q) => !q.brand).slice(0, 20),
  };
}
