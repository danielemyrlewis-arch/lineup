// Server entry point: only import from server components or route handlers.
import { PRACTICE_CATALOGUE } from "./catalogue.ts";
import { normaliseMovie } from "./normalise.ts";
import { eligiblePracticeMovie } from "../game/practice-eligibility.ts";
import type { Movie, Puzzle } from "../game/types.ts";
export interface MovieProvider {
  catalogue(): Promise<Movie[]>;
}
export class DemoProvider implements MovieProvider {
  async catalogue() {
    return PRACTICE_CATALOGUE;
  }
}
const DAY = 24 * 60 * 60 * 1000;
let catalogueCache: {
  expires: number;
  value: Promise<Movie[]>;
  failed?: boolean;
} | null = null;

/** Diverse discovery, seeded with a rich snapshot so cold starts aren't a tiny top-50 pool. */
export class TMDBProvider implements MovieProvider {
  private token: string;
  private fetcher: typeof fetch;
  constructor(token: string, fetcher: typeof fetch = fetch) {
    this.token = token;
    this.fetcher = fetcher;
  }
  private async request(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetcher(`https://api.themoviedb.org/3${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) throw new Error("Movie catalogue unavailable");
    return response.json();
  }
  async catalogue(): Promise<Movie[]> {
    const signal = AbortSignal.timeout(15000);
    const year = new Date().getFullYear();
    const buckets: Record<string, string>[] = [
      ...[1930, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map((start) => ({
        "primary_release_date.gte": `${start}-01-01`,
        "primary_release_date.lte": `${start === 1930 ? 1959 : Math.min(start + 9, year)}-12-31`,
        "vote_count.gte": String(start < 1980 ? 150 : start < 2000 ? 250 : 500),
      })),
      ...["16", "27", "35"].map((genre) => ({ with_genres: genre })),
      ...["ja", "ko", "fr", "es", "hi"].map((language) => ({
        with_original_language: language,
        "vote_count.gte": "150",
      })),
    ];
    // Rotate pages and interleave buckets rather than always taking the first popular hits.
    const pageNumber = 1 + (Math.floor(Date.now() / DAY) % 3);
    const pages: PromiseSettledResult<unknown>[] = [];
    for (let i = 0; i < buckets.length; i += 6) {
      pages.push(
        ...(await Promise.allSettled(
          buckets.slice(i, i + 6).map((bucket) => {
            const params = new URLSearchParams({
              include_adult: "false",
              include_video: "false",
              "with_runtime.gte": "60",
              "vote_count.gte": "500",
              sort_by: "vote_count.desc",
              language: "en-US",
              page: String(pageNumber),
              ...bucket,
            });
            return this.request(`/discover/movie?${params}`, signal);
          }),
        )),
      );
    }
    const groups = pages.map((page) => {
      const raw =
        page.status === "fulfilled" &&
        typeof page.value === "object" &&
        page.value
          ? (page.value as { results?: unknown }).results
          : null;
      return Array.isArray(raw)
        ? raw.flatMap((r) => {
            const id = typeof r === "object" && r && "id" in r ? r.id : null;
            return typeof id === "number" && Number.isSafeInteger(id) && id > 0
              ? [id]
              : [];
          })
        : [];
    });
    const ids = new Set<number>();
    for (let rank = 0; rank < 20; rank++)
      for (const group of groups) if (group[rank]) ids.add(group[rank]);
    if (!ids.size) throw new Error("Insufficient suitable films");
    const movies = new Map(PRACTICE_CATALOGUE.map((m) => [m.tmdbId, m]));
    // At most 46 upstream requests / refresh (16 discovery + 30 details). No huge
    // cold-start fanout or browser catalogue download. The full snapshot remains eligible.
    const candidates = [...ids].slice(0, 30);
    let refreshed = 0;
    for (let i = 0; i < candidates.length && !signal.aborted; i += 6) {
      const chunk = await Promise.allSettled(
        candidates
          .slice(i, i + 6)
          .map((id) =>
            this.request(
              `/movie/${id}?append_to_response=credits&language=en-US`,
              signal,
            ),
          ),
      );
      for (const item of chunk) {
        if (item.status !== "fulfilled") continue;
        const m = normaliseMovie(item.value);
        if (m && eligiblePracticeMovie(m, 2)) {
          movies.set(m.tmdbId, m);
          refreshed++;
        }
      }
    }
    if (!refreshed) throw new Error("Insufficient suitable films");
    return [...movies.values()];
  }
}
export async function getCatalogue(): Promise<{
  movies: Movie[];
  source: Puzzle["source"];
}> {
  const token = process.env.TMDB_API_TOKEN?.trim();
  if (!token) return { movies: PRACTICE_CATALOGUE, source: "demo" };
  try {
    if (!catalogueCache || catalogueCache.expires < Date.now())
      catalogueCache = {
        expires: Date.now() + DAY,
        value: new TMDBProvider(token).catalogue(),
      };
    return { movies: await catalogueCache.value, source: "tmdb" };
  } catch {
    // Short backoff on service failures. No credentials/upstream payloads enter client logs.
    if (catalogueCache && !catalogueCache.failed) {
      catalogueCache.failed = true;
      catalogueCache.expires = Date.now() + 60000;
    }
    return { movies: PRACTICE_CATALOGUE, source: "demo" };
  }
}
