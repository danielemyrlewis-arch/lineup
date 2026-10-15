import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import {
  createPracticePuzzle,
  franchiseKey,
  practiceQuestionQuality,
  practiceSelectionReport,
} from "../lib/game/practice-selection.ts";
import {
  emptyPracticeHistory,
  rememberPracticePuzzle,
  readPracticeHistory,
  writePracticeHistory,
  sanitisePracticeHistory,
  encodePracticeHistory,
  decodePracticeHistory,
  PRACTICE_HISTORY_KEY,
} from "../lib/game/practice-history.ts";
import {
  eligiblePracticeMovie,
  recognitionThreshold,
} from "../lib/game/practice-eligibility.ts";
import { normaliseMovie } from "../lib/data/normalise.ts";
import { validQuestions } from "../lib/game/questions.ts";
import type { Movie } from "../lib/game/types.ts";

const base = PRACTICE_CATALOGUE[0];
const fixture = (count: number, overrides: Partial<Movie> = {}): Movie[] =>
  Array.from({ length: count }, (_, i) => ({
    ...base,
    id: String(10000000 + i),
    tmdbId: 10000000 + i,
    title: `Fixture ${i}`,
    releaseYear: 1955 + (i % 65),
    genres: [i % 2 ? "Comedy" : "Drama", i % 3 ? "Action" : "Animation"],
    runtime: 80 + (i % 90),
    director: `Director ${i % 15}`,
    cast: [`Actor ${i % 18}`],
    belongsToCollection: i % 3 === 0,
    collectionName: null,
    collectionId: null,
    originalLanguage: i % 5 ? "en" : "fr",
    productionCountries: [i % 4 ? "US" : "FR"],
    voteCount: 5000,
    popularity: 10,
    ...overrides,
  }));
const ids = (movies: Movie[]) => movies.map((m) => m.tmdbId);

test("fallback contains over 1,000 unique eligible films with every gameplay field", () => {
  assert.ok(PRACTICE_CATALOGUE.length >= 1000);
  assert.equal(
    new Set(ids(PRACTICE_CATALOGUE)).size,
    PRACTICE_CATALOGUE.length,
  );
  for (const movie of PRACTICE_CATALOGUE) {
    assert.ok(eligiblePracticeMovie(movie), movie.title);
    assert.ok(
      movie.director &&
        movie.cast?.length &&
        movie.originalLanguage &&
        movie.productionCountries?.length &&
        movie.belongsToCollection !== null,
      movie.title,
    );
  }
});

test("20 sequential boards have 24 unique films, five-board exclusion and ten-game mystery cooldown", () => {
  let history = emptyPracticeHistory();
  const frequencies = new Map<number, number>();
  for (let seed = 501; seed < 521; seed++) {
    const puzzle = createPracticePuzzle(
      PRACTICE_CATALOGUE,
      seed,
      "demo",
      history,
    );
    assert.equal(puzzle.movies.length, 24);
    assert.equal(new Set(ids(puzzle.movies)).size, 24);
    const recentFive = new Set(history.boards.slice(0, 5).flat());
    assert.ok(ids(puzzle.movies).every((id) => !recentFive.has(id)));
    assert.ok(!history.mysteries.includes(Number(puzzle.mysteryId)));
    assert.ok(practiceQuestionQuality(puzzle.movies).healthy);
    assert.ok(
      new Set(puzzle.movies.map((m) => Math.floor(m.releaseYear! / 10))).size >=
        4,
    );
    const families = puzzle.movies.map(franchiseKey).filter(Boolean);
    assert.equal(new Set(families).size, families.length);
    for (const id of ids(puzzle.movies))
      frequencies.set(id, (frequencies.get(id) ?? 0) + 1);
    history = rememberPracticePuzzle(history, puzzle);
  }
  assert.ok(
    frequencies.size >= 400,
    `${frequencies.size} unique in 480 appearances`,
  );
  assert.ok(Math.max(...frequencies.values()) <= 3);
});

test("boards six through ten are heavily deprioritised without a permanent ban", () => {
  const pool = fixture(200);
  const oldIds = ids(pool.slice(0, 100));
  const history = {
    boards: [
      [],
      [],
      [],
      [],
      [],
      oldIds.slice(0, 24),
      oldIds.slice(24, 48),
      oldIds.slice(48, 72),
      oldIds.slice(72, 96),
      oldIds.slice(96),
    ],
    mysteries: [],
  };
  // Sanitised real history has no empty placeholders, so use five unrelated boards.
  history.boards.splice(
    0,
    5,
    ...Array.from({ length: 5 }, (_, i) => [900000 + i]),
  );
  const recent = new Set(oldIds);
  let weightedRepeats = 0,
    baselineRepeats = 0;
  for (let seed = 1; seed <= 30; seed++) {
    weightedRepeats += ids(
      createPracticePuzzle(pool, seed, "demo", history).movies,
    ).filter((id) => recent.has(id)).length;
    baselineRepeats += ids(createPracticePuzzle(pool, seed).movies).filter(
      (id) => recent.has(id),
    ).length;
  }
  assert.ok(
    weightedRepeats < baselineRepeats / 3,
    `${weightedRepeats} versus ${baselineRepeats}`,
  );
  assert.ok(baselineRepeats > 200); // Old films can re-enter once history ages out.
});

