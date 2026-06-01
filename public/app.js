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

// ─────────────────────────── i18n ───────────────────────────

const messages = {
  ru: {
    "topbar.dark": "Dark",
    "topbar.light": "Light",

    "hero.subhead":
      "Сводный показатель присутствия Magnum Estate в digital и AI-канале. Web Dominance объединяет органический поиск, позиции против конкурентов, конверсию и SEO-исполнение. AI Visibility измеряет долю бренда в ответах ChatGPT, Claude, Perplexity и YandexGPT на ключевые prompt-семьи.",
    "hero.currentValue": "Текущее значение",
    "hero.scaleHint": "100 = стабильность · 130+ = доминирование",
    "hero.period": "PERIOD",
    "hero.previous": "PREVIOUS",

    "dom.total.formula":
      "Композит из Web Dominance и AI Visibility, взвешенный по их влиянию на цифровой канал.",
    "dom.web.formula":
      "GA4 + GSC + Bitrix24. non-brand 40% · лиды 25% · трафик 20% · sales 15%.",
    "dom.ai.formula":
      "Probe ChatGPT / Claude / Perplexity / YandexGPT по 32 prompt-семьям. SOV 40% · рост 30% · позитивный sentiment 20% · цитирования 10%.",

    "controls.from": "Период · от",
    "controls.to": "Период · до",
    "controls.step": "Шаг",
    "controls.day": "День",
    "controls.week": "Неделя",
    "controls.month": "Месяц",
    "controls.channel": "Канал",
    "controls.allSources": "Все источники",
    "controls.social": "Социальные",
    "controls.refresh": "Обновить",

    "s01.title": "Объёмы и конверсия за период",
    "s01.desc": "Google Analytics 4 — сеансы, лиды, вовлечённость, охват уникальных пользователей.",
    "s01.vsPrev": "vs prev",

    "s02.desc": "Search Console: бренд работает, рост non-brand — главный приоритет квартала.",
    "s02.impressions": "показов",
    "s02.avgPos": "средняя позиция",

    "s03.title": "Позиции Magnum Estate vs конкуренты",
    "s03.desc": "Weekly snapshot через Bright Data SERP API — Google + Yandex. Лучшая позиция в строке выделена золотом.",
    "s03.queryHeader": "Запрос",
    "s03.snapshot": "snapshot",
    "s03.keys": "ключей",
    "s03.filtersOn": "фильтры",
    "s03.empty": "Нет данных. Запустите /api/snapshot для первого сбора.",
    "s03.filteredEmpty": "Под выбранные фильтры ключи не подходят.",
    "s03.notLoaded": "SERP snapshot не загружен",

    "s03.filter.nonBrand": "Только non-brand",
    "s03.filter.yandex":   "Только Yandex",
    "s03.filter.missing":  "Где мы вне ТОП-100",

    "s03.engine.google": "google",
    "s03.engine.yandex": "yandex",
    "s03.engine.top10":  "top-10",
    "s03.engine.best":   "best",
    "s03.engine.sov":    "SoV in top-10",
    "s03.engine.us":     "наш",
    "s03.engine.them":   "конкуренты",

    "movers.synth.winning.title": "Где выигрываем",
    "movers.synth.winning.empty": "Нет ключей, где мы впереди всех",
    "movers.synth.missing.title": "Где упускаем",
    "movers.synth.missing.empty": "Конкуренты не доминируют ни в одном ключе",
    "movers.synth.open.title":    "SERP открыта",
    "movers.synth.open.empty":    "Все ключи закрыты конкурентами",
    "movers.synth.openLabel":     "топ-10 пуст",
    "movers.synth.vs":            "vs",

    "movers.diff.up.title":    "▲ Поднялись",
    "movers.diff.up.empty":    "Нет улучшений с прошлого snapshot'а",
    "movers.diff.down.title":  "▼ Просели",
    "movers.diff.down.empty":  "Нет проседаний — отлично",
    "movers.diff.churn.title": "Новые / потеряли",
    "movers.diff.churn.empty": "Нет смены состава топ-100",
    "movers.diff.new":         "★ NEW",
    "movers.diff.lost":        "✖ LOST",
    "movers.diff.was":         "было",
    "movers.diff.metaVs":      "vs",
    "movers.diff.metaCompared":"keys compared",
    "movers.diff.metaStable":  "stable",

    "s03b.title": "Где конкуренты обходят нас",
    "s03b.desc":
      "Пересечение GSC (мы там ранжируемся) и SERP (где они выше). Эти ключи — самые легкие апсайды: уже виден сигнал релевантности, осталось обогнать одного игрока.",
    "s03b.foundLeft":  "Найдено",
    "s03b.foundRight": "пересечений · показаны",
    "s03b.foundEnd":   "с самым большим разрывом",
    "s03b.ourGsc":  "наш GSC",
    "s03b.clicks":  "clicks",
    "s03b.impr":    "impr",
    "s03b.emptyNoData":
      "Для этой секции нужны одновременно GSC и SERP snapshot. Когда оба будут доступны — здесь появятся ключи, по которым мы ранжируемся, но конкуренты выше.",
    "s03b.emptyClean":
      "Нет ключей, где мы ранжируемся, но конкурент впереди ≥2 позиций. Это хорошо: вы либо лидер, либо не пересекаетесь.",

    "s04.title": "Источники трафика",
    "s04.desc":  "Source / medium / channel из GA4 с разбивкой по сеансам, лидам и lead rate.",
    "s04.sources":   "источников",
    "s04.empty":     "Источники не найдены",

    "s05.desc":      "Прогресс по контент-плану — Authoritative Content sheet.",
    "s05.notConnected": "Sheet не подключен",
    "s05.metaDone":  "done",
    "s05.metaInProgress": "в работе",
    "s05.metaTotal": "всего",

    "s06.title": "Динамика за период",
    "s06.desc":  "Трафик и лиды, тренд индекса доминирования, вовлечённость.",
    "s06.thirtyDays": "30 дней",
    "s06.dataMissing": "Нет данных",
    "s06.indexNow":    "Текущий индекс",
    "s06.historyHint": "История появится после первых snapshot'ов.",

    "s07.title": "Методология и контекст",
    "s07.desc":  "Веса индекса, отслеживаемые события, статус источников.",
    "s07.indexExplain":
      "Dominance Index 2.2 объединяет рост non-brand, рост лидов, рост трафика и pipeline в Bitrix24.",
    "s07.noLeadEvents":   "Lead события не указаны",
    "s07.noActivities":   "Активности не найдены",
    "s07.gscDisconnected": "GSC не подключен",
    "s07.gscTotal": "Total",

    "src.notConfigured": "не настроено",
    "src.noData":        "нет данных",
    "src.ok":            "ок",
    "src.snapshot":      "snapshot",

    "footer.previous": "Previous",

    // AI Visibility (section 06)
    "aiVis.title": "Бренд в ответах LLM и Google AI Overviews",
    "aiVis.desc":  "Probe: ~30 prompt-семей × включённые движки (Claude, ChatGPT, Perplexity, YandexGPT) — еженедельный замер Share of Voice, sentiment и цитирования. AI Overviews: реальные блоки Google AI на отслеживаемых ключах.",
    "aiVis.opportunities": "Топ возможностей (где конкуренты упомянуты, мы — нет)",
    "aiVis.notConfigured": "AI probe не подключён (нет API-ключей)",
    "aiVis.noData":        "нет данных за эту неделю",
    "aiVis.responsesShort": "ответов",
    "aiVis.allResponses":  "всего ответов",
    "aiVis.brandMentionsTotal": "brand mentions из",
    "aiVis.brandMentionsTotal2": "ответов",
    "aiVis.ofMentions":    "от упоминаний",
    "aiVis.classified":    "ответов классифицировано Haiku 4.5",
    "aiVis.sentimentNotRun": "Sentiment ещё не запускался",
    "aiVis.classifierMissing": "Classifier не настроен (нет ANTHROPIC_API_KEY)",
    "aiVis.scoreLabel":    "score",
    "aiVis.noWeek":        "Нет AI-данных за эту неделю",
    "aiVis.cards.wins":    "Где Magnum цитируют",
    "aiVis.cards.threats": "Угрозы (конкуренты цитируются, мы — нет)",
    "aiVis.cards.blue":    "Blue ocean (AI Overview есть, никто не цитирован)",
    "aiVis.opp.empty":     "Нет данных. Запустите /api/snapshot после настройки ANTHROPIC_API_KEY (и при желании OPENAI/PERPLEXITY/YANDEX).",
    "aiVis.opp.cleanRu":   "Конкуренты пока не доминируют в AI Overviews.",
    "aiVis.opp.compInAio": "конкуренты в AI Overview",

    // Sales Pipeline / Bitrix (section 08)
    "sales.title": "Лиды и сделки в Bitrix24",
    "sales.desc":  "Реальные CRM-данные: лиды по статусу и источнику, активные сделки и стоимость pipeline.",
    "sales.totalForPeriod": "Всего за период",
    "sales.topLeadsTitle": "Top lead sources",
    "sales.topLeadsDesc":  "Откуда пришли лиды за выбранный период.",
    "sales.notConnected":  "Bitrix не подключен",
    "sales.empty":         "Источники не найдены",

    // Executive Brief (section 09)
    "brief.title": "Еженедельная сводка",
    "brief.desc":  "Автоматический нарратив, собранный из всех источников выше. Генерируется раз в неделю.",
    "brief.placeholder": "Сводка появится после первого weekly snapshot'а с настроенным ANTHROPIC_API_KEY.",
    "brief.grew": "Что выросло",
    "brief.slipped": "Где проседаем",
    "brief.actions": "Действия на следующую неделю",
    "brief.watch": "Следить дальше",
    "brief.notConfigured": "Brief не настроен",
  },

  en: {
    "topbar.dark": "Dark",
    "topbar.light": "Light",

    "hero.subhead":
      "Aggregate measure of Magnum Estate's digital and AI presence. Web Dominance combines organic search, positions vs competitors, conversion, and SEO execution. AI Visibility tracks brand share-of-voice in ChatGPT, Claude, Perplexity and YandexGPT responses to tracked prompt families.",
    "hero.currentValue": "Current value",
    "hero.scaleHint": "100 = stable · 130+ = dominating",
    "hero.period": "PERIOD",
    "hero.previous": "PREVIOUS",

    "dom.total.formula":
      "Composite of Web Dominance and AI Visibility, weighted by their influence on the digital channel.",
    "dom.web.formula":
      "GA4 + GSC + Bitrix24. non-brand 40% · leads 25% · traffic 20% · sales 15%.",
    "dom.ai.formula":
      "Probe of ChatGPT / Claude / Perplexity / YandexGPT across 32 prompt families. SOV 40% · growth 30% · positive sentiment 20% · citations 10%.",

    "controls.from": "Period · from",
    "controls.to": "Period · to",
    "controls.step": "Step",
    "controls.day": "Day",
    "controls.week": "Week",
    "controls.month": "Month",
    "controls.channel": "Channel",
    "controls.allSources": "All sources",
    "controls.social": "Social",
    "controls.refresh": "Refresh",

    "s01.title": "Volumes and conversion for the period",
    "s01.desc": "Google Analytics 4 — sessions, leads, engagement, reach of unique users.",
    "s01.vsPrev": "vs prev",

    "s02.desc": "Search Console: brand is working; growing non-brand is the main quarterly priority.",
    "s02.impressions": "impressions",
    "s02.avgPos": "avg position",

    "s03.title": "Magnum Estate positions vs competitors",
    "s03.desc": "Weekly snapshot via Bright Data SERP API — Google + Yandex. Best position in row highlighted in gold.",
    "s03.queryHeader": "Query",
    "s03.snapshot": "snapshot",
    "s03.keys": "keys",
    "s03.filtersOn": "filters",
    "s03.empty": "No data. Run /api/snapshot for the first collection.",
    "s03.filteredEmpty": "No keywords match the selected filters.",
    "s03.notLoaded": "SERP snapshot not loaded",

    "s03.filter.nonBrand": "Non-brand only",
    "s03.filter.yandex":   "Yandex only",
    "s03.filter.missing":  "Where we're out of TOP-100",

    "s03.engine.google": "google",
    "s03.engine.yandex": "yandex",
    "s03.engine.top10":  "top-10",
    "s03.engine.best":   "best",
    "s03.engine.sov":    "SoV in top-10",
    "s03.engine.us":     "us",
    "s03.engine.them":   "competitors",

    "movers.synth.winning.title": "Where we lead",
    "movers.synth.winning.empty": "No keywords where we beat all competitors",
    "movers.synth.missing.title": "Where we miss",
    "movers.synth.missing.empty": "Competitors don't dominate any tracked keyword",
    "movers.synth.open.title":    "SERP is open",
    "movers.synth.open.empty":    "All keywords claimed by competitors",
    "movers.synth.openLabel":     "top-10 empty",
    "movers.synth.vs":            "vs",

    "movers.diff.up.title":    "▲ Risers",
    "movers.diff.up.empty":    "No improvements since last snapshot",
    "movers.diff.down.title":  "▼ Fallers",
    "movers.diff.down.empty":  "No drops — clean week",
    "movers.diff.churn.title": "New / Lost",
    "movers.diff.churn.empty": "No turnover in top-100",
    "movers.diff.new":         "★ NEW",
    "movers.diff.lost":        "✖ LOST",
    "movers.diff.was":         "was",
    "movers.diff.metaVs":      "vs",
    "movers.diff.metaCompared":"keys compared",
    "movers.diff.metaStable":  "stable",

    "s03b.title": "Where competitors outrank us",
    "s03b.desc":
      "Intersection of GSC (we already rank there) and SERP (where they sit higher). These keywords are the easiest upgrades — relevance signal exists, only one player to overtake.",
    "s03b.foundLeft":  "Found",
    "s03b.foundRight": "intersections · showing",
    "s03b.foundEnd":   "with the largest gap",
    "s03b.ourGsc":  "our GSC",
    "s03b.clicks":  "clicks",
    "s03b.impr":    "impr",
    "s03b.emptyNoData":
      "This section needs both GSC and SERP snapshots. Once both are available, you'll see the keywords where you rank but competitors rank higher.",
    "s03b.emptyClean":
      "No keywords where we rank but a competitor leads by ≥2 positions. That's good: either you're the leader, or there's no overlap.",

    "s04.title": "Traffic sources",
    "s04.desc":  "Source / medium / channel from GA4 broken down by sessions, leads, and lead rate.",
    "s04.sources":   "sources",
    "s04.empty":     "No sources found",

    "s05.desc":      "Content plan progress — Authoritative Content sheet.",
    "s05.notConnected": "Sheet not connected",
    "s05.metaDone":  "done",
    "s05.metaInProgress": "in progress",
    "s05.metaTotal": "total",

    "s06.title": "Time series for the period",
    "s06.desc":  "Traffic and leads, dominance index trend, engagement.",
    "s06.thirtyDays": "30 days",
    "s06.dataMissing": "No data",
    "s06.indexNow":    "Current index",
    "s06.historyHint": "History will appear after the first snapshots.",

    "s07.title": "Methodology and context",
    "s07.desc":  "Index weights, tracked events, source status.",
    "s07.indexExplain":
      "Dominance Index 2.2 combines non-brand growth, lead growth, traffic growth, and Bitrix24 pipeline.",
    "s07.noLeadEvents":   "No lead events specified",
    "s07.noActivities":   "No activity events found",
    "s07.gscDisconnected": "GSC not connected",
    "s07.gscTotal": "Total",

    "src.notConfigured": "not configured",
    "src.noData":        "no data",
    "src.ok":            "ok",
    "src.snapshot":      "snapshot",

    "footer.previous": "Previous",

    // AI Visibility (section 06)
    "aiVis.title": "Brand in LLM responses and Google AI Overviews",
    "aiVis.desc":  "Probe: ~30 prompt families × enabled engines (Claude, ChatGPT, Perplexity, YandexGPT) — weekly Share of Voice, sentiment and citation tracking. AI Overviews: real Google AI blocks on tracked keywords.",
    "aiVis.opportunities": "Top opportunities (competitors mentioned, we are not)",
    "aiVis.notConfigured": "AI probe not connected (no API keys)",
    "aiVis.noData":        "no data this week",
    "aiVis.responsesShort": "responses",
    "aiVis.allResponses":  "total responses",
    "aiVis.brandMentionsTotal": "brand mentions out of",
    "aiVis.brandMentionsTotal2": "responses",
    "aiVis.ofMentions":    "of mentions",
    "aiVis.classified":    "responses classified by Haiku 4.5",
    "aiVis.sentimentNotRun": "Sentiment hasn't run yet",
    "aiVis.classifierMissing": "Classifier not configured (no ANTHROPIC_API_KEY)",
    "aiVis.scoreLabel":    "score",
    "aiVis.noWeek":        "No AI data for this week",
    "aiVis.cards.wins":    "Where Magnum is cited",
    "aiVis.cards.threats": "Threats (competitors cited, we're not)",
    "aiVis.cards.blue":    "Blue ocean (AI Overview present, no one cited)",
    "aiVis.opp.empty":     "No data. Run /api/snapshot after configuring ANTHROPIC_API_KEY (and optionally OPENAI / PERPLEXITY / YANDEX).",
    "aiVis.opp.cleanRu":   "Competitors don't dominate AI Overviews yet.",
    "aiVis.opp.compInAio": "competitors in AI Overview",

    // Sales Pipeline / Bitrix (section 08)
    "sales.title": "Leads and deals in Bitrix24",
    "sales.desc":  "Real CRM data: leads by status and source, open deals, pipeline value.",
    "sales.totalForPeriod": "Total for period",
    "sales.topLeadsTitle": "Top lead sources",
    "sales.topLeadsDesc":  "Where leads came from in the selected period.",
    "sales.notConnected":  "Bitrix not connected",
    "sales.empty":         "No sources found",

    // Executive Brief (section 09)
    "brief.title": "Weekly briefing",
    "brief.desc":  "Auto-generated narrative across all sources above. Generated once a week.",
    "brief.placeholder": "The briefing will appear after the first weekly snapshot with ANTHROPIC_API_KEY configured.",
    "brief.grew": "What grew",
    "brief.slipped": "Where we slipped",
    "brief.actions": "Actions for next week",
    "brief.watch": "Keep watching",
    "brief.notConfigured": "Brief not configured",
  },
};

