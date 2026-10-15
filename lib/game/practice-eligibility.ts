import type { Movie } from "./types.ts";

export type RecognitionTier = 0 | 1 | 2;
/** Vote history is primary; a popularity floor only rejects low-signal marginal records. */
export function recognitionThreshold(
  movie: Movie,
  tier: RecognitionTier = 0,
): number {
  const year = movie.releaseYear ?? 9999;
  const thresholds =
    year < 1980
      ? [250, 200, 150]
      : year < 2000
        ? [600, 400, 250]
        : [1200, 800, 500];
  // International hits have smaller TMDB voting audiences. Never relax below 150 votes.
  return Math.max(
    150,
    Math.round(
      thresholds[tier] *
        (movie.originalLanguage && movie.originalLanguage !== "en" ? 0.65 : 1),
    ),
  );
}
export function eligiblePracticeMovie(
  movie: Movie,
  tier: RecognitionTier = 0,
): boolean {
  const threshold = recognitionThreshold(movie, tier);
  return (
    Number.isSafeInteger(movie.tmdbId) &&
    movie.tmdbId > 0 &&
    movie.id === String(movie.tmdbId) &&
    Boolean(movie.title?.trim()) &&
    typeof movie.posterPath === "string" &&
    /^\/[a-zA-Z0-9._-]+\.(jpg|png|webp)$/.test(movie.posterPath) &&
    Number.isInteger(movie.releaseYear) &&
    movie.releaseYear! >= 1888 &&
    movie.releaseYear! <= new Date().getFullYear() &&
    typeof movie.runtime === "number" &&
    movie.runtime >= 60 &&
    movie.runtime <= 360 &&
    Array.isArray(movie.genres) &&
    movie.genres.length > 0 &&
    !movie.genres.includes("TV Movie") &&
    Number.isFinite(movie.voteCount) &&
    movie.voteCount >= threshold &&
    Number.isFinite(movie.popularity) &&
    (movie.popularity >= 0.5 || movie.voteCount >= threshold * 2)
  );
}
