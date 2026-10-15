import { SNAPSHOT_MOVIES } from "./catalogue-snapshot.ts";
import { DEMO_MOVIES } from "./demo.ts";
import type { Movie } from "../game/types.ts";

// Keep the original hand-checked modern additions and local artwork. Merge rather
// than replace so collection selection hints survive the curated overrides.
const movies = new Map<number, Movie>(
  SNAPSHOT_MOVIES.map((m) => [m.tmdbId, m]),
);
for (const movie of DEMO_MOVIES)
  movies.set(movie.tmdbId, { ...movies.get(movie.tmdbId), ...movie });
export const PRACTICE_CATALOGUE = [...movies.values()];