test("mystery cooldown works even when a small pool must show recent films", () => {
  const pool = fixture(26);
  const history = {
    boards: [ids(pool.slice(0, 24))],
    mysteries: ids(pool.slice(0, 10)),
  };
  for (let seed = 0; seed < 20; seed++) {
    const puzzle = createPracticePuzzle(pool, seed, "demo", history);
    assert.ok(!history.mysteries.includes(Number(puzzle.mysteryId)));
  }
});

test("franchise and remake duplicates are avoided with enough alternatives", () => {
  const pool = fixture(70);
  for (let i = 0; i < 30; i++) pool[i].collectionName = "Big franchise";
  // Live details include an ID while the bundled snapshot only has the name.
  for (let i = 0; i < 15; i++) pool[i].collectionId = 88;
  pool[30].title = "Dune";
  pool[31].title = "DUNE";
  for (let seed = 1; seed <= 15; seed++) {
    const movies = createPracticePuzzle(pool, seed).movies;
    assert.ok(
      movies.filter((m) => m.collectionName === "Big franchise").length <= 1,
    );
    assert.ok(
      movies.filter((m) => m.title.toLowerCase() === "dune").length <= 1,
    );
  }
  // Separate TMDB sub-collections still belong to one MCU universe.
  assert.equal(
    franchiseKey({
      ...pool[0],
      tmdbId: 1726,
      collectionName: "Iron Man Collection",
    }),
    franchiseKey({
      ...pool[1],
      tmdbId: 284054,
      collectionName: "Black Panther Collection",
    }),
  );
  assert.equal(
    franchiseKey({ ...pool[0], collectionName: "The Hobbit Collection" }),
    franchiseKey({
      ...pool[1],
      collectionName: "The Lord of the Rings Collection",
    }),
  );
});

test("duplicate TMDB records do not create duplicate cards or mutate the pool", () => {
  const pool = fixture(40);
  const before = structuredClone(pool);
  const movies = createPracticePuzzle([...pool, ...pool], 35).movies;
  assert.equal(new Set(ids(movies)).size, 24);
  assert.deepEqual(pool, before);
});

test("soft diversity constraints and question retry terminate for a small homogeneous pool", () => {
  const pool = fixture(24, {
    releaseYear: 2005,
    genres: ["Drama"],
    originalLanguage: "en",
    productionCountries: ["US"],
    director: "One director",
    cast: ["One actor"],
    runtime: 100,
    collectionName: "Only franchise",
    belongsToCollection: true,
  });
  const puzzle = createPracticePuzzle(pool, 19, "demo", {
    boards: [ids(pool)],
    mysteries: ids(pool.slice(0, 10)),
  });
  assert.equal(puzzle.movies.length, 24);
  assert.equal(new Set(ids(puzzle.movies)).size, 24);
  assert.throws(
    () => createPracticePuzzle(pool.slice(0, 23), 19),
    /24 suitable/,
  );
});

test("thresholds widen gradually to fill a smaller recognisable pool", () => {
  const pool = fixture(30, { releaseYear: 2005, voteCount: 900 });
  const puzzle = createPracticePuzzle(pool, 4);
  assert.equal(practiceSelectionReport(pool, puzzle)?.recognitionTier, 1);
  assert.equal(puzzle.movies.length, 24);
  assert.throws(
    () =>
      createPracticePuzzle(fixture(30, { voteCount: 2, popularity: 10000 }), 4),
    /24 suitable/,
  );
});

test("age and voting-audience thresholds retain classics and international hits", () => {
  assert.equal(
    recognitionThreshold({
      ...base,
      releaseYear: 1960,
      originalLanguage: "en",
    }),
    250,
  );
  assert.equal(
    recognitionThreshold({
      ...base,
      releaseYear: 1990,
      originalLanguage: "en",
    }),
    600,
  );
  assert.equal(
    recognitionThreshold({
      ...base,
      releaseYear: 2020,
      originalLanguage: "en",
    }),
    1200,
  );
  assert.ok(
    eligiblePracticeMovie({
      ...base,
      releaseYear: 1955,
      voteCount: 300,
      popularity: 1,
    }),
  );
  assert.ok(
    eligiblePracticeMovie({
      ...base,
      releaseYear: 2020,
      originalLanguage: "ko",
      voteCount: 800,
      popularity: 2,
    }),
  );
  assert.ok(
    !eligiblePracticeMovie({ ...base, voteCount: 1, popularity: 10000 }),
  );
});

