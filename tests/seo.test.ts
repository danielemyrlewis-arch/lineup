import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { GAME_STRUCTURED_DATA, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "../lib/site.ts";

const jsxRuntime = await import("react/jsx-runtime");
const exports = {} as {SupportingContent: React.ComponentType};
const source = ts.transpileModule(readFileSync(new URL("../components/game/supporting-content.tsx", import.meta.url), "utf8"), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
}).outputText;
runInNewContext(source, {exports, require: (name: string) => {
  assert.equal(name, "react/jsx-runtime"); return jsxRuntime;
}});
const html = renderToStaticMarkup(React.createElement(exports.SupportingContent));

test("homepage title and description explain the actual Daily game without overstating elimination", () => {
  assert.equal(SITE_TITLE, "LINEUP — Daily Movie Guessing Game | Find the Film");
  assert.match(SITE_DESCRIPTION, /free daily movie guessing game/);
  assert.match(SITE_DESCRIPTION, /up to five yes-or-no questions/);
  assert.match(SITE_DESCRIPTION, /lineup of 24 films/);
  assert.match(SITE_DESCRIPTION, /New each day/);
  assert.ok(!/eliminate 24|premium|subscription/i.test(SITE_DESCRIPTION));
});

test("supporting copy is static HTML with useful rules, mode differences and accessible native FAQs", () => {
  for (const phrase of ["How LINEUP works", "24 films", "up to five yes-or-no questions", "one mystery film", "Daily LINEUP or Practice?", "midnight UK time", "GMT and BST", "Why question choice matters", "Browse questions", "Optional Google sign-in", "Europe/London"])
    assert.ok(html.includes(phrase), phrase);
  assert.equal((html.match(/<h2 /g) ?? []).length, 1);
  assert.equal((html.match(/<details>/g) ?? []).length, 5);
  assert.equal((html.match(/<summary>/g) ?? []).length, 5);
  assert.match(html, /href="\/\?mode=practice#lineup"/);
  assert.match(html, /href="#lineup"/);
  assert.ok(!html.includes("<h1") && !html.includes("<script"));
  assert.ok(!/mysteryId|tmdbId|Inception|today.s answer/.test(html));
});

test("game structured data matches visible browser-game features and invents no social proof", () => {
  assert.deepEqual(GAME_STRUCTURED_DATA["@type"], ["VideoGame", "WebApplication"]);
  assert.equal(GAME_STRUCTURED_DATA.url, SITE_URL);
  assert.equal(GAME_STRUCTURED_DATA.name, "LINEUP");
  assert.equal(GAME_STRUCTURED_DATA.isAccessibleForFree, true);
  assert.equal(GAME_STRUCTURED_DATA.gamePlatform, "Web browser");
  assert.equal(GAME_STRUCTURED_DATA.browserRequirements, "JavaScript required to play.");
  for (const key of ["aggregateRating", "ratingValue", "review", "award", "offers", "price", "userInteractionCount", "mysteryId", "actors"])
    assert.ok(!(key in GAME_STRUCTURED_DATA), key);
});
