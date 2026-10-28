import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import { activeMovies, createPuzzle, deductionPath, gameReducer, hasUsedSuggestion, initialState } from "../lib/game/engine.ts";
import { evaluateQuestion, recommendedQuestions, validQuestions } from "../lib/game/questions.ts";
import { advanceDailyProgress, DAILY_PROGRESS_PREFIX, dailyProgressKey, readDailyProgress, reconcileDailyProgress } from "../lib/game/daily-persistence.ts";
import type { GameAction, GameState, Puzzle } from "../lib/game/types.ts";

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); this.writes++; }
}
const puzzle = (date = "2026-10-20", number = 1): Puzzle => ({
  ...createPuzzle(DEMO_MOVIES, 7401, "demo", "daily"),
  id: `daily-${date}`,
  createdAt: `${date}T00:00:00.000Z`,
  daily: {date, number, catalogueVersion: "catalogue-test-v1"},
});
const question = (state: GameState) => validQuestions(activeMovies(state), state.history.map(h => h.question.id))[0];
const ask = (state: GameState): GameAction => ({ type: "ask", question: question(state) });

function twoQuestions(storage: MemoryStorage) {
  let state = initialState(puzzle());
  for (let n = 0; n < 2; n++) state = advanceDailyProgress(state, ask(state), storage).state;
  return state;
}

test("Daily progress is synchronous, compact and resumes with the same used questions", () => {
  const storage = new MemoryStorage();
  assert.equal(readDailyProgress(puzzle(), storage).kind, "missing");
  const state = twoQuestions(storage);
  assert.equal(storage.writes, 2);
  const raw = storage.getItem(dailyProgressKey("2026-10-20"))!;
  assert.ok(raw.length < 4000);
  assert.ok(!raw.includes('"movies"') && !raw.includes('"mysteryId"'));
  const stored = JSON.parse(raw);
  assert.equal(stored.schema, 1);
  assert.equal(stored.questionsLeft, 3);
  assert.equal(stored.questionsUsed, 2);
  assert.equal(stored.finalGuessSubmitted, false);
  assert.equal(stored.filmsRemainingAtGuess, null);
  const loaded = readDailyProgress(puzzle(), storage);
  assert.equal(loaded.kind, "saved");
  assert.deepEqual(loaded.state, state);
  assert.equal(loaded.state.history.length, 2);
  assert.deepEqual(loaded.state.activeIds, state.activeIds);
  assert.ok(!validQuestions(activeMovies(loaded.state)).filter(q => q.id === state.history[0].question.id).length);
});

test("restored games preserve the canonical five-question limit", () => {
  const storage = new MemoryStorage();
  let state = initialState(puzzle());
  for (let n = 0; n < 5; n++) {
    const mystery = state.puzzle.movies.find(m => m.id === state.puzzle.mysteryId)!;
    const choices = validQuestions(activeMovies(state), state.history.map(h => h.question.id));
    choices.sort((a, b) => (evaluateQuestion(mystery, b) ? b.yesCount : b.noCount) - (evaluateQuestion(mystery, a) ? a.yesCount : a.noCount));
    assert.ok(choices[0]);
    state = advanceDailyProgress(state, {type: "ask", question: choices[0]}, storage).state;
  }
  const loaded = readDailyProgress(puzzle(), storage).state;
  assert.equal(loaded.history.length, 5);
  const sixth = question(loaded);
  assert.ok(sixth);
  const before = storage.getItem(dailyProgressKey("2026-10-20"));
  const attempt = advanceDailyProgress(loaded, {type: "ask", question: sixth}, storage);
  assert.equal(attempt.accepted, false);
  assert.equal(attempt.state.history.length, 5);
  assert.equal(storage.getItem(dailyProgressKey("2026-10-20")), before);
});

test("a completed Daily attempt is immutable and may be revisited with its real final path", () => {
  const storage = new MemoryStorage();
  const started = twoQuestions(storage);
  const finished = advanceDailyProgress(started, {type: "guess", movieId: started.puzzle.mysteryId}, storage);
  assert.equal(finished.state.status, "won");
  assert.equal(finished.saved, true);
  const raw = storage.getItem(dailyProgressKey("2026-10-20"));
  const stored = JSON.parse(raw!);
  assert.equal(stored.filmsRemainingAtGuess, started.activeIds.length);
  assert.equal(stored.finalGuessSubmitted, true);
  const restored = readDailyProgress(puzzle(), storage).state;
  assert.deepEqual(deductionPath(restored), deductionPath(started));
  assert.equal(restored.status, "won");
  for (const action of [{type: "new", puzzle: puzzle()}, {type: "ask", question: question(initialState(puzzle()))}, {type: "guess", movieId: "missing"}] as GameAction[]) {
    const next = advanceDailyProgress(restored, action, storage);
    assert.equal(next.accepted, false);
    assert.equal(next.state.status, "won");
    assert.equal(storage.getItem(dailyProgressKey("2026-10-20")), raw);
  }
});

