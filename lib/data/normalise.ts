import type { Movie } from "../game/types.ts";
const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const string = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const number = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const list = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
function strings(v: unknown, key: string): string[] | null {
  const a = list(v);
  if (!a) return null;
  const values = a.flatMap((x) => {
    const s = string(record(x)?.[key]);
    return s ? [s] : [];
  });
  return values.length ? values : null;
}
export function normaliseMovie(raw: unknown): Movie | null {
  const m = record(raw);
  if (!m) return null;
  const id = number(m.id),
    title = string(m.title),
    poster = string(m.poster_path);
  if (
    !id ||
    !title ||
    m.adult === true ||
    !poster ||
    !/^\/[a-zA-Z0-9._-]+\.(jpg|png|webp)$/.test(poster)
  )
    return null;
  const year =
    typeof m.release_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(m.release_date)
      ? Number(m.release_date.slice(0, 4))
      : null;
  const credits = record(m.credits);
  const crew = list(credits?.crew);
  const director = crew?.map(record).find((c) => c?.job === "Director");
  const billed = list(credits?.cast)
    ?.map(record)
    .filter((c): c is Record<string, unknown> => c !== null)
    .sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
    .slice(0, 5);
  return {
    id: String(id),
    tmdbId: id,
    title,
    posterPath: poster,
    releaseYear:
      year && year >= 1888 && year <= new Date().getFullYear() ? year : null,
    genres: strings(m.genres, "name"),
    runtime: number(m.runtime),
    director: string(director?.name),
    cast: billed?.length
      ? billed.flatMap((c) => {
          const name = string(c.name);
          return name ? [name] : [];
        })
      : null,
    originalLanguage:
      typeof m.original_language === "string" &&
      /^[a-z]{2}$/.test(m.original_language)
        ? m.original_language
        : null,
    productionCountries: strings(m.production_countries, "iso_3166_1"),
    belongsToCollection:
      m.belongs_to_collection === null
        ? false
        : record(m.belongs_to_collection)?.id
          ? true
          : null,
    popularity: number(m.popularity) ?? 0,
    voteCount: number(m.vote_count) ?? 0,
  };
}
