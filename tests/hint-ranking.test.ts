import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { activeMovies, createPuzzle, gameReducer, hasUsedSuggestion, initialState } from "../lib/game/engine.ts";
import { evaluateQuestion, recommendedQuestions, validQuestions } from "../lib/game/questions.ts";
import type { Movie, Question } from "../lib/game/types.ts";

/** Average the actual incompatible-film count over every equally likely remaining candidate. */
function expectedElimination(movies: Movie[], question: Question): number {
  const answers = movies.map(movie => evaluateQuestion(movie, question));
  assert.ok(answers.every(answer => typeof answer === "boolean"));
  return answers.reduce<number>((total, answer) =>
    total + answers.filter(other => other !== answer).length, 0) / movies.length;
}

const daily = resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE);
const practice = createPuzzle(PRACTICE_CATALOGUE, 19, "demo", "practice");

test("hints rank actual expected eliminations: six/six beats eleven/one and fewer honest choices stay fewer", () => {
  const movies: Movie[] = daily.movies.slice(0, 12).map((movie, index) => ({
    ...movie,
    releaseYear: 2001,
    genres: [index < 6 ? "Animation" : "Drama"],
    runtime: index < 11 ? 100 : 180,
    director: "One director",
    cast: ["One cast member"], castMembers: null,
    productionCompanies: null, topBilledLead: null, enrichment: {}, oscars: null,
    originalLanguage: "en", productionCountries: ["US"], belongsToCollection: false,
  }));
  const valid = validQuestions(movies);
  const balanced = valid.find(question => question.id === "genre:Animation")!;
  const niche = valid.find(question => question.id === "over:120")!;
  assert.ok(balanced && niche);
  assert.equal(balanced.yesCount, 6); assert.equal(balanced.noCount, 6);
  assert.equal(niche.yesCount, 1); assert.equal(niche.noCount, 11);
  assert.equal(expectedElimination(movies, balanced), 6);
  assert.equal(expectedElimination(movies, niche), 22 / 12);
  const hints = recommendedQuestions(movies);
  assert.equal(hints.length, 2, "There are only two useful distinct partitions; do not pad to three");
  assert.equal(expectedElimination(movies, hints[0]), 6);
  assert.equal(expectedElimination(movies, hints[1]), 22 / 12);
});

test("each of the three hints maximises actual expected elimination among remaining distinct opportunities", () => {
  for (const puzzle of [daily, practice]) {
    const initial = initialState(puzzle);
    const manual = validQuestions(activeMovies(initial)).find(question => question.kind === "genre" && question.yesCount > 2 && question.noCount > 2)!;
    assert.ok(manual);
    const answered = gameReducer(initial, {type: "ask", question: manual});
    assert.equal(answered.history.length, 1);
    assert.equal(hasUsedSuggestion(answered), false);
    for (const state of [initial, answered]) {
      const movies = activeMovies(state), asked = state.history.map(row => row.question.id);
      const valid = validQuestions(movies, asked), hints = recommendedQuestions(movies, asked);
      assert.ok(hints.length > 0);
      const partitions = new Set<string>();
      for (const hint of hints) {
        const remaining = valid.filter(question => !partitions.has(question.partitionKey));
        const expected = expectedElimination(movies, hint);
        assert.equal(expected, Math.max(...remaining.map(question => expectedElimination(movies, question))));
        // Known Yes/No partitions have the same expected-elimination ordering as weaker-side ranking.
        assert.equal(expected, 2 * hint.yesCount * hint.noCount / movies.length);
        assert.ok(!asked.includes(hint.id));
        partitions.add(hint.partitionKey);
      }
    }
  }
});

test("after a manual answer, hints depend on remaining-film metadata only and never inspect eliminated films", () => {
  for (const puzzle of [daily, practice]) {
    const before = initialState(puzzle), opening = recommendedQuestions(puzzle.movies);
    const manual = validQuestions(puzzle.movies).find(question => question.kind === "genre" && question.yesCount > 2 && question.noCount > 2)!;
    assert.ok(manual);
    const after = gameReducer(before, {type: "ask", question: manual});
    assert.ok(after.activeIds.length < 24 && after.activeIds.length > 1);
    const asked = after.history.map(row => row.question.id);
    const expected = recommendedQuestions(activeMovies(after), asked);
    assert.notEqual(expected[0].id, opening[0].id, `${puzzle.mode} fixture changes the best question after elimination`);
    const opaque = {...after, puzzle: {...after.puzzle,
      get mysteryId(): string { throw new Error("Hints inspected the mystery identity"); },
      movies: after.puzzle.movies.map(movie => after.activeIds.includes(movie.id) ? movie : {
        ...movie,
        get releaseYear(): never { throw new Error("Hints evaluated an eliminated film"); },
        get genres(): never { throw new Error("Hints evaluated an eliminated film"); },
      }),
    }};
    assert.deepEqual(recommendedQuestions(activeMovies(opaque), asked), expected);
  }
});
