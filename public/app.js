// ── Theme (must run before paint to avoid FOUC) ──
(function initTheme() {
  const stored = localStorage.getItem("theme");
  const initial = stored === "light" || stored === "dark" ? stored : "dark";
  document.documentElement.setAttribute("data-theme", initial);
  document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll(".theme-toggle button");
    function sync(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
      buttons.forEach((b) => {
        const active = b.dataset.theme === theme;
        b.setAttribute("aria-pressed", active ? "true" : "false");
        b.classList.toggle("active", active);
      });
    }
    sync(initial);
    buttons.forEach((b) => b.addEventListener("click", () => sync(b.dataset.theme)));
  });
})();

const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const granularitySelect = document.getElementById("granularity");
const channelSelect = document.getElementById("channelGroup");
const applyButton = document.getElementById("applyFilters");

const sessionsValue = document.getElementById("sessionsValue");
const leadsValue = document.getElementById("leadsValue");
const engagementValue = document.getElementById("engagementValue");
const reachValue = document.getElementById("reachValue");
const sessionsDelta = document.getElementById("sessionsDelta");
const leadsDelta = document.getElementById("leadsDelta");
const engagementDelta = document.getElementById("engagementDelta");
const reachDelta = document.getElementById("reachDelta");
const sessionsSpark = document.getElementById("sessionsSpark");
const leadsSpark = document.getElementById("leadsSpark");
const engagementSpark = document.getElementById("engagementSpark");
const reachSpark = document.getElementById("reachSpark");
const heroMetaPeriod = document.getElementById("heroMetaPeriod");
const heroMetaPrev = document.getElementById("heroMetaPrev");
const dominanceScore = document.getElementById("dominanceScore");
const dominanceStatus = document.getElementById("dominanceStatus");
const dominanceFill = document.getElementById("dominanceFill");
const trafficChart = document.getElementById("trafficChart");
const engagementChart = document.getElementById("engagementChart");
const diTrendChart = document.getElementById("diTrendChart");
const periodLabel = document.getElementById("periodLabel");
const previousPeriod = document.getElementById("previousPeriod");
const leadEventsList = document.getElementById("leadEventsList");
const activityList = document.getElementById("activityList");
const sourceCount = document.getElementById("sourceCount");
const sourceTableBody = document.getElementById("sourceTableBody");

const brandClicksEl = document.getElementById("brandClicks");
const brandImpressionsEl = document.getElementById("brandImpressions");
const nonBrandClicksEl = document.getElementById("nonBrandClicks");
const nonBrandImpressionsEl = document.getElementById("nonBrandImpressions");
const gscCtrEl = document.getElementById("gscCtr");
const gscPositionEl = document.getElementById("gscPosition");
const gscStateEl = document.getElementById("gscState");

const serpStateEl = document.getElementById("serpState");
const serpTableHead = document.getElementById("serpTableHead");
const serpTableBody = document.getElementById("serpTableBody");
const serpEngineSummary = document.getElementById("serpEngineSummary");
const serpMovers = document.getElementById("serpMovers");

const seoStateEl = document.getElementById("seoState");
const seoPctEl = document.getElementById("seoPct");
const seoFillEl = document.getElementById("seoFill");
const seoMetaEl = document.getElementById("seoMeta");
const clusterGrid = document.getElementById("clusterGrid");

const diMetaEl = document.getElementById("diMeta");
const sourceStatusList = document.getElementById("sourceStatusList");

const numberFormat = new Intl.NumberFormat("ru-RU");
const compactFormat = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 1,
});

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDates() {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start, end };
}

function setTag(el, text, mode = "ok") {
  el.textContent = text;
  el.className = mode === "ok" ? "tag" : mode === "warn" ? "tag warn" : "tag muted";
}

function computeDelta(current, previous) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current > 0 ? 1 : null; // unbounded growth — show as +100% sentinel
  return (current - previous) / previous;
}

