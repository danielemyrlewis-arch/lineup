import test from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { activeMovies, gameReducer, hasUsedSuggestion, initialState } from "../lib/game/engine.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { recommendedQuestions, validQuestions } from "../lib/game/questions.ts";
import { PRACTICE_PROGRESS_KEY, readPracticeProgress, writePracticeProgress } from "../lib/game/practice-persistence.ts";
import { advanceDailyProgress, dailyProgressKey, encodeGameProgress } from "../lib/game/daily-persistence.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import type { GameState } from "../lib/game/types.ts";

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); this.writes++; }
  removeItem(key: string) { this.values.delete(key); }
}
const fresh = (seed = 91) => initialState(createPracticePuzzle(PRACTICE_CATALOGUE, seed, "demo"));
const manualQuestion = (state: GameState) => validQuestions(activeMovies(state), state.history.map(row => row.question.id))[0];

test("Practice stores the exact unfinished board and restores its accepted suggestion and question budget", () => {
  const storage = new MemoryStorage();
  let state = fresh();
  assert.equal(readPracticeProgress(PRACTICE_CATALOGUE, storage).kind, "missing");
  const example = recommendedQuestions(state.puzzle.movies)[0];
  state = gameReducer(state, {type: "ask", question: example, suggested: true});
  state = gameReducer(state, {type: "ask", question: manualQuestion(state)});
  assert.equal(writePracticeProgress(state, storage), true);
  const raw = storage.getItem(PRACTICE_PROGRESS_KEY)!;
  assert.ok(raw.length < 6_000);
  assert.ok(!raw.includes('"movies"') && !raw.includes('"posterPath"') && !raw.includes('"overview"'));
  assert.ok(raw.includes('"suggested":true'));
  const restored = readPracticeProgress(PRACTICE_CATALOGUE, storage);
  assert.equal(restored.kind, "saved");
  assert.deepEqual(restored.state, state);
  assert.equal(restored.state!.history.length, 2);
  assert.equal(hasUsedSuggestion(restored.state!), true);
});

test("an unused allowance survives Practice reload and a new board replaces the unfinished snapshot", () => {
  const storage = new MemoryStorage();
  let state = fresh();
  state = gameReducer(state, {type: "ask", question: manualQuestion(state)});
  writePracticeProgress(state, storage);
  const restored = readPracticeProgress(PRACTICE_CATALOGUE, storage).state!;
  assert.equal(hasUsedSuggestion(restored), false);
  const next = fresh(492);
  assert.equal(writePracticeProgress(next, storage), true);
  const changed = readPracticeProgress(PRACTICE_CATALOGUE, storage).state!;
  assert.equal(changed.puzzle.id, next.puzzle.id);
  assert.equal(changed.history.length, 0);
  assert.equal(hasUsedSuggestion(changed), false);
});

test("completed Practice games remove only their unfinished-progress key and are not resumed", () => {
  const storage = new MemoryStorage();
  const state = fresh();
  storage.setItem("lineup:practice:v1", '{"played":7}');
  storage.setItem("lineup:auth:v1", "private-session");
  storage.setItem("lineup:practice-films:v1", "history");
  writePracticeProgress(state, storage);
  const finished = gameReducer(state, {type: "guess", movieId: state.puzzle.mysteryId});
  assert.equal(writePracticeProgress(finished, storage), true);
  assert.equal(storage.getItem(PRACTICE_PROGRESS_KEY), null);
  assert.equal(readPracticeProgress(PRACTICE_CATALOGUE, storage).kind, "missing");
  assert.equal(storage.getItem("lineup:practice:v1"), '{"played":7}');
  assert.equal(storage.getItem("lineup:auth:v1"), "private-session");
  assert.equal(storage.getItem("lineup:practice-films:v1"), "history");
});

test("a valid stale completed Practice snapshot is ignored rather than resumed", () => {
  const storage = new MemoryStorage(), state = fresh();
  writePracticeProgress(state, storage);
  const raw = JSON.parse(storage.getItem(PRACTICE_PROGRESS_KEY)!);
  raw.progress = encodeGameProgress(gameReducer(state, {type: "guess", movieId: state.puzzle.mysteryId}));
  storage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(raw));
  assert.deepEqual(readPracticeProgress(PRACTICE_CATALOGUE, storage), {kind: "missing", state: null});
});