test("incorrect guesses, including zero-question attempts, remain completed after refresh", () => {
  const storage = new MemoryStorage();
  const state = initialState(puzzle());
  const wrong = state.activeIds.find(id => id !== state.puzzle.mysteryId)!;
  const next = advanceDailyProgress(state, {type: "guess", movieId: wrong}, storage);
  assert.equal(next.state.status, "lost");
  const restored = readDailyProgress(puzzle(), storage).state;
  assert.equal(restored.status, "lost");
  assert.equal(restored.history.length, 0);
  assert.equal(restored.activeIds.length, 24);
  assert.deepEqual(deductionPath(restored), [24]);
});

test("invalid, corrupt, mismatched and old-schema storage is held without a fresh attempt", () => {
  const storage = new MemoryStorage();
  const initial = initialState(puzzle());
  const key = dailyProgressKey("2026-10-20");
  for (const raw of ["{broken", "null", "[]", JSON.stringify({schema: 0}), "x".repeat(32_001)]) {
    storage.setItem(key, raw);
    assert.equal(readDailyProgress(puzzle(), storage).kind, "invalid");
    assert.equal(advanceDailyProgress(initial, ask(initial), storage).accepted, false);
    assert.equal(storage.getItem(key), raw);
  }
  storage.values.clear();
  twoQuestions(storage);
  const good = JSON.parse(storage.getItem(key)!);
  const variants = [
    {...good, puzzleId: "different"}, {...good, date: "2026-10-21"}, {...good, catalogueVersion: "changed"},
    {...good, number: 2}, {...good, questionsLeft: 5}, {...good, questionsUsed: 0},
    {...good, status: "won"}, {...good, activeIds: good.activeIds.slice(1)},
    {...good, questions: [...good.questions, good.questions[0]]},
    {...good, questions: [{...good.questions[0], answer: !good.questions[0].answer}, good.questions[1]]},
    {...good, questions: [{...good.questions[0], id: "made-up"}, good.questions[1]]},
    {...good, questions: [{...good.questions[0], eliminatedIds: []}, good.questions[1]]},
    {...good, finalGuessSubmitted: true, guessId: "missing"},
  ];
  for (const bad of variants) {
    storage.setItem(key, JSON.stringify(bad));
    assert.equal(readDailyProgress(puzzle(), storage).kind, "invalid", JSON.stringify(bad));
  }
});

test("restricted storage keeps the current session playable without resetting in-memory progress", () => {
  const initial = initialState(puzzle());
  const denied = {getItem: () => {throw new Error("Denied");}, setItem: () => {throw new Error("Denied");}};
  assert.equal(readDailyProgress(puzzle(), denied).kind, "unavailable");
  const first = advanceDailyProgress(initial, ask(initial), denied);
  assert.equal(first.kind, "unavailable");
  assert.equal(first.saved, false);
  assert.equal(first.accepted, true);
  const second = advanceDailyProgress(first.state, ask(first.state), denied);
  assert.equal(second.state.history.length, 2);
  const readonly = {getItem: () => null, setItem: () => {throw new Error("Full");}};
  const third = advanceDailyProgress(second.state, ask(second.state), readonly);
  assert.equal(third.state.history.length, 3);
});

test("Daily state is separated by date and never writes Practice keys or accepts Practice puzzles", () => {
  const storage = new MemoryStorage();
  storage.setItem("lineup:practice:v1", '{"played":7}');
  const first = twoQuestions(storage);
  const tomorrow = puzzle("2026-10-21", 2);
  assert.equal(readDailyProgress(tomorrow, storage).kind, "missing");
  const next = advanceDailyProgress(initialState(tomorrow), ask(initialState(tomorrow)), storage);
  assert.equal(next.state.history.length, 1);
  assert.equal(readDailyProgress(first.puzzle, storage).state.history.length, 2);
  assert.equal(storage.getItem("lineup:practice:v1"), '{"played":7}');
  assert.equal(DAILY_PROGRESS_PREFIX, "lineup:daily:progress:v1:");
  const practice = createPuzzle(DEMO_MOVIES, 42);
  const before = storage.writes;
  assert.equal(readDailyProgress(practice, storage).kind, "invalid");
  assert.equal(advanceDailyProgress(initialState(practice), ask(initialState(practice)), storage).accepted, false);
  assert.equal(storage.writes, before);
});

