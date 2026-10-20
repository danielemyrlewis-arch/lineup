import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import * as engine from "../lib/game/engine.ts";
import { validQuestions } from "../lib/game/questions.ts";
import * as share from "../lib/game/share.ts";
import { RESULT_COPY } from "../lib/game/copy.ts";
import type { GameState } from "../lib/game/types.ts";

function dailyState(number = 1): GameState {
  const puzzle = engine.createPuzzle(DEMO_MOVIES, 19, "demo", "daily");
  let state = engine.initialState({
    ...puzzle, id: "daily-2026-10-20", createdAt: "2026-10-20T00:00:00.000Z",
    daily: { date: "2026-10-20", number, catalogueVersion: "reviewed-test-v1" },
  });
  for (let i = 0; i < 3; i++) {
    const question = validQuestions(engine.activeMovies(state), state.history.map(answer => answer.question.id))[0];
    if (!question) break;
    state = engine.gameReducer(state, { type: "ask", question });
  }
  return engine.gameReducer(state, { type: "guess", movieId: puzzle.mysteryId });
}

test("Daily sharing takes its stable number from the schedule and includes the actual path without spoilers", () => {
  const state = dailyState();
  const text = share.shareText(state);
  assert.ok(text.startsWith(`LINEUP #001\nFound in ${state.history.length} questions.`));
  assert.ok(text.includes(`Films remaining:\n${engine.deductionPath(state).join(" → ")}`));
  assert.ok(text.endsWith(`Can you do better?\n${share.GAME_URL}`));
  assert.ok(!text.includes("Practice"));
  assert.ok(!text.includes(state.puzzle.id));
  assert.ok(!text.includes(state.puzzle.daily!.date));
  for (const movie of state.puzzle.movies) assert.ok(!text.includes(movie.title));
  for (const answer of state.history) assert.ok(!text.includes(answer.question.label));
  assert.ok(!/mystery|answer:|🎯/i.test(text));
  assert.equal(share.dailyResultLabel(state), "Daily LINEUP #001");
  assert.equal(share.dailyResultLabel(dailyState(1234)), "Daily LINEUP #1234");
});

test("a failed Daily result remains accurately failed and uses the same non-spoiling root URL", () => {
  const state = { ...dailyState(27), status: "lost" as const };
  const text = share.shareText(state);
  assert.ok(text.startsWith("LINEUP #027\nNot this time."));
  assert.ok(text.includes(`${state.history.length} questions used.`));
  assert.ok(!text.includes("Found in"));
  assert.ok(text.endsWith(share.GAME_URL));
  assert.equal(new URL(share.gameUrl(state)).search, "");
});

test("Practice sharing selects Practice explicitly and never borrows Daily numbering", () => {
  const state = dailyState(25);
  const practice = { ...state, puzzle: { ...state.puzzle, mode: "practice" as const } };
  const text = share.shareText(practice);
  assert.match(text, /^LINEUP\nPractice · Found in/);
  assert.ok(!text.includes("#025"));
  assert.equal(share.dailyResultLabel(practice), null);
  const url = new URL(share.gameUrl(practice));
  assert.equal(url.origin + url.pathname, share.GAME_URL);
  assert.equal(url.searchParams.get("mode"), "practice");
  assert.ok(text.endsWith(url.href));
});

test("Daily native sharing and clipboard fallback carry the same stable spoiler-free result", async () => {
  const state = dailyState(42);
  let nativeText = "";
  assert.equal(await share.shareResult(state, { share: async data => {
    assert.equal(data.title, "LINEUP #042");
    nativeText = data.text!;
  } }), "shared");
  assert.equal(nativeText, share.shareText(state));
  let copiedText = "";
  assert.equal(await share.shareResult(state, { clipboard: { writeText: async text => { copiedText = text; } } }), "copied");
  assert.equal(copiedText, nativeText);
  assert.equal(await share.shareResult(state, { share: async () => { throw { name: "AbortError" }; } }), "cancelled");
  assert.equal(await share.shareResult(state, { clipboard: { writeText: async () => { throw new Error("Blocked"); } } }), "manual");
});

const exports = {} as { ResultDialog: React.ComponentType<Record<string, unknown>> };
const compiled = ts.transpileModule(readFileSync(new URL("../components/game/result-dialog.tsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
});
runInNewContext(compiled.outputText, { React, exports, require: (name: string) => {
  if (name === "@/lib/game/engine") return engine;
  if (name === "@/lib/game/share") return share;
  if (name === "@/lib/game/copy") return { RESULT_COPY };
  if (name === "./dialog") return { Dialog: ({ children }: { children: React.ReactNode }) => React.createElement("dialog", null, children) };
  assert.equal(name, "./poster");
  return { Poster: () => null };
} });
const render = (state: GameState) => renderToStaticMarkup(React.createElement(exports.ResultDialog, {
  state, error: "", newLoading: false, shareStatus: "", shareBusy: false,
  shareFallback: null, onNew: () => {}, onShare: () => {},
  onCopyResult: () => {}, onCopyLink: () => {}, onClose: () => {},
}));

test("Daily result labelling retains the existing real path and offers Practice rather than a Daily restart", () => {
  const state = dailyState(99);
  const html = render(state);
  assert.match(html, /Daily LINEUP #099/);
  assert.match(html, /You got it\./);
  assert.match(html, /questions used\./);
  assert.match(html, />Play Practice<\/button>/);
  assert.ok(!html.includes("Play again"));
  assert.ok(html.includes(`Films remaining: ${engine.deductionPath(state).join(", then ")}`));
  const practice = render({ ...state, puzzle: { ...state.puzzle, mode: "practice" } });
  assert.ok(!practice.includes("Daily LINEUP"));
  assert.match(practice, />Play again<\/button>/);
});
