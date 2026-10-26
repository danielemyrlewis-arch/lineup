import test from "node:test";
import assert from "node:assert/strict";
import { calculateDailyStatistics } from "../lib/account/statistics.ts";
import { DAILY_SCHEDULE } from "../lib/game/daily-schedule.ts";
import { londonDate } from "../lib/game/daily-date.ts";
import type { DailyResult } from "../lib/account/results.ts";

function row(date: string, won = true, questions = 3): DailyResult {
  const entry = DAILY_SCHEDULE.find(day => day.date === date)!;
  assert.ok(entry, date);
  const path = [24, ...Array.from({length: questions}, (_, i) => 20 - i * 2)];
  return {user_id:"11111111-2222-4333-8444-555555555555", puzzle_id:entry.id,
    puzzle_date:date,puzzle_number:entry.number,outcome:won?"won":"lost",questions_used:questions,
    deduction_path:path,films_remaining:path.at(-1)!,completed_at:`${date}T12:00:00.000Z`};
}

test("empty Daily statistics have safe zero totals and no invented average or best result", () => {
  assert.deepEqual(calculateDailyStatistics([], "2026-10-26"), {
    played:0,won:0,winPercentage:0,currentStreak:0,longestStreak:0,
    averageQuestionsInWins:null,bestWin:null,history:[],
  });
});

test("all statistics derive from distinct completed Daily records, with best successful result tied by earliest date", () => {
  const results = [row("2026-10-23", true, 2), row("2026-10-20", false, 5), row("2026-10-22", true, 4), row("2026-10-21", true, 2)];
  const stats = calculateDailyStatistics(results, "2026-10-23");
  assert.equal(stats.played,4);
  assert.equal(stats.won,3);
  assert.equal(stats.winPercentage,75);
  assert.equal(stats.currentStreak,3);
  assert.equal(stats.longestStreak,3);
  assert.equal(stats.averageQuestionsInWins,8/3);
  assert.equal(stats.bestWin?.puzzle_date,"2026-10-21");
  assert.deepEqual(stats.history.map(result => result.puzzle_date),["2026-10-23","2026-10-22","2026-10-21","2026-10-20"]);
  assert.deepEqual(results.map(result=>result.puzzle_date),["2026-10-23","2026-10-20","2026-10-22","2026-10-21"],"input is not mutated");
});

test("an unplayed today retains yesterday's active streak, then a completed loss breaks it immediately", () => {
  const wins=[row("2026-10-20"),row("2026-10-21")];
  assert.equal(calculateDailyStatistics(wins,"2026-10-22").currentStreak,2);
  assert.equal(calculateDailyStatistics([...wins,row("2026-10-22",false)],"2026-10-22").currentStreak,0);
  assert.equal(calculateDailyStatistics([...wins,row("2026-10-22")],"2026-10-22").currentStreak,3);
});

test("missed calendar days break current and longest runs without erasing older results", () => {
  const results=[row("2026-10-20"),row("2026-10-21"),row("2026-10-23"),row("2026-10-24")];
  assert.equal(calculateDailyStatistics(results,"2026-10-24").currentStreak,2);
  assert.equal(calculateDailyStatistics(results,"2026-10-24").longestStreak,2);
  assert.equal(calculateDailyStatistics(results,"2026-10-25").currentStreak,2);
  assert.equal(calculateDailyStatistics(results,"2026-10-26").currentStreak,0);
});

test("zero-question wins are a valid best result and losses never enter successful averages", () => {
  const stats=calculateDailyStatistics([row("2026-10-20",true,0),row("2026-10-21",false,5),row("2026-10-22",true,2)],"2026-10-22");
  assert.equal(stats.averageQuestionsInWins,1);
  assert.equal(stats.bestWin?.questions_used,0);
  assert.equal(stats.bestWin?.films_remaining,24);
});

test("duplicates, malformed rows and future puzzles cannot inflate private statistics", () => {
  const first=row("2026-10-20",false,2);
  const duplicate={...row("2026-10-20",true,0),completed_at:"2026-10-20T15:00:00Z"};
  const stats=calculateDailyStatistics([first,first,duplicate,row("2026-10-22"),{...row("2026-10-21"),puzzle_id:"practice-1"}],"2026-10-21");
  assert.equal(stats.played,1);
  assert.equal(stats.won,0);
  assert.equal(stats.currentStreak,0);
});

test("streaks follow London dates across autumn's 25-hour and spring's 23-hour calendar days", () => {
  const autumn=[row("2026-10-24"),row("2026-10-25")];
  assert.equal(calculateDailyStatistics(autumn,londonDate(new Date("2026-10-26T00:00:00Z"))).currentStreak,2);
  const spring=[row("2027-03-27"),row("2027-03-28")];
  assert.equal(calculateDailyStatistics(spring,londonDate(new Date("2027-03-28T23:00:00Z"))).currentStreak,2);
  assert.equal(calculateDailyStatistics(autumn,"2026-10-27").currentStreak,0);
});

test("the current winning streak changes at UK midnight, independently of device timezone", () => {
  const results=[row("2027-06-01")];
  const previous=process.env.TZ;
  try {
    for (const timezone of ["UTC","America/Los_Angeles","Asia/Tokyo"]) {
      process.env.TZ=timezone;
      assert.equal(calculateDailyStatistics(results,londonDate(new Date("2027-06-02T22:59:59Z"))).currentStreak,1);
      assert.equal(calculateDailyStatistics(results,londonDate(new Date("2027-06-02T23:00:00Z"))).currentStreak,0);
    }
  } finally { if(previous===undefined) delete process.env.TZ; else process.env.TZ=previous; }
});
