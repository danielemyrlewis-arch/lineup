import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as awards from "../lib/data/awards.ts";
import { normaliseMovie } from "../lib/data/normalise.ts";
import { applyMovieEnrichment, curatedValue } from "../lib/data/enrichment.ts";
import { producedBy } from "../lib/data/studios.ts";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import {
  generateQuestions,
  evaluateQuestion,
  validQuestions,
  searchQuestions,
  suggestedQuestions,
} from "../lib/game/questions.ts";
import { initialState, createPuzzle, gameReducer } from "../lib/game/engine.ts";
import type { Movie, Question } from "../lib/game/types.ts";
const base = PRACTICE_CATALOGUE.find((m) => m.tmdbId === 27205)!;
const movie = (id: number, fields: Partial<Movie> = {}): Movie => ({
  ...base,
  tmdbId: id,
  id: String(id),
  ...fields,
});
const raw = {
  id: 90000001,
  title: "Test film",
  poster_path: "/poster.jpg",
  release_date: "2000-01-01",
  runtime: 120,
  genres: [{ name: "Drama" }],
};
const question = (id: string, movies: Movie[]): Question => {
  const q = generateQuestions(movies).find((q) => q.id === id);
  assert.ok(q, id);
  return q;
};

// Render the real JSX component with the existing TypeScript compiler. No new
// browser/testing dependency, substitute component or snapshot of its implementation.
const componentSource = readFileSync(
  new URL("../components/game/film-details.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(componentSource, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
});
const componentExports = {} as {
  FilmDetails: React.ComponentType<{ movie: Movie }>;
};
runInNewContext(compiled.outputText, {
  React,
  exports: componentExports,
  require: (name: string) => {
    if (name === "react") return React;
    assert.equal(name, "../../lib/data/awards");
    return awards;
  },
});
const render = (m: Movie) =>
  renderToStaticMarkup(
    React.createElement(componentExports.FilmDetails, { movie: m }),
  );

test("company normalisation preserves IDs, deduplicates and keeps missing/empty credits unknown", () => {
  const m = normaliseMovie({
    ...raw,
    production_companies: [
      { id: 420, name: "Marvel Studios" },
      { id: 420, name: "Marvel Studios" },
    ],
  })!;
  assert.deepEqual(m.productionCompanies, [
    { id: 420, name: "Marvel Studios" },
  ]);
  assert.equal(producedBy(m, "marvel"), true);
  assert.equal(producedBy(m, "disney"), false);
  assert.equal(normaliseMovie(raw)?.productionCompanies, null);
  assert.equal(
    normaliseMovie({ ...raw, production_companies: [] })?.productionCompanies,
    null,
  );
  const malformed = normaliseMovie({
    ...raw,
    production_companies: [{ id: 3, name: "Pixar" }, { id: 2 }],
  })!;
  assert.equal(malformed.productionCompanies, null);
  assert.equal(producedBy(malformed, "disney"), null);
});

test("studio allow-list supports exact legacy names without ownership or substring inference", () => {
  const pixar = movie(1, { productionCompanies: [{ id: 3, name: "Pixar" }] });
  assert.equal(producedBy(pixar, "pixar"), true);
  assert.equal(producedBy(pixar, "disney"), false);
  assert.equal(
    producedBy(
      movie(2, { productionCompanies: [{ id: 25, name: "20th Century Fox" }] }),
      "20th-century",
    ),
    true,
  );
  assert.equal(
    producedBy(
      movie(3, {
        productionCompanies: [{ id: null, name: "Pixar Animation Studios" }],
      }),
      "pixar",
    ),
    true,
  );
  assert.equal(
    producedBy(
      movie(4, {
        productionCompanies: [{ id: 888, name: "Not Walt Disney Pictures" }],
      }),
      "disney",
    ),
    false,
  );
  const movies = [
    pixar,
    movie(5, { productionCompanies: [{ id: 999, name: "Tiny test company" }] }),
  ];
  assert.ok(
    !generateQuestions(movies).some((q) =>
      q.label.includes("Tiny test company"),
    ),
  );
});

