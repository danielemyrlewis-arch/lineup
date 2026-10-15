import { SNAPSHOT_DETAILS } from "./details-snapshot.ts";
import { applyMovieEnrichment } from "./enrichment.ts";
import type { Movie } from "../game/types.ts";

/** Bundled fallback only. Live TMDB unknowns are never filled with stale gender/companies. */
export function withBundledDetails(movie: Movie): Movie {
  const merged = { ...SNAPSHOT_DETAILS[movie.tmdbId], ...movie };
  // Keep the historical cast strings consistent with the verified TMDB person correction.
  // https://www.themoviedb.org/person/27578-elliot-page
  if (merged.cast?.includes("Ellen Page"))
    merged.cast = merged.cast.map((name) =>
      name === "Ellen Page" ? "Elliot Page" : name,
    );
  if (merged.topBilledLead === undefined && movie.cast?.[0]) {
    merged.topBilledLead = {
      tmdbId: null,
      name: movie.cast[0],
      character: null,
      gender: null,
    };
  }
  // Older bundled additions can still show known names without inventing roles/images.
  if (merged.castMembers === undefined && merged.cast?.length)
    merged.castMembers = merged.cast.slice(0, 10).map((name) => ({
      tmdbId: null,
      name,
      character: null,
      profilePath: null,
      order: null,
    }));
  return applyMovieEnrichment(merged);
}