function renderDelta(el, delta) {
  if (delta == null) {
    el.textContent = "—";
    el.className = "delta-value neutral";
    return;
  }
  const positive = delta > 0;
  const negative = delta < 0;
  const arrow = positive ? "▲" : negative ? "▼" : "·";
  const pct = Math.abs(delta * 100);
  const formatted = pct >= 1000 ? ">999" : pct.toFixed(1);
  el.innerHTML = `<span class="arrow">${arrow}</span>${formatted}%`;
  el.className = `delta-value ${positive ? "positive" : negative ? "negative" : "neutral"}`;
}

function renderSparkline(container, values, color) {
  container.innerHTML = "";
  if (!values || values.length < 2) return;
  const w = container.clientWidth || 200;
  const h = container.clientHeight || 32;
  const pad = 1.5;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const lastX = points[points.length - 1][0];
  const lastY = points[points.length - 1][1];
  const areaPath = `${linePath} L ${lastX.toFixed(2)},${h - pad} L ${pad},${h - pad} Z`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
  area.setAttribute("d", areaPath);
  area.setAttribute("fill", color);
  area.setAttribute("opacity", "0.14");
  svg.appendChild(area);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", linePath);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "1.4");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.appendChild(line);

  // Endpoint marker
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", lastX.toFixed(2));
  dot.setAttribute("cy", lastY.toFixed(2));
  dot.setAttribute("r", "1.8");
  dot.setAttribute("fill", color);
  svg.appendChild(dot);

  container.appendChild(svg);
}

function compactDate(iso) {
  if (!iso) return "—";
  // 2026-04-26 → 26.04.26
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
}

function periodLength(startISO, endISO) {
  if (!startISO || !endISO) return null;
  const a = new Date(startISO);
  const b = new Date(endISO);
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function renderList(target, list, emptyText) {
  target.innerHTML = "";
  if (!list || list.length === 0) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    target.appendChild(li);
    return;
  }
  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = typeof item === "string" ? item : `${item.name} — ${numberFormat.format(item.count)}`;
    target.appendChild(li);
  });
}

function renderSourceTable(list) {
  sourceTableBody.innerHTML = "";
  const rows = list || [];
  sourceCount.textContent = `${numberFormat.format(rows.length)} источников`;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "Источники не найдены";
    td.className = "empty-cell";
    tr.appendChild(td);
    sourceTableBody.appendChild(tr);
    return;
  }

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const values = [
      item.source,
      item.medium,
      item.channel,
      numberFormat.format(item.sessions),
      numberFormat.format(item.totalUsers),
      numberFormat.format(item.leads),
      percentFormat.format(item.leadRate),
      percentFormat.format(item.engagementRate),
    ];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index >= 3) td.className = "numeric-cell";
      tr.appendChild(td);
    });
    sourceTableBody.appendChild(tr);
  });
}

function renderLineChart(container, series) {
  container.innerHTML = "";
  if (!series || series.length === 0 || series.every((s) => !s.values?.length)) {
    container.textContent = "Нет данных";
    return;
  }

  const width = container.clientWidth || 600;
  const height = 200;
  const padding = 24;

  const allValues = series.flatMap((item) => item.values);
  const maxValue = Math.max(...allValues, 1);
  const step = (width - padding * 2) / Math.max(series[0].values.length - 1, 1);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
  grid.setAttribute("x1", padding);
  grid.setAttribute("x2", width - padding);
  grid.setAttribute("y1", height - padding);
  grid.setAttribute("y2", height - padding);
  grid.setAttribute("stroke", "rgba(245, 241, 234, 0.12)");
  grid.setAttribute("stroke-width", "1");
  grid.setAttribute("stroke-dasharray", "2 4");
  svg.appendChild(grid);

  series.forEach((line) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const points = line.values.map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    });
    const d = `M ${points.join(" L ")}`;
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", line.color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("opacity", "0.95");
    svg.appendChild(path);
  });

  container.appendChild(svg);
}

