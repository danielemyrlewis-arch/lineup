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
import type { GameState, Question } from "../lib/game/types.ts";

interface PanelProps {state: GameState; busy: boolean; onAsk: (q: Question, suggested?: true) => void}
type Element = React.ReactElement<Record<string, unknown>>;
const jsx = await import("react/jsx-runtime");
const compiled = ts.transpileModule(readFileSync(new URL("../components/game/question-panel.tsx", import.meta.url), "utf8"), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
}).outputText;
const recommendations = (state: GameState) => questions.recommendedQuestions(engine.activeMovies(state), state.history.map(answer => answer.question.id));
const start = (mode: "daily" | "practice" = "daily", seed = 19) => engine.initialState(engine.createPuzzle(DEMO_MOVIES, seed, "demo", mode));
function nodes(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function") return nodes((node.type as (props: unknown) => React.ReactNode)(node.props));
  return [node, ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(nodes)];
}
function fixture(initial = start(), accept = true) {
  let state = initial, busy = false, cursor = 0;
  let tree: React.ReactNode;
  const hooks: {value: unknown; deps?: readonly unknown[]}[] = [];
  let rankingCalls = 0;
  const asks: {question: Question; suggested?: true}[] = [];
  const events: unknown[] = [];
  const react = {
    useState(value: unknown) { const index = cursor++; hooks[index] ??= {value}; return [hooks[index].value, (next: unknown) => { hooks[index].value = typeof next === "function" ? (next as (value: unknown) => unknown)(hooks[index].value) : next; }]; },
    useRef(value: unknown) { const index = cursor++; hooks[index] ??= {value: {current: value}}; return hooks[index].value; },
    useMemo(run: () => unknown, deps: readonly unknown[]) {
      const index = cursor++, previous = hooks[index];
      if (!previous || !previous.deps || previous.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, previous.deps![i]))) {
        hooks[index] = {value: run(), deps: [...deps]};
      }
      return hooks[index].value;
    },
    useEffect: () => {},
  };
  const exports = {} as {QuestionPanel: (props: PanelProps) => React.ReactNode};
  runInNewContext(compiled, {exports, require: (name: string) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "@/lib/game/engine") return engine;
    if (name === "@/lib/game/questions") return {...questions,
      suggestedQuestions: (...args: Parameters<typeof questions.suggestedQuestions>) => { rankingCalls++; return questions.suggestedQuestions(...args); },
      recommendedQuestions: (...args: Parameters<typeof questions.recommendedQuestions>) => { rankingCalls++; return questions.recommendedQuestions(...args); },
    };
    if (name === "@/lib/analytics") return {trackEvent: (...args: unknown[]) => events.push(args)};
    if (name === "./question-browser") return {QuestionBrowser: ({onAsk}: {onAsk: (q: Question) => void}) => React.createElement("button", {onClick: () => onAsk(recommendations(state)[0])}, "Browse fixture question")};
    assert.equal(name, "lucide-react");
    return {ArrowRight: () => null, ChevronDown: () => null, Search: () => null, X: () => null};
  }, window: {matchMedia: () => ({matches: false})}, requestAnimationFrame: (callback: () => void) => callback()});
  const render = () => { cursor = 0; tree = exports.QuestionPanel({state, busy, onAsk: (question, suggested) => {
    asks.push({question, suggested}); if (accept) state = engine.gameReducer(state, {type: "ask", question, ...(suggested ? {suggested} : {})});
  }}); return tree; };
  const find = (predicate: (node: Element) => boolean) => { const found = nodes(tree).find(predicate); assert.ok(found, "Expected UI control"); return found; };
  const label = (node: Element) => renderToStaticMarkup(node).replace(/<[^>]+>/g, "");
  const button = (text: string) => find(node => node.type === "button" && (label(node) === text || node.props["aria-label"] === text));
  const click = (node: Element) => { (node.props.onClick as () => void)(); render(); };
  render();
  return {asks, events, render, button, click,
    suggestions: () => nodes(find(node => node.props.className === "suggestions")).filter(node => node.type === "button"),
    select(index = 0) { click(this.suggestions()[index]); },
    submit() { click(button("Ask this question")); },
    input: () => find(node => node.type === "input"),
    change(value: string) { (this.input().props.onChange as (event: unknown) => void)({target: {value}}); render(); },
    enter() { (this.input().props.onKeyDown as (event: unknown) => void)({key: "Enter", preventDefault: () => {}}); render(); },
    html: () => renderToStaticMarkup(tree),
    update(next: GameState) { state = next; render(); },
    setBusy(value: boolean) { busy = value; render(); },
    get state() { return state; },
    get rankingCalls() { return rankingCalls; },
  };
}