test("malformed, obsolete and incompatible Practice snapshots cannot replace canonical data", () => {
  const storage = new MemoryStorage();
  writePracticeProgress(fresh(), storage);
  const good = JSON.parse(storage.getItem(PRACTICE_PROGRESS_KEY)!);
  for (const raw of ["{broken", "null", "[]", "x".repeat(32_001),
    JSON.stringify({...good, schema: 0}),
    JSON.stringify({...good, puzzle: {...good.puzzle, id: "practice-other"}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, mode: "daily"}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, seed: -1}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, source: "network-api"}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, createdAt: "not a date"}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, mysteryId: "missing"}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, movieIds: Array(24).fill(good.puzzle.movieIds[0])}}),
    JSON.stringify({...good, puzzle: {...good.puzzle, movieIds: [...good.puzzle.movieIds.slice(0, 23), "missing"]}}),
    JSON.stringify({...good, progress: {...good.progress, questionsLeft: 4}}),
  ]) {
    storage.setItem(PRACTICE_PROGRESS_KEY, raw);
    assert.deepEqual(readPracticeProgress(PRACTICE_CATALOGUE, storage), {kind: "invalid", state: null});
    assert.equal(storage.getItem(PRACTICE_PROGRESS_KEY), raw, "Reads must not clear or replace stored data");
  }
});

test("Practice replay rejects forged suggestion markers and duplicate question submissions", () => {
  const storage = new MemoryStorage();
  let state = fresh();
  const example = recommendedQuestions(state.puzzle.movies)[0];
  state = gameReducer(state, {type: "ask", question: example, suggested: true});
  writePracticeProgress(state, storage);
  const good = JSON.parse(storage.getItem(PRACTICE_PROGRESS_KEY)!);
  for (const marker of [false, "true", 1, null]) {
    const bad = structuredClone(good); bad.progress.questions[0].suggested = marker;
    storage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(bad));
    assert.equal(readPracticeProgress(PRACTICE_CATALOGUE, storage).kind, "invalid");
  }
  const duplicate = structuredClone(good);
  duplicate.progress.questions.push(duplicate.progress.questions[0]);
  storage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(duplicate));
  assert.equal(readPracticeProgress(PRACTICE_CATALOGUE, storage).kind, "invalid");
});

test("Daily and Practice use independent snapshots and suggestion allowances", () => {
  const storage = new MemoryStorage();
  const daily = initialState(resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE));
  const dailyExample = recommendedQuestions(daily.puzzle.movies)[0];
  const progressed = advanceDailyProgress(daily, {type: "ask", question: dailyExample, suggested: true}, storage);
  const dailyRaw = storage.getItem(dailyProgressKey(daily.puzzle.daily!.date));
  const practice = fresh(); writePracticeProgress(practice, storage);
  assert.equal(hasUsedSuggestion(progressed.state), true);
  assert.equal(hasUsedSuggestion(readPracticeProgress(PRACTICE_CATALOGUE, storage).state!), false);
  assert.equal(storage.getItem(dailyProgressKey(daily.puzzle.daily!.date)), dailyRaw);
  assert.equal(writePracticeProgress(daily, storage), false);
  assert.equal(readPracticeProgress(PRACTICE_CATALOGUE, storage).state!.puzzle.id, practice.puzzle.id);
});

test("storage restrictions fail safely without touching the in-memory Practice attempt", () => {
  const state = fresh();
  assert.deepEqual(readPracticeProgress(PRACTICE_CATALOGUE, {getItem: () => {throw new Error("denied");}}), {kind: "unavailable", state: null});
  const denied = {setItem: () => {throw new Error("full");}, removeItem: () => {throw new Error("denied");}};
  assert.equal(writePracticeProgress(state, denied), false);
  const completed = gameReducer(state, {type: "guess", movieId: state.puzzle.mysteryId});
  assert.equal(writePracticeProgress(completed, denied), false);
  assert.equal(state.history.length, 0); assert.equal(state.status, "playing");
});

