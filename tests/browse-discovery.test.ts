import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import * as engine from "../lib/game/engine.ts";
import * as questions from "../lib/game/questions.ts";
import type { GameState } from "../lib/game/types.ts";

const exports = {} as { QuestionPanel: React.ComponentType<Record<string, unknown>> };
const compiled = ts.transpileModule(readFileSync(new URL("../components/game/question-panel.tsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
});
runInNewContext(compiled.outputText, { React, exports, require: (name: string) => {
  if (name === "react") return React;
  if (name === "@/lib/game/engine") return engine;
  if (name === "@/lib/game/questions") return questions;
  if (name === "./question-browser") return { QuestionBrowser: () => null };
  assert.equal(name, "lucide-react");
  return { ArrowRight: () => React.createElement("svg", { "aria-hidden": "true" }), ChevronDown: () => null, Search: () => null, X: () => null };
} });
function start(mode: "practice" | "daily"): GameState {
  return engine.initialState(engine.createPuzzle(DEMO_MOVIES, 19, "demo", mode));
}
function render(state: GameState, hint = false, busy = false) {
  return renderToStaticMarkup(React.createElement(exports.QuestionPanel, { state, busy, onAsk: () => {}, showStrategyHint: hint }));
}

test("both modes show Browse directly after search, followed by three opening examples", () => {
  for (const mode of ["daily", "practice"] as const) {
    const html = render(start(mode));
    assert.match(html, /<button[^>]*class="browse-questions"[^>]*aria-haspopup="dialog"/);
    assert.match(html, /<span>Browse questions<\/span><svg aria-hidden="true"><\/svg>/);
    assert.ok(html.indexOf('class="search-root"') < html.indexOf('class="question-discovery"'));
    assert.ok(html.indexOf('class="question-discovery"') < html.indexOf('class="suggestion-label"'));
    assert.ok(html.indexOf('class="suggestion-label"') < html.indexOf('class="suggestions"'));
    assert.ok(!html.includes('class="browse-questions" disabled'));
    assert.match(html, />Example questions<\/p>/);
    const examples = html.match(/class="suggestions">(.*?)<\/div>/)?.[1] ?? "";
    assert.equal((examples.match(/<button /g) ?? []).length, 3);
  }
});

test("Daily and Practice remove examples after the first answer while keeping search and Browse", () => {
  for (const mode of ["daily", "practice"] as const) {
    let state = start(mode);
    const first = questions.openingQuestionExamples(state.puzzle.movies)[0];
    state = engine.gameReducer(state, {type: "ask", question: first});
    assert.equal(state.history.length, 1);
    const html = render(state);
    assert.ok(!html.includes('class="suggestions"') && !html.includes("Example questions"));
    assert.match(html, /role="combobox"/);
    assert.match(html, /class="browse-questions"/);
    assert.ok(!html.includes('class="browse-questions" disabled'));
    assert.match(html, /Asked/);
    assert.ok(!html.includes('class="search-popover"'));
  }
});

test("no opening examples reappear on an early completed game", () => {
  for (const mode of ["daily", "practice"] as const) {
    const state = start(mode);
    const html = render(engine.gameReducer(state, {type: "guess", movieId: state.puzzle.mysteryId}));
    assert.ok(!html.includes('class="suggestions"') && !html.includes("Example questions"));
  }
});

test("empty or filler-only searches never offer a fresh ranked recommendation list", () => {
  const valid = questions.validQuestions(start("daily").puzzle.movies);
  for (const query of ["", "   ", "is it a", "the film?", "movie"]) assert.deepEqual(questions.searchQuestions(valid, query), []);
  assert.ok(questions.searchQuestions(valid, "genre").length > 0);
});

test("the existing single first-use hint explains browsing without repeatedly prompting returning players", () => {
  const state = start("daily");
  const fresh = render(state, true);
  assert.match(fresh, /Not sure what to ask\? Browse questions below\./);
  assert.equal((fresh.match(/class="strategy-hint"/g) ?? []).length, 1);
  const returning = render(state);
  assert.ok(!returning.includes("Not sure what to ask?"));
  assert.match(returning, /Try a genre, year, actor or studio\./);
});

test("Browse cannot bypass busy, completion or the five-question final-pick state", () => {
  const state = start("daily");
  assert.match(render(state, false, true), /class="browse-questions" disabled=""/);
  assert.match(render({ ...state, status: "lost" }), /class="browse-questions" disabled=""/);
  let played = state;
  for (let turn = 0; turn < 5; turn++) {
    const active = engine.activeMovies(played);
    const valid = questions.validQuestions(active, played.history.map(answer => answer.question.id));
    const mystery = played.puzzle.movies.find(movie => movie.id === played.puzzle.mysteryId)!;
    const question = valid.sort((a, b) => {
      const kept = (q: typeof a) => questions.evaluateQuestion(mystery, q) ? q.yesCount : q.noCount;
      return kept(b) - kept(a);
    })[0];
    assert.ok(question);
    played = engine.gameReducer(played, { type: "ask", question });
  }
  const final = render(played);
  assert.equal(played.history.length, 5);
  assert.ok(!final.includes('class="browse-questions"'));
  assert.match(final, /Final pick\./);
});
