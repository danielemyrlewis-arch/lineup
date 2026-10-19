import type { Movie } from "../game/types.ts";
import { OSCAR_RECORDS } from "./oscar-snapshot.ts";
import { normaliseOscarRecord } from "./awards.ts";

/** Static preparation only. No missing-ID fallback and no title-only join. */
export function withBundledAwards(movie: Movie): Movie {
  const record = normaliseOscarRecord(OSCAR_RECORDS[movie.tmdbId]);
  return {...movie, oscars: record};
}