test("Practice replay cannot restore two consumed suggestion allowances", () => {
  const storage = new MemoryStorage();
  let state: GameState | null = null;
  for (let seed = 1; seed < 20 && !state; seed++) {
    const initial = fresh(seed), examples = recommendedQuestions(initial.puzzle.movies);
    for (const first of examples) {
      const once = gameReducer(initial, {type: "ask", question: first, suggested: true});
      const valid = validQuestions(activeMovies(once), once.history.map(row => row.question.id));
      const second = examples.find(example => valid.some(question => question.id === example.id));
      if (second) { state = gameReducer(once, {type: "ask", question: second}); break; }
    }
  }
  assert.ok(state, "A board with a second still-valid question must exist");
  assert.equal(writePracticeProgress(state, storage), true);
  const snapshot = JSON.parse(storage.getItem(PRACTICE_PROGRESS_KEY)!);
  snapshot.progress.questions[1].suggested = true;
  storage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(snapshot));
  assert.equal(readPracticeProgress(PRACTICE_CATALOGUE, storage).kind, "invalid");
});

test("an old neutral Practice suggestion keeps its exact board and spent allowance after ranking changes", () => {
  const storage = new MemoryStorage();
  // Frozen unfinished snapshot from the previous neutral selector, commit 92ccd9b.
  const saved = {schema: 1,
    puzzle: {id: "practice-91", mode: "practice", seed: 91,
      movieIds: ["37686", "85", "296524", "1593", "654", "11322", "3035", "406", "1542", "691", "354912", "422", "2789", "146", "8290", "16859", "100", "771", "77338", "12477", "962", "103", "1924", "653"],
      mysteryId: "2789", source: "demo", createdAt: "2026-10-27T12:00:00.000Z"},
    progress: {questions: [{id: "director:F.W. Murnau", answer: false, remaining: 23,
      eliminatedIds: ["653"], suggested: true}],
    activeIds: ["37686", "85", "296524", "1593", "654", "11322", "3035", "406", "1542", "691", "354912", "422", "2789", "146", "8290", "16859", "100", "771", "77338", "12477", "962", "103", "1924"],
    questionsUsed: 1, questionsLeft: 4, finalGuessSubmitted: false,
    guessId: null, status: "playing", filmsRemainingAtGuess: null},
  };
  const raw = JSON.stringify(saved);
  storage.setItem(PRACTICE_PROGRESS_KEY, raw);
  const restored = readPracticeProgress(PRACTICE_CATALOGUE, storage);
  assert.equal(restored.kind, "saved");
  const state = restored.state!;
  assert.deepEqual(state.puzzle.movies.map(movie => movie.id), saved.puzzle.movieIds);
  assert.equal(state.puzzle.mysteryId, saved.puzzle.mysteryId);
  assert.equal(state.history[0].question.id, "director:F.W. Murnau");
  assert.equal(state.history.length, 1);
  assert.equal(state.activeIds.length, 23);
  assert.equal(hasUsedSuggestion(state), true);
  assert.ok(!recommendedQuestions(state.puzzle.movies).some(question => question.id === saved.progress.questions[0].id),
    "The old one-film split must no longer be offered as a useful opening recommendation");
  assert.equal(storage.getItem(PRACTICE_PROGRESS_KEY), raw, "Reading must not rewrite the legacy snapshot");
  const offeredNow = recommendedQuestions(activeMovies(state), state.history.map(row => row.question.id))[0];
  assert.equal(gameReducer(state, {type: "ask", question: offeredNow, suggested: true}), state);
  const continued = gameReducer(state, {type: "ask", question: manualQuestion(state)});
  assert.equal(continued.history.length, 2);
  assert.equal(writePracticeProgress(continued, storage), true);
  const reopened = readPracticeProgress(PRACTICE_CATALOGUE, storage);
  assert.equal(reopened.kind, "saved");
  assert.deepEqual(reopened.state, continued);
  assert.equal(hasUsedSuggestion(reopened.state!), true);
});
