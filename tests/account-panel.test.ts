import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { calculateDailyStatistics } from "../lib/account/statistics.ts";
import type { CompletedDailyResult, DailyResult } from "../lib/account/results.ts";
import type { AccountPanelProps } from "../components/account/account-panel.tsx";
import { getDailyEntry } from "../lib/game/daily-schedule.ts";
import { addCalendarDays } from "../lib/game/daily-date.ts";
import * as dailyDate from "../lib/game/daily-date.ts";

const jsxRuntime = await import("react/jsx-runtime");
const exports = {} as { AccountPanel: React.ComponentType<AccountPanelProps> };
const source = ts.transpileModule(readFileSync(new URL("../components/account/account-panel.tsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
runInNewContext(source, { exports, require: (name: string) => {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return jsxRuntime;
  if (name === "@/lib/game/daily-date") return dailyDate;
  if (name === "../game/dialog") return { Dialog: ({children, title, className}: {children: React.ReactNode; title: string; className: string}) => React.createElement("div", {role: "dialog", "aria-label": title, className}, children) };
  assert.equal(name, "@/lib/account/statistics");
  return { calculateDailyStatistics: (rows: DailyResult[]) => calculateDailyStatistics(rows, "2026-12-01") };
} });

function result(date: string, questions = 2, outcome: "won" | "lost" = "won"): DailyResult {
  const entry = getDailyEntry(date)!;
  const path = [24, ...Array.from({length: questions}, (_, i) => 20 - i * 3)];
  return {
    user_id: "bd0edbfe-b30d-4333-80ec-594e265e039b", puzzle_id: entry.id,
    puzzle_date: entry.date, puzzle_number: entry.number, questions_used: questions,
    outcome, deduction_path: path, films_remaining: path.at(-1)!, completed_at: `${entry.date}T12:00:00.000Z`,
  };
}
const noop = () => {};
const base: AccountPanelProps = {
  status: "signed-out", user: null, error: null, authBusy: false, resultsLoading: false,
  resultsError: null, results: [], pending: null, saveStatus: "idle", saveError: null,
  googleSignIn: React.createElement("div", {"data-google-sign-in-slot": true}, "Official Google sign-in slot"),
  onSignOut: noop, onRetry: noop, onSaveGuest: noop, onClose: noop,
};
const render = (props: Partial<AccountPanelProps> = {}) => renderToStaticMarkup(React.createElement(exports.AccountPanel, {...base, ...props}));
const signedIn: Partial<AccountPanelProps> = {status: "signed-in", user: {name: "Alex", email: "alex@example.test"}};
const pending: CompletedDailyResult = result("2026-10-20");

test("signed-out account panel keeps Google sign-in optional and does not expose player metrics", () => {
  const html = render();
  assert.match(html, /data-google-sign-in-slot="true"/);
  assert.match(html, /Daily and Practice without an account/);
  assert.ok(!html.includes("Daily games played") && !html.includes("Sign out"));
  assert.ok(!html.includes("Continue with Google"), "AccountPanel must not produce an imitation Google button");
  const staleIdentity = render({user: {name: "Old account", email: "old@example.test"}});
  assert.ok(!staleIdentity.includes("old@example.test") && !staleIdentity.includes("Old account"));
});

test("auth loading and unavailable states preserve a clear guest path without false zero statistics", () => {
  const loading = render({status: "loading"});
  assert.match(loading, /role="status"/);
  assert.match(loading, /Checking your session/);
  assert.ok(!loading.includes("data-google-sign-in-slot") && !loading.includes("Daily games played"));
  const unavailable = render({status: "unavailable", error: "Accounts are unavailable."});
  assert.match(unavailable, /Daily and Practice are still free to play/);
  assert.match(unavailable, /role="alert"/);
  assert.match(unavailable, /Try again/);
  assert.ok(!unavailable.includes("data-google-sign-in-slot"));
});

test("the official Google slot is rendered only for signed-out players", () => {
  const loading = React.createElement("p", {role: "status"}, "Loading Google sign-in…");
  const html = render({googleSignIn: loading});
  assert.match(html, /role="status">Loading Google sign-in…/);
  assert.ok(!render(signedIn).includes("data-google-sign-in-slot"));
});

test("private account identity is safely escaped and every requested statistic is shown", () => {
  const html = render({...signedIn, user: {name: '<img src=x onerror="bad">', email: "private@example.test"}, results: [result("2026-10-20", 0), result("2026-10-21", 3, "lost")]});
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img/);
  assert.match(html, /private@example.test/);
  for (const label of ["Daily games played", "Games won", "Win percentage", "Current winning streak", "Longest winning streak", "Average questions in wins", "Best successful result", "Daily history"]) assert.ok(html.includes(label), label);
  assert.match(html, /50%/);
  assert.match(html, /0 questions · LINEUP #001/);
  assert.match(html, /Your account results are private/);
});

test("loading or failed result fetches never masquerade as an empty statistics account", () => {
  const loading = render({...signedIn, resultsLoading: true});
  assert.match(loading, /Loading your results/);
  assert.match(loading, /aria-busy="true"/);
  assert.ok(!loading.includes("Daily games played") && !loading.includes("No Daily results saved yet"));
  const error = render({...signedIn, resultsError: "Your results could not load. Please retry."});
  assert.match(error, /Retry results/);
  assert.match(error, /role="alert"/);
  assert.ok(!error.includes("Daily games played") && !error.includes("No Daily results saved yet"));
});

test("an empty loaded account shows an honest empty history and no invented best win", () => {
  const html = render(signedIn);
  assert.match(html, /No Daily results saved yet/);
  assert.match(html, /No winning result yet/);
  assert.match(html, /Practice games do not affect these statistics/);
  assert.match(html, /unplayed today does not end yesterday/);
});

test("guest result import is an explicit action, with duplicate and failure feedback", () => {
  assert.match(render({pending}), /After signing in, you can choose/);
  const offered = render({...signedIn, pending});
  assert.match(offered, /Save your completed LINEUP #001/);
  assert.match(offered, /Save to account/);
  const saving = render({...signedIn, pending, saveStatus: "saving"});
  assert.match(saving, /disabled="">Saving…/);
  const duplicate = render({...signedIn, pending, saveStatus: "duplicate"});
  assert.match(duplicate, /Your account result has been kept/);
  assert.match(duplicate, /Save to account/);
  const failed = render({...signedIn, pending, saveStatus: "error", saveError: "Saving failed. Your game is safe."});
  assert.match(failed, /Try saving again/);
  assert.match(failed, /Saving failed/);
  const saved = render({...signedIn, saveStatus: "saved"});
  assert.match(saved, /Your Daily result is saved to your account/);
});

test("history renders twelve newest entries with a continuation action and accurate results", () => {
  const results = Array.from({length: 15}, (_, i) => result(addCalendarDays("2026-10-20", i), 2, i % 2 ? "lost" : "won"));
  const html = render({...signedIn, results});
  const history = html.slice(html.indexOf('aria-label="Daily game history"'));
  assert.equal((history.match(/<li>/g) ?? []).length, 12);
  assert.match(history, /LINEUP #015/);
  assert.ok(!history.includes("LINEUP #001"));
  assert.match(history, /Not this time/);
  assert.match(history, /24 → 20 → 17/);
  assert.match(history, /Show more results/);
});


test("success feedback does not hide the next queued guest result or imply consent", () => {
  const nextPending = result("2026-10-21");
  for (const saveStatus of ["saved", "duplicate"] as const) {
    const html = render({...signedIn, pending: nextPending, saveStatus});
    assert.match(html, /role="status"/);
    assert.match(html, /Save your completed LINEUP #002/);
    assert.match(html, /Save to account<\/button>/);
    assert.ok(!html.includes('disabled="">Save to account'));
  }
});
