import { google } from "googleapis";

let sheets = null;

function getClient() {
  if (sheets) return sheets;
  const keyFile = process.env.SHEETS_SERVICE_ACCOUNT_KEYFILE || process.env.GA4_SERVICE_ACCOUNT_KEYFILE;
  if (!keyFile) throw new Error("SHEETS_SERVICE_ACCOUNT_KEYFILE (or GA4_SERVICE_ACCOUNT_KEYFILE) is required");
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

export function isConfigured() {
  return Boolean(
    process.env.SEO_PROGRESS_SHEET_ID &&
      (process.env.SHEETS_SERVICE_ACCOUNT_KEYFILE || process.env.GA4_SERVICE_ACCOUNT_KEYFILE)
  );
}

function normalizeStatus(value) {
  if (!value) return "unknown";
  const v = String(value).trim().toLowerCase();
  if (v === "done" || v === "✅" || v === "yes" || v === "complete" || v === "completed") return "done";
  if (v === "not done" || v === "no" || v === "todo" || v === "pending" || v === "in progress") return "not_done";
  return "unknown";
}

export async function fetchSeoProgress() {
  const sheetId = process.env.SEO_PROGRESS_SHEET_ID;
  if (!sheetId) throw new Error("SEO_PROGRESS_SHEET_ID is required");

  const client = getClient();
  const meta = await client.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetTitles = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);

  const ranges = sheetTitles.map((t) => `${t}!A1:H1000`);
  const res = await client.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges,
  });

  const items = [];
  const byCluster = new Map();

  for (const valueRange of res.data.valueRanges || []) {
    const range = valueRange.range || "";
    const sheetName = range.split("!")[0].replace(/^'|'$/g, "");
    const rows = valueRange.values || [];
    if (rows.length === 0) continue;

    const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
    const titleIdx = header.findIndex((h) => h.includes("title") || h.includes("topic"));
    const urlIdx = header.findIndex((h) => h.includes("url"));
    const categoryIdx = header.findIndex((h) => h.includes("category"));
    const clusterIdx = header.findIndex((h) => h.includes("cluster"));

    // Status column is often unlabeled (header trims trailing empties) — scan
    // data rows to find the column whose values match Done/Not Done patterns.
    const STATUS_RE = /^(done|not\s*done|in\s*progress|completed?|todo|pending|✅|✓)$/i;
    function findStatus(row) {
      for (let c = row.length - 1; c >= 0; c--) {
        const cell = String(row[c] || "").trim();
        if (cell && STATUS_RE.test(cell)) return cell;
      }
      return "";
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const title = titleIdx >= 0 ? row[titleIdx] : row[1];
      if (!title) continue;
      const url = urlIdx >= 0 ? row[urlIdx] : "";
      const category = categoryIdx >= 0 ? row[categoryIdx] : "";
      const cluster = clusterIdx >= 0 ? row[clusterIdx] : "";
      const status = normalizeStatus(findStatus(row));

      const item = { sheet: sheetName, title, url, category, cluster, status };
      items.push(item);

      const key = cluster || category || sheetName;
      if (!byCluster.has(key)) byCluster.set(key, { cluster: key, total: 0, done: 0 });
      const bucket = byCluster.get(key);
      bucket.total++;
      if (status === "done") bucket.done++;
    }
  }

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const pct = total > 0 ? done / total : 0;

  const clusters = Array.from(byCluster.values())
    .map((c) => ({ ...c, pct: c.total > 0 ? c.done / c.total : 0 }))
    .sort((a, b) => b.total - a.total);

  return {
    total,
    done,
    notDone: total - done,
    pct,
    clusters,
    items,
  };
}
