// Bitrix24 CRM — leads + deals + pipeline.
//
// Uses a Bitrix24 "inbound webhook" — a REST endpoint generated in the
// Bitrix admin that lets an external client call the CRM API with a
// static token, no OAuth dance.
//
//   Webhook URL format:
//     https://<portal>.bitrix24.ru/rest/<user_id>/<token>/
//
//   Append <method>.json to call any REST method. We use:
//     - crm.lead.list      — leads in the period (paginated, 50/page)
//     - crm.deal.list      — deals in the period
//     - crm.status.list    — once-per-snapshot lookup tables for STATUS_ID
//     - crm.dealcategory.stage.list — deal pipeline stages
//
// Snapshot shape returned by fetchBitrixSnapshot():
//   {
//     leads: { current: { total, qualified, junk, by_source }, previous: {...} },
//     deals: { current: { won, lost, in_progress, won_value, pipeline_value, by_stage }, previous: {...} },
//     fetchedAt: ISO,
//   }

const PAGE_SIZE = 50; // Bitrix24 hard cap on list endpoints
const REQUEST_TIMEOUT_MS = 30_000;

export function isConfigured() {
  return Boolean(process.env.BITRIX_WEBHOOK_URL);
}

function getWebhook() {
  const url = process.env.BITRIX_WEBHOOK_URL;
  if (!url) throw new Error("BITRIX_WEBHOOK_URL is required");
  // Ensure trailing slash so we can append <method>.json cleanly.
  return url.endsWith("/") ? url : url + "/";
}

async function bitrixCall(method, params = {}) {
  const base = getWebhook();
  const url = `${base}${method}.json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bitrix24 ${method} ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(`Bitrix24 ${method}: ${data.error_description || data.error}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Walk the paginated list endpoints. Bitrix returns `next` for cursor; we
// keep going until it's missing. Hard cap at 1000 records to avoid runaway.
async function bitrixList(method, params = {}) {
  const all = [];
  let start = 0;
  for (let page = 0; page < 20; page++) {
    const res = await bitrixCall(method, { ...params, start });
    const batch = res.result || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (typeof res.next !== "number") break;
    start = res.next;
  }
  return all;
}

// Lookup tables — small, can be cached per-process.
let _leadStatusCache = null;
let _dealStagesCache = null;

async function getLeadStatuses() {
  if (_leadStatusCache) return _leadStatusCache;
  const res = await bitrixCall("crm.status.list", {
    filter: { ENTITY_ID: "STATUS" },
    order: { SORT: "ASC" },
  });
  _leadStatusCache = (res.result || []).reduce((map, s) => {
    map[s.STATUS_ID] = s;
    return map;
  }, {});
  return _leadStatusCache;
}

async function getDealStages() {
  if (_dealStagesCache) return _dealStagesCache;
  // crm.dealcategory.stage.list requires a category id; default category is 0.
  const res = await bitrixCall("crm.dealcategory.stage.list", { id: 0 });
  _dealStagesCache = (res.result || []).reduce((map, s) => {
    map[s.STATUS_ID] = s;
    return map;
  }, {});
  return _dealStagesCache;
}

// Lead status semantics (default Bitrix taxonomy):
//   NEW, IN_PROCESS, PROCESSED — qualified-in-progress
//   CONVERTED                  — qualified, converted to deal/contact (good)
//   JUNK                       — junk
// Custom installs may add their own STATUS_IDs. We treat:
//   STATUS_ID === "JUNK" → junk
//   STATUS_ID === "CONVERTED" → converted (counts toward qualified)
//   anything else → qualified-in-progress
function classifyLead(lead) {
  const s = String(lead.STATUS_ID || "").toUpperCase();
  if (s === "JUNK") return "junk";
  if (s === "CONVERTED") return "converted";
  return "qualified";
}

// Deal stage semantics:
//   STAGE_SEMANTICS = "S" → success (won)
//   STAGE_SEMANTICS = "F" → failure (lost)
//   STAGE_SEMANTICS = "P" → in progress (preparation)
function classifyDeal(deal, stages) {
  const stage = stages[deal.STAGE_ID];
  const semantics = stage?.SEMANTICS;
  if (semantics === "S") return "won";
  if (semantics === "F") return "lost";
  return "in_progress";
}

function summarizeLeads(leads) {
  const byStatus = { junk: 0, qualified: 0, converted: 0 };
  const bySource = {};
  for (const lead of leads) {
    const cls = classifyLead(lead);
    byStatus[cls]++;
    const src = lead.SOURCE_ID || "(none)";
    bySource[src] = (bySource[src] || 0) + 1;
  }
  const total = leads.length;
  const junkRate = total > 0 ? byStatus.junk / total : 0;
  const sources = Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));
  return { total, ...byStatus, junkRate: Number(junkRate.toFixed(3)), sources };
}

