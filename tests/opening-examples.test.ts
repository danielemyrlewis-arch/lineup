import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { activeMovies, createPuzzle, gameReducer, initialState } from "../lib/game/engine.ts";
import { evaluateQuestion, recommendedQuestions, suggestedQuestions, validQuestions } from "../lib/game/questions.ts";
import type { RankedQuestion } from "../lib/game/types.ts";
import { groupQuestions } from "../lib/game/question-groups.ts";

const ids = (questions: readonly RankedQuestion[]) => questions.map(question => question.id);
const weaker = (question: RankedQuestion) => Math.min(question.yesCount, question.noCount);
const firstDaily = resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE);

test("all 365 Daily openings recommend three known useful splits with the strongest available question first", () => {
  for (const entry of DAILY_SCHEDULE) {
    const puzzle = resolveDailyPuzzle(entry, PRACTICE_CATALOGUE);
    const recommendations = recommendedQuestions(puzzle.movies);
    const valid = validQuestions(puzzle.movies);
    assert.equal(recommendations.length, 3, entry.id);
    assert.equal(weaker(recommendations[0]), Math.max(...valid.map(weaker)), entry.id);
    assert.ok(weaker(recommendations[0]) >= 10, "Each frozen opening has at least a 10/14 opportunity");
    assert.equal(new Set(recommendations.map(question => question.partitionKey)).size, 3, entry.id);
    assert.equal(new Set(ids(recommendations)).size, 3, entry.id);
    for (const [index, question] of recommendations.entries()) {
      assert.ok(valid.some(candidate => candidate.id === question.id), `${entry.id}: existing question bank only`);
      const answers = puzzle.movies.map(movie => evaluateQuestion(movie, question));
      assert.ok(answers.every(answer => typeof answer === "boolean"), `${entry.id}: ${question.id}`);
      assert.equal(answers.filter(Boolean).length, question.yesCount);
      assert.equal(answers.filter(answer => answer === false).length, question.noCount);
      assert.ok(question.yesCount > 0 && question.noCount > 0);
      if (index) assert.ok(weaker(recommendations[index - 1]) >= weaker(question));
      const earlierPartitions = new Set(recommendations.slice(0, index).map(previous => previous.partitionKey));
      const available = valid.filter(candidate => !earlierPartitions.has(candidate.partitionKey));
      assert.equal(weaker(question), Math.max(...available.map(weaker)), "Category variety must not displace a stronger split");
    }
  }
});

test("split counts determine usefulness regardless of input order, with stable non-mutating tie breaks", () => {
  const questions = validQuestions(firstDaily.movies);
  const before = ids(questions);
  const expected = ids(suggestedQuestions(Object.freeze(questions)));
  assert.deepEqual(ids(suggestedQuestions([...questions].reverse())), expected);
  assert.deepEqual(ids(suggestedQuestions([...questions].sort((a, b) => b.id.localeCompare(a.id)))), expected);
  assert.deepEqual(ids(questions), before, "Recommendation selection must not reorder the canonical bank");
  const base = questions[0];
  const strong = {...base, id: "strong", yesCount: 12, noCount: 12, balance: 0.5, partitionKey: "strong"};
  const weak = {...base, id: "weak", yesCount: 1, noCount: 23, balance: 1 / 24, partitionKey: "weak"};
  assert.equal(suggestedQuestions([weak, strong])[0].id, "strong");
  assert.equal(suggestedQuestions([
    {...strong, yesCount: 2, noCount: 22, balance: 2 / 24},
    {...weak, yesCount: 11, noCount: 13, balance: 11 / 24},
  ])[0].id, "weak", "Recommendations should respond to the current split rather than a fixed question ID");
});

test("equally strong questions prefer different Browse categories but usefulness takes priority over variety", () => {
  const base = validQuestions(firstDaily.movies)[0];
  const question = (id: string, kind: RankedQuestion["kind"], category: string, yesCount = 12): RankedQuestion => ({
    ...base, id, kind, category, yesCount, noCount: 24 - yesCount, balance: Math.min(yesCount, 24 - yesCount) / 24, partitionKey: id,
  });
  const release = question("release", "before", "Release date");
  const genre = question("genre-a", "genre", "Genre");
  const otherGenre = question("genre-b", "genre", "Genre");
  const runtime = question("runtime", "over", "Runtime");
  const tied = suggestedQuestions([otherGenre, runtime, genre, release]);
  assert.equal(tied.length, 3);
  assert.equal(groupQuestions(tied).length, 3, "Choose category variety among equally good opportunities");
  const allStrongSameGroup = [release, question("second-release", "after", "Release date"), question("third-release", "decade", "Release date")];
  const niche = question("niche-cast", "cast", "Cast", 1);
  assert.deepEqual(new Set(ids(suggestedQuestions([niche, ...allStrongSameGroup]))), new Set(ids(allStrongSameGroup)),
    "A niche alternative must not be promoted solely to add another category");
});

