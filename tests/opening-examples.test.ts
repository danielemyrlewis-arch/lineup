import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { activeMovies, createPuzzle, gameReducer, initialState } from "../lib/game/engine.ts";
import { evaluateQuestion, openingQuestionExamples, suggestedQuestions, validQuestions } from "../lib/game/questions.ts";
import type { RankedQuestion } from "../lib/game/types.ts";
import { groupQuestions } from "../lib/game/question-groups.ts";

const ids = (questions: readonly RankedQuestion[]) => questions.map(question => question.id);
const firstDaily = resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE);

test("all 365 Daily openings have three valid examples from different categories and partitions", () => {
  for (const entry of DAILY_SCHEDULE) {
    const puzzle = resolveDailyPuzzle(entry, PRACTICE_CATALOGUE);
    const examples = openingQuestionExamples(puzzle.movies);
    assert.equal(examples.length, 3, entry.id);
    assert.equal(new Set(examples.map(question => question.category)).size, 3, entry.id);
    assert.equal(groupQuestions(examples).length, 3, "Examples should also span the browser's broad categories");
    assert.equal(new Set(examples.map(question => question.partitionKey)).size, 3, entry.id);
    for (const example of examples) {
      const answers = puzzle.movies.map(movie => evaluateQuestion(movie, example));
      assert.ok(answers.every(answer => typeof answer === "boolean"), `${entry.id}: ${example.id}`);
      assert.ok(answers.includes(true) && answers.includes(false), `${entry.id}: ${example.id}`);
    }
  }
});

test("example selection is independent of ranked input order, balance and expected elimination counts", () => {
  const questions = validQuestions(firstDaily.movies);
  const before = ids(questions);
  const expected = ids(suggestedQuestions(questions, 3, "test-opening"));
  const changed = [...questions].reverse().map((question, index) => ({
    ...question,
    balance: (index % 3) / 10,
    yesCount: index % 23 + 1,
    noCount: 23 - index % 23,
  }));
  assert.deepEqual(ids(suggestedQuestions(changed, 3, "test-opening")), expected);
  assert.deepEqual(ids(questions), before, "Selecting examples must not reorder the canonical bank");
  const withoutRanking = questions.map(question => Object.defineProperties({...question}, {
    balance: {get: () => { throw Error("Examples read split balance"); }},
    yesCount: {get: () => { throw Error("Examples read YES counts"); }},
    noCount: {get: () => { throw Error("Examples read NO counts"); }},
  }));
  assert.deepEqual(ids(suggestedQuestions(Object.freeze(withoutRanking), 3, "test-opening")), expected);
});

test("opening examples are stable across refreshes and poster order changes", () => {
  const expected = ids(openingQuestionExamples(firstDaily.movies));
  assert.deepEqual(ids(openingQuestionExamples([...firstDaily.movies].reverse())), expected);
  assert.deepEqual(ids(openingQuestionExamples(firstDaily.movies)), expected);
});

test("changing every possible hidden mystery leaves Daily and Practice opening examples unchanged", () => {
  const puzzles = [
    ...DAILY_SCHEDULE.slice(0, 3).map(entry => resolveDailyPuzzle(entry, PRACTICE_CATALOGUE)),
    ...[12, 27, 91].map(seed => createPuzzle(PRACTICE_CATALOGUE, seed, "demo", "practice")),
  ];
  for (const puzzle of puzzles) {
    const expected = ids(openingQuestionExamples(puzzle.movies));
    assert.equal(expected.length, 3);
    for (const movie of puzzle.movies) {
      const state = initialState({...puzzle, mysteryId: movie.id});
      assert.deepEqual(ids(openingQuestionExamples(activeMovies(state), state.history.map(answer => answer.question.id))), expected);
    }
  }
});

test("manual answers never regenerate or reorder the original board examples, for either YES or NO", () => {
  const question = validQuestions(firstDaily.movies).find(q => q.yesCount > 1 && q.noCount > 1)!;
  for (const answer of [true, false]) {
    const mystery = firstDaily.movies.find(movie => evaluateQuestion(movie, question) === answer)!;
    assert.ok(mystery);
    const state = gameReducer(initialState({...firstDaily, mysteryId: mystery.id}), {type: "ask", question});
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].answer, answer);
    assert.deepEqual(ids(openingQuestionExamples(state.puzzle.movies, state.history.map(row => row.question.id))),
      ids(openingQuestionExamples(firstDaily.movies)));
    assert.ok(validQuestions(activeMovies(state), state.history.map(row => row.question.id)).length > 0,
      "Keeping the original suggestions must not remove the remaining question bank");
  }
});

test("sparse category coverage yields fewer honest examples rather than duplicate categories or inverse splits", () => {
  const base = validQuestions(firstDaily.movies)[0];
  const questions: RankedQuestion[] = [
    {...base, id: "one", category: "Genre", partitionKey: "same-split"},
    {...base, id: "inverse", category: "Release date", partitionKey: "same-split"},
    {...base, id: "same-category", category: "Genre", partitionKey: "another-split"},
  ];
  const examples = suggestedQuestions(questions);
  assert.ok(examples.length <= 2);
  assert.equal(new Set(examples.map(question => question.category)).size, examples.length);
  assert.equal(new Set(examples.map(question => question.partitionKey)).size, examples.length);
  assert.deepEqual(suggestedQuestions([]), []);
  assert.equal(suggestedQuestions(questions, 1).length, 1);
});