test("studio questions need YES/NO and fully known production credits; aliases find exact brands", () => {
  const studios = [
    movie(1, {
      productionCompanies: [{ id: 2, name: "Walt Disney Pictures" }],
    }),
    movie(2, { productionCompanies: [{ id: 420, name: "Marvel Studios" }] }),
    movie(3, { productionCompanies: [{ id: 3, name: "Pixar" }] }),
  ];
  const valid = validQuestions(studios);
  for (const [alias, id] of [
    ["Disney", "studio:disney"],
    ["Marvel", "studio:marvel"],
    ["Pixar", "studio:pixar"],
    ["studio", "studio:disney"],
  ])
    assert.ok(searchQuestions(valid, alias).some((q) => q.id === id));
  assert.equal(
    evaluateQuestion(studios[0], question("studio:disney", studios)),
    true,
  );
  assert.equal(
    evaluateQuestion(studios[1], question("studio:disney", studios)),
    false,
  );
  assert.ok(
    !validQuestions([studios[0], movie(4, { productionCompanies: null })]).some(
      (q) => q.kind === "studio",
    ),
  );
  assert.ok(
    !validQuestions([studios[0], { ...studios[0], id: "6", tmdbId: 6 }]).some(
      (q) => q.kind === "studio",
    ),
  );
});

test("top-billed lead uses lowest credit order, performer gender and character from the same record", () => {
  const m = normaliseMovie({
    ...raw,
    credits: {
      cast: [
        {
          id: 2,
          name: "Second",
          order: 1,
          gender: 1,
          character: "Second role",
        },
        {
          id: 1,
          name: "First",
          order: 0,
          gender: 2,
          character: "A female character",
        },
      ],
    },
  })!;
  assert.deepEqual(m.topBilledLead, {
    tmdbId: 1,
    name: "First",
    gender: "male",
    character: "A female character",
  });
  assert.equal(m.cast?.[0], "First");
  assert.equal(evaluateQuestion(m, question("leadGender:male", [m])), true);
  assert.equal(evaluateQuestion(m, question("leadGender:female", [m])), false);
});

test("unknown lead gender is never filled from another cast member, a name or a character", () => {
  for (const gender of [0, undefined, 99, "female"]) {
    const m = normaliseMovie({
      ...raw,
      credits: {
        cast: [
          { name: "A woman", order: 0, gender, character: "Mother" },
          { name: "Known second actor", order: 1, gender: 1 },
        ],
      },
    })!;
    assert.equal(m.topBilledLead?.gender, null);
    assert.equal(evaluateQuestion(m, question("leadGender:female", [m])), null);
  }
  const nonbinary = normaliseMovie({
    ...raw,
    credits: { cast: [{ name: "Lead", order: 0, gender: 3 }] },
  })!;
  assert.equal(nonbinary.topBilledLead?.gender, "nonbinary");
  assert.equal(
    evaluateQuestion(nonbinary, question("leadGender:female", [nonbinary])),
    false,
  );
  assert.equal(
    evaluateQuestion(nonbinary, question("leadGender:male", [nonbinary])),
    false,
  );
});

test("lead aliases do not confuse male with female or man with woman", () => {
  const movies = [
    movie(1, {
      topBilledLead: {
        tmdbId: 1,
        name: "A",
        gender: "female",
        character: null,
      },
    }),
    movie(2, {
      topBilledLead: { tmdbId: 2, name: "B", gender: "male", character: null },
    }),
  ];
  const valid = validQuestions(movies);
  for (const alias of ["female", "woman"]) {
    const matches = searchQuestions(valid, alias);
    assert.ok(matches.some((q) => q.id === "leadGender:female"));
    assert.ok(!matches.some((q) => q.id === "leadGender:male"));
  }
  for (const alias of ["male", "man"]) {
    const matches = searchQuestions(valid, alias);
    assert.ok(matches.some((q) => q.id === "leadGender:male"));
    assert.ok(!matches.some((q) => q.id === "leadGender:female"));
  }
  assert.ok(
    !validQuestions([...movies, movie(3, { topBilledLead: null })]).some(
      (q) => q.kind === "leadGender",
    ),
  );
});

