import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type Choice = "unknown" | "granted" | "denied";
interface PanelProps {
  consent: Choice;
  onChoice: (choice: "granted" | "denied") => void;
  onClose?: () => void;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}
interface ConsentExports {
  AnalyticsConsent: () => React.ReactNode;
  AnalyticsPreferencesButton: () => React.ReactElement;
  AnalyticsPreferencePanel: (props: PanelProps) => React.ReactElement;
}
const jsx = await import("react/jsx-runtime");
const source = ts.transpileModule(readFileSync(new URL("../components/analytics/analytics-consent.tsx", import.meta.url), "utf8"), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
}).outputText;
function load(react: unknown, analytics: unknown, globals: Record<string, unknown> = {}): ConsentExports {
  const exports = {} as ConsentExports;
  runInNewContext(source, {exports, ...globals, require: (name: string) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return jsx;
    assert.equal(name, "@/lib/analytics"); return analytics;
  }});
  return exports;
}
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function") return elements((node.type as (props: unknown) => React.ReactNode)(node.props));
  return [node, ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(elements)];
}
function click(tree: React.ReactNode, text: string) {
  const button = elements(tree).find(node => node.type === "button" && node.props.children === text);
  assert.ok(button, `Visible button ${text} must exist`);
  (button.props.onClick as () => void)();
}

/** Runs the actual component's hooks/effects and click callbacks without a DOM renderer dependency. */
function fixture(initial: Choice) {
  let consent = initial;
  let cursor = 0;
  let dirty = false;
  let tree: React.ReactNode;
  let starts = 0, stops = 0;
  const choices: string[] = [];
  const subscriptions = new Set<() => void>();
  interface Hook {value?: unknown; dependencies?: unknown[]; cleanup?: () => void}
  const hooks: Hook[] = [];
  const effects: {index: number; dependencies?: unknown[]; run: () => void | (() => void)}[] = [];
  const window = new EventTarget();
  class Element {
    isConnected = true;
    focused = 0;
    focus() { this.focused++; }
  }
  const footer = new Element();
  const document = {activeElement: footer, querySelector: () => footer};
  const react = {
    useState(value: unknown) {
      const index = cursor++;
      hooks[index] ??= {value};
      return [hooks[index].value, (next: unknown) => {
        const value = typeof next === "function" ? (next as (previous: unknown) => unknown)(hooks[index].value) : next;
        if (value !== hooks[index].value) { hooks[index].value = value; dirty = true; }
      }];
    },
    useRef(value: unknown) {
      const index = cursor++;
      hooks[index] ??= {value: {current: value}};
      return hooks[index].value;
    },
    useEffect(run: () => void | (() => void), dependencies?: unknown[]) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || !dependencies || !previous.dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies![i]))) {
        effects.push({index, dependencies, run});
      }
      hooks[index] ??= {};
    },
  };
  const exports = load(react, {
    getAnalyticsConsent: () => consent,
    subscribeAnalyticsConsent: (listener: () => void) => { subscriptions.add(listener); return () => subscriptions.delete(listener); },
    startAnalytics: () => { starts++; return () => { stops++; }; },
    setAnalyticsConsent: (choice: "granted" | "denied") => {
      choices.push(choice); consent = choice;
      for (const listener of subscriptions) listener();
    },
  }, {window, document, HTMLElement: Element, Event});
  const render = () => { cursor = 0; dirty = false; tree = exports.AnalyticsConsent(); return tree; };
  const settle = () => {
    let count = 0;
    do {
      if (++count > 20) throw new Error("Unexpected consent render loop");
      if (dirty || tree === undefined) render();
      const queued = effects.splice(0);
      for (const effect of queued) {
        const hook = hooks[effect.index];
        hook.cleanup?.(); hook.dependencies = effect.dependencies;
        const cleanup = effect.run(); hook.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      }
    } while (dirty || effects.length);
    return tree;
  };
  return {exports, render, settle, choices, footer,
    html: () => renderToStaticMarkup(tree),
    open() { (exports.AnalyticsPreferencesButton().props as {onClick: () => void}).onClick(); return settle(); },
    choose(choice: "Accept analytics" | "Reject analytics") { click(tree, choice); return settle(); },
    close() { click(tree, "Close preferences"); return settle(); },
    update(choice: Choice) { consent = choice; for (const listener of subscriptions) listener(); return settle(); },
    dispose() { for (const hook of hooks) hook.cleanup?.(); },
    get starts() { return starts; }, get stops() { return stops; }, get listeners() { return subscriptions.size; },
  };
}

