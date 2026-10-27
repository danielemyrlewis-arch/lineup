import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import ts from "typescript";

let clientId: string | null = null;
let externalCalls = 0;
const jsxRuntime = await import("react/jsx-runtime");
const exports = {} as {GoogleSignInButton: React.ComponentType<{client: SupabaseClient | null}>};
const source = ts.transpileModule(readFileSync(new URL("../components/account/google-sign-in-button.tsx", import.meta.url), "utf8"), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
}).outputText;
runInNewContext(source, {exports, require: (name: string) => {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return jsxRuntime;
  if (name === "@/lib/account/google-script") return {getGoogleClientId: () => clientId};
  assert.equal(name, "@/lib/account/google-sign-in");
  return {mountGoogleSignIn: () => { externalCalls++; throw new Error("Static rendering cannot authenticate"); }};
}});
const client = {} as SupabaseClient;
const render = (value: SupabaseClient | null = client) => renderToStaticMarkup(React.createElement(exports.GoogleSignInButton, {client: value}));

test("missing Google or Supabase public configuration explains that guest play remains available", () => {
  clientId = null;
  assert.match(render(), /role="alert"/);
  assert.match(render(), /keep playing as a guest/);
  assert.ok(!render().includes("<button"));
  clientId = "123-example.apps.googleusercontent.com";
  assert.match(render(null), /isn’t configured/);
  assert.equal(externalCalls, 0);
});

test("the static sign-in shell waits for the browser's official Google control without a fake button", () => {
  clientId = "123-example.apps.googleusercontent.com";
  const html = render();
  assert.match(html, /class="google-sign-in-host" aria-label="Google sign-in"/);
  assert.match(html, /role="status">Loading Google sign-in/);
  assert.ok(!html.includes("<button") && !html.includes("<script") && !html.includes("<iframe"));
  assert.equal(externalCalls, 0);
});
