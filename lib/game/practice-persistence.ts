import { decodeGameProgress, encodeGameProgress } from "./daily-persistence.ts";
import type { GameState, Movie, Puzzle } from "./types.ts";

export const PRACTICE_PROGRESS_KEY = "lineup:practice:progress:v1";
const SCHEMA = 1;
const MAX_STORED_LENGTH = 32_000;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const boundedId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const date = (value: unknown): value is string => typeof value === "string" &&
  value.length <= 40 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export interface PracticeProgress {
  kind: "missing" | "saved" | "invalid" | "unavailable";
  state: GameState | null;
}
function validPuzzle(value: Puzzle): boolean {
  return value.mode === "practice" && value.daily === undefined &&
    Number.isSafeInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffff_ffff &&
    value.id === `practice-${value.seed}` && (value.source === "demo" || value.source === "tmdb") &&
    date(value.createdAt) && value.movies.length === 24 &&
    value.movies.every(movie => boundedId(movie.id)) &&
    new Set(value.movies.map(movie => movie.id)).size === 24 &&
    value.movies.some(movie => movie.id === value.mysteryId);
}

/** The exact random board is retained: its seed alone cannot reproduce recency-based selection. */
export function readPracticeProgress(
  catalogue: readonly Movie[],
  storage?: Pick<Storage, "getItem">,
): PracticeProgress {
  let raw: string | null;
  try { raw = (storage ?? localStorage).getItem(PRACTICE_PROGRESS_KEY); }
  catch { return {kind: "unavailable", state: null}; }
  if (raw === null) return {kind: "missing", state: null};
  if (raw.length > MAX_STORED_LENGTH) return {kind: "invalid", state: null};
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.schema !== SCHEMA || !object(value.puzzle)) return {kind: "invalid", state: null};
    const saved = value.puzzle;
    if (saved.mode !== "practice" || !Array.isArray(saved.movieIds) || saved.movieIds.length !== 24 ||
        !saved.movieIds.every(boundedId) || new Set(saved.movieIds).size !== 24 ||
        !boundedId(saved.mysteryId) || !saved.movieIds.includes(saved.mysteryId)) return {kind: "invalid", state: null};
    const byId = new Map(catalogue.map(movie => [movie.id, movie]));
    const movies = saved.movieIds.map(id => byId.get(id));
    if (movies.some(movie => !movie)) return {kind: "invalid", state: null};
    const puzzle: Puzzle = {id: saved.id as string, mode: "practice", seed: saved.seed as number,
      movies: movies as Movie[], mysteryId: saved.mysteryId,
      source: saved.source as Puzzle["source"], createdAt: saved.createdAt as string};
    if (!validPuzzle(puzzle)) return {kind: "invalid", state: null};
    const state = decodeGameProgress(value.progress, puzzle);
    if (!state) return {kind: "invalid", state: null};
    return state.status === "playing" ? {kind: "saved", state} : {kind: "missing", state: null};
  } catch { return {kind: "invalid", state: null}; }
}

/** This snapshot never writes account data, Daily progress or existing Practice statistics/history. */
export function writePracticeProgress(
  state: GameState,
  storage?: Pick<Storage, "setItem" | "removeItem">,
): boolean {
  try {
    if (!validPuzzle(state.puzzle)) return false;
    const progress = encodeGameProgress(state);
    if (!decodeGameProgress(progress, state.puzzle)) return false;
    const target = storage ?? localStorage;
    if (state.status !== "playing") { target.removeItem(PRACTICE_PROGRESS_KEY); return true; }
    const puzzle = state.puzzle;
    const raw = JSON.stringify({schema: SCHEMA,
      puzzle: {id: puzzle.id, mode: "practice", seed: puzzle.seed, movieIds: puzzle.movies.map(movie => movie.id),
        mysteryId: puzzle.mysteryId, source: puzzle.source, createdAt: puzzle.createdAt}, progress});
    if (raw.length > MAX_STORED_LENGTH) return false;
    target.setItem(PRACTICE_PROGRESS_KEY, raw);
    return true;
  } catch { return false; }
}