function renderGsc(gsc) {
  if (!gsc) {
    setTag(gscStateEl, "GSC не подключен", "warn");
    [brandClicksEl, nonBrandClicksEl, gscCtrEl].forEach((el) => (el.textContent = "—"));
    brandImpressionsEl.textContent = "— показов";
    nonBrandImpressionsEl.textContent = "— показов";
    gscPositionEl.textContent = "средняя позиция —";
    return;
  }

  setTag(gscStateEl, `Total: ${numberFormat.format(gsc.totals.clicks)} clicks`, "ok");

  brandClicksEl.textContent = numberFormat.format(gsc.brandSplit.brand.clicks);
  brandImpressionsEl.textContent = `${compactFormat.format(gsc.brandSplit.brand.impressions)} показов`;
  nonBrandClicksEl.textContent = numberFormat.format(gsc.brandSplit.nonBrand.clicks);
  nonBrandImpressionsEl.textContent = `${compactFormat.format(gsc.brandSplit.nonBrand.impressions)} показов`;
  gscCtrEl.textContent = percentFormat.format(gsc.totals.ctr);
  gscPositionEl.textContent = `средняя позиция ${gsc.totals.position.toFixed(1)}`;
}

function renderEngineSummary(serp) {
  if (!serpEngineSummary) return;
  serpEngineSummary.innerHTML = "";
  if (!serp || !serp.keywords || !serp.competitors) return;

  const us = serp.competitors.us.domain;
  const others = serp.competitors.competitors.map((c) => c.domain);

  const byEngine = new Map();
  let ourTop10 = 0;
  let theirTop10 = 0;

  for (const row of serp.keywords) {
    const engine = (row.engine || "google").toLowerCase();
    if (!byEngine.has(engine)) byEngine.set(engine, { total: 0, ourTop10: 0, ourBest: null });
    const bucket = byEngine.get(engine);
    bucket.total++;
    const ourPos = row.positions[us];
    if (ourPos != null) {
      if (ourPos <= 10) {
        bucket.ourTop10++;
        ourTop10++;
      }
      if (bucket.ourBest == null || ourPos < bucket.ourBest) bucket.ourBest = ourPos;
    }
    for (const d of others) {
      const p = row.positions[d];
      if (p != null && p <= 10) theirTop10++;
    }
  }

  const sharePct = ourTop10 + theirTop10 > 0
    ? Math.round((ourTop10 / (ourTop10 + theirTop10)) * 100)
    : 0;

  for (const [engine, b] of byEngine.entries()) {
    const tile = document.createElement("div");
    tile.className = `engine-tile engine-${engine}`;
    tile.innerHTML = `
      <span class="engine-tile-label">${engine}</span>
      <span class="engine-tile-stat"><b>${b.ourTop10}</b>/${b.total} <em>top-10</em></span>
      <span class="engine-tile-stat best">best <b>${b.ourBest != null ? "#" + b.ourBest : "—"}</b></span>
    `;
    serpEngineSummary.appendChild(tile);
  }

  const overall = document.createElement("div");
  overall.className = "engine-tile coverage";
  overall.innerHTML = `
    <span class="engine-tile-label">SoV in top-10</span>
    <span class="engine-tile-stat coverage-value"><b>${sharePct}%</b></span>
    <span class="engine-tile-stat"><em>наш ${ourTop10} · конкуренты ${theirTop10}</em></span>
  `;
  serpEngineSummary.appendChild(overall);
}

