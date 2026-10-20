import type { Movie, Puzzle } from "./types.ts";
import { DAILY_SCHEDULE_DATA } from "../data/daily-schedule.ts";
import { DAILY_CATALOGUE_VERSION } from "../data/daily-config.ts";

export interface DailyScheduleEntry {
  id: string;
  date: string;
  number: number;
  movieIds: readonly number[];
  mysteryMovieId: number;
  catalogueVersion: string;
  seed: number;
}
export const DAILY_SCHEDULE: readonly DailyScheduleEntry[] = DAILY_SCHEDULE_DATA.entries;
export { DAILY_CATALOGUE_VERSION };

/** Explicit frozen-date lookup; no random generation, local timezone or date-seed derivation. */
export function getDailyEntry(date: string): DailyScheduleEntry | null {
  return DAILY_SCHEDULE.find(entry => entry.date === date) ?? null;
}
export const dailyNumber = (number: number): string => String(number).padStart(3, "0");

/** Resolve the published ordered IDs. Missing/version-changed references fail visibly. */
export function resolveDailyPuzzle(entry: DailyScheduleEntry, catalogue: readonly Movie[]): Puzzle {
  if (entry.catalogueVersion !== DAILY_CATALOGUE_VERSION)
    throw new Error("This Daily catalogue version is unavailable.");
  const byId = new Map(catalogue.map(movie => [movie.tmdbId, movie]));
  const movies = entry.movieIds.map(id => byId.get(id));
  if (movies.length !== 24 || new Set(entry.movieIds).size !== 24 ||
      movies.some(movie => !movie) || !entry.movieIds.includes(entry.mysteryMovieId))
    throw new Error("This Daily lineup has unavailable film references.");
  return {
    id: entry.id,
    mode: "daily",
    seed: entry.seed,
    movies: movies as Movie[],
    mysteryId: String(entry.mysteryMovieId),
    source: "demo",
    createdAt: `${entry.date}T00:00:00.000Z`,
    daily: {date:entry.date,number:entry.number,catalogueVersion:entry.catalogueVersion},
  };
}