let currentLang = "ru";
function t(key) {
  return messages[currentLang]?.[key] ?? messages.ru[key] ?? key;
}

function localeFor(lang) {
  return lang === "en" ? "en-US" : "ru-RU";
}

// Module-level formatters — recreated when language changes
let numberFormat = new Intl.NumberFormat(localeFor("ru"));
let compactFormat = new Intl.NumberFormat(localeFor("ru"), { notation: "compact", maximumFractionDigits: 1 });
let percentFormat = new Intl.NumberFormat(localeFor("ru"), { style: "percent", maximumFractionDigits: 1 });
function refreshFormatters() {
  numberFormat = new Intl.NumberFormat(localeFor(currentLang));
  compactFormat = new Intl.NumberFormat(localeFor(currentLang), { notation: "compact", maximumFractionDigits: 1 });
  percentFormat = new Intl.NumberFormat(localeFor(currentLang), { style: "percent", maximumFractionDigits: 1 });
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = t(el.dataset.i18n);
    if (el.tagName === "INPUT" && el.type !== "submit") {
      el.placeholder = value;
    } else {
      el.textContent = value;
    }
  });
}

function setLanguage(lang) {
  if (lang !== "ru" && lang !== "en") lang = "ru";
  currentLang = lang;
  document.documentElement.setAttribute("lang", lang);
  try { localStorage.setItem("language", lang); } catch {}
  refreshFormatters();
  applyStaticI18n();
  document.querySelectorAll(".lang-toggle button").forEach((b) => {
    const active = b.dataset.lang === lang;
    b.setAttribute("aria-pressed", active ? "true" : "false");
    b.classList.toggle("active", active);
  });
  if (typeof lastData !== "undefined" && lastData) renderDashboard(lastData);
}

