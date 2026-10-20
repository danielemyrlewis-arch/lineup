import { activeMovies, gameReducer, initialState, QUESTION_LIMIT } from "./engine.ts";
import { validQuestions } from "./questions.ts";
import { isDailyDate } from "./daily-date.ts";
import type { GameAction, GameState, Puzzle } from "./types.ts";

export const DAILY_PROGRESS_PREFIX = "lineup:daily:progress:v1:";
const SCHEMA = 1;
const MAX_STORED_LENGTH = 32_000;
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type DailyProgressKind = "missing" | "saved" | "invalid" | "unavailable";
export interface DailyProgress {
  kind: DailyProgressKind;
  state: GameState;
}
export interface DailyAdvance extends DailyProgress {
  /** True only when this action was accepted by the canonical reducer. */
  accepted: boolean;
  /** False when browser restrictions prevent durable storage. */
  saved: boolean;
}
interface StoredQuestion {
  id: string;
  answer: boolean;
  remaining: number;
  eliminatedIds: string[];
}
interface StoredDailyProgress {
  schema: number;
  date: string;
  puzzleId: string;
  number: number;
  catalogueVersion: string;
  questions: StoredQuestion[];
  activeIds: string[];
  questionsUsed: number;
  questionsLeft: number;
  finalGuessSubmitted: boolean;
  guessId: string | null;
  status: GameState["status"];
  filmsRemainingAtGuess: number | null;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const boundedId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;

function dailyIdentity(puzzle: Puzzle) {
  return puzzle.mode === "daily" && puzzle.daily && isDailyDate(puzzle.daily.date) &&
    Number.isSafeInteger(puzzle.daily.number) && puzzle.daily.number > 0 &&
    boundedId(puzzle.daily.catalogueVersion) && boundedId(puzzle.id) ? puzzle.daily : null;
}

export function dailyProgressKey(date: string): string {
  if (!isDailyDate(date)) throw new RangeError("Invalid daily progress date");
  return `${DAILY_PROGRESS_PREFIX}${date}`;
}

/** Compact facts are stored; movie objects and the hidden answer are not duplicated. */
function encode(state: GameState): StoredDailyProgress {
  const daily = dailyIdentity(state.puzzle)!;
  return {
    schema: SCHEMA,
    date: daily.date,
    puzzleId: state.puzzle.id,
    number: daily.number,
    catalogueVersion: daily.catalogueVersion,
    questions: state.history.map(h => ({ id: h.question.id, answer: h.answer,
      remaining: h.remaining, eliminatedIds: h.eliminatedIds })),
    activeIds: state.activeIds,
    questionsUsed: state.history.length,
    questionsLeft: QUESTION_LIMIT - state.history.length,
    finalGuessSubmitted: state.status !== "playing",
    guessId: state.guessId,
    status: state.status,
    filmsRemainingAtGuess: state.status === "playing" ? null : state.activeIds.length,
  };
}

/** Rebuild only through the shared engine; stored answers/counts never become rules. */
function decode(value: unknown, puzzle: Puzzle): GameState | null {
  const daily = dailyIdentity(puzzle);
  if (!daily || !object(value) || value.schema !== SCHEMA || value.date !== daily.date ||
      value.puzzleId !== puzzle.id || value.number !== daily.number ||
      value.catalogueVersion !== daily.catalogueVersion || !Array.isArray(value.questions) ||
      value.questions.length > QUESTION_LIMIT) return null;
  let state = initialState(puzzle);
  for (const row of value.questions) {
    if (!object(row) || !boundedId(row.id) || typeof row.answer !== "boolean") return null;
    const question = validQuestions(activeMovies(state), state.history.map(h => h.question.id))
      .find(q => q.id === row.id);
    if (!question) return null;
    const next = gameReducer(state, { type: "ask", question });
    const answer = next.history.at(-1);
    if (next === state || !answer || row.answer !== answer.answer ||
        row.remaining !== answer.remaining || !same(row.eliminatedIds, answer.eliminatedIds)) return null;
    state = next;
  }
  if (value.finalGuessSubmitted === true) {
    if (!boundedId(value.guessId)) return null;
    const next = gameReducer(state, { type: "guess", movieId: value.guessId });
    if (next === state) return null;
    state = next;
  } else if (value.finalGuessSubmitted !== false || value.guessId !== null) return null;
  const expected = encode(state);
  // This also verifies status, used/remaining budget, final remaining count and film order.
  for (const key of Object.keys(expected) as (keyof StoredDailyProgress)[])
    if (!same(value[key], expected[key])) return null;
  return state;
}

export function readDailyProgress(puzzle: Puzzle, storage?: StorageLike): DailyProgress {
  const fresh = initialState(puzzle);
  const daily = dailyIdentity(puzzle);
  if (!daily) return { kind: "invalid", state: fresh };
  let raw: string | null;
  try {
    raw = (storage ?? localStorage).getItem(dailyProgressKey(daily.date));
  } catch {
    return { kind: "unavailable", state: fresh };
  }
  if (raw === null) return { kind: "missing", state: fresh };
  if (raw.length > MAX_STORED_LENGTH) return { kind: "invalid", state: fresh };
  try {
    const state = decode(JSON.parse(raw), puzzle);
    return state ? { kind: "saved", state } : { kind: "invalid", state: fresh };
  } catch {
    return { kind: "invalid", state: fresh };
  }
}

/** Preserve a trusted in-memory attempt without merging another date/version/lineup. */
export function reconcileDailyProgress(current: GameState, loaded: DailyProgress): GameState {
  const cachedIdentity = dailyIdentity(current.puzzle);
  const loadedIdentity = dailyIdentity(loaded.state.puzzle);
  if (!cachedIdentity || !loadedIdentity || loaded.kind === "invalid" ||
      current.puzzle.id !== loaded.state.puzzle.id || !same(cachedIdentity, loadedIdentity) ||
      current.puzzle.mysteryId !== loaded.state.puzzle.mysteryId ||
      !same(current.puzzle.movies.map(m => m.id), loaded.state.puzzle.movies.map(m => m.id)))
    return loaded.state;
  if (loaded.kind !== "saved") return current;
  // Another tab's completed attempt always wins. A prior failed write must not
  // throw away this tab's longer, consistent in-memory progress.
  if (loaded.state.status !== "playing") return loaded.state;
  const prefix = current.history.slice(0, loaded.state.history.length);
  if (same(prefix, loaded.state.history) && current.history.length >= loaded.state.history.length)
    return current;
  return loaded.state;
}

/** Read latest, apply once and synchronously save before the caller renders it. */
export function advanceDailyProgress(
  current: GameState,
  action: GameAction,
  storage?: StorageLike,
): DailyAdvance {
  const loaded = readDailyProgress(current.puzzle, storage);
  if (loaded.kind === "invalid")
    return { ...loaded, state: current, accepted: false, saved: false };
  const base = reconcileDailyProgress(current, loaded);
  if (action.type === "new" || base.status !== "playing")
    return { kind: loaded.kind, state: base, accepted: false, saved: loaded.kind === "saved" };
  const next = gameReducer(base, action);
  if (next === base)
    return { kind: loaded.kind, state: base, accepted: false, saved: loaded.kind === "saved" };
  try {
    (storage ?? localStorage).setItem(dailyProgressKey(next.puzzle.daily!.date), JSON.stringify(encode(next)));
    return { kind: "saved", state: next, accepted: true, saved: true };
  } catch {
    return { kind: "unavailable", state: next, accepted: true, saved: false };
  }
}
