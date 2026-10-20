import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, DAILY_TIME_ZONE, formatDailyDate, isDailyDate, londonDate, nextLondonMidnight } from "../lib/game/daily-date.ts";

const date = (value: string) => new Date(value);

test("Daily date uses the London calendar in winter and summer, not a fixed UTC offset", () => {
  assert.equal(DAILY_TIME_ZONE, "Europe/London");
  assert.equal(londonDate(date("2026-01-01T23:59:59.999Z")), "2026-01-01");
  assert.equal(londonDate(date("2026-01-02T00:00:00Z")), "2026-01-02");
  assert.equal(londonDate(date("2026-07-01T22:59:59.999Z")), "2026-07-01");
  assert.equal(londonDate(date("2026-07-01T23:00:00Z")), "2026-07-02");
});

test("next London midnight follows 23-hour spring and 25-hour autumn days", () => {
  const spring = date("2026-03-29T00:00:00Z");
  assert.equal(nextLondonMidnight(spring).toISOString(), "2026-03-29T23:00:00.000Z");
  assert.equal(nextLondonMidnight(spring).getTime() - spring.getTime(), 23 * 3600_000);
  const autumn = date("2026-10-24T23:00:00Z");
  assert.equal(nextLondonMidnight(autumn).toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(nextLondonMidnight(autumn).getTime() - autumn.getTime(), 25 * 3600_000);
  assert.equal(londonDate(date("2026-10-25T23:59:59.999Z")), "2026-10-25");
  assert.equal(londonDate(date("2026-10-26T00:00:00Z")), "2026-10-26");
});

test("rollover is the first millisecond of the next UK date, including near midnight", () => {
  for (const instant of ["2026-03-29T00:59:59Z", "2026-03-29T01:00:00Z", "2026-10-25T00:59:59Z", "2026-10-25T01:00:00Z", "2026-12-31T23:59:59.999Z"]) {
    const current = date(instant);
    const midnight = nextLondonMidnight(current);
    assert.equal(londonDate(midnight), addCalendarDays(londonDate(current)));
    assert.equal(londonDate(midnight.getTime() - 1), londonDate(current));
    assert.ok(midnight.getTime() > current.getTime());
  }
});

test("device timezone changes cannot change Daily date selection or reset time", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = zone;
      const instant = date("2026-07-01T23:30:00Z");
      assert.equal(londonDate(instant), "2026-07-02", zone);
      assert.equal(nextLondonMidnight(instant).toISOString(), "2026-07-02T23:00:00.000Z", zone);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("calendar dates, leap years and invalid inputs are handled explicitly", () => {
  assert.equal(addCalendarDays("2026-12-31"), "2027-01-01");
  assert.equal(addCalendarDays("2028-02-28"), "2028-02-29");
  assert.equal(addCalendarDays("2028-03-01", -1), "2028-02-29");
  assert.equal(formatDailyDate("2026-10-20"), "20 Oct");
  for (const invalid of [null, "2026-02-29", "2026-13-01", "2026-1-01", "2026-04-31", "not a date"])
    assert.equal(isDailyDate(invalid), false);
  assert.equal(isDailyDate("2028-02-29"), true);
  assert.throws(() => londonDate(new Date(NaN)), RangeError);
  assert.throws(() => nextLondonMidnight(NaN), RangeError);
  assert.throws(() => addCalendarDays("2026-02-29"), RangeError);
});
