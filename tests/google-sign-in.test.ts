import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createGoogleSignInController, type GoogleSignInState } from "../lib/account/google-sign-in.ts";
import type { GoogleIdentityApi, GoogleIdentityConfiguration, GoogleButtonConfiguration } from "../lib/account/google-script.ts";

const clientId = "123456789-fixture.apps.googleusercontent.com";
const credential = "fixture-google-credential";
const success = (id = "existing-player-id") => ({data: {user: {id}, session: {user: {id}}}, error: null});
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function host(width = 280) {
  return {inert: false, clientWidth: width, replaceChildren: () => undefined} as unknown as HTMLElement;
}
function fixture(t: TestContext, options: {waitMs?: number; ttlMs?: number; result?: unknown | (() => unknown); load?: () => Promise<GoogleIdentityApi>; nonce?: () => Promise<{raw: string; hashed: string}>} = {}) {
  let time = 1_000;
  let loads = 0, nonces = 0, disabled = 0;
  const configurations: GoogleIdentityConfiguration[] = [];
  const buttons: {host: HTMLElement; configuration: GoogleButtonConfiguration}[] = [];
  const calls: unknown[] = [];
  const states: GoogleSignInState[] = [];
  const api: GoogleIdentityApi = {
    initialize: value => { configurations.push(value); },
    renderButton: (element, configuration) => { buttons.push({host: element, configuration}); },
    disableAutoSelect: () => { disabled++; },
  };
  const client = {auth: {
    signInWithIdToken: (value: unknown) => {
      calls.push(value);
      return typeof options.result === "function" ? options.result() : Promise.resolve(options.result ?? success());
    },
    signInWithOAuth: () => { throw new Error("Redirect OAuth is forbidden"); },
  }} as unknown as SupabaseClient;
  const controller = createGoogleSignInController({
    load: () => { loads++; return options.load ? options.load() : Promise.resolve(api); },
    nonce: () => { nonces++; return options.nonce ? options.nonce() : Promise.resolve({raw: `random-original-nonce-with-at-least-32-characters-${nonces}`, hashed: String(nonces).repeat(64)}); },
    now: () => time,
    ttlMs: options.ttlMs,
    waitMs: options.waitMs,
  });
  t.after(() => controller.reset());
  return {controller, api, client, calls, configurations, buttons, states,
    mount: (element = host()) => controller.mount(element, client, clientId, value => states.push(value)),
    click: (index = buttons.length - 1) => buttons[index].configuration.click_listener(),
    callback: (response: unknown = {credential}, index = configurations.length - 1) => configurations[index].callback(response),
    setTime: (value: number) => { time = value; },
    get loads() { return loads; }, get nonces() { return nonces; }, get disabled() { return disabled; },
    get state() { return states.at(-1)!; },
  };
}

test("creating the sign-in controller never loads Google, creates a nonce or signs anyone in", async t => {
  const f = fixture(t);
  await flush();
  assert.equal(f.loads, 0); assert.equal(f.nonces, 0);
  assert.equal(f.configurations.length, 0); assert.equal(f.buttons.length, 0); assert.equal(f.calls.length, 0);
});

test("StrictMode loading remounts reuse one preparation and initialize only the mounted official button", async t => {
  const pending = deferred<GoogleIdentityApi>();
  const f = fixture(t, {load: () => pending.promise});
  const first = host();
  f.mount(first).dispose();
  const second = host();
  f.mount(second);
  await flush();
  assert.equal(f.loads, 1); assert.equal(f.nonces, 1);
  pending.resolve(f.api);
  await flush();
  assert.equal(f.configurations.length, 1); assert.equal(f.buttons.length, 1);
  assert.equal(f.buttons[0].host, second); assert.equal(f.state.phase, "ready");
  assert.equal(second.inert, false); assert.equal(f.calls.length, 0);
});

test("ready remounts reuse the nonce and GIS initialization while stale button clicks are ignored", async t => {
  const f = fixture(t);
  const first = f.mount(); await flush(); first.dispose();
  f.mount(); await flush();
  assert.equal(f.loads, 1); assert.equal(f.nonces, 1); assert.equal(f.configurations.length, 1);
  assert.equal(f.buttons.length, 2);
  f.click(0); f.callback(); await flush();
  assert.equal(f.state.phase, "ready"); assert.equal(f.calls.length, 0);
  f.click(1); f.callback(); await flush();
  assert.equal(f.state.phase, "signed-in"); assert.equal(f.calls.length, 1);
});

