import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { getBrowserClient, getPublicSupabaseConfig, createSafeAuthStorage } from "../lib/account/client.ts";
import { watchAuth, signOut, oauthErrorFromUrl, type AuthSnapshot } from "../lib/account/auth.ts";

type SessionResult = { data: { session: Session | null }; error: unknown };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const session = (id = "player-a") => ({ user: { id, email: "player@example.test" } }) as Session;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fakeClient(read: Promise<SessionResult> = Promise.resolve({ data: { session: null }, error: null })) {
  let listener: (event: string, value: Session | null) => void = () => {};
  let unsubscribed = 0;
  const calls: unknown[] = [];
  let signOutResponse: { error: unknown } | Promise<{ error: unknown }> = { error: null };
  const client = { auth: {
    getSession: () => read,
    onAuthStateChange: (callback: typeof listener) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: () => { unsubscribed++; } } } };
    },
    signOut: (options: unknown) => { calls.push(options); return Promise.resolve(signOutResponse); },
  } } as unknown as SupabaseClient;
  return {
    client, calls,
    emit: (event: string, value: Session | null) => listener(event, value),
    get unsubscribed() { return unsubscribed; },
    set signOutResponse(value: typeof signOutResponse) { signOutResponse = value; },
  };
}

test("missing public configuration leaves browser accounts optional and never initializes on the server", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(getPublicSupabaseConfig(), null);
    assert.equal(getBrowserClient(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
    assert.deepEqual(getPublicSupabaseConfig(), { url: "https://project.supabase.co", key: "sb_publishable_fixture" });
    assert.equal(getBrowserClient(), null, "A configured static build must still not initialize browser auth during SSR");
    for (const badKey of ["sb_secret_fixture", "service_role", "eyJ.fixture.token", ""]) {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = badKey;
      assert.equal(getPublicSupabaseConfig(), null);
    }
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
    const credentialUrl = new URL("https://project.supabase.co");
    credentialUrl.username = "fixture-user";
    credentialUrl.password = "fixture-password";
    for (const badUrl of ["http://project.supabase.co", "https://attacker.test", credentialUrl.href, "https://project.supabase.co/path", "https://project.supabase.co?secret=value", "not a URL"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = badUrl;
      assert.equal(getPublicSupabaseConfig(), null);
    }
  } finally {
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  }
});

test("auth starts pending, restores a signed-in session and follows sign-out and account changes", async () => {
  const initial = deferred<SessionResult>();
  const fake = fakeClient(initial.promise);
  const states: AuthSnapshot[] = [];
  const stop = watchAuth(fake.client, value => states.push(value));
  assert.equal(states.at(-1)?.status, "loading");
  initial.resolve({ data: { session: session() }, error: null });
  await tick();
  assert.equal(states.at(-1)?.status, "signed-in");
  assert.equal(states.at(-1)?.user?.id, "player-a");
  fake.emit("SIGNED_OUT", null);
  assert.equal(states.at(-1)?.status, "signed-out");
  assert.equal(states.at(-1)?.user, null);
  fake.emit("SIGNED_IN", session("player-b"));
  assert.equal(states.at(-1)?.user?.id, "player-b");
  fake.emit("TOKEN_REFRESHED", session("player-b"));
  assert.equal(states.at(-1)?.status, "signed-in");
  stop();
  assert.equal(fake.unsubscribed, 1);
  const count = states.length;
  fake.emit("SIGNED_IN", session());
  assert.equal(states.length, count, "Unmounted providers must not receive session changes");
});

test("a late initial session cannot restore an account after a newer sign-out event", async () => {
  const initial = deferred<SessionResult>();
  const fake = fakeClient(initial.promise);
  const states: AuthSnapshot[] = [];
  const stop = watchAuth(fake.client, value => states.push(value));
  fake.emit("SIGNED_OUT", null);
  initial.resolve({ data: { session: session() }, error: null });
  await tick();
  assert.equal(states.at(-1)?.status, "signed-out");
  assert.equal(states.at(-1)?.user, null);
  stop();
});

test("signed-out sessions and missing/unavailable Supabase leave guest play available", async () => {
  const states: AuthSnapshot[] = [];
  const fake = fakeClient();
  const stop = watchAuth(fake.client, value => states.push(value));
  await tick();
  assert.deepEqual(states.at(-1), { status: "signed-out", user: null, error: null });
  stop();
  watchAuth(null, value => states.push(value));
  assert.equal(states.at(-1)?.status, "unavailable");
  assert.match(states.at(-1)?.error ?? "", /guest/);
  for (const failing of [
    () => Promise.resolve({ data: { session: null }, error: { message: "private provider detail" } }),
    () => Promise.reject(new Error("private provider detail")),
  ]) {
    const broken = fakeClient(failing());
    const cancel = watchAuth(broken.client, value => states.push(value));
    await tick();
    assert.equal(states.at(-1)?.status, "unavailable");
    assert.ok(!states.at(-1)?.error?.includes("private provider detail"));
    cancel();
  }
});

test("a hung session check is bounded and a later valid session event can recover", async () => {
  const fake = fakeClient(new Promise(() => {}));
  const states: AuthSnapshot[] = [];
  const stop = watchAuth(fake.client, value => states.push(value), { timeoutMs: 5 });
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(states.at(-1)?.status, "unavailable");
  fake.emit("SIGNED_IN", session());
  assert.equal(states.at(-1)?.status, "signed-in");
  stop();
});

test("OAuth errors are generic and normal game anchors are not mistaken for a callback", async () => {
  assert.equal(oauthErrorFromUrl("https://dailylineup.co.uk/#lineup"), false);
  assert.equal(oauthErrorFromUrl("https://dailylineup.co.uk/?mode=practice"), false);
  for (const value of ["https://dailylineup.co.uk/#error=access_denied&error_description=private", "https://dailylineup.co.uk/?error_code=provider_denied"]) assert.equal(oauthErrorFromUrl(value), true);
  const states: AuthSnapshot[] = [];
  const stop = watchAuth(fakeClient().client, state => states.push(state), { oauthError: true });
  await tick();
  assert.equal(states.at(-1)?.status, "signed-out");
  assert.match(states.at(-1)?.error ?? "", /wasn’t completed/);
  assert.ok(!states.at(-1)?.error?.includes("private"));
  stop();
});

test("sign-out affects only this browser and provider failures remain private", async () => {
  const fake = fakeClient();
  assert.equal(await signOut(fake.client), null);
  assert.deepEqual(fake.calls[0], { scope: "local" });
  fake.signOutResponse = { error: { message: "private provider response" } };
  const error = await signOut(fake.client);
  assert.match(error ?? "", /couldn’t finish/);
  assert.ok(!error?.includes("private provider response"));
  assert.match(await signOut(null) ?? "", /guest/);
});

test("a pending sign-out does not leave controls loading indefinitely", async () => {
  const fake = fakeClient();
  fake.signOutResponse = new Promise(() => {});
  assert.match(await signOut(fake.client, 5) ?? "", /couldn’t finish/);
});

test("auth storage persists normal sessions and restricts itself to supplied storage keys", () => {
  const values = new Map<string, string>();
  values.set("lineup:daily:progress:v1:2026-10-26", "untouched");
  const storage = createSafeAuthStorage(() => ({ getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } }));
  storage.setItem("lineup:auth:v1", "session");
  assert.equal(storage.getItem("lineup:auth:v1"), "session");
  storage.removeItem("lineup:auth:v1");
  assert.equal(storage.getItem("lineup:auth:v1"), null);
  assert.equal(values.get("lineup:daily:progress:v1:2026-10-26"), "untouched");
});

