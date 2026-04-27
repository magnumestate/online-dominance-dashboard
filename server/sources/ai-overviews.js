export function summarizeAiOverviews(serpSnapshot) {
  const items = serpSnapshot?.aiOverviews || [];
  const totalKeywords = serpSnapshot?.keywords?.length || 0;

  if (totalKeywords === 0) {
    return {
      totalKeywords: 0,
      presentCount: 0,
      presenceRate: 0,
      brandCitedCount: 0,
      brandCitedRate: 0,
      competitorCitedCount: 0,
      blueOcean: [],
      threats: [],
      ourWins: [],
      byEngine: {},
    };
  }

  const presentCount = items.length;
  const brandCitedItems = items.filter((it) => it.brand_cited);
  const competitorCitedItems = items.filter((it) => (it.competitors_cited || []).length > 0);

  const blueOcean = items
    .filter((it) => !it.brand_cited && (it.competitors_cited || []).length === 0)
    .map((it) => ({ keyword: it.keyword, engine: it.engine, lang: it.lang }));

  const threats = items
    .filter((it) => !it.brand_cited && (it.competitors_cited || []).length > 0)
    .map((it) => ({
      keyword: it.keyword,
      engine: it.engine,
      lang: it.lang,
      competitors: it.competitors_cited,
    }));

  const ourWins = brandCitedItems.map((it) => ({
    keyword: it.keyword,
    engine: it.engine,
    lang: it.lang,
    alongsideCompetitors: it.competitors_cited || [],
  }));

  const byEngine = {};
  for (const it of items) {
    const e = it.engine || "google";
    if (!byEngine[e]) byEngine[e] = { present: 0, brand_cited: 0, competitor_cited: 0 };
    byEngine[e].present++;
    if (it.brand_cited) byEngine[e].brand_cited++;
    if ((it.competitors_cited || []).length > 0) byEngine[e].competitor_cited++;
  }

  return {
    totalKeywords,
    presentCount,
    presenceRate: presentCount / totalKeywords,
    brandCitedCount: brandCitedItems.length,
    brandCitedRate: presentCount ? brandCitedItems.length / presentCount : 0,
    competitorCitedCount: competitorCitedItems.length,
    blueOcean,
    threats,
    ourWins,
    byEngine,
  };
}
