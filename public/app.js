const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const granularitySelect = document.getElementById("granularity");
const channelSelect = document.getElementById("channelGroup");
const applyButton = document.getElementById("applyFilters");

const sessionsValue = document.getElementById("sessionsValue");
const leadsValue = document.getElementById("leadsValue");
const engagementValue = document.getElementById("engagementValue");
const reachValue = document.getElementById("reachValue");
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

function renderSerp(serp) {
  serpTableHead.innerHTML = "";
  serpTableBody.innerHTML = "";

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
  sessionsValue.textContent = numberFormat.format(data.totals?.sessions || 0);
  leadsValue.textContent = numberFormat.format(data.totals?.leads || 0);
  engagementValue.textContent = percentFormat.format(data.totals?.engagementRate || 0);
  reachValue.textContent = numberFormat.format(data.totals?.totalUsers || 0);

  dominanceScore.textContent = data.dominance.index;
  dominanceStatus.textContent = data.dominance.status;
  const fillWidth = Math.min(data.dominance.index, 160) / 160;
  dominanceFill.style.width = `${Math.round(fillWidth * 100)}%`;

  periodLabel.textContent = `${data.meta.startDate} — ${data.meta.endDate}`;
  previousPeriod.textContent = `Предыдущий период: ${data.meta.previousStartDate} — ${data.meta.previousEndDate}`;

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