test("GIS gets the hashed nonce and an official popup button with automatic selection disabled", async t => {
  const f = fixture(t); f.mount(host(120)); await flush();
  const configuration = f.configurations[0];
  assert.equal(configuration.client_id, clientId); assert.equal(configuration.nonce, "1".repeat(64));
  assert.equal(configuration.ux_mode, "popup"); assert.equal(configuration.auto_select, false);
  assert.equal(configuration.button_auto_select, false);
  assert.equal("login_uri" in configuration, false); assert.equal("redirect_to" in configuration, false);
  assert.deepEqual({...f.buttons[0].configuration, click_listener: null}, {
    type: "standard", theme: "filled_black", size: "large", text: "continue_with", shape: "rectangular", width: 200, click_listener: null,
  });
  assert.equal(f.calls.length, 0);
});

test("a Google credential cannot authenticate until the mounted official button is explicitly clicked", async t => {
  const f = fixture(t); const element = host(); f.mount(element); await flush();
  f.callback(); await flush();
  assert.equal(f.calls.length, 0); assert.equal(f.state.phase, "ready");
  f.click(); assert.equal(f.state.phase, "waiting"); assert.equal(element.inert, true);
  f.callback(); await flush();
  assert.deepEqual(f.calls, [{provider: "google", token: credential, nonce: "random-original-nonce-with-at-least-32-characters-1"}]);
  assert.equal(f.state.phase, "signed-in");
});

test("repeated clicks and callbacks start only one exchange and accept an existing server identity unchanged", async t => {
  const pending = deferred<ReturnType<typeof success>>();
  const response = success("previously-saved-player");
  const f = fixture(t, {result: () => pending.promise}); f.mount(); await flush();
  f.click(); f.click(); f.callback(); f.callback(); await flush();
  assert.equal(f.calls.length, 1); assert.equal(f.state.phase, "verifying");
  pending.resolve(response); await flush();
  f.callback(); f.click(); await flush();
  assert.equal(f.calls.length, 1); assert.equal(f.state.phase, "signed-in");
  assert.equal(response.data.user.id, "previously-saved-player");
});

test("malformed callbacks and provider errors fail gracefully without leaking details or retrying", async t => {
  const f = fixture(t, {result: {data: {user: null, session: null}, error: {message: "private provider detail"}}});
  f.mount(); await flush(); f.click(); f.callback({}); await flush();
  assert.equal(f.state.phase, "error"); assert.equal(f.calls.length, 0);
  assert.match(f.state.error!, /credential/i);
  const connection = f.mount(); await flush(); f.click(); f.callback(); await flush();
  assert.equal(f.state.phase, "error"); assert.equal(f.calls.length, 1);
  assert.ok(!f.state.error!.includes("private provider detail"));
  assert.ok(!f.state.error!.includes(credential));
  connection.dispose();
});

test("script, secure-random preparation and GIS rendering errors keep guest-safe status", async t => {
  for (const failure of ["script", "nonce", "initialize", "render"] as const) {
    const f = fixture(t, {
      load: failure === "script" ? () => Promise.reject(new Error("private script details")) : undefined,
      nonce: failure === "nonce" ? () => Promise.reject(new Error("private crypto details")) : undefined,
    });
    if (failure === "initialize") f.api.initialize = () => { throw new Error("private init details"); };
    if (failure === "render") f.api.renderButton = () => { throw new Error("private render details"); };
    f.mount(); await flush();
    assert.equal(f.state.phase, "error", failure); assert.match(f.state.error!, /Guest play/i);
    assert.ok(!f.state.error!.includes("private")); assert.equal(f.calls.length, 0);
    f.controller.reset();
  }
});

test("manual retry makes a fresh nonce and stale callback closures cannot authenticate", async t => {
  const f = fixture(t); const connection = f.mount(); await flush();
  f.click(); connection.retry(); await flush();
  assert.equal(f.nonces, 2); assert.equal(f.configurations.length, 2);
  assert.notEqual(f.configurations[0].nonce, f.configurations[1].nonce);
  f.callback({credential}, 0); await flush(); assert.equal(f.calls.length, 0);
  f.click(); f.callback({credential}, 0); await flush(); assert.equal(f.calls.length, 0);
  f.callback({credential}, 1); await flush();
  assert.equal(f.state.phase, "signed-in");
  assert.deepEqual(f.calls, [{provider: "google", token: credential, nonce: "random-original-nonce-with-at-least-32-characters-2"}]);
});

test("retry while preparing or verifying cannot create competing authentication attempts", async t => {
  const loader = deferred<GoogleIdentityApi>();
  const result = deferred<ReturnType<typeof success>>();
  const f = fixture(t, {load: () => loader.promise, result: () => result.promise});
  const connection = f.mount(); connection.retry(); await flush(); assert.equal(f.nonces, 1);
  loader.resolve(f.api); await flush(); f.click(); f.callback(); await flush(); connection.retry();
  assert.equal(f.nonces, 1); assert.equal(f.calls.length, 1);
  result.resolve(success()); await flush(); assert.equal(f.state.phase, "signed-in");
});

