import test from "node:test";
import assert from "node:assert/strict";
import { DemoProvider, getCatalogue } from "../lib/data/provider.ts";

test("static provider returns the existing complete catalogue without network requests", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("No runtime API may be called");
  });
  const a = await getCatalogue(),
    b = await getCatalogue();
  assert.equal(a.source, "demo");
  assert.equal(a.movies, b.movies);
  assert.equal(a.movies, await new DemoProvider().catalogue());
  assert.ok(a.movies.length >= 1000);
  assert.equal(fetch.mock.callCount(), 0);
});

test("static catalogue preserves gameplay, details, studio, lead, cast and enrichment metadata", async () => {
  const { movies } = await getCatalogue();
  assert.ok(
    movies.every(
      (m) => m.posterPath && m.genres?.length && m.runtime && m.releaseYear,
    ),
  );
  const m = movies.find((m) => m.tmdbId === 27205)!;
  assert.ok(m.director && m.cast?.length && m.overview);
  assert.ok(m.productionCompanies?.length && m.topBilledLead);
  assert.equal(m.castMembers?.length, 10);
  assert.equal(m.enrichment?.isMusical, false);
});
