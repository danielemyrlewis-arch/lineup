/** Daily puzzles follow the UK calendar, independently of the device's timezone. */
export const DAILY_TIME_ZONE = "Europe/London";
const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: DAILY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: DAILY_TIME_ZONE,
  day: "numeric",
  month: "short",
});

function instant(now: Date | number): Date {
  const date = new Date(typeof now === "number" ? now : now.getTime());
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid puzzle time");
  return date;
}

export function londonDate(now: Date | number = new Date()): string {
  const parts = calendar.formatToParts(instant(now));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isDailyDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

/** Calendar arithmetic only; elapsed hours between London midnights may differ. */
export function addCalendarDays(date: string, days = 1): string {
  if (!isDailyDate(date) || !Number.isSafeInteger(days)) throw new RangeError("Invalid calendar date");
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Find the next date boundary using the IANA calendar, including 23/25-hour days. */
export function nextLondonMidnight(now: Date | number = new Date()): Date {
  const current = instant(now).getTime();
  const date = londonDate(current);
  let low = current + 1;
  let high = current + 30 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (londonDate(middle) === date) low = middle + 1;
    else high = middle;
  }
  return new Date(low);
}

export function formatDailyDate(date: string): string {
  if (!isDailyDate(date)) throw new RangeError("Invalid calendar date");
  return shortDate.format(new Date(`${date}T12:00:00.000Z`));
}
