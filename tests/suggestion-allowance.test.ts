import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { activeMovies, createPuzzle, gameReducer, hasUsedSuggestion, initialState, QUESTION_LIMIT } from "../lib/game/engine.ts";
import { recommendedQuestions, validQuestions } from "../lib/game/questions.ts";
import type { GameState } from "../lib/game/types.ts";

const daily = resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE);
const practice = createPuzzle(PRACTICE_CATALOGUE, 19, "demo", "practice");
const valid = (state: GameState) => validQuestions(activeMovies(state), state.history.map(answer => answer.question.id));
const recommendations = (state: GameState) => recommendedQuestions(activeMovies(state), state.history.map(answer => answer.question.id));

/** Ordinary manual choices leave enough candidates to exercise any allowed suggestion turn. */
function beforeSuggestedTurn(initial: GameState, turn: number): GameState {
  let state = initial;
  for (let slot = 1; slot < turn; slot++) {
    const chosen = [...valid(state)].reverse()
      .map(question => () => gameReducer(state, {type: "ask", question}))
      .reduce<GameState | undefined>((chosen, ask) => {
        if (chosen) return chosen;
        const next = ask();
        return next.activeIds.length > 1 && valid(next).length > 0 ? next : undefined;
      }, undefined);
    assert.ok(chosen, `Fixture needs a valid manual path to question ${turn}`);
    state = chosen;
    assert.equal(hasUsedSuggestion(state), false);
  }
  return state;
}

test("the one suggestion can be submitted on question 1, 3 or 5 in Daily and Practice", () => {
  for (const puzzle of [daily, practice]) for (const turn of [1, 3, 5]) {
    assert.equal(recommendedQuestions(puzzle.movies).length, 3);
    const before = beforeSuggestedTurn(initialState(puzzle), turn);
    const suggestion = recommendations(before)[0];
    assert.ok(suggestion);
    assert.equal(before.history.length, turn - 1);
    assert.equal(hasUsedSuggestion(before), false);
    const after = gameReducer(before, {type: "ask", question: suggestion, suggested: true});
    assert.notEqual(after, before, `${puzzle.mode}, question ${turn}`);
    assert.equal(after.history.length, turn);
    assert.equal(after.history.at(-1)!.suggested, true);
    assert.equal(after.history.filter(answer => answer.suggested).length, 1);
    assert.equal(hasUsedSuggestion(after), true);
    assert.ok(after.activeIds.includes(puzzle.mysteryId));
  }
});

test("a second suggested submission is rejected without spending a question; manual questions remain available", () => {
  const before = initialState(daily);
  const originals = recommendedQuestions(daily.movies);
  const after = gameReducer(before, {type: "ask", question: originals[0], suggested: true});
  const another = recommendations(after)[0];
  assert.ok(another, "The fixture retains another useful question");
  assert.equal(gameReducer(after, {type: "ask", question: another, suggested: true}), after);
  const manual = valid(after)[0];
  const continued = gameReducer(after, {type: "ask", question: manual});
  assert.equal(continued.history.length, 2);
  assert.equal(continued.history.at(-1)!.suggested, undefined);
  assert.equal(continued.history.filter(answer => answer.suggested).length, 1);
});

test("asking a recommendation manually leaves the allowance unused and can never be submitted twice", () => {
  const before = initialState(daily), original = recommendedQuestions(daily.movies)[0];
  const after = gameReducer(before, {type: "ask", question: original});
  assert.equal(after.history.length, 1); assert.equal(hasUsedSuggestion(after), false);
  assert.equal(after.history[0].suggested, undefined);
  assert.equal(gameReducer(after, {type: "ask", question: original}), after);
  assert.equal(gameReducer(after, {type: "ask", question: original, suggested: true}), after);
  assert.equal(hasUsedSuggestion(after), false);
});

test("invalid or non-recommended suggested requests do not consume the allowance or alter canonical questions", () => {
  const before = initialState(practice), originals = recommendedQuestions(practice.movies);
  const other = valid(before).find(question => !originals.some(original => original.id === question.id))!;
  assert.equal(gameReducer(before, {type: "ask", question: other, suggested: true}), before);
  assert.equal(gameReducer(before, {type: "ask", question: {...originals[0], id: "missing"}, suggested: true}), before);
  const changed = {...originals[0], label: "Tampered question", kind: "cast" as const, value: "Not the real subject"};
  const accepted = gameReducer(before, {type: "ask", question: changed, suggested: true});
  assert.equal(accepted.history[0].question.label, originals[0].label);
  assert.equal(accepted.history[0].question.kind, originals[0].kind);
  assert.equal(accepted.history[0].suggested, true);
  assert.equal(hasUsedSuggestion(before), false);
});

test("the allowance is never a sixth question and completed games cannot spend it", () => {
  const suggestion = recommendedQuestions(daily.movies)[0];
  const four = beforeSuggestedTurn(initialState(daily), 5);
  const fifthManual = gameReducer(four, {type: "ask", question: recommendations(four)[0]});
  assert.equal(fifthManual.history.length, QUESTION_LIMIT); assert.equal(hasUsedSuggestion(fifthManual), false);
  assert.equal(gameReducer(fifthManual, {type: "ask", question: suggestion, suggested: true}), fifthManual);
  const before = initialState(daily);
  const finished = gameReducer(before, {type: "guess", movieId: daily.mysteryId});
  assert.equal(gameReducer(finished, {type: "ask", question: suggestion, suggested: true}), finished);
  assert.equal(hasUsedSuggestion(finished), false);
});

test("only a genuinely new puzzle resets use; independent Daily and Practice attempts do not share it", () => {
  const original = recommendedQuestions(daily.movies)[0];
  const used = gameReducer(initialState(daily), {type: "ask", question: original, suggested: true});
  const untouchedPractice = initialState(practice);
  assert.equal(hasUsedSuggestion(used), true); assert.equal(hasUsedSuggestion(untouchedPractice), false);
  const nextPuzzle = createPuzzle(PRACTICE_CATALOGUE, 20, "demo", "practice");
  const fresh = gameReducer(used, {type: "new", puzzle: nextPuzzle});
  assert.equal(fresh.puzzle.id, nextPuzzle.id); assert.equal(fresh.history.length, 0);
  assert.equal(hasUsedSuggestion(fresh), false);
  assert.equal(recommendedQuestions(fresh.puzzle.movies).length, 3);
  assert.equal(hasUsedSuggestion(used), true, "Creating another attempt cannot mutate the previous Daily");
});