(function initLanguage() {
  const stored = localStorage.getItem("language");
  currentLang = stored === "ru" || stored === "en" ? stored : "ru";
  refreshFormatters();
  document.documentElement.setAttribute("lang", currentLang);
  document.addEventListener("DOMContentLoaded", () => {
    applyStaticI18n();
    document.querySelectorAll(".lang-toggle button").forEach((b) => {
      const active = b.dataset.lang === currentLang;
      b.setAttribute("aria-pressed", active ? "true" : "false");
      b.classList.toggle("active", active);
      b.addEventListener("click", () => setLanguage(b.dataset.lang));
    });
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
const totalDominanceScore = document.getElementById("totalDominanceScore");
const totalDominanceStatus = document.getElementById("totalDominanceStatus");
const totalDominanceSpark = document.getElementById("totalDominanceSpark");
const totalDominanceFoot = document.getElementById("totalDominanceFoot");
const webDominanceSpark = document.getElementById("webDominanceSpark");
const aiVisibilityScoreEl = document.getElementById("aiVisibilityScore");
const aiVisibilityStatusEl = document.getElementById("aiVisibilityStatus");
const aiVisibilitySpark = document.getElementById("aiVisibilitySpark");
const aiVisibilityFoot = document.getElementById("aiVisibilityFoot");

const aiState = document.getElementById("aiState");
const aiSovValue = document.getElementById("aiSovValue");
const aiSovMeta = document.getElementById("aiSovMeta");
const aiMentionsValue = document.getElementById("aiMentionsValue");
const aiMentionsMeta = document.getElementById("aiMentionsMeta");
const aiCitedValue = document.getElementById("aiCitedValue");
const aiCitedMeta = document.getElementById("aiCitedMeta");
const aiPositiveValue = document.getElementById("aiPositiveValue");
const aiPositiveMeta = document.getElementById("aiPositiveMeta");
const aioState = document.getElementById("aioState");
const aioStats = document.getElementById("aioStats");
const aioCards = document.getElementById("aioCards");
const aiOpportunitiesList = document.getElementById("aiOpportunitiesList");
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
const serpFiltersEl = document.getElementById("serpFilters");
const intersectionEl = document.getElementById("intersectionList");

const seoStateEl = document.getElementById("seoState");
const seoPctEl = document.getElementById("seoPct");
const seoFillEl = document.getElementById("seoFill");
const seoMetaEl = document.getElementById("seoMeta");
const clusterGrid = document.getElementById("clusterGrid");

const diMetaEl = document.getElementById("diMeta");
const sourceStatusList = document.getElementById("sourceStatusList");

const bitrixState = document.getElementById("bitrixState");
const bitrixLeadsTotal = document.getElementById("bitrixLeadsTotal");
const bitrixLeadsDelta = document.getElementById("bitrixLeadsDelta");
const bitrixLeadsCaption = document.getElementById("bitrixLeadsCaption");
const bitrixQualified = document.getElementById("bitrixQualified");
const bitrixQualifiedDelta = document.getElementById("bitrixQualifiedDelta");
const bitrixJunkRate = document.getElementById("bitrixJunkRate");
const bitrixDealsOpen = document.getElementById("bitrixDealsOpen");
const bitrixDealsDelta = document.getElementById("bitrixDealsDelta");
const bitrixDealsBreakdown = document.getElementById("bitrixDealsBreakdown");
const bitrixSourcesBody = document.getElementById("bitrixSourcesBody");

const briefingState = document.getElementById("briefingState");
const briefingHeadline = document.getElementById("briefingHeadline");
const briefingGrew = document.getElementById("briefingGrew");
const briefingSlipped = document.getElementById("briefingSlipped");
const briefingActions = document.getElementById("briefingActions");
const briefingWatch = document.getElementById("briefingWatch");

// numberFormat / compactFormat / percentFormat declared in i18n bootstrap above

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
  sourceCount.textContent = `${numberFormat.format(rows.length)} ${t("s04.sources")}`;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = t("s04.empty");
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
    container.textContent = t("s06.dataMissing");
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
    setTag(gscStateEl, t("s07.gscDisconnected"), "warn");
    [brandClicksEl, nonBrandClicksEl, gscCtrEl].forEach((el) => (el.textContent = "—"));
    brandImpressionsEl.textContent = `— ${t("s02.impressions")}`;
    nonBrandImpressionsEl.textContent = `— ${t("s02.impressions")}`;
    gscPositionEl.textContent = `${t("s02.avgPos")} —`;
    return;
  }

  setTag(gscStateEl, `${t("s07.gscTotal")}: ${numberFormat.format(gsc.totals.clicks)} clicks`, "ok");

  brandClicksEl.textContent = numberFormat.format(gsc.brandSplit.brand.clicks);
  brandImpressionsEl.textContent = `${compactFormat.format(gsc.brandSplit.brand.impressions)} ${t("s02.impressions")}`;
  nonBrandClicksEl.textContent = numberFormat.format(gsc.brandSplit.nonBrand.clicks);
  nonBrandImpressionsEl.textContent = `${compactFormat.format(gsc.brandSplit.nonBrand.impressions)} ${t("s02.impressions")}`;
  gscCtrEl.textContent = percentFormat.format(gsc.totals.ctr);
  gscPositionEl.textContent = `${t("s02.avgPos")} ${gsc.totals.position.toFixed(1)}`;
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
      <span class="engine-tile-stat"><b>${b.ourTop10}</b>/${b.total} <em>${t("s03.engine.top10")}</em></span>
      <span class="engine-tile-stat best">${t("s03.engine.best")} <b>${b.ourBest != null ? "#" + b.ourBest : "—"}</b></span>
    `;
    serpEngineSummary.appendChild(tile);
  }

  const overall = document.createElement("div");
  overall.className = "engine-tile coverage";
  overall.innerHTML = `
    <span class="engine-tile-label">${t("s03.engine.sov")}</span>
    <span class="engine-tile-stat coverage-value"><b>${sharePct}%</b></span>
    <span class="engine-tile-stat"><em>${t("s03.engine.us")} ${ourTop10} · ${t("s03.engine.them")} ${theirTop10}</em></span>
  `;
  serpEngineSummary.appendChild(overall);
}

function moverEngineLabel(e) {
  return e && e !== "google" ? `<span class="mover-engine">${e}</span>` : "";
}

function moverCard(slug, title, items, emptyText, renderItem) {
  const lis = items.length
    ? items.map((it) => renderItem(it)).join("")
    : `<li class="mover-empty">${emptyText}</li>`;
  return `
    <div class="mover-card mover-${slug}">
      <div class="mover-title">${title}</div>
      <ol class="mover-list">${lis}</ol>
    </div>
  `;
}

function posCell(p) {
  return p == null ? "—" : `#${p}`;
}

function renderTrueMovers(diff) {
  const since = diff.previousDate || diff.sinceDate || "—";
  const meta = `
    <div class="movers-meta">
      <span>${t("movers.diff.metaVs")} <b>${since}</b></span>
      <span>·</span>
      <span>${diff.totalCompared} ${t("movers.diff.metaCompared")}</span>
      <span>·</span>
      <span>${diff.stableCount} ${t("movers.diff.metaStable")}</span>
    </div>
  `;

  const risersHTML = moverCard(
    "winning",
    t("movers.diff.up.title"),
    diff.risers,
    t("movers.diff.up.empty"),
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
        <span class="mover-stat">
          <b class="delta-up">▲${it.delta}</b>
          <em>${posCell(it.prevPos)}→${posCell(it.curPos)}</em>
        </span>
      </li>
    `
  );

  const fallersHTML = moverCard(
    "missing",
    t("movers.diff.down.title"),
    diff.fallers,
    t("movers.diff.down.empty"),
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
        <span class="mover-stat">
          <b class="delta-down">▼${Math.abs(it.delta)}</b>
          <em>${posCell(it.prevPos)}→${posCell(it.curPos)}</em>
        </span>
      </li>
    `
  );

  const churn = [
    ...diff.newEntrants.map((it) => ({ ...it, kind: "new" })),
    ...diff.lost.map((it) => ({ ...it, kind: "lost" })),
  ].slice(0, 5);

  const churnHTML = moverCard(
    "open",
    t("movers.diff.churn.title"),
    churn,
    t("movers.diff.churn.empty"),
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
        <span class="mover-stat">
          ${
            it.kind === "new"
              ? `<b class="delta-up">${t("movers.diff.new")}</b><em>${posCell(it.curPos)}</em>`
              : `<b class="delta-down">${t("movers.diff.lost")}</b><em>${t("movers.diff.was")} ${posCell(it.prevPos)}</em>`
          }
        </span>
      </li>
    `
  );

  serpMovers.innerHTML = meta + risersHTML + fallersHTML + churnHTML;
  serpMovers.classList.add("has-diff");
}

function renderSyntheticMovers(serp) {
  serpMovers.classList.remove("has-diff");
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

  const winHTML = moverCard(
    "winning",
    t("movers.synth.winning.title"),
    winners,
    t("movers.synth.winning.empty"),
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
        <span class="mover-stat"><b>#${it.ourPos}</b>${it.competitorBest === Infinity ? "" : ` <em>${t("movers.synth.vs")} #${it.competitorBest}</em>`}</span>
      </li>
    `
  );

  const oppHTML = moverCard(
    "missing",
    t("movers.synth.missing.title"),
    opportunities,
    t("movers.synth.missing.empty"),
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
        <span class="mover-stat"><em>${competitorByDomain.get(it.leader.domain) || it.leader.domain}</em> <b>#${it.leader.pos}</b></span>
      </li>
    `
  );

  const openHTML = moverCard(
    "open",
    t("movers.synth.open.title"),
    open,
    t("movers.synth.open.empty"),
    (it) => `
      <li>
        <span class="mover-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
        <span class="mover-stat"><em>${t("movers.synth.openLabel")}</em></span>
      </li>
    `
  );

  serpMovers.innerHTML = winHTML + oppHTML + openHTML;
}

function renderMovers(serp, diff) {
  if (!serpMovers) return;
  serpMovers.innerHTML = "";
  if (!serp || !serp.keywords || !serp.competitors) return;

  const hasMovement =
    diff &&
    ((diff.risers && diff.risers.length) ||
      (diff.fallers && diff.fallers.length) ||
      (diff.newEntrants && diff.newEntrants.length) ||
      (diff.lost && diff.lost.length));

  if (hasMovement) {
    renderTrueMovers(diff);
  } else {
    renderSyntheticMovers(serp);
  }
}

// SERP table filter state (module-scoped, persisted to localStorage)
const serpFilterState = {
  nonBrand: false,
  yandex: false,
  missing: false,
};
try {
  const stored = JSON.parse(localStorage.getItem("serpFilters") || "{}");
  Object.assign(serpFilterState, stored);
} catch {}

let lastSerp = null;
let lastSerpFilters = null;

function persistSerpFilters() {
  try { localStorage.setItem("serpFilters", JSON.stringify(serpFilterState)); } catch {}
}

function isBrandKeyword(row) {
  const tag = (row.tag || "").toLowerCase();
  const group = (row.group || "").toLowerCase();
  return group === "brand_baseline" || tag.includes("brand");
}

function applySerpFilters(rows, ourDomain) {
  return rows.filter((row) => {
    if (serpFilterState.nonBrand && isBrandKeyword(row)) return false;
    if (serpFilterState.yandex && (row.engine || "google").toLowerCase() !== "yandex") return false;
    if (serpFilterState.missing && row.positions[ourDomain] != null) return false;
    return true;
  });
}

function renderSerpFilters() {
  if (!serpFiltersEl) return;
  const buttons = [
    { key: "nonBrand", label: t("s03.filter.nonBrand") },
    { key: "yandex",   label: t("s03.filter.yandex") },
    { key: "missing",  label: t("s03.filter.missing") },
  ];
  serpFiltersEl.innerHTML = buttons
    .map(
      (b) => `
        <button type="button" data-filter="${b.key}" class="${serpFilterState[b.key] ? "active" : ""}">
          ${b.label}
        </button>
      `
    )
    .join("");
  serpFiltersEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.filter;
      serpFilterState[k] = !serpFilterState[k];
      persistSerpFilters();
      renderSerp(lastSerp, lastSerpFilters);
    });
  });
}

