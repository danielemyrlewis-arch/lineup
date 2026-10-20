import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { activeMovies, initialState, gameReducer } from "../lib/game/engine.ts";
import { evaluateQuestion, validQuestions } from "../lib/game/questions.ts";
import { groupQuestions, QUESTION_PAGE_SIZE } from "../lib/game/question-groups.ts";
import type { QuestionKind, RankedQuestion } from "../lib/game/types.ts";

const start = (seed = 42) => initialState(createPracticePuzzle(PRACTICE_CATALOGUE, seed, "demo"));

test("category browsing preserves all canonical question objects and ranked order without a second evaluator", () => {
  const state = start();
  const questions = validQuestions(activeMovies(state));
  const groups = groupQuestions(questions);
  const grouped = groups.flatMap((group) => group.questions);
  assert.equal(grouped.length, questions.length);
  assert.equal(new Set(grouped.map((question) => question.id)).size, questions.length);
  assert.deepEqual(new Set(grouped), new Set(questions));
  assert.ok(groups.every((group) => group.questions.every((question, index, list) =>
    questions.includes(question) && (index === 0 || questions.indexOf(list[index - 1]) < questions.indexOf(question)))));
  assert.ok(groups.every((group) => group.questions.length));
  assert.deepEqual(groupQuestions([]), []);
});

test("every current question kind has exactly one human-readable discovery category", () => {
  const kinds: QuestionKind[] = ["before", "after", "decade", "genre", "under", "over", "collection", "director", "cast", "language", "languageNot", "country", "coProduction", "studio", "leadGender", "oscar", "curated"];
  const questions = kinds.map((kind): RankedQuestion => ({
    id: `${kind}:test`, kind, value: "test", label: "A question?", shortLabel: "Question?",
    category: "Source category", aliases: [], yesCount: 1, noCount: 1, balance: 1, partitionKey: kind,
  }));
  const groups = groupQuestions(questions);
  assert.equal(groups.length, 6);
  for (const question of questions)
    assert.equal(groups.filter((group) => group.questions.includes(question)).length, 1, question.kind);
});

test("Awards is only discoverable when the existing engine offers usable awards questions", () => {
  const verified = [15, 19].map((id) => PRACTICE_CATALOGUE.find((movie) => movie.tmdbId === id)!);
  assert.ok(groupQuestions(validQuestions(verified)).some((group) => group.id === "awards"));
  const unknown = verified.map((movie) => ({ ...movie, oscars: null }));
  assert.ok(!groupQuestions(validQuestions(unknown)).some((group) => group.id === "awards"));
  assert.ok(!groupQuestions(validQuestions([...verified, { ...verified[0], id: "unknown", oscars: null }])).some((group) => group.id === "awards"));
});

test("a browsed question uses the same reducer, suppresses asked questions and retains the mystery", () => {
  const state = start();
  const browsed = groupQuestions(validQuestions(activeMovies(state)))[0].questions[0];
  const next = gameReducer(state, { type: "ask", question: browsed });
  const mystery = state.puzzle.movies.find((movie) => movie.id === state.puzzle.mysteryId)!;
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].question.id, browsed.id);
  assert.equal(next.history[0].answer, evaluateQuestion(mystery, browsed));
  assert.ok(next.activeIds.includes(mystery.id));
  const remaining = groupQuestions(validQuestions(activeMovies(next), next.history.map((answer) => answer.question.id))).flatMap((group) => group.questions);
  assert.ok(!remaining.some((question) => question.id === browsed.id));
  for (const question of remaining) {
    const values = activeMovies(next).map((movie) => evaluateQuestion(movie, question));
    assert.ok(values.includes(true) && values.includes(false));
    assert.ok(values.every((value) => typeof value === "boolean"));
  }
});

test("Browse opens a short category menu rather than rendering hundreds of question buttons", () => {
  const exports = {} as { QuestionBrowser: React.ComponentType<{ questions: RankedQuestion[]; onAsk: () => void; onClose: () => void }> };
  const compiled = ts.transpileModule(readFileSync(new URL("../components/game/question-browser.tsx", import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
  });
  const Dialog = ({ title, children }: { title: string; children: React.ReactNode }) => React.createElement("dialog", { "aria-label": title }, children);
  runInNewContext(compiled.outputText, {
    React, exports,
    require: (name: string) => name === "react" ? React : name === "./dialog" ? { Dialog } :
      name.includes("question-groups") ? { groupQuestions, QUESTION_PAGE_SIZE } : { ArrowLeft: () => null, ArrowRight: () => null },
  });
  const questions = validQuestions(PRACTICE_CATALOGUE);
  const html = renderToStaticMarkup(React.createElement(exports.QuestionBrowser, { questions, onAsk: () => {}, onClose: () => {} }));
  assert.match(html, /aria-label="Browse questions"/);
  assert.match(html, /Explore questions that can narrow your current lineup/);
  assert.equal((html.match(/<button /g) ?? []).length, groupQuestions(questions).length);
  assert.ok((html.match(/<button /g) ?? []).length <= 6);
});
