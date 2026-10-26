import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { gameReducer, initialState, activeMovies } from "../lib/game/engine.ts";
import { validQuestions } from "../lib/game/questions.ts";
import { completedDailyResult, parseCompletedDailyResult, parseDailyResult } from "../lib/account/results.ts";

const completedAt = "2026-10-20T22:59:59.000Z";
const puzzle = resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE);
const user = "11111111-2222-4333-8444-555555555555";
const finish = (won = true) => {
  let state = initialState(puzzle);
  const question = validQuestions(activeMovies(state))[0];
  state = gameReducer(state, {type: "ask", question});
  const movieId = won ? puzzle.mysteryId : state.activeIds.find(id => id !== puzzle.mysteryId)!;
  return gameReducer(state, {type: "guess", movieId});
};

test("completed scheduled Dailies keep the real outcome, questions, remaining films and path without a numeric score", () => {
  for (const won of [true, false]) {
    const state = finish(won);
    const result = completedDailyResult(state, completedAt)!;
    assert.equal(result.puzzle_id, "daily-001");
    assert.equal(result.puzzle_date, "2026-10-20");
    assert.equal(result.puzzle_number, 1);
    assert.equal(result.outcome, won ? "won" : "lost");
    assert.equal(result.questions_used, 1);
    assert.deepEqual(result.deduction_path, [24, state.activeIds.length]);
    assert.equal(result.films_remaining, state.activeIds.length);
    assert.equal(result.completed_at, completedAt);
    assert.ok(!Object.hasOwn(result, "score"));
    assert.ok(!Object.hasOwn(result, "user_id"));
  }
});

test("a successful early guess with zero questions keeps 24 remaining rather than inventing a final one", () => {
  const state = gameReducer(initialState(puzzle), {type: "guess", movieId: puzzle.mysteryId});
  const result = completedDailyResult(state, completedAt)!;
  assert.equal(result.questions_used, 0);
  assert.deepEqual(result.deduction_path, [24]);
  assert.equal(result.films_remaining, 24);
});

test("Practice, unfinished, forged identity and inconsistent local facts cannot be queued as Daily account results", () => {
  const state = finish();
  assert.equal(completedDailyResult(initialState(puzzle), completedAt), null);
  assert.equal(completedDailyResult({...state, puzzle: {...puzzle, mode: "practice"}}, completedAt), null);
  assert.equal(completedDailyResult({...state, puzzle: {...puzzle, id: "daily-999"}}, completedAt), null);
  assert.equal(completedDailyResult({...state, puzzle: {...puzzle, daily: {...puzzle.daily!, number: 12}}}, completedAt), null);
  assert.equal(completedDailyResult({...state, puzzle: {...puzzle, movies: [...puzzle.movies].reverse()}}, completedAt), null);
  assert.equal(completedDailyResult({...state, activeIds: []}, completedAt), null);
  assert.equal(completedDailyResult({...state, history: [{...state.history[0], answer: !state.history[0].answer}]}, completedAt), null);
  assert.equal(completedDailyResult({...state, status: "lost"}, completedAt), null);
  assert.equal(completedDailyResult(state, "2026-10-19T00:00:00Z"), null);
});

test("API/guest summaries are validated and copied without private profile or unknown fields", () => {
  const result = completedDailyResult(finish(), completedAt)!;
  const row = parseDailyResult({...result, user_id: user, email: "private@example.test", extra: 42})!;
  assert.deepEqual(row, {user_id: user, ...result});
  assert.notEqual(row.deduction_path, result.deduction_path);
  assert.equal(parseDailyResult({...row, user_id: "not-a-user"}), null);
  assert.equal(parseDailyResult({...row, user_id: null}), null);
  assert.equal(parseDailyResult(null), null);
  assert.equal(parseCompletedDailyResult([]), null);
});

test("invalid identities, timestamps and path/budget values are rejected rather than normalized into a result", () => {
  const result = completedDailyResult(finish(), completedAt)!;
  const invalid = [
    {puzzle_id: "practice-001"}, {puzzle_date: "2026-02-30"}, {puzzle_date: "2028-10-20"},
    {puzzle_number: 2}, {outcome: "playing"}, {questions_used: -1}, {questions_used: 6},
    {questions_used: 1.5}, {films_remaining: 0}, {films_remaining: 25},
    {deduction_path: [24]}, {deduction_path: [25, result.films_remaining]},
    {deduction_path: [24, 2, 3], questions_used: 2, films_remaining: 3},
    {deduction_path: [24, null]}, {completed_at: "2026-10-20"},
    {completed_at: "2026-02-30T12:00:00Z"}, {completed_at: "2026-10-20T24:00:00Z"},
    {completed_at: "2026-10-20T12:00:00"},
  ];
  for (const change of invalid) assert.equal(parseCompletedDailyResult({...result, ...change}), null, JSON.stringify(change));
});

test("completion timestamp uses the London calendar around BST midnight", () => {
  const result = completedDailyResult(finish(), completedAt)!;
  assert.ok(parseCompletedDailyResult({...result, completed_at: "2026-10-19T23:00:00.000Z"}));
  assert.equal(parseCompletedDailyResult({...result, completed_at: "2026-10-19T22:59:59.999Z"}), null);
  assert.equal(parseCompletedDailyResult({...result, completed_at: "2026-10-20T00:00:00+01:00"})?.completed_at, "2026-10-19T23:00:00.000Z");
});