test("static consent rendering neither reads preferences nor initializes analytics", () => {
  let calls = 0;
  const forbidden = () => { calls++; throw new Error("No browser analytics during static rendering"); };
  const exports = load(React, {getAnalyticsConsent: forbidden, setAnalyticsConsent: forbidden, startAnalytics: forbidden, subscribeAnalyticsConsent: forbidden});
  const html = renderToStaticMarkup(React.createElement(exports.AnalyticsConsent));
  assert.equal(calls, 0);
  assert.ok(!html.includes("Accept analytics") && !html.includes("<script"));
  assert.match(html, /role="status"/);
});

test("an undecided visitor gets equal accept/reject controls in a non-modal region", () => {
  const exports = load(React, {});
  const html = renderToStaticMarkup(React.createElement(exports.AnalyticsPreferencePanel, {consent: "unknown", onChoice: () => {}}));
  const buttons = [...html.matchAll(/<button[^>]*class="([^"]+)"[^>]*>([^<]+)<\/button>/g)];
  assert.deepEqual(buttons.map(match => match[2]), ["Accept analytics", "Reject analytics"]);
  assert.equal(buttons[0][1], buttons[1][1], "Both choices must use the same visual treatment");
  assert.match(html, /<section[^>]*aria-labelledby="analytics-preferences-heading"/);
  assert.ok(!html.includes("role=\"dialog\"") && !html.includes("aria-modal"));
  assert.match(html, /Daily, Practice and Google sign-in work whichever you choose/);
  assert.match(html, /href="\/privacy\/"/);
});

test("accept and reject submit their exact explicit choices without automatic acceptance", () => {
  for (const [label, expected] of [["Accept analytics", "granted"], ["Reject analytics", "denied"]] as const) {
    const f = fixture("unknown"); f.render(); f.settle();
    assert.match(f.html(), /Accept analytics/); assert.deepEqual(f.choices, []);
    f.choose(label);
    assert.deepEqual(f.choices, [expected]);
    assert.ok(!f.html().includes("Accept analytics"));
    assert.match(f.html(), new RegExp(`Analytics preference saved: ${expected === "granted" ? "on" : "off"}`));
    assert.equal(f.footer.focused, 1);
    f.dispose();
  }
});

test("remembered choices do not re-prompt and the footer reopens one panel without changing consent", () => {
  for (const choice of ["granted", "denied"] as const) {
    const f = fixture(choice); f.render(); f.settle();
    assert.ok(!f.html().includes("Accept analytics"));
    f.open();
    assert.equal((f.html().match(/id="analytics-preferences-heading"/g) ?? []).length, 1);
    assert.match(f.html(), new RegExp(`Analytics is ${choice === "granted" ? "on" : "off"}`));
    assert.deepEqual(f.choices, []);
    f.close(); assert.ok(!f.html().includes("Accept analytics"));
    assert.deepEqual(f.choices, []); assert.equal(f.footer.focused, 1);
    f.dispose();
  }
});

test("withdrawal calls reject immediately and hides the saved preferences panel", () => {
  const f = fixture("granted"); f.render(); f.settle(); f.open();
  assert.match(f.html(), /withdraw consent and remove analytics cookies/);
  f.choose("Reject analytics");
  assert.deepEqual(f.choices, ["denied"]);
  assert.ok(!f.html().includes("Accept analytics"));
  f.open(); assert.match(f.html(), /Analytics is off/);
  f.dispose();
});

test("preference changes from another tab update an open panel and clear subscriptions on unmount", () => {
  const f = fixture("granted"); f.render(); f.settle(); f.open();
  f.update("denied"); assert.match(f.html(), /Analytics is off/);
  assert.equal(f.starts, 1); assert.equal(f.listeners, 1);
  f.dispose(); assert.equal(f.listeners, 0); assert.equal(f.stops, 1);
});

test("the public privacy page identifies the real operator and explains consent, storage and remaining data requests", () => {
  const exports = {} as {default: React.ComponentType; metadata: {alternates: {canonical: string}}};
  const page = ts.transpileModule(readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"), {
    compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
  }).outputText;
  const consent = load(React, {});
  runInNewContext(page, {exports, URL, require: (name: string) => {
    if (name === "react/jsx-runtime") return jsx;
    if (name === "@/components/analytics/analytics-consent") return consent;
    assert.equal(name, "@/lib/site");
    return {SITE_URL: "https://dailylineup.co.uk/", SOCIAL_IMAGE: {url: "https://dailylineup.co.uk/social/lineup-og.png"}};
  }});
  const html = renderToStaticMarkup(React.createElement(exports.default));
  assert.equal(exports.metadata.alternates.canonical, "https://dailylineup.co.uk/privacy/");
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
  for (const content of ["Daniel Lewis", "privacy@dailylineup.co.uk", "lineup:auth:v1", "lineup:analytics:consent:v1", "180 days", "does not load the Analytics tag", "cannot automatically erase information already received by Google", "Analytics preferences", "Supabase", "localStorage"]) assert.ok(html.includes(content), content);
  assert.ok(!html.includes("<script") && !html.includes("service_role"));
});
