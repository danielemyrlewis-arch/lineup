import type { Movie } from "../game/types.ts";
import { OSCAR_RECORDS } from "./oscar-snapshot.ts";
import { normaliseOscarRecord } from "./awards.ts";
import { OSCAR_QUESTION_EVIDENCE } from "./oscar-question-snapshot.ts";

/** Static preparation only. No missing-ID fallback and no title-only join. */
export function withBundledAwards(movie: Movie): Movie {
  const complete = OSCAR_RECORDS[movie.tmdbId];
  const answers = OSCAR_QUESTION_EVIDENCE[movie.tmdbId];
  const record = normaliseOscarRecord(answers
    ? {...complete, awardsDataStatus:complete?"verified":"partial", answers}
    : complete);
  return {...movie, oscars: record};
}