/** Test-only manual paths retain a usable board through the desired question turn. */
function beforeTurn(turn: number, mode: "daily" | "practice" = "daily") {
  let state = start(mode);
  for (let step = 1; step < turn; step++) {
    const next = [...questions.validQuestions(engine.activeMovies(state), state.history.map(row => row.question.id))].reverse()
      .map(question => () => engine.gameReducer(state, {type: "ask", question}))
      .reduce<GameState | undefined>((chosen, ask) => {
        if (chosen) return chosen;
        const next = ask();
        return next.activeIds.length > 1 && recommendations(next).length > 0 ? next : undefined;
      }, undefined);
    assert.ok(next, `No manual test path for turn ${turn}`);
    state = next;
  }
  return {state, target: recommendations(state)[0]};
}
const suggestionLabels = (f: ReturnType<typeof fixture>) => f.suggestions().map(node => renderToStaticMarkup(node.props.children as React.ReactElement));
const expectedLabels = (state: GameState) => recommendations(state).map(question => renderToStaticMarkup(React.createElement("span", {}, question.shortLabel)));

test("three useful suggestions adapt to accepted manual answers in both Daily and Practice", () => {
  for (const mode of ["daily", "practice"] as const) {
    const f = fixture(start(mode));
    const original = suggestionLabels(f);
    assert.equal(original.length, 3);
    assert.deepEqual(original, expectedLabels(f.state));
    const later = beforeTurn(3, mode).state;
    f.update(later);
    assert.notDeepEqual(suggestionLabels(f), original);
    assert.deepEqual(suggestionLabels(f), expectedLabels(later));
    assert.match(f.html(), /1 suggested question available/);
    assert.equal(f.asks.length, 0);
  }
});

test("selecting and changing a suggestion does not ask, consume budget or send analytics", () => {
  const f = fixture(); const original = suggestionLabels(f), calls = f.rankingCalls; f.select();
  assert.equal(f.state.history.length, 0); assert.equal(f.asks.length, 0); assert.equal(f.events.length, 0);
  assert.match(f.html(), /Ask this question/); assert.match(f.html(), /aria-pressed="true"/);
  assert.ok(!f.html().includes('class="search-popover"'));
  f.select(1); assert.equal(f.asks.length, 0); assert.equal(f.state.history.length, 0);
  f.change("drama"); assert.ok(!f.html().includes("Ask this question")); assert.equal(f.asks.length, 0);
  f.select(); f.click(f.button("Clear search"));
  assert.ok(!f.html().includes("Ask this question")); assert.equal(f.state.history.length, 0);
  f.setBusy(true); f.setBusy(false); f.render();
  assert.deepEqual(suggestionLabels(f), original);
  assert.equal(f.rankingCalls, calls, "Selection, typing, clearing and busy rerenders must not recompute recommendations");
});

test("one suggestion can be submitted on question 1, 3 or 5 and counts towards the normal limit", () => {
  for (const turn of [1, 3, 5]) for (const mode of ["daily", "practice"] as const) {
    const {state, target} = beforeTurn(turn, mode); const f = fixture(state);
    const index = recommendations(state).findIndex(question => question.id === target.id);
    f.select(index); assert.equal(f.state.history.length, turn - 1);
    f.submit();
    assert.equal(f.asks.length, 1); assert.equal(f.asks[0].suggested, true);
    assert.equal(f.state.history.length, turn); assert.equal(engine.hasUsedSuggestion(f.state), true);
    assert.ok(!f.html().includes('class="suggestions"') && !f.html().includes("suggested question available"));
    assert.equal(f.events.length, 0, "question_asked belongs to the parent accepted-action handler only");
  }
});

test("Enter submits the selected question once and stale double-click handlers cannot repeat it", () => {
  const f = fixture(); f.select(); f.enter();
  assert.equal(f.asks.length, 1); assert.equal(f.state.history.length, 1);
  const other = fixture(); other.select();
  const submit = other.button("Ask this question").props.onClick as () => void;
  submit(); submit(); other.render();
  assert.equal(other.asks.length, 1); assert.equal(other.state.history.length, 1);
});