test("denied/full auth storage falls back in memory without preventing sign-out removal", () => {
  let restricted = 0;
  let removed = false;
  const storage = createSafeAuthStorage(() => ({ getItem: () => "old-session",
    setItem: () => { throw new Error("quota"); }, removeItem: () => { removed = true; } }), () => { restricted++; });
  assert.equal(storage.getItem("lineup:auth:v1"), "old-session");
  storage.setItem("lineup:auth:v1", "fresh-session");
  assert.equal(storage.getItem("lineup:auth:v1"), "fresh-session");
  storage.removeItem("lineup:auth:v1");
  assert.equal(removed, true);
  assert.equal(storage.getItem("lineup:auth:v1"), null);
  assert.equal(restricted, 1);
  const denied = createSafeAuthStorage(() => { throw new Error("private browsing"); });
  assert.equal(denied.getItem("lineup:auth:v1"), null);
  denied.setItem("lineup:auth:v1", "ephemeral");
  assert.equal(denied.getItem("lineup:auth:v1"), "ephemeral");
  denied.removeItem("lineup:auth:v1");
  assert.equal(denied.getItem("lineup:auth:v1"), null);
});

test("a late session from an old user or a late failure cannot replace a newer signed-in identity", async () => {
  for (const fails of [false, true]) {
    const initial = deferred<SessionResult>();
    const fake = fakeClient(initial.promise);
    const states: AuthSnapshot[] = [];
    const stop = watchAuth(fake.client, value => states.push(value));
    fake.emit("SIGNED_IN", session("new-player"));
    if (fails) initial.reject(new Error("old request failed"));
    else initial.resolve({ data: { session: session("old-player") }, error: null });
    await tick();
    assert.equal(states.at(-1)?.status, "signed-in");
    assert.equal(states.at(-1)?.user?.id, "new-player");
    assert.equal(states.at(-1)?.error, null);
    stop();
  }
});