test("an abandoned Google popup times out without authenticating and needs an explicit retry", async t => {
  const f = fixture(t, {waitMs: 5}); const connection = f.mount(); await flush(); f.click();
  await delay(15);
  assert.equal(f.state.phase, "error"); assert.match(f.state.error!, /hasn’t completed/);
  f.callback(); await flush(); assert.equal(f.calls.length, 0); assert.equal(f.nonces, 1);
  connection.retry(); await flush(); assert.equal(f.nonces, 2); assert.equal(f.state.phase, "ready");
});

test("an unused official button expires and cannot start a late sign-in", async t => {
  const f = fixture(t, {ttlMs: 5}); f.mount(); await flush();
  await delay(15);
  assert.equal(f.state.phase, "error"); assert.match(f.state.error!, /expired/);
  f.click(); f.callback(); await flush(); assert.equal(f.calls.length, 0);
});

test("expiry checks use the original flow start even when Google preparation took time", async t => {
  const loader = deferred<GoogleIdentityApi>();
  const f = fixture(t, {load: () => loader.promise}); f.mount();
  f.setTime(61_000); loader.resolve(f.api); await flush();
  f.setTime(300_999); f.click(); assert.equal(f.state.phase, "waiting");
  // Simulate a callback queued just after expiry but before the timer task runs.
  f.setTime(301_001); f.callback(); await flush();
  assert.equal(f.calls.length, 0); assert.equal(f.state.phase, "error"); assert.match(f.state.error!, /expired/);
});

test("disposing a waiting panel cancels its callback and remounting makes a fresh nonce", async t => {
  const f = fixture(t); const connection = f.mount(); await flush(); f.click(); connection.dispose();
  const count = f.states.length; f.callback(); await flush();
  assert.equal(f.calls.length, 0); assert.equal(f.states.length, count);
  f.mount(); await flush(); assert.equal(f.nonces, 2); assert.equal(f.state.phase, "ready");
});

test("disposing a verifying panel suppresses stale UI completion without claiming to abort the SDK", async t => {
  const pending = deferred<ReturnType<typeof success>>();
  const f = fixture(t, {result: () => pending.promise}); const connection = f.mount(); await flush();
  f.click(); f.callback(); await flush(); assert.equal(f.calls.length, 1);
  connection.dispose(); const count = f.states.length;
  pending.resolve(success()); await flush(); assert.equal(f.states.length, count); assert.equal(f.calls.length, 1);
  f.mount(); await flush(); assert.equal(f.nonces, 2);
});

test("sign-out reset disables automatic selection only for an already-loaded API and never logs back in", async t => {
  const f = fixture(t); f.controller.reset(); await flush();
  assert.equal(f.loads, 0); assert.equal(f.disabled, 0); assert.equal(f.calls.length, 0);
  f.mount(); await flush(); f.click(); f.controller.reset();
  const count = f.states.length; f.callback(); await flush();
  assert.equal(f.disabled, 1); assert.equal(f.calls.length, 0); assert.equal(f.states.length, count);
  assert.equal(f.loads, 1); assert.equal(f.nonces, 1);
});

test("resetting while Google is loading prevents late initialization or authentication", async t => {
  const pending = deferred<GoogleIdentityApi>(); const f = fixture(t, {load: () => pending.promise});
  f.mount(); f.controller.reset(); pending.resolve(f.api); await flush();
  assert.equal(f.configurations.length, 0); assert.equal(f.buttons.length, 0); assert.equal(f.calls.length, 0);
});



test("resizing the official button preserves its nonce and initialization without reopening sign-in", async t => {
  const f = fixture(t); const element = host(400); const connection = f.mount(element); await flush();
  assert.equal(f.buttons[0].configuration.width, 400);
  Object.defineProperty(element, "clientWidth", {value: 260, configurable: true});
  connection.resize();
  assert.equal(f.buttons.length, 2); assert.equal(f.buttons[1].configuration.width, 260);
  assert.equal(f.configurations.length, 1); assert.equal(f.nonces, 1); assert.equal(f.calls.length, 0);
  connection.resize(); assert.equal(f.buttons.length, 2);
  f.click(0); f.callback(); await flush();
  assert.equal(f.calls.length, 0, "A replaced button cannot start authentication");
  f.click(1); Object.defineProperty(element, "clientWidth", {value: 300}); connection.resize();
  assert.equal(f.buttons.length, 2, "Resizing cannot replace a button during a pending login");
  f.callback(); await flush(); assert.equal(f.calls.length, 1);
});
