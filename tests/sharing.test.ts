import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import { createPuzzle, initialState } from "../lib/game/engine.ts";
import * as engine from "../lib/game/engine.ts";
import * as share from "../lib/game/share.ts";
import { RESULT_COPY } from "../lib/game/copy.ts";
import { generateQuestions } from "../lib/game/questions.ts";
import type { GameState } from "../lib/game/types.ts";

const start = initialState(createPuzzle(DEMO_MOVIES, 19));
const questions = generateQuestions(start.puzzle.movies);
const finished = (status: "won" | "lost" = "won", remaining = [17, 8, 4]): GameState => ({
  ...start,
  status,
  guessId: status === "won" ? start.puzzle.mysteryId : start.puzzle.movies.find(m => m.id !== start.puzzle.mysteryId)!.id,
  activeIds: [start.puzzle.mysteryId, ...start.activeIds.filter(id => id !== start.puzzle.mysteryId)].slice(0, remaining.at(-1) ?? 24),
  history: remaining.map((count, i) => ({ question: questions[i], answer: true, remaining: count, eliminatedIds: [] })),
});

test("result text contains the Practice game link, real path and natural invitation without spoilers", () => {
  const state = finished();
  const text = share.shareText(state);
  assert.equal(text, `LINEUP\nPractice · Found in 3 questions.\n\nFilms remaining:\n24 → 17 → 8 → 4\n\nCan you do better?\n${share.gameUrl(state)}`);
  for (const movie of state.puzzle.movies) assert.ok(!text.includes(movie.title));
  for (const answer of state.history) assert.ok(!text.includes(answer.question.label));
  assert.ok(!text.includes("→ 1\n"));
  const resultCopy = text.slice(0, text.indexOf("https://"));
  assert.ok(!/🎯|today|daily|#\d/i.test(resultCopy));
  assert.equal((text.match(/https:\/\//g) ?? []).length, 1);
});

test("early and failed outcomes keep accurate question grammar and never claim a win", () => {
  assert.match(share.shareText(finished("won", [])), /Found in 0 questions\./);
  assert.match(share.shareText(finished("won", [7])), /Found in 1 question\./);
  const failed = share.shareText(finished("lost", [9]));
  assert.match(failed, /Not this time\.\n1 question used\./);
  assert.ok(!failed.includes("Found in"));
  assert.match(failed, /24 → 9\n/);
  assert.match(failed, /Can you find the film\?/);
});

test("native sharing awaits the platform and shares the complete spoiler-free message", async () => {
  const state = finished();
  let resolve!: () => void;
  let completed = false;
  let clipboardCalls = 0;
  const pending = share.shareResult(state, {
    share: async data => {
      assert.equal(data.text, share.shareText(state));
      assert.equal(data.title, "LINEUP — Find the film.");
      await new Promise<void>(r => { resolve = r; });
    },
    clipboard: { writeText: async () => { clipboardCalls++; } },
  }).then(result => { completed = true; return result; });
  await Promise.resolve();
  assert.equal(completed, false);
  resolve();
  assert.equal(await pending, "shared");
  assert.equal(clipboardCalls, 0);
});

test("native cancellation does not copy or claim sharing succeeded", async () => {
  let copied = false;
  const result = await share.shareResult(finished(), {
    share: async () => { throw { name: "AbortError" }; },
    clipboard: { writeText: async () => { copied = true; } },
  });
  assert.equal(result, "cancelled");
  assert.equal(copied, false);
});

test("a native share failure can fall back to an accurately reported clipboard copy", async () => {
  let copied = "";
  const state = finished("lost");
  const result = await share.shareResult(state, {
    share: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    clipboard: { writeText: async text => { copied = text; } },
  });
  assert.equal(result, "copied");
  assert.equal(copied, share.shareText(state));
});

test("missing native share uses Clipboard API and waits for success", async () => {
  let value = "";
  assert.equal(await share.shareResult(finished(), {
    clipboard: { writeText: async text => { value = text; } },
  }), "copied");
  assert.match(value, /https:\/\/dailylineup\.co\.uk\//);
});

test("missing or rejected clipboard exposes manual fallback instead of false success", async () => {
  assert.equal(await share.copyText(share.GAME_URL, {}), "manual");
  assert.equal(await share.copyText(share.GAME_URL, {
    clipboard: { writeText: async () => { throw new Error("Permission denied"); } },
  }), "manual");
  assert.equal(await share.shareResult(finished(), {}), "manual");
  assert.equal(await share.shareResult(finished(), {
    share: async () => { throw new Error("Unavailable"); },
    clipboard: { writeText: async () => { throw new Error("Permission denied"); } },
  }), "manual");
});

test("copy game link writes only the public URL and explicit copy never invokes native share", async () => {
  let copied = "";
  let nativeCalls = 0;
  assert.equal(await share.copyText(share.GAME_URL, {
    share: async () => { nativeCalls++; },
    clipboard: { writeText: async text => { copied = text; } },
  }), "copied");
  assert.equal(copied, "https://dailylineup.co.uk/");
  assert.equal(nativeCalls, 0);
});

// Render the actual result component. Dialog/Poster are presentation wrappers;
// the result's counts, state-dependent wording and controls remain the real JSX.
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
const render = (state: GameState, fallback: { text: string; label: string } | null = null) => renderToStaticMarkup(React.createElement(exports.ResultDialog, {
  state, error: "", newLoading: false, shareStatus: "", shareBusy: false,
  shareFallback: fallback, onNew: () => {}, onShare: () => {},
  onCopyResult: () => {}, onCopyLink: () => {}, onClose: () => {},
}));

test("result screen states the actual remaining count rather than inventing a final one", () => {
  const won = render(finished());
  assert.match(won, /Found in 3 questions\./);
  assert.match(won, /Films remaining after each question/);
  assert.match(won, /Films remaining: 24, then 17, then 8, then 4/);
  assert.match(won, /Correct[\s\S]*guess with[\s\S]*4[\s\S]*films[\s\S]*remaining\./);
  assert.ok(!won.includes(", then 1\""));
  assert.match(won, />Share your result<\/button>/);
  assert.match(won, />Copy result<\/button>/);
  assert.match(won, />Copy game link<\/button>/);
  const lost = render(finished("lost", [9]));
  assert.match(lost, /Not this time\./);
  assert.match(lost, /The film was/);
  assert.match(lost, /Incorrect[\s\S]*guess with[\s\S]*9[\s\S]*films[\s\S]*remaining\./);
  assert.ok(!lost.includes("Found in"));
});

test("manual copy fallback is a named read-only field with accurate content", () => {
  const html = render(finished(), { text: share.GAME_URL, label: "Game link to copy" });
  assert.match(html, /<textarea[^>]*aria-label="Game link to copy"[^>]*readOnly=""/);
  assert.match(html, /https:\/\/dailylineup\.co\.uk\/<\/textarea>/);
  assert.match(html, /role="status"/);
});