function summarizeDeals(deals, stages) {
  const byClass = { won: 0, lost: 0, in_progress: 0 };
  let wonValue = 0;
  let pipelineValue = 0; // open deals only
  let lostValue = 0;
  for (const deal of deals) {
    const cls = classifyDeal(deal, stages);
    byClass[cls]++;
    const value = Number(deal.OPPORTUNITY || 0);
    if (cls === "won") wonValue += value;
    else if (cls === "lost") lostValue += value;
    else pipelineValue += value;
  }
  return {
    total: deals.length,
    ...byClass,
    won_value: Math.round(wonValue),
    pipeline_value: Math.round(pipelineValue),
    lost_value: Math.round(lostValue),
  };
}

// Build a Bitrix24 date filter for DATE_CREATE within [startDate, endDate].
// Bitrix expects ISO 8601 with timezone — yyyy-mm-ddT00:00:00 in portal tz.
function dateRangeFilter(startDate, endDate) {
  return {
    ">=DATE_CREATE": `${startDate}T00:00:00`,
    "<=DATE_CREATE": `${endDate}T23:59:59`,
  };
}

async function fetchPeriod(startDate, endDate, stages) {
  const filter = dateRangeFilter(startDate, endDate);
  const [leads, deals] = await Promise.all([
    bitrixList("crm.lead.list", {
      filter,
      select: ["ID", "STATUS_ID", "SOURCE_ID", "DATE_CREATE", "OPPORTUNITY"],
    }),
    bitrixList("crm.deal.list", {
      filter,
      select: ["ID", "STAGE_ID", "OPPORTUNITY", "DATE_CREATE", "CLOSEDATE"],
    }),
  ]);
  return {
    leads: summarizeLeads(leads),
    deals: summarizeDeals(deals, stages),
  };
}

export async function fetchBitrixSnapshot({
  startDate,
  endDate,
  previousStartDate,
  previousEndDate,
}) {
  // Stage lookup is shared between current/previous so we fetch once.
  const stages = await getDealStages();

  const tasks = [fetchPeriod(startDate, endDate, stages)];
  if (previousStartDate && previousEndDate) {
    tasks.push(fetchPeriod(previousStartDate, previousEndDate, stages));
  }
  const [current, previous] = await Promise.all(tasks);

  return {
    leads: { current: current.leads, previous: previous?.leads || null },
    deals: { current: current.deals, previous: previous?.deals || null },
    fetchedAt: new Date().toISOString(),
  };
}

// Sales execution component for the Dominance Index. Uses pipeline value
// growth (open + won together) as the leading indicator. Capped at [0, 2]
// so a 200% spike doesn't blow up the index, and floored at 0 if both
// values are 0 (no opinion = neutral).
export function salesExecutionComponent(snapshot) {
  if (!snapshot?.deals?.current) return 1; // neutral when not configured / no data
  const cur = snapshot.deals.current;
  const prev = snapshot.deals.previous;

  const curTotal = (cur.won_value || 0) + (cur.pipeline_value || 0);
  const prevTotal = prev ? (prev.won_value || 0) + (prev.pipeline_value || 0) : 0;

  if (prevTotal === 0) return curTotal > 0 ? 1.25 : 1;
  const ratio = curTotal / prevTotal;
  return Math.max(0, Math.min(2, ratio));
}
