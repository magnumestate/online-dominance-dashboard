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
const periodLabel = document.getElementById("periodLabel");
const previousPeriod = document.getElementById("previousPeriod");
const leadEventsList = document.getElementById("leadEventsList");
const activityList = document.getElementById("activityList");
const sourceCount = document.getElementById("sourceCount");
const sourceTableBody = document.getElementById("sourceTableBody");

const numberFormat = new Intl.NumberFormat("ru-RU");
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

function renderList(list) {
  leadEventsList.innerHTML = "";
  if (!list || list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Lead события не указаны";
    leadEventsList.appendChild(li);
    return;
  }

  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    leadEventsList.appendChild(li);
  });
}

function renderActivityList(list) {
  activityList.innerHTML = "";
  if (!list || list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Активности не найдены";
    activityList.appendChild(li);
    return;
  }

  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.name} — ${numberFormat.format(item.count)}`;
    activityList.appendChild(li);
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

function renderLineChart(container, series, options) {
  container.innerHTML = "";
  if (!series || series.length === 0) {
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
  grid.setAttribute("stroke", "#e8e2d7");
  grid.setAttribute("stroke-width", "1");
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
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
  });

  container.appendChild(svg);
}

let lastData = null;

function renderDashboard(data) {
  sessionsValue.textContent = numberFormat.format(data.totals.sessions);
  leadsValue.textContent = numberFormat.format(data.totals.leads);
  engagementValue.textContent = percentFormat.format(data.totals.engagementRate);
  reachValue.textContent = numberFormat.format(data.totals.totalUsers);

  dominanceScore.textContent = data.dominance.index;
  dominanceStatus.textContent = data.dominance.status;
  const fillWidth = Math.min(data.dominance.index, 160) / 160;
  dominanceFill.style.width = `${Math.round(fillWidth * 100)}%`;

  periodLabel.textContent = `${data.meta.startDate} — ${data.meta.endDate}`;
  previousPeriod.textContent = `Предыдущий период: ${data.meta.previousStartDate} — ${data.meta.previousEndDate}`;

  renderList(data.meta.leadEvents);
  renderActivityList(data.activities);
  renderSourceTable(data.trafficSources);

  const sessionsSeries = data.series.map((item) => item.sessions);
  const leadsSeries = data.series.map((item) => item.leads);
  const engagementSeries = data.series.map((item) => Math.round(item.engagementRate * 100));

  renderLineChart(trafficChart, [
    { name: "Сеансы", values: sessionsSeries, color: "#0f766e" },
    { name: "Лиды", values: leadsSeries, color: "#ea6b4e" },
  ]);

  renderLineChart(engagementChart, [
    { name: "Вовлеченность", values: engagementSeries, color: "#f2b66d" },
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