test("recommendations remain stable across refresh and poster order changes on the same remaining board", () => {
  const expected = ids(recommendedQuestions(firstDaily.movies));
  assert.deepEqual(ids(recommendedQuestions([...firstDaily.movies].reverse())), expected);
  assert.deepEqual(ids(recommendedQuestions(firstDaily.movies)), expected);
});

test("changing every hidden mystery leaves Daily and Practice recommendations unchanged for the same board", () => {
  const puzzles = [
    ...DAILY_SCHEDULE.slice(0, 3).map(entry => resolveDailyPuzzle(entry, PRACTICE_CATALOGUE)),
    ...[12, 27, 91].map(seed => createPuzzle(PRACTICE_CATALOGUE, seed, "demo", "practice")),
  ];
  for (const puzzle of puzzles) {
    const expected = ids(recommendedQuestions(puzzle.movies));
    for (const movie of puzzle.movies) {
      const state = initialState({...puzzle, mysteryId: movie.id});
      assert.deepEqual(ids(recommendedQuestions(activeMovies(state), state.history.map(answer => answer.question.id))), expected);
    }
    const opaque = {...puzzle, get mysteryId(): string { throw new Error("Recommendation read the hidden answer"); }};
    assert.deepEqual(ids(recommendedQuestions(opaque.movies)), expected);
  }
});

test("manual YES and NO answers recompute the best available split from the earned remaining board", () => {
  const puzzles = [firstDaily, createPuzzle(PRACTICE_CATALOGUE, 19, "demo", "practice")];
  for (const puzzle of puzzles) {
    const question = recommendedQuestions(puzzle.movies)[0];
    const before = ids(recommendedQuestions(puzzle.movies));
    for (const answer of [true, false]) {
      const mystery = puzzle.movies.find(movie => evaluateQuestion(movie, question) === answer)!;
      const state = gameReducer(initialState({...puzzle, mysteryId: mystery.id}), {type: "ask", question});
      const remaining = activeMovies(state), asked = state.history.map(row => row.question.id);
      const valid = validQuestions(remaining, asked);
      const recommendations = recommendedQuestions(remaining, asked);
      assert.equal(state.history[0].answer, answer);
      assert.ok(recommendations.length > 0);
      assert.ok(!recommendations.some(candidate => candidate.id === question.id));
      assert.notDeepEqual(ids(recommendations), before);
      assert.equal(weaker(recommendations[0]), Math.max(...valid.map(weaker)));
      for (const candidate of recommendations) {
        assert.equal(candidate.yesCount + candidate.noCount, remaining.length);
        assert.ok(valid.some(validQuestion => validQuestion.id === candidate.id));
      }
      for (const other of remaining) {
        const sameBoardDifferentSecret = {...state, puzzle: {...state.puzzle, mysteryId: other.id}};
        assert.deepEqual(ids(recommendedQuestions(activeMovies(sameBoardDifferentSecret), asked)), ids(recommendations));
      }
    }
  }
});

test("asked, unknown, one-sided and equivalent questions cannot enter recommendations", () => {
  const originals = recommendedQuestions(firstDaily.movies);
  const askedIds = originals.map(question => question.id);
  assert.ok(recommendedQuestions(firstDaily.movies, askedIds).every(question => !askedIds.includes(question.id)));
  const uncertain = firstDaily.movies.map((movie, index) => index === 0 ? {...movie, runtime: null, genres: null} : movie);
  const recommendations = recommendedQuestions(uncertain);
  assert.ok(recommendations.every(question => question.kind !== "under" && question.kind !== "over" && question.kind !== "genre"));
  assert.ok(recommendations.every(question => uncertain.every(movie => typeof evaluateQuestion(movie, question) === "boolean")));
  assert.deepEqual(recommendedQuestions(firstDaily.movies.slice(0, 1)), []);
  const base = validQuestions(firstDaily.movies)[0];
  const alternatives = [
    {...base, id: "one", partitionKey: "same-split"},
    {...base, id: "inverse", partitionKey: "same-split"},
    {...base, id: "another", partitionKey: "another-split"},
  ];
  assert.equal(suggestedQuestions(alternatives).length, 2);
  assert.equal(new Set(suggestedQuestions(alternatives).map(question => question.partitionKey)).size, 2);
  assert.deepEqual(suggestedQuestions([]), []);
  assert.equal(suggestedQuestions(alternatives, 1).length, 1);
  assert.deepEqual(suggestedQuestions(alternatives, 0), []);
});
