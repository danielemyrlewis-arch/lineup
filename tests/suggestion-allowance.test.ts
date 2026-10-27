import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { activeMovies, createPuzzle, gameReducer, hasUsedSuggestion, initialState, QUESTION_LIMIT } from "../lib/game/engine.ts";
import { openingQuestionExamples, validQuestions } from "../lib/game/questions.ts";
import type { GameState, Question } from "../lib/game/types.ts";

const daily = resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE);
const practice = createPuzzle(PRACTICE_CATALOGUE, 19, "demo", "practice");
const valid = (state: GameState) => validQuestions(activeMovies(state), state.history.map(answer => answer.question.id));
const isUsable = (state: GameState, question: Question) => valid(state).some(candidate => candidate.id === question.id);

/** Fixture paths use ordinary manual questions, keeping an original suggestion valid until the chosen turn. */
function beforeSuggestedTurn(initial: GameState, suggestion: Question, turn: number): GameState {
  const originalIds = new Set(openingQuestionExamples(initial.puzzle.movies).map(question => question.id));
  let state = initial;
  for (let slot = 1; slot < turn; slot++) {
    const candidates = valid(state).filter(question => !originalIds.has(question.id));
    let chosen: GameState | undefined;
    for (const question of candidates) {
      const next = gameReducer(state, {type: "ask", question});
      if (isUsable(next, suggestion)) { chosen = next; break; }
    }
    assert.ok(chosen, `Fixture needs a valid manual path to question ${turn}`);
    state = chosen;
    assert.equal(hasUsedSuggestion(state), false);
  }
  return state;
}

test("the one suggestion can be submitted on question 1, 3 or 5 in Daily and Practice", () => {
  for (const puzzle of [daily, practice]) for (const turn of [1, 3, 5]) {
    const original = openingQuestionExamples(puzzle.movies);
    assert.equal(original.length, 3);
    const before = beforeSuggestedTurn(initialState(puzzle), original[0], turn);
    assert.equal(before.history.length, turn - 1);
    assert.equal(hasUsedSuggestion(before), false);
    const after = gameReducer(before, {type: "ask", question: original[0], suggested: true});
    assert.notEqual(after, before, `${puzzle.mode}, question ${turn}`);
    assert.equal(after.history.length, turn);
    assert.equal(after.history.at(-1)!.suggested, true);
    assert.equal(after.history.filter(answer => answer.suggested).length, 1);
    assert.equal(hasUsedSuggestion(after), true);
    assert.ok(after.activeIds.includes(puzzle.mysteryId));
    assert.deepEqual(openingQuestionExamples(after.puzzle.movies).map(question => question.id), original.map(question => question.id));
  }
});

test("a second suggested submission is rejected without spending a question; manual questions remain available", () => {
  const before = initialState(daily);
  const originals = openingQuestionExamples(daily.movies);
  const after = gameReducer(before, {type: "ask", question: originals[0], suggested: true});
  const another = originals.find(question => isUsable(after, question));
  assert.ok(another, "The fixture retains another original usable suggestion");
  assert.equal(gameReducer(after, {type: "ask", question: another, suggested: true}), after);
  const manual = valid(after)[0];
  const continued = gameReducer(after, {type: "ask", question: manual});
  assert.equal(continued.history.length, 2);
  assert.equal(continued.history.at(-1)!.suggested, undefined);
  assert.equal(continued.history.filter(answer => answer.suggested).length, 1);
});

test("asking an original suggestion manually leaves the allowance unused and can never be submitted twice", () => {
  const before = initialState(daily), original = openingQuestionExamples(daily.movies)[0];
  const after = gameReducer(before, {type: "ask", question: original});
  assert.equal(after.history.length, 1); assert.equal(hasUsedSuggestion(after), false);
  assert.equal(after.history[0].suggested, undefined);
  assert.equal(gameReducer(after, {type: "ask", question: original}), after);
  assert.equal(gameReducer(after, {type: "ask", question: original, suggested: true}), after);
  assert.equal(hasUsedSuggestion(after), false);
});

test("invalid or non-original suggested requests do not consume the allowance or alter canonical questions", () => {
  const before = initialState(practice), originals = openingQuestionExamples(practice.movies);
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
  const suggestion = openingQuestionExamples(daily.movies)[0];
  const four = beforeSuggestedTurn(initialState(daily), suggestion, 5);
  const fifthManual = gameReducer(four, {type: "ask", question: suggestion});
  assert.equal(fifthManual.history.length, QUESTION_LIMIT); assert.equal(hasUsedSuggestion(fifthManual), false);
  assert.equal(gameReducer(fifthManual, {type: "ask", question: suggestion, suggested: true}), fifthManual);
  const before = initialState(daily);
  const finished = gameReducer(before, {type: "guess", movieId: daily.mysteryId});
  assert.equal(gameReducer(finished, {type: "ask", question: suggestion, suggested: true}), finished);
  assert.equal(hasUsedSuggestion(finished), false);
});

test("only a genuinely new puzzle resets use; independent Daily and Practice attempts do not share it", () => {
  const original = openingQuestionExamples(daily.movies)[0];
  const used = gameReducer(initialState(daily), {type: "ask", question: original, suggested: true});
  const untouchedPractice = initialState(practice);
  assert.equal(hasUsedSuggestion(used), true); assert.equal(hasUsedSuggestion(untouchedPractice), false);
  const nextPuzzle = createPuzzle(PRACTICE_CATALOGUE, 20, "demo", "practice");
  const fresh = gameReducer(used, {type: "new", puzzle: nextPuzzle});
  assert.equal(fresh.puzzle.id, nextPuzzle.id); assert.equal(fresh.history.length, 0);
  assert.equal(hasUsedSuggestion(fresh), false);
  assert.equal(openingQuestionExamples(fresh.puzzle.movies).length, 3);
  assert.equal(hasUsedSuggestion(used), true, "Creating another attempt cannot mutate the previous Daily");
});