test("missing optional metadata is safe; shorts, TV, missing posters/genres/years are rejected", () => {
  const optional = fixture(30, {
    director: null,
    cast: null,
    originalLanguage: null,
    productionCountries: null,
    belongsToCollection: null,
  });
  const invalid: Movie[] = [
    { ...base, tmdbId: 999001, id: "999001", posterPath: null },
    { ...base, tmdbId: 999002, id: "999002", releaseYear: null },
    { ...base, tmdbId: 999003, id: "999003", runtime: 20 },
    { ...base, tmdbId: 999004, id: "999004", genres: ["TV Movie"] },
    { ...base, tmdbId: 999005, id: "999005", genres: null },
  ];
  const puzzle = createPracticePuzzle([...optional, ...invalid], 5);
  assert.equal(puzzle.movies.length, 24);
  assert.ok(
    puzzle.movies.every((m) => m.tmdbId < 999001 || m.tmdbId >= 10000000),
  );
  assert.ok(validQuestions(puzzle.movies).length >= 5);
});

test("history is bounded to 240 shown IDs and ten mystery answers and is idempotent", () => {
  let history = emptyPracticeHistory();
  for (let seed = 0; seed < 40; seed++) {
    const puzzle = createPracticePuzzle(fixture(60), seed, "demo", history);
    history = rememberPracticePuzzle(history, puzzle);
    assert.deepEqual(rememberPracticePuzzle(history, puzzle), history);
  }
  assert.equal(history.boards.length, 10);
  assert.equal(history.boards.flat().length, 240);
  assert.equal(history.mysteries.length, 10);
  const cookie = encodePracticeHistory(history);
  assert.ok(cookie.length < 3000);
  const expected = { boards: history.boards, mysteries: history.mysteries };
  assert.deepEqual(decodePracticeHistory(cookie), expected);
  const huge = sanitisePracticeHistory({
    boards: Array.from({ length: 100 }, () =>
      Array.from({ length: 1000 }, (_, i) => i + 1),
    ),
    mysteries: Array.from({ length: 1000 }, (_, i) => i + 1),
  });
  assert.equal(huge.boards.flat().length, 240);
  assert.equal(huge.mysteries.length, 10);
});

test("localStorage failures/corruption do not block play and Daily puzzles aren't recorded", () => {
  let value = "not json";
  const storage = {
    getItem: (key: string) => {
      assert.equal(key, PRACTICE_HISTORY_KEY);
      return value;
    },
    setItem: (_key: string, v: string) => {
      value = v;
    },
  };
  assert.deepEqual(readPracticeHistory(storage), emptyPracticeHistory());
  const puzzle = createPracticePuzzle(fixture(30), 11);
  const history = rememberPracticePuzzle(emptyPracticeHistory(), puzzle);
  writePracticeHistory(history, storage);
  assert.deepEqual(readPracticeHistory(storage), history);
  const blocked = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("quota");
    },
  };
  assert.deepEqual(readPracticeHistory(blocked), emptyPracticeHistory());
  assert.doesNotThrow(() => writePracticeHistory(history, blocked));
  assert.deepEqual(
    rememberPracticePuzzle(history, {
      ...puzzle,
      mode: "daily",
      id: "daily-test",
    }),
    history,
  );
  assert.deepEqual(decodePracticeHistory("bad;cookie"), emptyPracticeHistory());
});

test("TMDB normalisation retains family hints and rejects video/future/malformed releases", () => {
  const raw = {
    id: 123,
    title: "Film",
    poster_path: "/poster.jpg",
    release_date: "2000-01-01",
    runtime: 110,
    genres: [{ name: "Comedy" }],
    belongs_to_collection: { id: 55, name: "Collection" },
  };
  const movie = normaliseMovie(raw)!;
  assert.equal(movie.collectionId, 55);
  assert.equal(movie.collectionName, "Collection");
  assert.equal(normaliseMovie({ ...raw, video: true }), null);
  assert.equal(normaliseMovie({ ...raw, id: 12.5 }), null);
  assert.equal(
    normaliseMovie({ ...raw, release_date: "2001-02-31" })?.releaseYear,
    null,
  );
  assert.equal(
    normaliseMovie({ ...raw, release_date: "2099-01-01" })?.releaseYear,
    null,
  );
  assert.equal(
    normaliseMovie({
      ...raw,
      production_countries: [{ iso_3166_1: "invalid" }],
    })?.productionCountries,
    null,
  );
});
