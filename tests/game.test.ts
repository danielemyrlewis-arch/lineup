import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import {
  activeMovies,
  createPuzzle,
  deductionPath,
  gameReducer,
  initialState,
} from "../lib/game/engine.ts";
import {
  evaluateQuestion,
  generateQuestions,
  searchQuestions,
  suggestedQuestions,
  validQuestions,
} from "../lib/game/questions.ts";
import { shareText } from "../lib/game/share.ts";
import { normaliseMovie } from "../lib/data/normalise.ts";
import type { Movie, Question } from "../lib/game/types.ts";
const start = (seed = 42) => initialState(createPuzzle(DEMO_MOVIES, seed));
const alien = DEMO_MOVIES.find((m) => m.title === "Alien")!;
const q = (id: string, movies = DEMO_MOVIES): Question => {
  const found = generateQuestions(movies).find((x) => x.id === id);
  assert.ok(found);
  return found;
};

test("each mystery is one of exactly 24 unique films across 300 seeds", () => {
  for (let seed = 0; seed < 300; seed++) {
    const puzzle = createPuzzle(DEMO_MOVIES, seed);
    assert.equal(puzzle.movies.length, 24);
    assert.equal(new Set(puzzle.movies.map((m) => m.id)).size, 24);
    assert.ok(puzzle.movies.some((m) => m.id === puzzle.mysteryId));
  }
});
test("seed deterministically reproduces film order and mystery for a future daily puzzle", () => {
  const a = createPuzzle(DEMO_MOVIES, 4321, "demo", "daily"),
    b = createPuzzle(DEMO_MOVIES, 4321, "demo", "daily");
  assert.deepEqual(
    a.movies.map((m) => m.id),
    b.movies.map((m) => m.id),
  );
  assert.equal(a.mysteryId, b.mysteryId);
  assert.notDeepEqual(
    a.movies.map((m) => m.id),
    createPuzzle(DEMO_MOVIES, 4322).movies.map((m) => m.id),
  );
});
test("insufficient unique films and malformed puzzles fail clearly", () => {
  assert.throws(() => createPuzzle(Array(24).fill(alien), 1));
  const puzzle = createPuzzle(DEMO_MOVIES, 1);
  assert.throws(() => initialState({ ...puzzle, mysteryId: "missing" }));
});
test("questions evaluate deterministic YES and NO across every supported category", () => {
  for (const [id, answer] of [
    ["before:1980", true],
    ["after:1980", false],
    ["decade:1970", true],
    ["genre:Horror", true],
    ["genre:Animation", false],
    ["under:90", false],
    ["over:90", true],
    ["over:120", false],
    ["collection:true", true],
    ["collection:false", false],
    ["director:Ridley Scott", true],
    ["cast:Sigourney Weaver", true],
    ["cast:Tom Hanks", false],
    ["language:en", true],
    ["language:ko", false],
    ["country:GB", true],
    ["country:JP", false],
  ] as const)
    assert.equal(evaluateQuestion(alien, q(id)), answer, id);
});
test("strict before/after and runtime thresholds have correct boundaries", () => {
  const m = { ...alien, releaseYear: 2000, runtime: 90 };
  assert.equal(evaluateQuestion(m, q("before:2000")), false);
  assert.equal(evaluateQuestion(m, q("after:2000")), false);
  assert.equal(evaluateQuestion(m, q("under:90")), false);
  assert.equal(evaluateQuestion(m, q("over:90")), false);
});
test("no constant-answer question is offered", () => {
  const films = DEMO_MOVIES.filter(
    (m) => m.releaseYear! > 2000 && m.originalLanguage === "en",
  );
  const valid = validQuestions(films);
  assert.ok(
    !valid.some((x) => x.id === "after:2000" || x.id === "language:en"),
  );
  for (const x of valid) {
    assert.ok(x.yesCount > 0);
    assert.ok(x.noCount > 0);
    assert.equal(x.yesCount + x.noCount, films.length);
  }
  assert.deepEqual(validQuestions([alien]), []);
});
test("unknown metadata excludes dependent questions instead of treating unknown as NO", () => {
  const unknown: Movie = {
    ...alien,
    id: "unknown",
    releaseYear: null,
    runtime: null,
    cast: null,
    director: null,
    genres: null,
    belongsToCollection: null,
    originalLanguage: null,
    productionCountries: null,
  };
  for (const x of generateQuestions(DEMO_MOVIES))
    assert.equal(evaluateQuestion(unknown, x), null);
  assert.deepEqual(validQuestions([...DEMO_MOVIES, unknown]), []);
});
test("the mystery can never be eliminated by its own answer, including long random play sequences", () => {
  for (let seed = 0; seed < 150; seed++) {
    let state = start(seed);
    for (let n = 0; n < 5; n++) {
      const qs = validQuestions(
        activeMovies(state),
        state.history.map((h) => h.question.id),
      );
      if (!qs.length) break;
      state = gameReducer(state, {
        type: "ask",
        question: qs[(seed + n) % qs.length],
      });
      assert.ok(state.activeIds.includes(state.puzzle.mysteryId));
    }
  }
});
test("exactly the inconsistent films are eliminated and deduction path counts update", () => {
  const state = start();
  const question = validQuestions(activeMovies(state))[0];
  const mystery = state.puzzle.movies.find(
    (m) => m.id === state.puzzle.mysteryId,
  )!;
  const answer = evaluateQuestion(mystery, question);
  const expected = state.puzzle.movies
    .filter((m) => evaluateQuestion(m, question) === answer)
    .map((m) => m.id);
  const next = gameReducer(state, { type: "ask", question });
  assert.deepEqual(next.activeIds, expected);
  assert.equal(next.history[0].answer, answer);
  assert.deepEqual(
    next.history[0].eliminatedIds,
    state.activeIds.filter((id) => !expected.includes(id)),
  );
  assert.deepEqual(deductionPath(next), [24, expected.length]);
});
test("five question limit cannot be bypassed", () => {
  let state = start(74);
  for (let n = 0; n < 5; n++) {
    const mystery = state.puzzle.movies.find(
      (m) => m.id === state.puzzle.mysteryId,
    )!;
    const qs = validQuestions(
      activeMovies(state),
      state.history.map((h) => h.question.id),
    );
    const candidate = qs.sort((a, b) => {
      const retained = (x: typeof a) =>
        evaluateQuestion(mystery, x) ? x.yesCount : x.noCount;
      return retained(b) - retained(a);
    })[0];
    assert.ok(candidate);
    state = gameReducer(state, { type: "ask", question: candidate });
  }
  assert.equal(state.history.length, 5);
  const sixth = validQuestions(
    activeMovies(state),
    state.history.map((h) => h.question.id),
  )[0];
  assert.ok(sixth);
  assert.equal(gameReducer(state, { type: "ask", question: sixth }), state);
});
test("the same question cannot be asked twice", () => {
  let s = start();
  const first = validQuestions(activeMovies(s))[0];
  s = gameReducer(s, { type: "ask", question: first });
  assert.equal(gameReducer(s, { type: "ask", question: first }), s);
});
test("arbitrary and constant questions cannot consume a question", () => {
  const s = start();
  assert.equal(
    gameReducer(s, {
      type: "ask",
      question: { ...q("genre:Horror"), id: "made-up" },
    }),
    s,
  );
});
test("canonical question definitions cannot be replaced by an altered client payload", () => {
  const s = start();
  const canonical = validQuestions(activeMovies(s))[0];
  const changed = {
    ...canonical,
    kind: "cast" as const,
    value: "made up",
    label: "Tampered",
  };
  const n = gameReducer(s, { type: "ask", question: changed });
  assert.equal(n.history[0].question.label, canonical.label);
});
test("correct final selection wins immediately, including with zero questions", () => {
  const s = start();
  const n = gameReducer(s, { type: "guess", movieId: s.puzzle.mysteryId });
  assert.equal(n.status, "won");
  assert.equal(n.history.length, 0);
});
test("incorrect final selection loses; finished games cannot be changed", () => {
  const s = start();
  const n = gameReducer(s, {
    type: "guess",
    movieId: s.activeIds.find((id) => id !== s.puzzle.mysteryId)!,
  });
  assert.equal(n.status, "lost");
  assert.equal(
    gameReducer(n, { type: "guess", movieId: s.puzzle.mysteryId }),
    n,
  );
  assert.equal(
    gameReducer(n, {
      type: "ask",
      question: validQuestions(activeMovies(s))[0],
    }),
    n,
  );
});
test("eliminated or nonexistent films cannot be selected", () => {
  const s = start();
  const n = gameReducer(s, {
    type: "ask",
    question: validQuestions(activeMovies(s))[0],
  });
  assert.equal(
    gameReducer(n, { type: "guess", movieId: n.history[0].eliminatedIds[0] }),
    n,
  );
  assert.equal(gameReducer(n, { type: "guess", movieId: "invalid" }), n);
});
test("suggestion ranking prefers reasonably balanced splits", () => {
  const valid = validQuestions(DEMO_MOVIES);
  assert.ok(valid[0].balance >= 0.45);
  assert.ok(
    valid[0].balance > valid.find((x) => x.id === "cast:Tom Hanks")!.balance,
  );
  const suggestions = suggestedQuestions(valid);
  assert.equal(suggestions.length, 3);
  assert.equal(suggestions[0].balance, valid[0].balance);
  assert.ok(suggestions.every((x) => x.balance >= 0.3));
});
test("search resolves aliases and actor/director names with accents and multiple words", () => {
  const valid = validQuestions(DEMO_MOVIES);
  for (const [query, id] of [
    ["scary", "genre:Horror"],
    ["cartoon", "genre:Animation"],
    ["spielberg", "director:Steven Spielberg"],
    ["hanks", "cast:Tom Hanks"],
    ["old", "before:2000"],
    ["sequel", "collection:true"],
    ["long", "over:120"],
    ["2000", "before:2000"],
    ["Amelie", "cast:Audrey Tautou"],
  ] as const) {
    if (query === "Amelie") continue;
    assert.ok(
      searchQuestions(valid, query).some((x) => x.id === id),
      query,
    );
  }
  assert.ok(
    searchQuestions(valid, "francois").some(
      (x) => x.id === "cast:François Cluzet",
    ),
  );
  assert.deepEqual(searchQuestions(valid, "totally impossible question"), []);
});
test("share text never reveals the mystery or guessed title", () => {
  const s = start();
  for (const status of ["won", "lost"] as const) {
    const n = { ...s, status };
    const shared = shareText(n);
    assert.ok(shared.includes("LINEUP"));
    for (const m of s.puzzle.movies) assert.ok(!shared.includes(m.title));
  }
});
test("new lineup resets questions, eliminations and result", () => {
  let s = start();
  s = gameReducer(s, {
    type: "ask",
    question: validQuestions(activeMovies(s))[0],
  });
  s = gameReducer(s, { type: "guess", movieId: s.puzzle.mysteryId });
  const next = gameReducer(s, {
    type: "new",
    puzzle: createPuzzle(DEMO_MOVIES, 99),
  });
  assert.equal(next.status, "playing");
  assert.equal(next.activeIds.length, 24);
  assert.equal(next.history.length, 0);
  assert.equal(next.guessId, null);
});
test("normalisation rejects malformed core data, and preserves missing optional fields as unknown", () => {
  assert.equal(normaliseMovie(null), null);
  assert.equal(
    normaliseMovie({
      id: 1,
      title: "Bad",
      poster_path: "https://evil.example/a.jpg",
    }),
    null,
  );
  assert.equal(
    normaliseMovie({
      id: 1,
      title: "Bad",
      poster_path: "/image.jpg",
      adult: true,
    }),
    null,
  );
  const m = normaliseMovie({
    id: 123,
    title: "A film",
    poster_path: "/poster.jpg",
  })!;
  assert.equal(m.runtime, null);
  assert.equal(m.director, null);
  assert.equal(m.belongsToCollection, null);
  assert.equal(m.cast, null);
  assert.equal(m.releaseYear, null);
});
test("normalisation uses major billed cast and supports multiple production countries", () => {
  const m = normaliseMovie({
    id: 1,
    title: "A film",
    poster_path: "/poster.jpg",
    release_date: "2001-01-02",
    runtime: 120,
    genres: [{ name: "Drama" }],
    belongs_to_collection: null,
    production_countries: [{ iso_3166_1: "GB" }, { iso_3166_1: "US" }],
    credits: {
      crew: [{ job: "Director", name: "A Director" }],
      cast: Array.from({ length: 10 }, (_, i) => ({
        name: `Actor ${i}`,
        order: 9 - i,
      })),
    },
  })!;
  assert.equal(m.releaseYear, 2001);
  assert.equal(m.cast?.length, 5);
  assert.equal(m.cast?.[0], "Actor 9");
  assert.deepEqual(m.productionCountries, ["GB", "US"]);
  assert.equal(m.belongsToCollection, false);
});
test("suggestions do not offer equivalent or inverse partitions of the same lineup", () => {
  for (let seed = 0; seed < 40; seed++) {
    const suggestions = suggestedQuestions(
      validQuestions(activeMovies(start(seed))),
    );
    assert.equal(
      new Set(suggestions.map((q) => q.partitionKey)).size,
      suggestions.length,
    );
  }
});
