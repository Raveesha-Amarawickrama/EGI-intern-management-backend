// Week runs Sunday → Saturday (7 days). Single source of truth for both
// the Task model and any controller that needs to filter/group by week.

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday
  return d;
};

const getWeekKey = (date = new Date()) => {
  const sun  = startOfWeek(date);
  const year = sun.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const jan1Sunday = startOfWeek(jan1);
  const diffDays = Math.round((sun - jan1Sunday) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
};

const weekKeyToDateRange = (wk) => {
  const [yearStr, wStr] = wk.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);

  const jan1 = new Date(year, 0, 1);
  const jan1Sunday = startOfWeek(jan1);

  const start = new Date(jan1Sunday);
  start.setDate(jan1Sunday.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (d) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
};

module.exports = { startOfWeek, getWeekKey, weekKeyToDateRange };