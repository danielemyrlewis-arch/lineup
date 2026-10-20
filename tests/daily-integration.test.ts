import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import * as engine from "../lib/game/engine.ts";
import * as history from "../lib/game/practice-history.ts";
import * as dailyStorage from "../lib/game/daily-persistence.ts";
import * as dates from "../lib/game/daily-date.ts";
import * as sharing from "../lib/game/share.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { validQuestions } from "../lib/game/questions.ts";
import type { GameState, Puzzle } from "../lib/game/types.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const dailyPuzzle = (): Puzzle => ({
  ...engine.createPuzzle(DEMO_MOVIES, 8012, "demo", "daily"),
  id: "daily-2026-10-20",
  daily: {date: "2026-10-20", number: 1, catalogueVersion: "test-v1"},
});
const ask = (state: GameState) => ({type: "ask" as const,
  question: validQuestions(engine.activeMovies(state), state.history.map(h => h.question.id))[0]});
let storage = new MemoryStorage();
let dailyReads = 0;

// Render the real Game JSX and its state initializers. Child sheets/board are
// presentation boundaries; no synthetic hook runner or duplicated UI rules.
const exports: {Game?: React.ComponentType<{
  initialPuzzle: Puzzle; catalogue: typeof DEMO_MOVIES; initialGameState?: GameState;
  dailyToday?: string; hasNextDaily?: boolean; hasCurrentDaily?: boolean;
}>} = {};
const dependencies: Record<string, unknown> = {
  "react": React,
  "react/jsx-runtime": await import("react/jsx-runtime"),
  "lucide-react": {X: () => null},
  "@/lib/game/engine": engine,
  "@/lib/game/persistence": {recordResult: () => {}, readStats: () => null},
  "@/lib/game/practice-history": history,
  "@/lib/game/share": sharing,
  "./movie-board": {MovieBoard: () => React.createElement("section", {"data-test": "movie-board"})},
  "./question-panel": {QuestionPanel: ({state}: {state: GameState}) => React.createElement("section", {"data-test": "question-panel", "data-left": 5 - state.history.length})},
  "./info-dialogs": {HelpDialog: () => null, AboutDialog: () => null, StatsDialog: () => null},
  "./pick-dialogs": {PickDialog: () => null, RestartDialog: () => React.createElement("section", {"data-test": "restart"})},
  "./result-dialog": {ResultDialog: ({state}: {state: GameState}) => React.createElement("section", {"data-test": "result", "data-status": state.status})},
  "./game-shell": {GameShell: ({children, mode}: {children: React.ReactNode; mode: string}) => React.createElement("main", {"data-mode": mode}, children)},
  "@/lib/game/practice-selection": {createPracticePuzzle},
  "@/lib/game/onboarding": {shouldShowStrategyHint: () => false, dismissStrategyHint: () => {}},
  "@/lib/game/daily-persistence": {...dailyStorage, readDailyProgress: (puzzle: Puzzle) => { dailyReads++; return dailyStorage.readDailyProgress(puzzle, storage); }},
  "@/lib/game/daily-date": dates,
};
const source = ts.transpileModule(readFileSync(new URL("../components/game/game.tsx", import.meta.url), "utf8"), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
}).outputText;
runInNewContext(source, {exports, require: (name: string) => {
  assert.ok(Object.hasOwn(dependencies, name), `Unexpected Game dependency ${name}`);
  return dependencies[name];
}});
const render = (puzzle: Puzzle, cached?: GameState, options: {dailyToday?: string; hasNextDaily?: boolean; hasCurrentDaily?: boolean} = {}) => renderToStaticMarkup(React.createElement(exports.Game!, {
  initialPuzzle: puzzle, catalogue: DEMO_MOVIES, initialGameState: cached,
  dailyToday: "2026-10-20", hasNextDaily: true, ...options,
}));

