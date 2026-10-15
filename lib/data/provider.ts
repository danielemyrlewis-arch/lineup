// Server entry point: only import from server components or route handlers.
import { DEMO_MOVIES } from "./demo.ts";
import { normaliseMovie } from "./normalise.ts";
import type { Movie, Puzzle } from "../game/types.ts";
export interface MovieProvider {
  catalogue(): Promise<Movie[]>;
}
export class DemoProvider implements MovieProvider {
  async catalogue() {
    return DEMO_MOVIES;
  }
}
const DAY = 24 * 60 * 60 * 1000;
let catalogueCache: { expires: number; value: Promise<Movie[]> } | null = null;
export class TMDBProvider implements MovieProvider {
  private token: string;
  private fetcher: typeof fetch;
  private signal = AbortSignal.timeout(15000);
  constructor(token: string, fetcher: typeof fetch = fetch) {
    this.token = token;
    this.fetcher = fetcher;
  }
  private async request(path: string): Promise<unknown> {
    const response = await this.fetcher(`https://api.themoviedb.org/3${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.any([this.signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok) throw new Error("Movie catalogue unavailable");
    return response.json();
  }
  async catalogue(): Promise<Movie[]> {
    const pages = await Promise.allSettled(
      [1, 3, 5].map((page) =>
        this.request(
          `/discover/movie?include_adult=false&include_video=false&vote_count.gte=2500&sort_by=vote_count.desc&page=${page}&language=en-US`,
        ),
      ),
    );
    const ids = new Set<number>();
    for (const page of pages) {
      if (
        page.status !== "fulfilled" ||
        typeof page.value !== "object" ||
        !page.value
      )
        continue;
      const results = (page.value as { results?: unknown }).results;
      if (!Array.isArray(results)) continue;
      for (const r of results)
        if (
          typeof r === "object" &&
          r &&
          "id" in r &&
          typeof r.id === "number" &&
          Number.isSafeInteger(r.id) &&
          r.id > 0
        )
          ids.add(r.id);
    }
    const movies: Movie[] = [];
    // Bounded concurrent detail requests, credits appended once, cached as one catalogue.
    const candidates = [...ids].slice(0, 54);
    for (let i = 0; i < candidates.length; i += 6) {
      const chunk = await Promise.allSettled(
        candidates
          .slice(i, i + 6)
          .map((id) =>
            this.request(
              `/movie/${id}?append_to_response=credits&language=en-US`,
            ),
          ),
      );
      for (const item of chunk) {
        if (item.status !== "fulfilled") continue;
        const m = normaliseMovie(item.value);
        if (m && m.voteCount >= 2500) movies.push(m);
      }
    }
    // Do not include duplicate editions identified by the same normalised title + year.
    const unique = [
      ...new Map(
        movies.map((m) => [
          `${m.title.toLowerCase().replace(/[^a-z0-9]/g, "")}:${m.releaseYear}`,
          m,
        ]),
      ).values(),
    ];
    if (unique.length < 24) throw new Error("Insufficient suitable films");
    return unique;
  }
}
export async function getCatalogue(): Promise<{
  movies: Movie[];
  source: Puzzle["source"];
}> {
  const token = process.env.TMDB_API_TOKEN?.trim();
  if (!token)
    return { movies: await new DemoProvider().catalogue(), source: "demo" };
  try {
    if (!catalogueCache || catalogueCache.expires < Date.now())
      catalogueCache = {
        expires: Date.now() + DAY,
        value: new TMDBProvider(token).catalogue(),
      };
    return { movies: await catalogueCache.value, source: "tmdb" };
  } catch {
    // Short backoff on service failures. No credentials or upstream payloads reach the browser/logs.
    catalogueCache = {
      expires: Date.now() + 60000,
      value: Promise.reject(new Error("Retry later")),
    };
    catalogueCache.value.catch(() => {});
    return { movies: DEMO_MOVIES, source: "demo" };
  }
}
