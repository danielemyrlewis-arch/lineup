import test from "node:test";
import assert from "node:assert/strict";
import { DemoProvider, TMDBProvider } from "../lib/data/provider.ts";

test("demo provider runs without any external requests or credentials", async () => {
  const movies = await new DemoProvider().catalogue();
  assert.equal(movies.length, 40);
  assert.ok(movies.every((m) => m.localPoster && m.posterPath));
});
test("TMDB provider authenticates server requests, appends credits, normalises and bounds concurrency", async () => {
  let running = 0,
    maximum = 0,
    details = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer fake-test-token",
    );
    assert.equal(url.origin, "https://api.themoviedb.org");
    if (url.pathname.endsWith("/discover/movie"))
      return Response.json({
        results: Array.from({ length: 30 }, (_, i) => ({ id: i + 1 })),
      });
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
  assert.equal(movies.length, 30);
  assert.equal(details, 30);
  assert.ok(maximum <= 6);
  assert.equal(movies[0].director, "Director");
  assert.equal(movies[0].belongsToCollection, false);
  assert.deepEqual(movies[0].cast, ["Lead"]);
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
