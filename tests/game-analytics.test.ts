import test from "node:test";
import assert from "node:assert/strict";
import { initialState, gameReducer, activeMovies } from "../lib/game/engine.ts";
import { validQuestions } from "../lib/game/questions.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { advanceDailyProgress, dailyProgressKey } from "../lib/game/daily-persistence.ts";
import { hasPreviousDailyPlay, trackGameAction, ANALYTICS_QUESTION_CATEGORY } from "../lib/game/analytics.ts";
import { sanitizeAnalyticsEvent, type AnalyticsEventName } from "../lib/analytics.ts";
import type { GameState } from "../lib/game/types.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const start = (mode: "daily" | "practice" = "daily") => initialState(mode === "daily"
  ? resolveDailyPuzzle(DAILY_SCHEDULE[1], PRACTICE_CATALOGUE)
  : createPracticePuzzle(PRACTICE_CATALOGUE, 8012, "demo"));
const ask = (state: GameState) => gameReducer(state, {type: "ask", question: validQuestions(activeMovies(state), state.history.map(row => row.question.id))[0]});
function fixture() {
  const events: {name: AnalyticsEventName; params: Record<string, unknown>}[] = [];
  const keys = new Set<string>();
  const options = {
    consented: () => true,
    today: () => DAILY_SCHEDULE[1].date,
    previousDailyPlay: () => false,
    track: (name: AnalyticsEventName, params: Record<string, unknown>, key?: string) => {
      assert.deepEqual(sanitizeAnalyticsEvent(name, params), params);
      if (key && keys.has(key)) return false;
      if (key) keys.add(key);
      events.push({name, params}); return true;
    },
  };
  return {events, options};
}

test("Daily and Practice start at the first accepted question with only a broad category", () => {
  for (const mode of ["daily", "practice"] as const) {
    const before = start(mode), after = ask(before), f = fixture();
    trackGameAction(before, after, "ask", PRACTICE_CATALOGUE, f.options);
    assert.deepEqual(f.events, [
      {name: "game_start", params: {mode}},
      {name: "question_asked", params: {mode, question_number: 1, question_category: ANALYTICS_QUESTION_CATEGORY[after.history[0].question.kind]}},
    ]);
    const payload = JSON.stringify(f.events);
    assert.ok(!payload.includes(before.puzzle.id) && !payload.includes(after.history[0].question.id));
    for (const movie of before.puzzle.movies) assert.ok(!payload.includes(movie.title));
    trackGameAction(before, after, "ask", PRACTICE_CATALOGUE, f.options);
    assert.equal(f.events.length, 2);
  }
});

test("later questions and resumed games never manufacture another start", () => {
  const before = ask(start()), after = ask(before), f = fixture();
  trackGameAction(before, before, "ask", PRACTICE_CATALOGUE, f.options);
  assert.equal(f.events.length, 0);
  trackGameAction(before, after, "ask", PRACTICE_CATALOGUE, f.options);
  assert.equal(f.events.length, 1); assert.equal(f.events[0].name, "question_asked");
  assert.equal(f.events[0].params.question_number, 2);
});

test("an accepted final guess reports true outcome and completion once without the selected film", () => {
  for (const won of [true, false]) {
    const before = ask(start()), f = fixture();
    const selected = won ? before.puzzle.mysteryId : before.activeIds.find(id => id !== before.puzzle.mysteryId)!;
    const after = gameReducer(before, {type: "guess", movieId: selected});
    trackGameAction(before, after, "guess", PRACTICE_CATALOGUE, f.options);
    trackGameAction(before, after, "guess", PRACTICE_CATALOGUE, f.options);
    assert.deepEqual(f.events, [
      {name: "guess_submitted", params: {mode: "daily", correct: won}},
      {name: "game_complete", params: {mode: "daily", outcome: won ? "won" : "lost", questions_used: 1, films_remaining: after.activeIds.length}},
    ]);
    assert.ok(!JSON.stringify(f.events).includes(selected));
    trackGameAction(after, after, "guess", PRACTICE_CATALOGUE, f.options);
    assert.equal(f.events.length, 2);
  }
});