test("before 1970 is strict; older decades and 60s aliases only surface with relevant films", () => {
  const movies = [
    movie(1, { releaseYear: 1969 }),
    movie(2, { releaseYear: 1970 }),
    movie(3, { releaseYear: 2000 }),
  ];
  const q = question("before:1970", movies);
  assert.equal(evaluateQuestion(movies[0], q), true);
  assert.equal(evaluateQuestion(movies[1], q), false);
  const valid = validQuestions(movies);
  assert.ok(searchQuestions(valid, "60s").some((q) => q.id === "decade:1960"));
  assert.ok(
    searchQuestions(valid, "before 1970").some((q) => q.id === "before:1970"),
  );
  const modern = validQuestions([
    movie(1, { releaseYear: 2010 }),
    movie(2, { releaseYear: 2020 }),
  ]);
  assert.ok(
    !modern.some(
      (q) =>
        q.id === "before:1970" ||
        ["decade:1930", "decade:1940", "decade:1950", "decade:1960"].includes(
          q.id,
        ),
    ),
  );
});

test("generic curated attributes preserve independent true, false and unknown states without mutation", () => {
  const original = movie(90000001, { enrichment: undefined });
  const enriched = applyMovieEnrichment(original, {
    90000001: { hasMainAnimalCharacter: true, isMusical: false },
  });
  assert.equal(curatedValue(enriched, "hasMainAnimalCharacter"), true);
  assert.equal(curatedValue(enriched, "isMusical"), false);
  assert.equal(original.enrichment, undefined);
  assert.equal(curatedValue(original, "hasMainAnimalCharacter"), null);
  assert.equal(
    curatedValue(
      applyMovieEnrichment(original, { 90000001: { isMusical: null } }),
      "isMusical",
    ),
    null,
  );
});

test("animal question uses reviewed central-character facts and suppresses any unknown", () => {
  const nemo = PRACTICE_CATALOGUE.find((m) => m.tmdbId === 12)!;
  const inception = base;
  const movies = [nemo, inception];
  const q = question("curated:hasMainAnimalCharacter", movies);
  assert.equal(evaluateQuestion(nemo, q), true);
  assert.equal(evaluateQuestion(inception, q), false);
  assert.ok(
    searchQuestions(validQuestions(movies), "animal").some(
      (candidate) => candidate.id === q.id,
    ),
  );
  const unknown = movie(90000001, {
    genres: ["Animation", "Family"],
    overview: "An animal hero",
    enrichment: {},
  });
  assert.equal(evaluateQuestion(unknown, q), null);
  assert.ok(
    !validQuestions([...movies, unknown]).some(
      (candidate) => candidate.id === q.id,
    ),
  );
});

test("musical classification separates narrative musicals from Music tags and respects curated overrides", () => {
  const la = PRACTICE_CATALOGUE.find((m) => m.tmdbId === 313369)!;
  const whiplash = PRACTICE_CATALOGUE.find((m) => m.tmdbId === 244786)!;
  const lion = PRACTICE_CATALOGUE.find((m) => m.tmdbId === 8587)!;
  const q = question("curated:isMusical", [la, whiplash]);
  assert.ok(whiplash.genres?.includes("Music"));
  assert.equal(evaluateQuestion(la, q), true);
  assert.equal(evaluateQuestion(whiplash, q), false);
  assert.equal(
    evaluateQuestion({ ...lion, genres: ["Animation", "Family"] }, q),
    true,
  );
  const concert = normaliseMovie({
    ...raw,
    id: 90000001,
    genres: [{ name: "Music" }, { name: "Documentary" }],
    overview: "A concert performance",
  })!;
  assert.equal(evaluateQuestion(concert, q), null);
  const biopic = normaliseMovie({
    ...raw,
    id: 277216,
    genres: [{ name: "Music" }, { name: "Drama" }],
  })!;
  assert.equal(evaluateQuestion(biopic, q), false);
  const valid = validQuestions([la, whiplash]);
  for (const alias of ["musical", "singing", "song", "songs", "musical film"])
    assert.ok(searchQuestions(valid, alias).some((x) => x.id === q.id));
  assert.ok(
    !searchQuestions(valid, "musical").some((x) => x.id === "genre:Music"),
  );
  assert.ok(
    !validQuestions([la, whiplash, concert]).some((x) => x.id === q.id),
  );
  assert.ok(!validQuestions([la, lion]).some((x) => x.id === q.id));
});

