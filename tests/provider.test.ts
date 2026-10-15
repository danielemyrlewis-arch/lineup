import test from "node:test";
import assert from "node:assert/strict";
import { DemoProvider, TMDBProvider } from "../lib/data/provider.ts";

test("demo provider runs without any external requests or credentials", async () => {
  const movies = await new DemoProvider().catalogue();
  assert.ok(movies.length >= 1000);
  assert.ok(
    movies.every(
      (m) => m.posterPath && m.genres?.length && m.runtime && m.releaseYear,
    ),
  );
});
test("TMDB provider authenticates server requests, appends credits, normalises and bounds concurrency", async () => {
  let running = 0,
    maximum = 0,
    details = 0;
  const discovery: URL[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer fake-test-token",
    );
    assert.equal(url.origin, "https://api.themoviedb.org");
    if (url.pathname.endsWith("/discover/movie")) {
      discovery.push(url);
      return Response.json({
        results: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1 + (discovery.length - 1) * 10,
        })),
      });
    }
    assert.equal(url.searchParams.get("append_to_response"), "credits");
    running++;
    maximum = Math.max(maximum, running);
    details++;
    await new Promise((resolve) => setTimeout(resolve, 1));
    running--;
    const id = Number(url.pathname.split("/").at(-1));
    return Response.json({
      id,
      title: `Film ${id}`,
      release_date: "2001-01-01",
      poster_path: "/poster.jpg",
      vote_count: 4000,
      runtime: 110,
      genres: [{ name: "Drama" }],
      belongs_to_collection: null,
      original_language: "en",
      production_countries: [{ iso_3166_1: "US" }],
      credits: {
        crew: [{ name: "Director", job: "Director" }],
        cast: [{ name: "Lead", order: 0 }],
      },
    });
  };
  const movies = await new TMDBProvider("fake-test-token", fetcher).catalogue();
  assert.ok(movies.length >= 1000);
  assert.equal(details, 30);
  assert.ok(maximum <= 6);
  const refreshed = movies.find((m) => m.tmdbId === 1)!;
  assert.equal(refreshed.director, "Director");
  assert.equal(refreshed.belongsToCollection, false);
  assert.deepEqual(refreshed.cast, ["Lead"]);
  assert.equal(discovery.length, 16);
  assert.ok(
    discovery.some(
      (url) => url.searchParams.get("with_original_language") === "ja",
    ),
  );
  assert.ok(
    discovery.some(
      (url) =>
        url.searchParams.get("primary_release_date.gte") === "1930-01-01",
    ),
  );
  assert.ok(
    discovery.every((url) => url.searchParams.get("with_runtime.gte") === "60"),
  );
});
test("TMDB provider rejects insufficient/malformed results for safe demo fallback", async () => {
  const malformed: typeof fetch = async () =>
    Response.json({ unexpected: "response" });
  await assert.rejects(
    new TMDBProvider("fake", malformed).catalogue(),
    /Insufficient/,
  );
  const unavailable: typeof fetch = async () =>
    new Response("", { status: 503 });
  await assert.rejects(
    new TMDBProvider("fake", unavailable).catalogue(),
    /Insufficient/,
  );
});