test("a zero-question guess is an actual start and completion, including in Practice", () => {
  const before = start("practice"), after = gameReducer(before, {type: "guess", movieId: before.puzzle.mysteryId}), f = fixture();
  trackGameAction(before, after, "guess", PRACTICE_CATALOGUE, f.options);
  assert.deepEqual(f.events.map(event => event.name), ["game_start", "guess_submitted", "game_complete"]);
  assert.deepEqual(f.events.at(-1)!.params, {mode: "practice", outcome: "won", questions_used: 0, films_remaining: 24});
});

test("rejected actions, completion restores and different puzzle identities cannot emit gameplay events", () => {
  const before = start(), f = fixture();
  trackGameAction(before, before, "guess", PRACTICE_CATALOGUE, f.options);
  const other = ask(start("practice"));
  trackGameAction(before, other, "ask", PRACTICE_CATALOGUE, f.options);
  const after = gameReducer(before, {type: "guess", movieId: before.puzzle.mysteryId});
  trackGameAction(after, {...after}, "guess", PRACTICE_CATALOGUE, f.options);
  assert.equal(f.events.length, 0);
});

test("denied analytics neither records actions nor reads old game storage, and does not replay after opt-in", () => {
  const before = start(), after = ask(before), f = fixture(); let reads = 0;
  trackGameAction(before, after, "ask", PRACTICE_CATALOGUE, {...f.options,
    consented: () => false, previousDailyPlay: () => { reads++; return true; }});
  assert.equal(f.events.length, 0); assert.equal(reads, 0);
  trackGameAction(after, ask(after), "ask", PRACTICE_CATALOGUE, f.options);
  assert.deepEqual(f.events.map(event => event.name), ["question_asked"]);
});

test("Daily return is a current London-date participant signal and never a Practice or old-puzzle event", () => {
  for (const mode of ["daily", "practice"] as const) {
    const before = start(mode), f = fixture(), after = ask(before);
    trackGameAction(before, after, "ask", PRACTICE_CATALOGUE, {...f.options, previousDailyPlay: () => true});
    assert.equal(f.events.filter(event => event.name === "daily_return").length, mode === "daily" ? 1 : 0);
  }
  const before = start(), f = fixture();
  trackGameAction(before, ask(before), "ask", PRACTICE_CATALOGUE, {...f.options, today: () => "2026-10-22", previousDailyPlay: () => true});
  assert.ok(!f.events.some(event => event.name === "daily_return"));
});

test("return detection requires existing canonical earlier play, ignoring corrupt, empty, same-day and future records", () => {
  const storage = new MemoryStorage(), date = DAILY_SCHEDULE[1].date;
  assert.equal(hasPreviousDailyPlay(date, PRACTICE_CATALOGUE, storage), false);
  storage.setItem(dailyProgressKey(DAILY_SCHEDULE[0].date), '{"status":"won","private":"fake"}');
  assert.equal(hasPreviousDailyPlay(date, PRACTICE_CATALOGUE, storage), false);
  storage.values.delete(dailyProgressKey(DAILY_SCHEDULE[0].date));
  const prior = initialState(resolveDailyPuzzle(DAILY_SCHEDULE[0], PRACTICE_CATALOGUE));
  const question = validQuestions(prior.puzzle.movies)[0];
  advanceDailyProgress(prior, {type: "ask", question}, storage);
  assert.equal(hasPreviousDailyPlay(date, PRACTICE_CATALOGUE, storage), true);
  assert.equal(hasPreviousDailyPlay(DAILY_SCHEDULE[0].date, PRACTICE_CATALOGUE, storage), false);
  assert.equal(hasPreviousDailyPlay(date, PRACTICE_CATALOGUE, {getItem: () => { throw new Error("blocked"); }, setItem: () => {}}), false);
});

test("analytics failures cannot mutate or throw into an accepted game transition", () => {
  const before = start(), after = ask(before), f = fixture();
  const historyLength = after.history.length;
  assert.doesNotThrow(() => trackGameAction(before, after, "ask", PRACTICE_CATALOGUE,
    {...f.options, track: () => { throw new Error("analytics blocked"); }}));
  assert.equal(after.history.length, historyLength);
  assert.equal(after.status, "playing");
});