test("busy, stale and already manually asked suggestions cannot submit or consume assistance", () => {
  const f = fixture(); const question = recommendations(f.state)[0];
  f.select(); f.setBusy(true); f.submit();
  assert.equal(f.asks.length, 0); assert.equal(engine.hasUsedSuggestion(f.state), false);
  f.setBusy(false);
  const manual = engine.gameReducer(f.state, {type: "ask", question});
  f.update(manual);
  assert.ok(!f.html().includes("Ask this question"));
  assert.deepEqual(suggestionLabels(f), expectedLabels(manual));
  assert.ok(!f.suggestions().some(node => renderToStaticMarkup(node).includes(question.shortLabel)), "Already asked questions are replaced by current useful questions, never offered again");
  assert.equal(engine.hasUsedSuggestion(f.state), false);
});

test("a pending suggestion outside the updated top three is no longer submit-ready", () => {
  const initial = start(), target = recommendations(initial)[0];
  const later = questions.validQuestions(engine.activeMovies(initial))
    .filter(question => question.id !== target.id)
    .map(question => () => engine.gameReducer(initial, {type: "ask", question}))
    .reduce<GameState | undefined>((chosen, ask) => {
      if (chosen) return chosen;
      const next = ask();
      const stillValid = questions.validQuestions(engine.activeMovies(next), next.history.map(row => row.question.id)).some(question => question.id === target.id);
      return stillValid && !recommendations(next).some(question => question.id === target.id) ? next : undefined;
    }, undefined);
  assert.ok(later, "The fixture must keep the old question valid while making other recommendations stronger");
  const f = fixture(initial); f.select(); f.update(later);
  assert.ok(!f.html().includes("Ask this question"));
  assert.deepEqual(suggestionLabels(f), expectedLabels(later));
  assert.equal(f.asks.length, 0);
  assert.equal(engine.hasUsedSuggestion(f.state), false);
  assert.equal(engine.gameReducer(later, {type: "ask", question: target, suggested: true}), later,
    "A stale old recommendation must also fail the canonical live guard without spending assistance");
});

test("Browse cancels a pending selection and manual submission keeps its source manual", () => {
  const f = fixture(); f.select(); f.click(f.button("Browse questions"));
  assert.ok(!f.html().includes("Ask this question"));
  f.click(f.button("Browse fixture question"));
  assert.equal(f.asks.length, 1); assert.equal(f.asks[0].suggested, undefined);
  assert.equal(engine.hasUsedSuggestion(f.state), false);
  assert.equal(f.events.length, 1);
});

test("a rejected parent submission does not consume the persisted allowance", () => {
  const f = fixture(start(), false); f.select(); f.submit();
  assert.equal(f.state.history.length, 0); assert.equal(engine.hasUsedSuggestion(f.state), false);
  assert.match(f.html(), /1 suggested question available/);
  f.select(1); f.submit(); assert.equal(f.asks.length, 2);
});

test("no useful split or a completed game hides suggestions gracefully", () => {
  const initial = start(), question = questions.validQuestions(initial.puzzle.movies).find(question => question.yesCount === 1 || question.noCount === 1)!;
  assert.ok(question);
  const mystery = initial.puzzle.movies.find(movie => questions.evaluateQuestion(movie, question) === (question.yesCount === 1))!;
  const narrowed = engine.gameReducer(engine.initialState({...initial.puzzle, mysteryId: mystery.id}), {type: "ask", question});
  assert.equal(narrowed.activeIds.length, 1);
  const f = fixture(narrowed);
  assert.ok(!f.html().includes('class="suggestions"'));
  assert.match(f.html(), /One film standing/);
  const completed = fixture(engine.gameReducer(initial, {type: "guess", movieId: initial.puzzle.mysteryId}));
  assert.ok(!completed.html().includes('class="suggestions"'));
});

test("autocomplete explores from one character and narrows to Animation without consuming a hint", () => {
  for (const mode of ["daily", "practice"] as const) {
    const f = fixture(start(mode));
    for (const query of ["Y", "U", "a", "an", "ani", "anim"]) {
      f.change(query);
      assert.equal(f.input().props["aria-expanded"], true);
      assert.ok(f.html().includes('class="search-popover"'), query);
      assert.ok(!f.html().includes("No useful questions match."), query);
      assert.equal(f.asks.length, 0);
      assert.equal(engine.hasUsedSuggestion(f.state), false);
    }
    assert.match(f.html(), /Is it animated\?/);
    f.enter();
    assert.equal(f.state.history.length, 1);
    assert.equal(f.state.history[0].question.id, "genre:Animation");
    assert.equal(f.asks[0].suggested, undefined);
    assert.equal(engine.hasUsedSuggestion(f.state), false);
    assert.match(f.html(), /1 suggested question available/);
  }
});