function renderMovers(serp) {
  if (!serpMovers) return;
  serpMovers.innerHTML = "";
  if (!serp || !serp.keywords || !serp.competitors) return;

  const us = serp.competitors.us.domain;
  const others = serp.competitors.competitors.map((c) => c.domain);

  // Where we win: keywords where we're best (lowest position) of all tracked
  const winners = serp.keywords
    .map((row) => {
      const ourPos = row.positions[us];
      if (ourPos == null) return null;
      const competitorBest = Math.min(
        Infinity,
        ...others.map((d) => row.positions[d]).filter((p) => p != null)
      );
      const lead = competitorBest === Infinity ? Infinity : competitorBest - ourPos;
      return { keyword: row.keyword, engine: row.engine, ourPos, competitorBest, lead };
    })
    .filter((x) => x && x.lead > 0)
    .sort((a, b) => a.ourPos - b.ourPos)
    .slice(0, 3);

  // Where we miss most: keyword where competitor is in top-5 and we're absent
  const opportunities = serp.keywords
    .map((row) => {
      const ourPos = row.positions[us];
      if (ourPos != null) return null;
      const compPositions = others
        .map((d) => ({ domain: d, pos: row.positions[d] }))
        .filter((x) => x.pos != null && x.pos <= 5);
      if (compPositions.length === 0) return null;
      compPositions.sort((a, b) => a.pos - b.pos);
      return { keyword: row.keyword, engine: row.engine, leader: compPositions[0] };
    })
    .filter(Boolean)
    .sort((a, b) => a.leader.pos - b.leader.pos)
    .slice(0, 3);

  // Open SERP: nobody in top-10 — pure white space
  const open = serp.keywords
    .map((row) => {
      const everyone = [us, ...others].map((d) => row.positions[d]);
      const minPos = Math.min(Infinity, ...everyone.filter((p) => p != null));
      return { keyword: row.keyword, engine: row.engine, minPos };
    })
    .filter((x) => x.minPos === Infinity || x.minPos > 10)
    .slice(0, 3);

  const competitorByDomain = new Map(
    [serp.competitors.us, ...serp.competitors.competitors].map((c) => [c.domain, c.name])
  );
  const engineLabel = (e) => (e && e !== "google" ? `<span class="mover-engine">${e}</span>` : "");
  const card = (slug, title, items, emptyText, kind) => {
    const lis = items.length
      ? items.map((it) => kind(it)).join("")
      : `<li class="mover-empty">${emptyText}</li>`;
    return `
      <div class="mover-card mover-${slug}">
        <div class="mover-title">${title}</div>
        <ol class="mover-list">${lis}</ol>
      </div>
    `;
  };

  const winHTML = card(
    "winning",
    "Где выигрываем",
    winners,
    "Нет ключей, где мы впереди всех",
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${engineLabel(it.engine)}</span>
        <span class="mover-stat"><b>#${it.ourPos}</b>${it.competitorBest === Infinity ? "" : ` <em>vs #${it.competitorBest}</em>`}</span>
      </li>
    `
  );

  const oppHTML = card(
    "missing",
    "Где упускаем",
    opportunities,
    "Конкуренты не доминируют ни в одном ключе",
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${engineLabel(it.engine)}</span>
        <span class="mover-stat"><em>${competitorByDomain.get(it.leader.domain) || it.leader.domain}</em> <b>#${it.leader.pos}</b></span>
      </li>
    `
  );

  const openHTML = card(
    "open",
    "SERP открыта",
    open,
    "Все ключи закрыты конкурентами",
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${engineLabel(it.engine)}</span>
        <span class="mover-stat"><em>топ-10 пуст</em></span>
      </li>
    `
  );

  serpMovers.innerHTML = winHTML + oppHTML + openHTML;
}

function renderSerp(serp) {
  serpTableHead.innerHTML = "";
  serpTableBody.innerHTML = "";
  renderEngineSummary(serp);
  renderMovers(serp);

  if (!serp || !serp.keywords || serp.keywords.length === 0) {
    setTag(serpStateEl, "SERP snapshot не загружен", "warn");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = "Нет данных. Запустите /api/snapshot для первого сбора.";
    td.className = "empty-cell";
    tr.appendChild(td);
    serpTableBody.appendChild(tr);
    return;
  }

  const competitors = serp.competitors;
  const ourDomain = competitors.us.domain;
  const allDomains = [competitors.us, ...competitors.competitors];

  setTag(
    serpStateEl,
    `${serp.keywords.length} ключей · snapshot ${serp.snapshotDate || "—"}`,
    "ok"
  );

  const headers = ["Запрос", ...allDomains.map((c) => c.name)];
  headers.forEach((label, idx) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (idx === 1) th.className = "us-col";
    serpTableHead.appendChild(th);
  });

  serp.keywords.forEach((row) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const engine = (row.engine || "google").toLowerCase();
    tdName.innerHTML =
      engine !== "google"
        ? `${row.keyword}<span class="engine-badge ${engine}">${engine}</span>`
        : row.keyword;
    tr.appendChild(tdName);

    const positions = allDomains.map((c) => row.positions[c.domain]);
    const present = positions.filter((p) => p != null);
    const best = present.length ? Math.min(...present) : null;

    positions.forEach((pos, i) => {
      const td = document.createElement("td");
      if (pos == null) {
        td.textContent = "—";
        td.className = "pos-none";
      } else {
        td.textContent = pos;
        if (best != null && pos === best) td.className = "pos-best";
      }
      tr.appendChild(td);
    });

    serpTableBody.appendChild(tr);
  });
}

function renderSeoProgress(seo) {
  clusterGrid.innerHTML = "";
  if (!seo) {
    setTag(seoStateEl, "Sheet не подключен", "warn");
    seoPctEl.textContent = "—";
    seoMetaEl.textContent = "—";
    seoFillEl.style.width = "0%";
    return;
  }

  setTag(seoStateEl, `snapshot ${seo.snapshotDate || "—"}`, "ok");
  seoPctEl.textContent = percentFormat.format(seo.pct);
  seoFillEl.style.width = `${Math.round(seo.pct * 100)}%`;
  seoMetaEl.textContent = `${seo.done} done · ${seo.notDone} в работе · всего ${seo.total}`;

  (seo.clusters || []).forEach((cluster) => {
    const card = document.createElement("div");
    card.className = "cluster-card";
    card.innerHTML = `
      <div class="name">${cluster.cluster}</div>
      <div class="stats">
        <span class="pct">${Math.round(cluster.pct * 100)}%</span>
        <span class="ratio">${cluster.done}/${cluster.total}</span>
      </div>
      <div class="mini-bar"><div class="fill" style="width:${Math.round(cluster.pct * 100)}%"></div></div>
    `;
    clusterGrid.appendChild(card);
  });
}

function renderDominanceTrend(history, currentIndex) {
  if (!history || history.length === 0) {
    diTrendChart.textContent = currentIndex != null ? `Текущий индекс: ${currentIndex}. История появится после первых snapshot'ов.` : "Нет данных";
    diMetaEl.textContent = "—";
    return;
  }
  const values = history.map((h) => h.index);
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  diMetaEl.textContent = `${first} → ${last} (${delta >= 0 ? "+" : ""}${delta})`;
  renderLineChart(diTrendChart, [{ name: "Index", values, color: "#e1c282" }]);
}