function renderSerp(serp, diff) {
  lastSerp = serp;
  lastSerpFilters = diff;
  serpTableHead.innerHTML = "";
  serpTableBody.innerHTML = "";
  renderEngineSummary(serp);
  renderMovers(serp, diff);
  renderSerpFilters();

  if (!serp || !serp.keywords || serp.keywords.length === 0) {
    setTag(serpStateEl, t("s03.notLoaded"), "warn");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = t("s03.empty");
    td.className = "empty-cell";
    tr.appendChild(td);
    serpTableBody.appendChild(tr);
    return;
  }

  const competitors = serp.competitors;
  const ourDomain = competitors.us.domain;
  const allDomains = [competitors.us, ...competitors.competitors];

  const filtered = applySerpFilters(serp.keywords, ourDomain);
  const activeFilters = Object.entries(serpFilterState)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const stateText = activeFilters.length
    ? `${filtered.length}/${serp.keywords.length} · ${t("s03.snapshot")} ${serp.snapshotDate || "—"} · ${t("s03.filtersOn")}: ${activeFilters.length}`
    : `${serp.keywords.length} ${t("s03.keys")} · ${t("s03.snapshot")} ${serp.snapshotDate || "—"}`;
  setTag(serpStateEl, stateText, "ok");

  const headers = [t("s03.queryHeader"), ...allDomains.map((c) => c.name)];
  headers.forEach((label, idx) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (idx === 1) th.className = "us-col";
    serpTableHead.appendChild(th);
  });

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = t("s03.filteredEmpty");
    td.className = "empty-cell";
    td.colSpan = headers.length;
    tr.appendChild(td);
    serpTableBody.appendChild(tr);
    return;
  }

  filtered.forEach((row) => {
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

// ─────────── GSC × SERP intersection: where competitors outrank us ───────────

function renderIntersection(gsc, serp) {
  if (!intersectionEl) return;
  intersectionEl.innerHTML = "";
  if (!gsc?.topQueries || !serp?.keywords || !serp?.competitors) {
    intersectionEl.innerHTML = `<p class="intersection-empty">${t("s03b.emptyNoData")}</p>`;
    return;
  }

  const ourDomain = serp.competitors.us.domain;
  const competitorByDomain = new Map(
    serp.competitors.competitors.map((c) => [c.domain, c.name])
  );
  const others = serp.competitors.competitors.map((c) => c.domain);

  // Index GSC queries by lowercased keyword
  const gscByKey = new Map();
  for (const q of gsc.topQueries) {
    if (q.query) gscByKey.set(q.query.toLowerCase().trim(), q);
  }

  const outranked = [];
  for (const row of serp.keywords) {
    const key = row.keyword.toLowerCase().trim();
    const gscQ = gscByKey.get(key);
    if (!gscQ) continue;
    const ourGsc = gscQ.position;
    if (!ourGsc || ourGsc <= 0) continue;
    // Find best competitor in SERP for this keyword
    const compHits = others
      .map((d) => ({ domain: d, pos: row.positions[d] }))
      .filter((x) => x.pos != null);
    if (compHits.length === 0) continue;
    compHits.sort((a, b) => a.pos - b.pos);
    const leader = compHits[0];
    const gap = ourGsc - leader.pos; // positive: competitor is better
    if (gap < 2) continue; // skip noise: must be at least 2 positions behind
    outranked.push({
      keyword: row.keyword,
      engine: row.engine || "google",
      ourGsc,
      ourGscRounded: Math.round(ourGsc * 10) / 10,
      ourClicks: gscQ.clicks || 0,
      ourImpr: gscQ.impressions || 0,
      leader,
      leaderName: competitorByDomain.get(leader.domain) || leader.domain,
      gap,
    });
  }

  outranked.sort((a, b) => b.gap - a.gap);
  const top = outranked.slice(0, 8);

  if (top.length === 0) {
    intersectionEl.innerHTML = `<p class="intersection-empty">${t("s03b.emptyClean")}</p>`;
    return;
  }

  const itemsHTML = top
    .map(
      (it, i) => `
        <li>
          <span class="ix-rank">${String(i + 1).padStart(2, "0")}</span>
          <span class="ix-kw">${it.keyword}${moverEngineLabel(it.engine)}</span>
          <span class="ix-our">
            <em>${t("s03b.ourGsc")}</em> <b>#${it.ourGscRounded}</b>
            <small>${numberFormat.format(it.ourClicks)} ${t("s03b.clicks")} · ${compactFormat.format(it.ourImpr)} ${t("s03b.impr")}</small>
          </span>
          <span class="ix-arrow">→</span>
          <span class="ix-leader">
            <em>${it.leaderName}</em> <b>#${it.leader.pos}</b>
          </span>
          <span class="ix-gap"><b>−${it.gap.toFixed(1)}</b></span>
        </li>
      `
    )
    .join("");

  intersectionEl.innerHTML = `
    <div class="intersection-meta">
      ${t("s03b.foundLeft")} <b>${outranked.length}</b> ${t("s03b.foundRight")} ${top.length} ${t("s03b.foundEnd")}
    </div>
    <ol class="intersection-list">${itemsHTML}</ol>
  `;
}

function renderSeoProgress(seo) {
  clusterGrid.innerHTML = "";
  if (!seo) {
    setTag(seoStateEl, t("s05.notConnected"), "warn");
    seoPctEl.textContent = "—";
    seoMetaEl.textContent = "—";
    seoFillEl.style.width = "0%";
    return;
  }

  setTag(seoStateEl, `snapshot ${seo.snapshotDate || "—"}`, "ok");
  seoPctEl.textContent = percentFormat.format(seo.pct);
  seoFillEl.style.width = `${Math.round(seo.pct * 100)}%`;
  seoMetaEl.textContent = `${seo.done} ${t("s05.metaDone")} · ${seo.notDone} ${t("s05.metaInProgress")} · ${t("s05.metaTotal")} ${seo.total}`;

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
    diTrendChart.textContent = currentIndex != null
      ? `${t("s06.indexNow")}: ${currentIndex}. ${t("s06.historyHint")}`
      : t("s06.dataMissing");
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

function formatCompactCurrency(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + " B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + " M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, "") + " K";
  return numberFormat.format(n);
}

function statusSlug(status) {
  return String(status || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function applyStatusClass(el, baseClass, status) {
  el.className = `${baseClass} status-${statusSlug(status)}`;
}

function renderHeroDominance(data) {
  const web = data.dominance || {};
  const ai = data.aiVisibility || {};
  const total = data.totalDominance || {};

  totalDominanceScore.textContent = total.index != null ? total.index : "—";
  totalDominanceStatus.textContent = total.status || "—";
  applyStatusClass(totalDominanceStatus, "dominance-status", total.status);
  if (total.weights) {
    totalDominanceFoot.textContent = `web ${Math.round(total.weights.web * 100)}% · ai ${Math.round(total.weights.ai * 100)}%`;
  }

  dominanceScore.textContent = web.index != null ? web.index : "—";
  dominanceStatus.textContent = web.status || "—";
  applyStatusClass(dominanceStatus, "dominance-status", web.status);
  const fillWidth = web.index != null ? Math.min(web.index, 160) / 160 : 0;
  if (dominanceFill) dominanceFill.style.width = `${Math.round(fillWidth * 100)}%`;

  aiVisibilityScoreEl.textContent = ai.index != null ? ai.index : "—";
  aiVisibilityStatusEl.textContent = ai.status || "—";
  applyStatusClass(aiVisibilityStatusEl, "dominance-status", ai.status);
  if (ai.stats && ai.stats.totalResponses > 0) {
    const sov = ai.stats.sov_pct != null ? `SOV ${(ai.stats.sov_pct * 100).toFixed(0)}%` : "SOV —";
    aiVisibilityFoot.textContent = `${sov} · ${ai.stats.brandMentioned || 0} mentions · ${ai.stats.brandCited || 0} cited`;
  } else {
    aiVisibilityFoot.textContent = t("aiVis.noWeek");
  }

  const totalHistory = (data.totalDominanceHistory || []).map((h) => h.index).filter((v) => v != null);
  const webHistory = (data.dominanceHistory || []).map((h) => h.index).filter((v) => v != null);
  const aiHistory = (data.aiVisibilityHistory || []).map((h) => h.ai_visibility_score).filter((v) => v != null);

  renderSparkline(totalDominanceSpark, totalHistory.length >= 2 ? totalHistory : webHistory, "#e1c282");
  renderSparkline(webDominanceSpark, webHistory, "#c9a96e");
  renderSparkline(aiVisibilitySpark, aiHistory, "#7fb3d5");
}

function renderAiVisibilitySection(data) {
  const ai = data.aiVisibility || {};
  const sources = data.sources || {};
  const aip = sources.aiProbe || {};

  if (!aip.configured) {
    setTag(aiState, t("aiVis.notConfigured"), "warn");
  } else if (ai.index == null) {
    setTag(aiState, `${aip.engines.join(", ")} · ${t("aiVis.noData")}`, "warn");
  } else {
    setTag(aiState, `${aip.engines.join(", ")} · ${aip.responsesThisWeek} ${t("aiVis.responsesShort")} · ${t("aiVis.scoreLabel")} ${ai.index}`, "ok");
  }

  const stats = ai.stats || {};
  aiSovValue.textContent = stats.sov_pct != null ? `${(stats.sov_pct * 100).toFixed(1)}%` : "—";
  aiSovMeta.textContent = stats.totalResponses
    ? `${stats.brandMentioned || 0} ${t("aiVis.brandMentionsTotal")} ${stats.totalResponses} ${t("aiVis.brandMentionsTotal2")}`
    : "—";

  aiMentionsValue.textContent = numberFormat.format(stats.brandMentioned || 0);
  aiMentionsMeta.textContent = stats.totalResponses ? `${t("aiVis.allResponses")}: ${stats.totalResponses}` : "—";

  aiCitedValue.textContent = numberFormat.format(stats.brandCited || 0);
  aiCitedMeta.textContent = stats.brandMentioned
    ? `${Math.round(((stats.brandCited || 0) / stats.brandMentioned) * 100)}% ${t("aiVis.ofMentions")}`
    : "—";

  const classifiedCount = stats.classifiedCount || 0;
  if (classifiedCount > 0 && ai.breakdown?.components?.positive != null) {
    const positiveRatio = ai.breakdown.components.positive / 2;
    aiPositiveValue.textContent = `${(positiveRatio * 100).toFixed(0)}%`;
    aiPositiveMeta.textContent = `${classifiedCount} ${t("aiVis.classified")}`;
  } else {
    aiPositiveValue.textContent = "—";
    aiPositiveMeta.textContent = sources.aiClassifier?.configured
      ? t("aiVis.sentimentNotRun")
      : t("aiVis.classifierMissing");
  }

  renderAiOverviews(data.aiOverviews);
  renderAiOpportunities(data);
}

function renderAiOverviews(aio) {
  aioStats.innerHTML = "";
  aioCards.innerHTML = "";
  if (!aio || aio.totalKeywords === 0) {
    setTag(aioState, t("s03.notLoaded"), "muted");
    return;
  }
  setTag(aioState,
    `${aio.presentCount}/${aio.totalKeywords} keywords with AI Overview · ${aio.brandCitedCount} cite Magnum`,
    aio.brandCitedRate >= 0.3 ? "ok" : "warn"
  );

  const tile = (label, value, sub) => {
    const div = document.createElement("div");
    div.className = "aio-stat-tile";
    div.innerHTML = `
      <span class="aio-stat-label">${label}</span>
      <span class="aio-stat-value">${value}</span>
      <span class="aio-stat-sub">${sub}</span>
    `;
    return div;
  };
  aioStats.appendChild(tile("Presence rate", `${Math.round(aio.presenceRate * 100)}%`, `${aio.presentCount}/${aio.totalKeywords} keywords`));
  aioStats.appendChild(tile("Brand cited", aio.brandCitedCount, aio.presentCount ? `${Math.round(aio.brandCitedRate * 100)}% of AI Overviews` : "—"));
  aioStats.appendChild(tile("Threats", aio.threats.length, "competitor cited, we are not"));
  aioStats.appendChild(tile("Blue ocean", aio.blueOcean.length, "AI Overview present, nobody cited"));

  const renderCardSet = (title, items, kind, formatter) => {
    if (!items.length) return;
    const card = document.createElement("div");
    card.className = `aio-card aio-${kind}`;
    const lis = items.slice(0, 5).map((it) => `<li>${formatter(it)}</li>`).join("");
    card.innerHTML = `<div class="aio-card-title">${title}</div><ol class="aio-list">${lis}</ol>`;
    aioCards.appendChild(card);
  };
  renderCardSet(t("aiVis.cards.wins"), aio.ourWins, "wins",
    (it) => `<span class="aio-kw">${escapeHtml(it.keyword)}</span><span class="aio-meta">${it.engine}/${it.lang}${it.alongsideCompetitors?.length ? ` · vs ${it.alongsideCompetitors.length}` : " · solo"}</span>`);
  renderCardSet(t("aiVis.cards.threats"), aio.threats, "threats",
    (it) => `<span class="aio-kw">${escapeHtml(it.keyword)}</span><span class="aio-meta">${it.engine}/${it.lang} · ${(it.competitors || []).length} comp.</span>`);
  renderCardSet(t("aiVis.cards.blue"), aio.blueOcean, "blue",
    (it) => `<span class="aio-kw">${escapeHtml(it.keyword)}</span><span class="aio-meta">${it.engine}/${it.lang}</span>`);
}

function renderAiOpportunities(data) {
  aiOpportunitiesList.innerHTML = "";
  const aiResponses = data.aiVisibility?.stats?.totalResponses || 0;
  if (aiResponses === 0) {
    aiOpportunitiesList.innerHTML = `<li class='ai-opp-empty'>${t("aiVis.opp.empty")}</li>`;
    return;
  }
  const aio = data.aiOverviews;
  const items = aio?.threats?.slice(0, 5) || [];
  if (items.length === 0) {
    aiOpportunitiesList.innerHTML = `<li class='ai-opp-empty'>${t("aiVis.opp.cleanRu")}</li>`;
    return;
  }
  for (const it of items) {
    const li = document.createElement("li");
    li.className = "ai-opp-item";
    li.innerHTML = `
      <span class="ai-opp-kw">${escapeHtml(it.keyword)}</span>
      <span class="ai-opp-meta">${it.engine}/${it.lang} · ${t("aiVis.opp.compInAio")}: ${(it.competitors || []).length}</span>
    `;
    aiOpportunitiesList.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// Bitrix24 source IDs come from many integrations (Wazzup, Facebook,
// webform, etc.) and often include a "<userId>|" routing prefix.
// Map them to human-readable channel names so the table reads naturally.
function readableBitrixSource(raw) {
  if (!raw) return "(unknown)";
  const stripped = String(raw).replace(/^\d+\|/, ""); // drop "9|" assignee prefix

  if (/^WZ_WHATSAPP/i.test(stripped)) return "WhatsApp";
  if (/^WZ/i.test(stripped))          return "WhatsApp (Wazzup)";
  if (/FBINSTAGRAMDIRECT/i.test(stripped)) return "Instagram Direct";
  if (/FBINSTAGRAM/i.test(stripped))       return "Instagram";
  if (/^FB/i.test(stripped))               return "Facebook";
  if (/TELEGRAM/i.test(stripped))          return "Telegram";
  if (/VIBER/i.test(stripped))             return "Viber";
  if (/^WEBFORM$/i.test(stripped)) return "Website form";
  if (/^WEB$/i.test(stripped))     return "Website";
  if (/^GOOGLE_MAPS$/i.test(stripped)) return "Google Maps";
  if (/^CALL(BACK)?$/i.test(stripped)) return "Call";
  if (/^EMAIL$/i.test(stripped))   return "Email";
  // Bitrix internal source list IDs are usually short uppercase tokens
  if (/^[0-9A-F]{8,}$/i.test(stripped)) return `Other channel (${stripped.slice(0, 6)})`;
  return stripped;
}

// Aggregate raw bitrix sources by readable name (so multiple
// "1|WZ_WHATSAPP_…" / "9|WZ_WHATSAPP_…" rows collapse into one).
function aggregateBitrixSources(sources) {
  const agg = new Map();
  for (const s of sources || []) {
    const name = readableBitrixSource(s.source);
    agg.set(name, (agg.get(name) || 0) + (s.count || 0));
  }
  return agg;
}

function renderBitrix(bitrix) {
  if (!bitrix?.leads?.current) {
    setTag(bitrixState, t("sales.notConnected"), "muted");
    [bitrixLeadsTotal, bitrixQualified, bitrixDealsOpen]
      .forEach((el) => (el.textContent = "—"));
    [bitrixLeadsDelta, bitrixQualifiedDelta, bitrixDealsDelta]
      .forEach((el) => renderDelta(el, null));
    bitrixSourcesBody.innerHTML = "";
    bitrixJunkRate.textContent = "Junk rate —";
    bitrixDealsBreakdown.textContent = "Won — · Lost —";
    bitrixLeadsCaption.textContent = t("sales.totalForPeriod");
    return;
  }

  const cur = bitrix.leads.current;
  const prev = bitrix.leads.previous || {};
  const dCur = bitrix.deals.current;
  const dPrev = bitrix.deals.previous || {};

  setTag(bitrixState, `${cur.total} leads · ${dCur.total} deals`, "ok");

  bitrixLeadsTotal.textContent = numberFormat.format(cur.total);
  renderDelta(bitrixLeadsDelta, computeDelta(cur.total, prev.total));
  bitrixLeadsCaption.textContent = t("sales.totalForPeriod");

  bitrixQualified.textContent = numberFormat.format(cur.qualified || 0);
  renderDelta(bitrixQualifiedDelta, computeDelta(cur.qualified, prev.qualified));
  bitrixJunkRate.textContent = `Junk rate ${percentFormat.format(cur.junkRate || 0)}`;

  bitrixDealsOpen.textContent = numberFormat.format(dCur.in_progress || 0);
  renderDelta(bitrixDealsDelta, computeDelta(dCur.in_progress, dPrev.in_progress));
  bitrixDealsBreakdown.textContent = `Won ${dCur.won || 0} · Lost ${dCur.lost || 0}`;
  // Pipeline metric card removed entirely — the IDR pipeline_value (40+ B)
  // and the always-zero won_value were noise. Deals count + Won/Lost
  // breakdown remain on the "Deals open" card.

  // Top sources table — aggregate by readable name, then diff vs previous
  const aggCur = aggregateBitrixSources(cur.sources);
  const aggPrev = aggregateBitrixSources(prev.sources);
  bitrixSourcesBody.innerHTML = "";
  if (aggCur.size === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = t("sales.empty");
    td.className = "empty-cell";
    tr.appendChild(td);
    bitrixSourcesBody.appendChild(tr);
  } else {
    Array.from(aggCur.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([name, count]) => {
        const tr = document.createElement("tr");
        const prevCount = aggPrev.get(name) || 0;
        const tdName = document.createElement("td");
        tdName.textContent = name;
        const tdCur = document.createElement("td");
        tdCur.className = "numeric-cell";
        tdCur.textContent = numberFormat.format(count);
        const tdPrev = document.createElement("td");
        tdPrev.className = "numeric-cell";
        tdPrev.textContent = prevCount ? numberFormat.format(prevCount) : "—";
        const tdDelta = document.createElement("td");
        tdDelta.className = "numeric-cell";
        const delta = computeDelta(count, prevCount);
        if (delta == null) {
          tdDelta.textContent = "—";
          tdDelta.style.color = "var(--paper-faint)";
        } else {
          const pct = Math.abs(delta * 100);
          const sign = delta > 0 ? "▲ " : delta < 0 ? "▼ " : "";
          tdDelta.textContent = sign + (pct >= 1000 ? ">999" : pct.toFixed(1)) + "%";
          tdDelta.style.color = delta > 0 ? "var(--positive)" : delta < 0 ? "var(--negative)" : "var(--paper-faint)";
        }
        tr.appendChild(tdName);
        tr.appendChild(tdCur);
        tr.appendChild(tdPrev);
        tr.appendChild(tdDelta);
        bitrixSourcesBody.appendChild(tr);
      });
  }
}

function renderBriefing(brief) {
  if (!brief || (!brief.headline && !brief.ru && !brief.en)) {
    setTag(briefingState, t("brief.notConfigured"), "muted");
    briefingHeadline.textContent = t("brief.placeholder");
    briefingGrew.textContent = "—";
    briefingSlipped.textContent = "—";
    briefingActions.innerHTML = "";
    briefingWatch.textContent = "—";
    return;
  }
  // New bilingual shape: { ru: {...}, en: {...}, model, date, ... }.
  // Legacy flat shape: { headline, what_grew, ..., model, date }.
  // Prefer the lang-specific block, fall back to flat fields, fall back to ru.
  const langBlock =
    (currentLang === "en" && brief.en) ? brief.en :
    (currentLang === "ru" && brief.ru) ? brief.ru :
    brief.ru || brief.en || brief; // last resort: legacy flat fields

  const modelLabel = (brief.model || "Claude").replace(/^claude-/, "Claude ").replace(/-/g, " ");
  setTag(briefingState, `${modelLabel} · ${brief.date || "—"}`, "ok");
  briefingHeadline.textContent = langBlock.headline || "—";
  briefingGrew.textContent = langBlock.what_grew || "—";
  briefingSlipped.textContent = langBlock.what_slipped || "—";
  briefingActions.innerHTML = "";
  (langBlock.actions || []).forEach((a) => {
    const li = document.createElement("li");
    li.textContent = a;
    briefingActions.appendChild(li);
  });
  briefingWatch.textContent = langBlock.watch_next || "—";
}

function renderSourceStatus(sources) {
  sourceStatusList.innerHTML = "";
  if (!sources) return;
  const labels = {
    ga4: "Google Analytics 4",
    gsc: "Search Console",
    serp: "Bright Data (SERP)",
    seoProgress: "SEO Progress (Sheets)",
    bitrix: "Bitrix24 CRM",
    briefing: "Executive Brief (LLM)",
    aiProbe: "AI Probe (LLM APIs)",
    aiClassifier: "AI Classifier (Haiku 4.5)",
  };
  Object.entries(sources).forEach(([key, info]) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = labels[key] || key;
    const status = document.createElement("span");
    if (!info.configured) {
      status.textContent = t("src.notConfigured");
      status.className = "miss";
    } else if (info.ok === false || (info.cached === false && info.configured)) {
      status.textContent = info.error || t("src.noData");
      status.className = "miss";
    } else {
      status.textContent = info.date ? `${t("src.snapshot")} ${info.date}` : t("src.ok");
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

  renderHeroDominance(data);

  const periodDays = periodLength(data.meta.startDate, data.meta.endDate);
  if (heroMetaPeriod) {
    heroMetaPeriod.textContent = `${t("hero.period")} · ${compactDate(data.meta.startDate)} → ${compactDate(data.meta.endDate)}${periodDays ? ` · ${periodDays}D` : ""}`;
  }
  if (heroMetaPrev) {
    heroMetaPrev.textContent = `${t("hero.previous")} · ${compactDate(data.meta.previousStartDate)} → ${compactDate(data.meta.previousEndDate)}`;
  }

  periodLabel.textContent = `${compactDate(data.meta.startDate)} → ${compactDate(data.meta.endDate)}`;
  previousPeriod.textContent = `${t("footer.previous")} · ${compactDate(data.meta.previousStartDate)} → ${compactDate(data.meta.previousEndDate)}`;

  renderList(leadEventsList, data.meta.leadEvents, t("s07.noLeadEvents"));
  renderList(activityList, data.activities, t("s07.noActivities"));
  renderSourceTable(data.trafficSources);
  renderGsc(data.gsc);
  // SERP / Outranked / SEO Progress / AI Visibility sections were removed
  // from the dashboard. Their data sources may still flow via /api/dashboard
  // (e.g. AI Probe still feeds the hero AI Visibility card), but the detail
  // sections no longer render.
  renderDominanceTrend(data.dominanceHistory, data.dominance.index);
  renderSourceStatus(data.sources);
  renderBitrix(data.bitrix);
  renderBriefing(data.briefing);

  const sessionsSeries = (data.series || []).map((item) => item.sessions);
  const leadsSeries = (data.series || []).map((item) => item.leads);
  const engagementSeries = (data.series || []).map((item) => Math.round(item.engagementRate * 100));

  renderLineChart(trafficChart, [
    { name: "Sessions", values: sessionsSeries, color: "#c9a96e" },
    { name: "Leads", values: leadsSeries, color: "#d4685a" },
  ]);
  renderLineChart(engagementChart, [
    { name: "Engagement", values: engagementSeries, color: "#84b685" },
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
    trafficChart.textContent = currentLang === "en" ? "Failed to load data" : "Ошибка загрузки данных";
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