test("balanced new questions rank by split quality and inverse gender splits aren't suggested together", () => {
  const movies = Array.from({ length: 24 }, (_, i) =>
    movie(90000000 + i, {
      genres: ["Drama"],
      productionCompanies:
        i === 0
          ? [{ id: 420, name: "Marvel Studios" }]
          : [{ id: 999, name: "Other production company" }],
      topBilledLead: {
        tmdbId: i + 1,
        name: `Actor ${i}`,
        gender: i < 12 ? "female" : "male",
        character: null,
      },
    }),
  );
  const valid = validQuestions(movies),
    lead = valid.find((q) => q.id === "leadGender:female")!,
    marvel = valid.find((q) => q.id === "studio:marvel")!;
  assert.equal(lead.yesCount, 12);
  assert.equal(marvel.yesCount, 1);
  assert.ok(valid.indexOf(lead) < valid.indexOf(marvel));
  const suggestions = suggestedQuestions(valid);
  assert.ok(suggestions.filter((q) => q.kind === "leadGender").length <= 1);
  for (const q of valid) {
    assert.ok(q.yesCount > 0 && q.noCount > 0);
    assert.equal(q.yesCount + q.noCount, 24);
  }
});

test("unknown new attributes cannot consume a question or eliminate films through the reducer", () => {
  const pool = PRACTICE_CATALOGUE.slice(0, 24).map((m) => ({
    ...m,
    enrichment: { isMusical: null, hasMainAnimalCharacter: null },
    topBilledLead: null,
    productionCompanies: null,
  }));
  const state = initialState(createPuzzle(pool, 5));
  for (const id of [
    "curated:isMusical",
    "curated:hasMainAnimalCharacter",
    "leadGender:female",
  ]) {
    const q = question(id, pool);
    assert.equal(gameReducer(state, { type: "ask", question: q }), state);
  }
});