test("another tab's saved progress and final result cannot be overwritten by stale UI", () => {
  const storage = new MemoryStorage();
  const stale = initialState(puzzle());
  const newer = twoQuestions(storage);
  const next = advanceDailyProgress(stale, ask(newer), storage);
  assert.equal(next.state.history.length, 3);
  const complete = advanceDailyProgress(next.state, {type: "guess", movieId: next.state.puzzle.mysteryId}, storage);
  const saved = storage.getItem(dailyProgressKey("2026-10-20"));
  const staleAttempt = advanceDailyProgress(stale, ask(stale), storage);
  assert.equal(staleAttempt.state.status, complete.state.status);
  assert.equal(staleAttempt.accepted, false);
  assert.equal(storage.getItem(dailyProgressKey("2026-10-20")), saved);
});

test("a previously denied write can catch up from this tab's consistent longer history", () => {
  const storage = new MemoryStorage();
  const initial = initialState(puzzle());
  const first = advanceDailyProgress(initial, ask(initial), storage).state;
  const readonly = {getItem: (key: string) => storage.getItem(key), setItem: () => {throw new Error("Quota");}};
  const second = advanceDailyProgress(first, ask(first), readonly).state;
  const third = advanceDailyProgress(second, ask(second), storage);
  assert.equal(third.state.history.length, 3);
  assert.equal(third.saved, true);
  assert.equal(readDailyProgress(puzzle(), storage).state.history.length, 3);
});

test("invalid or repeated question actions cannot consume budget or alter persisted progress", () => {
  const storage = new MemoryStorage();
  const state = twoQuestions(storage);
  const before = storage.getItem(dailyProgressKey("2026-10-20"));
  const duplicate = advanceDailyProgress(state, {type: "ask", question: state.history[0].question}, storage);
  assert.equal(duplicate.accepted, false);
  assert.equal(storage.getItem(dailyProgressKey("2026-10-20")), before);
  assert.deepEqual(duplicate.state, state);
  const canonical = gameReducer(state, {type: "ask", question: question(state)});
  const next = advanceDailyProgress(state, ask(state), storage).state;
  assert.deepEqual(next, canonical);
});


test("cached Daily progress survives unavailable storage while a saved completion takes precedence", () => {
  const storage = new MemoryStorage();
  const cached = twoQuestions(storage);
  const unavailable = {kind: "unavailable" as const, state: initialState(puzzle())};
  assert.equal(reconcileDailyProgress(cached, unavailable), cached);
  const complete = advanceDailyProgress(cached, {type: "guess", movieId: cached.puzzle.mysteryId}, storage).state;
  assert.equal(reconcileDailyProgress(cached, readDailyProgress(puzzle(), storage)).status, "won");
  assert.deepEqual(reconcileDailyProgress(cached, readDailyProgress(puzzle(), storage)), complete);
});

test("Daily cache reconciliation never merges a different puzzle, version or film order", () => {
  const storage = new MemoryStorage();
  const cached = twoQuestions(storage);
  const today = {kind: "missing" as const, state: initialState(puzzle())};
  const wrong = [
    {...cached, puzzle: puzzle("2026-10-21", 2)},
    {...cached, puzzle: {...cached.puzzle, id: "different"}},
    {...cached, puzzle: {...cached.puzzle, daily: {...cached.puzzle.daily!, catalogueVersion: "other-version"}}},
    {...cached, puzzle: {...cached.puzzle, movies: [...cached.puzzle.movies].reverse()}},
    {...cached, puzzle: {...cached.puzzle, mode: "practice" as const}},
  ];
  for (const state of wrong) assert.equal(reconcileDailyProgress(state, today), today.state);
  assert.equal(reconcileDailyProgress(cached, {kind: "invalid", state: today.state}), today.state);
});

test("Daily suggestion provenance survives replay while legacy unmarked questions keep their allowance", () => {
  const storage = new MemoryStorage(), start = initialState(puzzle());
  const example = recommendedQuestions(start.puzzle.movies)[0];
  const accepted = advanceDailyProgress(start, {type: "ask", question: example, suggested: true}, storage);
  assert.equal(accepted.accepted, true);
  assert.equal(hasUsedSuggestion(accepted.state), true);
  const restored = readDailyProgress(start.puzzle, storage);
  assert.equal(restored.kind, "saved"); assert.equal(hasUsedSuggestion(restored.state), true);
  assert.deepEqual(restored.state, accepted.state);
  const key = dailyProgressKey(start.puzzle.daily!.date);
  const saved = JSON.parse(storage.getItem(key)!);
  assert.equal(saved.schema, 1);
  delete saved.questions[0].suggested;
  storage.setItem(key, JSON.stringify(saved));
  const legacy = readDailyProgress(start.puzzle, storage);
  assert.equal(legacy.kind, "saved"); assert.equal(hasUsedSuggestion(legacy.state), false);
  assert.equal(legacy.state.history.length, 1);
  const alreadyAsked = advanceDailyProgress(legacy.state, {type: "ask", question: example, suggested: true}, storage);
  assert.equal(alreadyAsked.accepted, false); assert.equal(hasUsedSuggestion(alreadyAsked.state), false);
});