test("actual Daily Game resumes saved used questions without showing a restart action", () => {
  storage = new MemoryStorage();
  const puzzle = dailyPuzzle();
  let state = engine.initialState(puzzle);
  for (let i = 0; i < 2; i++) state = dailyStorage.advanceDailyProgress(state, ask(state), storage).state;
  const html = render(puzzle);
  assert.match(html, /Daily #001/);
  assert.match(html, /data-mode="daily"/);
  assert.match(html, /data-test="question-panel" data-left="3"/);
  assert.ok(!html.includes("New lineup") && !html.includes('data-test="restart"'));
});

test("actual completed Daily Game exposes result revisit and Practice, never replay", () => {
  storage = new MemoryStorage();
  const puzzle = dailyPuzzle();
  const state = engine.initialState(puzzle);
  dailyStorage.advanceDailyProgress(state, {type: "guess", movieId: puzzle.mysteryId}, storage);
  const html = render(puzzle, state);
  assert.match(html, /Today’s LINEUP is complete/);
  assert.match(html, /midnight UK time/);
  assert.match(html, />View your result<\/button>/);
  assert.match(html, />Play Practice<\/button>/);
  assert.match(html, /data-test="result" data-status="won"/);
  assert.ok(!html.includes('data-test="question-panel"'));
  assert.ok(!html.includes("New lineup") && !html.includes("Play again"));
});

test("actual corrupt Daily Game holds the attempt and offers Practice instead of fresh budget", () => {
  storage = new MemoryStorage();
  storage.setItem(dailyStorage.dailyProgressKey("2026-10-20"), "{broken");
  const html = render(dailyPuzzle());
  assert.match(html, /role="alert"/);
  assert.match(html, /Today’s attempt hasn’t been reset/);
  assert.match(html, />Play Practice<\/button>/);
  assert.ok(!html.includes('data-test="question-panel"'));
  assert.ok(!html.includes('data-test="movie-board"'));
});

test("actual Practice Game keeps its independent cached state and New lineup action", () => {
  storage = new MemoryStorage();
  let state = engine.initialState(engine.createPuzzle(DEMO_MOVIES, 42));
  state = engine.gameReducer(state, ask(state));
  const before = dailyReads;
  const html = render(state.puzzle, state);
  assert.match(html, /data-mode="practice"/);
  assert.match(html, /data-test="question-panel" data-left="4"/);
  assert.match(html, />New lineup<\/button>/);
  assert.ok(!html.includes("Daily #"));
  assert.equal(dailyReads, before, "Practice must not read Daily progress");
});


test("actual Daily Game retains a cached attempt across a mode switch when storage is denied", () => {
  storage = new MemoryStorage();
  const puzzle = dailyPuzzle();
  let state = engine.initialState(puzzle);
  for (let i = 0; i < 2; i++) state = dailyStorage.advanceDailyProgress(state, ask(state), storage).state;
  storage.getItem = () => { throw new Error("Browser restriction"); };
  const html = render(puzzle, state);
  assert.match(html, /data-test="question-panel" data-left="3"/);
  assert.match(html, /Browser storage is unavailable/);
  assert.ok(!html.includes("Today’s LINEUP is complete"));
});

test("actual Daily Game preserves both cached budget and warning when reads work but writes are blocked", () => {
  storage = new MemoryStorage();
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const puzzle = dailyPuzzle();
  let state = engine.initialState(puzzle);
  for (let i = 0; i < 2; i++) {
    const next = dailyStorage.advanceDailyProgress(state, ask(state), storage);
    assert.equal(next.saved, false);
    state = next.state;
  }
  assert.equal(storage.getItem(dailyStorage.dailyProgressKey("2026-10-20")), null);
  const html = render(puzzle, state);
  assert.match(html, /data-test="question-panel" data-left="3"/);
  assert.match(html, /Browser storage is unavailable/);
  assert.ok(!html.includes("Today’s LINEUP is complete"));
});


test("an overnight Daily offers the new puzzle without silently changing the old attempt", () => {
  storage = new MemoryStorage();
  const puzzle = dailyPuzzle();
  let state = engine.initialState(puzzle);
  for (let i = 0; i < 2; i++) state = dailyStorage.advanceDailyProgress(state, ask(state), storage).state;
  const html = render(puzzle, state, {dailyToday: "2026-10-21", hasCurrentDaily: true});
  assert.match(html, /A new Daily is ready/);
  assert.match(html, /Play today’s lineup/);
  assert.match(html, /Daily #001/);
  assert.match(html, /data-test="question-panel" data-left="3"/);
  assert.ok(!html.includes("Daily #002"));
});

test("an overnight tab does not promise a new Daily after the static schedule ends", () => {
  storage = new MemoryStorage();
  const puzzle = dailyPuzzle();
  let state = engine.initialState(puzzle);
  for (let i = 0; i < 2; i++) state = dailyStorage.advanceDailyProgress(state, ask(state), storage).state;
  const options = {dailyToday: "2027-10-20", hasCurrentDaily: false, hasNextDaily: false};
  const html = render(puzzle, state, options);
  assert.match(html, /scheduled.*today/i);
  assert.match(html, /Play Practice/);
  assert.match(html, /Daily #001/);
  assert.match(html, /data-test="question-panel" data-left="3"/);
  assert.ok(!html.includes("A new Daily is ready"));
  assert.ok(!html.includes("Play today’s lineup"));
  const completed = dailyStorage.advanceDailyProgress(state, {type: "guess", movieId: puzzle.mysteryId}, storage).state;
  const completeHtml = render(puzzle, completed, options);
  assert.match(completeHtml, /This Daily is complete/);
  assert.match(completeHtml, /Play Practice/);
  assert.ok(!completeHtml.includes("Today’s new lineup is ready"));
  assert.ok(!completeHtml.includes("A new Daily is ready"));
});