test("a successful login clears an earlier callback error before a later deliberate sign-out", async () => {
  const fake = fakeClient();
  const states: AuthSnapshot[] = [];
  const stop = watchAuth(fake.client, value => states.push(value), { oauthError: true });
  await tick();
  assert.ok(states.at(-1)?.error);
  fake.emit("SIGNED_IN", session());
  assert.equal(states.at(-1)?.error, null);
  fake.emit("SIGNED_OUT", null);
  assert.deepEqual(states.at(-1), {status: "signed-out", user: null, error: null});
  stop();
});

test("the actual account provider statically renders guest children without starting auth or data requests", async () => {
  let externalCalls = 0;
  const forbidden = () => { externalCalls++; throw new Error("External request during static rendering"); };
  const exports: {PlayerProvider?: React.ComponentType<React.PropsWithChildren>; AccountControl?: React.ComponentType} = {};
  const dependencies: Record<string, unknown> = {
    "react": React,
    "react/jsx-runtime": await import("react/jsx-runtime"),
    "lucide-react": {UserRound: () => React.createElement("svg", {"aria-hidden": true})},
    "@/lib/account/client": {getBrowserClient: forbidden, hasPersistentAuthStorage: () => true},
    "@/lib/account/auth": {watchAuth: forbidden, signOut: forbidden, oauthErrorFromUrl},
    "@/lib/account/google-sign-in": {resetGoogleSignIn: forbidden},
    "@/lib/account/results": await import("../lib/account/results.ts"),
    "@/lib/account/repository": {loadDailyResults: forbidden, saveDailyResult: forbidden},
    "@/lib/account/guest-results": await import("../lib/account/guest-results.ts"),
    "./account-panel": {AccountPanel: () => React.createElement("section", null, "Account panel")},
    "./google-sign-in-button": {GoogleSignInButton: forbidden},
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../components/account/player-provider.tsx", import.meta.url), "utf8"), {
    compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
  }).outputText;
  runInNewContext(compiled, {exports, require: (name: string) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected account dependency ${name}`);
    return dependencies[name];
  }});
  assert.ok(exports.PlayerProvider && exports.AccountControl);
  const html = renderToStaticMarkup(React.createElement(exports.PlayerProvider, null,
    React.createElement(exports.AccountControl),
    React.createElement("main", {"aria-label": "Guest game content"}, "Play Daily or Practice without an account")));
  assert.equal(externalCalls, 0);
  assert.match(html, /aria-label="Sign in to LINEUP"/);
  assert.match(html, /Guest game content/);
  assert.match(html, /Play Daily or Practice without an account/);
  assert.ok(!html.includes("Account panel"));
});