test("Daily rejects invalid suggestion metadata without resetting an existing attempt", () => {
  const storage = new MemoryStorage(), start = initialState(puzzle());
  const example = recommendedQuestions(start.puzzle.movies)[0];
  advanceDailyProgress(start, {type: "ask", question: example, suggested: true}, storage);
  const key = dailyProgressKey(start.puzzle.daily!.date);
  const good = JSON.parse(storage.getItem(key)!);
  for (const marker of [false, "true", 1, null]) {
    const bad = structuredClone(good); bad.questions[0].suggested = marker;
    const raw = JSON.stringify(bad); storage.setItem(key, raw);
    assert.equal(readDailyProgress(start.puzzle, storage).kind, "invalid");
    assert.equal(advanceDailyProgress(start, ask(start), storage).accepted, false);
    assert.equal(storage.getItem(key), raw);
  }
});

test("old neutral Daily assistance survives a ranking update, including a completed result", () => {
  const storage = new MemoryStorage(), originalPuzzle = puzzle();
  // Frozen valid schema-1 record from the previous neutral selector, commit 92ccd9b.
  const saved = {
    schema: 1, date: "2026-10-20", puzzleId: "daily-2026-10-20", number: 1,
    catalogueVersion: "catalogue-test-v1",
    questions: [{id: "collection:false", answer: true, remaining: 15,
      eliminatedIds: ["78", "8587", "238", "694", "329", "603", "12", "354912", "862"], suggested: true}],
    activeIds: ["13", "37799", "244786", "120467", "194", "545611", "152601", "313369", "769", "419430", "37165", "77338", "4935", "346698", "329865"],
    questionsUsed: 1, questionsLeft: 4, finalGuessSubmitted: false,
    guessId: null as string | null, status: "playing", filmsRemainingAtGuess: null as number | null,
  };
  assert.ok(!recommendedQuestions(originalPuzzle.movies).some(question => question.id === saved.questions[0].id),
    "This fixture must exercise a formerly offered question outside the current recommendations");
  const key = dailyProgressKey(originalPuzzle.daily!.date);
  storage.setItem(key, JSON.stringify(saved));
  const resumed = readDailyProgress(originalPuzzle, storage);
  assert.equal(resumed.kind, "saved");
  assert.equal(resumed.state.history[0].question.id, "collection:false");
  assert.equal(resumed.state.history.length, 1);
  assert.equal(resumed.state.activeIds.length, 15);
  assert.equal(hasUsedSuggestion(resumed.state), true);
  const offeredNow = recommendedQuestions(activeMovies(resumed.state), resumed.state.history.map(row => row.question.id))[0];
  assert.equal(advanceDailyProgress(resumed.state, {type: "ask", question: offeredNow, suggested: true}, storage).accepted, false);

  const completed = {...saved, finalGuessSubmitted: true, guessId: originalPuzzle.mysteryId,
    status: "won", filmsRemainingAtGuess: 15};
  const raw = JSON.stringify(completed);
  storage.setItem(key, raw);
  const restored = readDailyProgress(originalPuzzle, storage);
  assert.equal(restored.kind, "saved");
  assert.equal(restored.state.status, "won");
  assert.equal(hasUsedSuggestion(restored.state), true);
  assert.deepEqual(deductionPath(restored.state), [24, 15]);
  assert.equal(advanceDailyProgress(restored.state, ask(resumed.state), storage).accepted, false);
  assert.equal(storage.getItem(key), raw, "Reading or revisiting a completed result cannot rewrite it");
});

test("Daily replay rejects a second assistance marker even when both questions are canonical", () => {
  const storage = new MemoryStorage(), start = initialState(puzzle());
  const first = recommendedQuestions(start.puzzle.movies)[0];
  const once = advanceDailyProgress(start, {type: "ask", question: first, suggested: true}, storage).state;
  const twice = advanceDailyProgress(once, ask(once), storage).state;
  assert.equal(twice.history.length, 2);
  const key = dailyProgressKey(start.puzzle.daily!.date);
  const saved = JSON.parse(storage.getItem(key)!);
  saved.questions[1].suggested = true;
  const raw = JSON.stringify(saved);
  storage.setItem(key, raw);
  assert.equal(readDailyProgress(start.puzzle, storage).kind, "invalid");
  assert.equal(storage.getItem(key), raw);
});
