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

export function previousPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = daysBetween(start, end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(totalDays - 1));
  return {
    startDate: toDateString(prevStart),
    endDate: toDateString(prevEnd),
  };
}

export function readJsonFile(path) {
  return import("node:fs").then((fs) =>
    JSON.parse(fs.readFileSync(path, "utf8"))
  );
}

export function safeRatio(value, prev) {
  if (!prev || prev <= 0) return value > 0 ? 1.25 : 0;
  return value / prev;
}
