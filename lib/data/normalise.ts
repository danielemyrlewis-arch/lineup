import type { Movie, ProductionCompany, TopBilledLead } from "../game/types.ts";
import { applyMovieEnrichment } from "./enrichment.ts";
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
    !Number.isSafeInteger(id) ||
    !title ||
    m.adult === true ||
    m.video === true ||
    m.status === "Rumored" ||
    m.status === "Planned" ||
    !poster ||
    !/^\/[a-zA-Z0-9._-]+\.(jpg|png|webp)$/.test(poster)
  )
    return null;
  const validDate =
    typeof m.release_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(m.release_date) &&
    Number.isFinite(Date.parse(m.release_date)) &&
    new Date(m.release_date).toISOString().slice(0, 10) === m.release_date &&
    m.release_date <= new Date().toISOString().slice(0, 10);
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
    .sort((a, b) => castOrder(a.order) - castOrder(b.order))
    .slice(0, 5);
  const cast = billed?.flatMap((c) => {
    const name = string(c.name);
    return name ? [name] : [];
  });
  const countries = strings(m.production_countries, "iso_3166_1")?.filter(
    (country) => /^[A-Z]{2}$/.test(country),
  );
  const first = billed?.[0];
  const leadName = string(first?.name);
  const topBilledLead: TopBilledLead | null = leadName
    ? {
        tmdbId: number(first?.id),
        name: leadName,
        character: string(first?.character),
        gender:
          first?.gender === 1
            ? "female"
            : first?.gender === 2
              ? "male"
              : first?.gender === 3
                ? "nonbinary"
                : null,
      }
    : null;
  return applyMovieEnrichment({
    id: String(id),
    tmdbId: id,
    title,
    posterPath: poster,
    releaseYear:
      validDate && year && year >= 1888 && year <= new Date().getFullYear()
        ? year
        : null,
    genres: strings(m.genres, "name"),
    runtime: number(m.runtime),
    director: string(director?.name),
    cast: cast?.length ? cast : null,
    overview: string(m.overview)?.slice(0, 1000) ?? null,
    productionCompanies: normaliseCompanies(m.production_companies),
    topBilledLead,
    originalLanguage:
      typeof m.original_language === "string" &&
      /^[a-z]{2}$/.test(m.original_language)
        ? m.original_language
        : null,
    productionCountries: countries?.length ? countries : null,
    belongsToCollection:
      m.belongs_to_collection === null
        ? false
        : record(m.belongs_to_collection)?.id
          ? true
          : null,
    collectionId: number(record(m.belongs_to_collection)?.id),
    collectionName: string(record(m.belongs_to_collection)?.name),
    popularity: number(m.popularity) ?? 0,
    voteCount: number(m.vote_count) ?? 0,
  });
}
function castOrder(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : Number.MAX_SAFE_INTEGER;
}
function normaliseCompanies(value: unknown): ProductionCompany[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const companies: ProductionCompany[] = [];
  for (const entry of value) {
    const company = record(entry),
      id = number(company?.id),
      name = string(company?.name);
    // An incomplete list cannot safely support a NO answer for an omitted studio.
    if (!id || !Number.isSafeInteger(id) || !name) return null;
    companies.push({ id, name });
  }
  return [
    ...new Map(companies.map((company) => [company.id, company])).values(),
  ];
}