function renderSourceStatus(sources) {
  sourceStatusList.innerHTML = "";
  if (!sources) return;
  const labels = {
    ga4: "Google Analytics 4",
    gsc: "Search Console",
    serp: "Bright Data (SERP)",
    seoProgress: "SEO Progress (Sheets)",
  };
  Object.entries(sources).forEach(([key, info]) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = labels[key] || key;
    const status = document.createElement("span");
    if (!info.configured) {
      status.textContent = "не настроено";
      status.className = "miss";
    } else if (info.ok === false || (info.cached === false && info.configured)) {
      status.textContent = info.error || "нет данных";
      status.className = "miss";
    } else {
      status.textContent = info.date ? `snapshot ${info.date}` : "ок";
      status.className = "ok";
    }
    li.appendChild(name);
    li.appendChild(status);
    sourceStatusList.appendChild(li);
  });
}

let lastData = null;

function renderDashboard(data) {
  const totals = data.totals || {};
  const prev = data.previousTotals || {};

  sessionsValue.textContent = numberFormat.format(totals.sessions || 0);
  leadsValue.textContent = numberFormat.format(totals.leads || 0);
  engagementValue.textContent = percentFormat.format(totals.engagementRate || 0);
  reachValue.textContent = numberFormat.format(totals.totalUsers || 0);

  renderDelta(sessionsDelta, computeDelta(totals.sessions, prev.sessions));
  renderDelta(leadsDelta, computeDelta(totals.leads, prev.leads));
  renderDelta(engagementDelta, computeDelta(totals.engagementRate, prev.engagementRate));
  renderDelta(reachDelta, computeDelta(totals.totalUsers, prev.totalUsers));

  const series = data.series || [];
  renderSparkline(sessionsSpark, series.map((s) => s.sessions), "#c9a96e");
  renderSparkline(leadsSpark, series.map((s) => s.leads), "#d4685a");
  renderSparkline(engagementSpark, series.map((s) => s.engagementRate), "#84b685");
  renderSparkline(reachSpark, series.map((s) => s.totalUsers), "#c9a96e");

  dominanceScore.textContent = data.dominance.index;
  dominanceStatus.textContent = data.dominance.status;
  const statusSlug = String(data.dominance.status || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
  dominanceStatus.className = `dominance-status status-${statusSlug || "unknown"}`;
  const fillWidth = Math.min(data.dominance.index, 160) / 160;
  dominanceFill.style.width = `${Math.round(fillWidth * 100)}%`;

  const periodDays = periodLength(data.meta.startDate, data.meta.endDate);
  if (heroMetaPeriod) {
    heroMetaPeriod.textContent = `Period · ${compactDate(data.meta.startDate)} → ${compactDate(data.meta.endDate)}${periodDays ? ` · ${periodDays}D` : ""}`;
  }
  if (heroMetaPrev) {
    heroMetaPrev.textContent = `Previous · ${compactDate(data.meta.previousStartDate)} → ${compactDate(data.meta.previousEndDate)}`;
  }

  periodLabel.textContent = `${compactDate(data.meta.startDate)} → ${compactDate(data.meta.endDate)}`;
  previousPeriod.textContent = `Previous · ${compactDate(data.meta.previousStartDate)} → ${compactDate(data.meta.previousEndDate)}`;

  renderList(leadEventsList, data.meta.leadEvents, "Lead события не указаны");
  renderList(activityList, data.activities, "Активности не найдены");
  renderSourceTable(data.trafficSources);
  renderGsc(data.gsc);
  renderSerp(data.serp);
  renderSeoProgress(data.seoProgress);
  renderDominanceTrend(data.dominanceHistory, data.dominance.index);
  renderSourceStatus(data.sources);

  const sessionsSeries = (data.series || []).map((item) => item.sessions);
  const leadsSeries = (data.series || []).map((item) => item.leads);
  const engagementSeries = (data.series || []).map((item) => Math.round(item.engagementRate * 100));

  renderLineChart(trafficChart, [
    { name: "Сеансы", values: sessionsSeries, color: "#c9a96e" },
    { name: "Лиды", values: leadsSeries, color: "#d4685a" },
  ]);
  renderLineChart(engagementChart, [
    { name: "Вовлеченность", values: engagementSeries, color: "#84b685" },
  ]);
}

async function loadDashboard() {
  const params = new URLSearchParams({
    startDate: startInput.value,
    endDate: endInput.value,
    granularity: granularitySelect.value,
    channelGroup: channelSelect.value,
  });

  const response = await fetch(`/api/dashboard?${params.toString()}`);
  if (!response.ok) {
    trafficChart.textContent = "Ошибка загрузки данных";
    return;
  }
  const data = await response.json();
  lastData = data;
  renderDashboard(data);
}

const { start, end } = defaultDates();
startInput.value = toISODate(start);
endInput.value = toISODate(end);

applyButton.addEventListener("click", () => {
  loadDashboard();
});

window.addEventListener("resize", () => {
  if (lastData) renderDashboard(lastData);
});

loadDashboard();