test("film details render title/year, up to three genres, director, Cast and original overview", () => {
  const m = movie(1, {
    title: "Test film",
    releaseYear: 2001,
    genres: ["Science Fiction", "Thriller", "Drama", "Adventure"],
    director: "A Director",
    castMembers: [
      {
        tmdbId: 1,
        name: "A Performer",
        character: "The Character",
        profilePath: "/portrait.jpg",
        order: 0,
      },
    ],
    overview: "The original TMDB overview.",
  });
  const html = render(m);
  for (const text of [
    "Test film",
    "2001",
    "Science Fiction • Thriller • Drama",
    "Directed by A Director",
    "Cast",
    "A Performer",
    "The Character",
    "The original TMDB overview.",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("Adventure"));
  assert.ok(!html.includes("Starring"));
  assert.ok(html.includes("https://image.tmdb.org/t/p/w185/portrait.jpg"));
  assert.ok(html.includes('class="confirm-synopsis"'));
});

test("film details omit missing synopsis/director/cast cleanly and handle character-free credits", () => {
  const empty = render(
    movie(1, {
      overview: null,
      director: null,
      cast: null,
      genres: null,
      topBilledLead: null,
      castMembers: null,
    }),
  );
  for (const text of [
    "confirm-synopsis",
    "Directed by",
    "Starring",
    'aria-label="Cast"',
    "No synopsis",
    "undefined",
    "null",
  ])
    assert.ok(!empty.includes(text), text);
  const actor = render(
    movie(1, {
      castMembers: [
        {
          tmdbId: null,
          name: "A Performer",
          character: null,
          profilePath: null,
          order: 0,
        },
      ],
    }),
  );
  assert.ok(actor.includes("A Performer"));
  assert.ok(!actor.includes("cast-character"));
  assert.ok(!actor.includes("cast-portrait"));
  assert.ok(
    !render(movie(1, { overview: "   " })).includes('class="confirm-synopsis"'),
  );
});

test("detail credits use the first ten usable TMDB cast entries while question cast and lead stay unchanged", () => {
  const credits = Array.from({ length: 14 }, (_, i) => ({
    id: i + 100,
    name: i === 2 ? "  " : `Actor ${i}`,
    character: i === 4 ? " " : `Character ${i}`,
    order: i,
    profile_path: i === 3 ? "https://other.test/image.jpg" : "/face.jpg",
    gender: 2,
    biography: "Do not retain this",
    known_for_department: "Acting",
  }));
  const m = normaliseMovie({
    ...raw,
    credits: { cast: credits.toReversed() },
  })!;
  assert.equal(m.castMembers?.length, 10);
  assert.deepEqual(
    m.castMembers?.map((c) => c.name),
    [0, 1, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `Actor ${i}`),
  );
  assert.equal(m.castMembers?.[2].profilePath, null);
  assert.equal(m.castMembers?.[3].character, null);
  assert.deepEqual(
    Object.keys(m.castMembers![0]).sort(),
    ["tmdbId", "name", "character", "profilePath", "order"].sort(),
  );
  assert.deepEqual(m.cast, ["Actor 0", "Actor 1", "Actor 3", "Actor 4"]);
  assert.equal(m.topBilledLead?.name, "Actor 0");
  const missing = normaliseMovie(raw)!;
  assert.equal(missing.castMembers, null);
  const tied = normaliseMovie({
    ...raw,
    credits: {
      cast: [
        { name: "Source first", order: 1 },
        { name: "Source second", order: 1 },
        { name: "Unknown order" },
      ],
    },
  })!;
  assert.deepEqual(
    tied.castMembers?.map((c) => c.name),
    ["Source first", "Source second", "Unknown order"],
  );
  assert.equal(tied.castMembers?.[2].order, null);
});

test("Cast renders at most ten names, no billing numbers and no placeholders for missing or invalid profiles", () => {
  const html = render(
    movie(1, {
      castMembers: Array.from({ length: 12 }, (_, i) => ({
        tmdbId: i + 1,
        name: `Performer ${String.fromCharCode(65 + i)}`,
        character: i ? null : "Cobb",
        profilePath: i % 2 ? null : "//invalid.test/face.jpg",
        order: i,
      })),
    }),
  );
  assert.equal((html.match(/class="cast-name"/g) ?? []).length, 10);
  assert.ok(html.includes("Performer J"));
  assert.ok(!html.includes("Performer K"));
  for (const text of [
    "<img",
    "#1",
    "#2",
    "Billing",
    "Top billed",
    "Starring",
    "silhouette",
    "invalid.test",
  ])
    assert.ok(!html.includes(text), text);
  assert.equal((html.match(/class="cast-character"/g) ?? []).length, 1);
});

test("bundled detail credits retain ordered names, roles and profiles without changing catalogue gameplay cast", () => {
  assert.equal(base.castMembers?.length, 10);
  assert.equal(base.castMembers?.[0].name, "Leonardo DiCaprio");
  assert.equal(base.castMembers?.[1].name, "Joseph Gordon-Levitt");
  assert.equal(base.castMembers?.[2].name, "Elliot Page");
  assert.equal(base.castMembers?.[2].character, "Ariadne");
  assert.ok(base.castMembers?.[0].profilePath?.startsWith("/"));
  assert.equal(base.cast?.length, 3);
  assert.ok(
    PRACTICE_CATALOGUE.every((m) => (m.castMembers?.length ?? 0) <= 10),
  );
});

test("movie overview remains plain text, bounded at preparation time; live unknowns aren't filled from old snapshots", () => {
  const m = normaliseMovie({
    ...raw,
    id: 27205,
    overview: "<script>alert(1)</script>" + "x".repeat(2000),
  })!;
  assert.equal(m.overview?.length, 1000);
  assert.equal(m.topBilledLead, null);
  assert.equal(m.productionCompanies, null);
  const html = render(m);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});
