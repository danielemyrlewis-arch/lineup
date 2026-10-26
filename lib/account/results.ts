import type { GameState } from "../game/types.ts";
import { gameReducer, initialState, deductionPath, LINEUP_SIZE, QUESTION_LIMIT } from "../game/engine.ts";
import { getDailyEntry } from "../game/daily-schedule.ts";
import { isDailyDate, londonDate } from "../game/daily-date.ts";

/** The existing result has no numeric score: keep outcome, questions and real path. */
export interface CompletedDailyResult {
  puzzle_id: string;
  puzzle_date: string;
  puzzle_number: number;
  outcome: "won" | "lost";
  questions_used: number;
  films_remaining: number;
  deduction_path: number[];
  completed_at: string;
}
export interface DailyResult extends CompletedDailyResult {
  user_id: string;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;

/** Reject incompatible/malformed API rows and queued guest summaries; strip extra fields. */
export function parseCompletedDailyResult(value: unknown): CompletedDailyResult | null {
  if (!object(value) || typeof value.puzzle_date !== "string") return null;
  const entry = getDailyEntry(value.puzzle_date);
  if (!entry || value.puzzle_id !== entry.id || value.puzzle_number !== entry.number ||
      (value.outcome !== "won" && value.outcome !== "lost") ||
      !integer(value.questions_used, 0, QUESTION_LIMIT) ||
      !integer(value.films_remaining, 1, LINEUP_SIZE) ||
      !Array.isArray(value.deduction_path) || value.deduction_path.length !== value.questions_used + 1 ||
      !value.deduction_path.every(count => integer(count, 1, LINEUP_SIZE)) ||
      value.deduction_path[0] !== LINEUP_SIZE || value.deduction_path.at(-1) !== value.films_remaining ||
      value.deduction_path.some((count, i, path) => i > 0 && count > path[i - 1]) ||
      typeof value.completed_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.completed_at) ||
      !isDailyDate(value.completed_at.slice(0, 10)) ||
      !Number.isFinite(Date.parse(value.completed_at))) return null;
  const completed = new Date(value.completed_at);
  if (londonDate(completed) < entry.date) return null;
  return {
    puzzle_id: entry.id,
    puzzle_date: entry.date,
    puzzle_number: entry.number,
    outcome: value.outcome,
    questions_used: value.questions_used,
    films_remaining: value.films_remaining,
    deduction_path: [...value.deduction_path],
    completed_at: completed.toISOString(),
  };
}

export function parseDailyResult(value: unknown): DailyResult | null {
  if (!object(value) || typeof value.user_id !== "string" || !uuid.test(value.user_id)) return null;
  const result = parseCompletedDailyResult(value);
  return result ? { user_id: value.user_id, ...result } : null;
}

/** Only a final, internally consistent scheduled Daily can enter an account queue. */
export function completedDailyResult(state: GameState, completedAt = new Date().toISOString()): CompletedDailyResult | null {
  const {puzzle} = state;
  if (puzzle.mode !== "daily" || !puzzle.daily || state.status === "playing" ||
      !state.guessId || state.history.length > QUESTION_LIMIT) return null;
  const entry = getDailyEntry(puzzle.daily.date);
  if (!entry || puzzle.id !== entry.id || puzzle.daily.number !== entry.number ||
      puzzle.daily.catalogueVersion !== entry.catalogueVersion ||
      puzzle.mysteryId !== String(entry.mysteryMovieId) ||
      !same(puzzle.movies.map(movie => movie.tmdbId), entry.movieIds)) return null;
  // Replaying the same canonical reducer prevents stale UI/corrupt stored facts
  // from being uploaded accidentally. It is not an anti-cheat security boundary.
  let verified = initialState(puzzle);
  for (const answer of state.history) {
    const next = gameReducer(verified, {type: "ask", question: answer.question});
    const latest = next.history.at(-1);
    if (next === verified || !latest || latest.answer !== answer.answer ||
        latest.remaining !== answer.remaining || !same(latest.eliminatedIds, answer.eliminatedIds)) return null;
    verified = next;
  }
  verified = gameReducer(verified, {type: "guess", movieId: state.guessId});
  if (verified.status !== state.status || verified.guessId !== state.guessId ||
      !same(verified.activeIds, state.activeIds)) return null;
  return parseCompletedDailyResult({
    puzzle_id: entry.id,
    puzzle_date: entry.date,
    puzzle_number: entry.number,
    outcome: state.status,
    questions_used: state.history.length,
    films_remaining: state.activeIds.length,
    deduction_path: deductionPath(state),
    completed_at: completedAt,
  });
}
