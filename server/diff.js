/**
 * Diff two SERP snapshots and surface true movers.
 *
 * Position semantics: lower number = better (rank 1 is the top).
 * delta = prevPos - curPos
 *   delta > 0 → improved (we moved UP in SERP, e.g. #5 → #2 means delta = 3)
 *   delta < 0 → declined (we moved DOWN, e.g. #5 → #11 means delta = -6)
 *
 * Categories:
 *   - "up"     : both positions known, delta > 0
 *   - "down"   : both positions known, delta < 0
 *   - "stable" : both positions known, delta == 0
 *   - "new"    : was null, now ranks  (entered top-100)
 *   - "lost"   : was ranking, now null (dropped out of top-100)
 */
export function diffSerp(currentSnapshot, previousSnapshot, ourDomain) {
  if (!currentSnapshot?.keywords || !previousSnapshot?.keywords) return null;
  if (!ourDomain) return null;

  const prevByKey = new Map();
  for (const row of previousSnapshot.keywords) {
    prevByKey.set(`${row.keyword}|${row.engine || "google"}`, row);
  }

  const movements = [];
  for (const cur of currentSnapshot.keywords) {
    const key = `${cur.keyword}|${cur.engine || "google"}`;
    const prev = prevByKey.get(key);
    if (!prev) continue;

    const curPos = cur.positions?.[ourDomain] ?? null;
    const prevPos = prev.positions?.[ourDomain] ?? null;

    let category = "stable";
    let delta = null;
    if (prevPos == null && curPos != null) {
      category = "new";
    } else if (prevPos != null && curPos == null) {
      category = "lost";
    } else if (prevPos != null && curPos != null) {
      delta = prevPos - curPos;
      if (delta > 0) category = "up";
      else if (delta < 0) category = "down";
      else category = "stable";
    } else {
      continue; // both null — uninteresting
    }

    movements.push({
      keyword: cur.keyword,
      engine: cur.engine || "google",
      curPos,
      prevPos,
      delta,
      category,
    });
  }

  return {
    sinceDate: previousSnapshot.date || null,
    risers: movements
      .filter((m) => m.category === "up")
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5),
    fallers: movements
      .filter((m) => m.category === "down")
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5),
    newEntrants: movements.filter((m) => m.category === "new").slice(0, 5),
    lost: movements.filter((m) => m.category === "lost").slice(0, 5),
    stableCount: movements.filter((m) => m.category === "stable").length,
    totalCompared: movements.length,
  };
}
