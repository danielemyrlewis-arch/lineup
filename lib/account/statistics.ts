import { addCalendarDays, isDailyDate, londonDate } from "../game/daily-date.ts";
import { parseDailyResult, type DailyResult } from "./results.ts";

export interface DailyStatistics {
  played: number;
  won: number;
  winPercentage: number;
  currentStreak: number;
  longestStreak: number;
  averageQuestionsInWins: number | null;
  bestWin: DailyResult | null;
  history: DailyResult[];
}

/** Derive private Daily stats; no duplicate counters, elapsed-hour arithmetic or Practice. */
export function calculateDailyStatistics(results: readonly DailyResult[], today = londonDate()): DailyStatistics {
  if (!isDailyDate(today)) throw new RangeError("Invalid statistics date");
  const byDate = new Map<string, DailyResult>();
  // The database already enforces uniqueness. Defensive de-duplication keeps
  // repeat responses from inflating a local screen; the earliest completion wins.
  const valid = results.map(parseDailyResult).filter((row): row is DailyResult => !!row)
    .filter(row => row.puzzle_date <= today)
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  for (const row of valid) if (!byDate.has(row.puzzle_date)) byDate.set(row.puzzle_date, row);
  const ascending = [...byDate.values()].sort((a, b) => a.puzzle_date.localeCompare(b.puzzle_date));
  const wins = ascending.filter(row => row.outcome === "won");
  let previous: string | null = null;
  let run = 0;
  let longestStreak = 0;
  for (const row of ascending) {
    run = row.outcome === "won"
      ? previous && addCalendarDays(previous) === row.puzzle_date ? run + 1 : 1
      : 0;
    longestStreak = Math.max(longestStreak, run);
    previous = row.puzzle_date;
  }
  let currentStreak = 0;
  let date = byDate.has(today) ? today : addCalendarDays(today, -1);
  while (byDate.get(date)?.outcome === "won") {
    currentStreak++;
    date = addCalendarDays(date, -1);
  }
  // Fewest questions matches the existing successful-result distribution.
  // Equal question counts use the earliest puzzle date; no new score is invented.
  const bestWin = [...wins].sort((a, b) => a.questions_used - b.questions_used || a.puzzle_date.localeCompare(b.puzzle_date))[0] ?? null;
  return {
    played: ascending.length,
    won: wins.length,
    winPercentage: ascending.length ? wins.length / ascending.length * 100 : 0,
    currentStreak,
    longestStreak,
    averageQuestionsInWins: wins.length ? wins.reduce((total, row) => total + row.questions_used, 0) / wins.length : null,
    bestWin,
    history: ascending.reverse(),
  };
}
