import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createGoogleCredentialAttempt, generateGoogleNonce } from "../lib/account/google-token.ts";

const nonce = {raw: "a-random-nonce-with-at-least-thirty-two-characters", hashed: "a".repeat(64)};
const credential = "fixture-google-id-token";
const success = (id = "existing-player-id") => ({data: {user: {id}, session: {user: {id}}}, error: null});
function fakeClient(result: unknown | (() => unknown) = success()) {
  const calls: unknown[] = [];
  const client = {auth: {
    signInWithIdToken: (value: unknown) => {
      calls.push(value);
      return typeof result === "function" ? result() : Promise.resolve(result);
    },
    signInWithOAuth: () => { throw new Error("The new flow must never redirect through OAuth"); },
  }} as unknown as SupabaseClient;
  return {client, calls};
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

test("a Google nonce uses 32 secure random bytes and hashes the original string as SHA-256 hex", async () => {
  let generatedBytes = 0;
  const cryptoApi = {
    getRandomValues: (bytes: Uint8Array) => { generatedBytes = bytes.length; bytes.fill(0); return bytes; },
    subtle: webcrypto.subtle,
  } as unknown as Crypto;
  const value = await generateGoogleNonce(cryptoApi);
  assert.equal(generatedBytes, 32);
  assert.equal(value.raw, "A".repeat(43));
  assert.equal(value.hashed, createHash("sha256").update(value.raw).digest("hex"));
  assert.match(value.hashed, /^[a-f0-9]{64}$/);
  assert.notEqual(value.raw, value.hashed);
});

test("separate authentication attempts receive distinct cryptographically generated nonces", async () => {
  const a = await generateGoogleNonce(webcrypto as Crypto);
  const b = await generateGoogleNonce(webcrypto as Crypto);
  assert.match(a.raw, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.hashed, b.hashed);
});

test("missing Web Crypto fails cleanly instead of generating an insecure nonce", async () => {
  await assert.rejects(generateGoogleNonce({} as Crypto), /unavailable/i);
});

test("the Google ID credential and original nonce go only to Supabase signInWithIdToken", async () => {
  const fake = fakeClient();
  const attempt = createGoogleCredentialAttempt(fake.client, nonce);
  assert.equal(attempt.isConsumed(), false);
  assert.deepEqual(await attempt.consume({credential}), {status: "signed-in", error: null});
  assert.equal(attempt.isConsumed(), true);
  assert.deepEqual(fake.calls, [{provider: "google", token: credential, nonce: nonce.raw}]);
  assert.ok(!JSON.stringify(fake.calls).includes(nonce.hashed));
});

test("a previously registered Google user's server-established identity is accepted unchanged", async () => {
  const existing = success("previously-saved-user-id");
  const fake = fakeClient(existing);
  assert.equal((await createGoogleCredentialAttempt(fake.client, nonce).consume({credential})).status, "signed-in");
  assert.equal(existing.data.user.id, "previously-saved-user-id");
  assert.equal(existing.data.session.user.id, "previously-saved-user-id");
  assert.equal(fake.calls.length, 1);
});

test("duplicate callbacks cannot start concurrent or repeated authentication requests", async () => {
  const pending = deferred<ReturnType<typeof success>>();
  const fake = fakeClient(() => pending.promise);
  const attempt = createGoogleCredentialAttempt(fake.client, nonce);
  const first = attempt.consume({credential});
  assert.equal(attempt.isConsumed(), true);
  assert.deepEqual(await attempt.consume({credential}), {status: "ignored", error: null});
  await Promise.resolve();
  assert.equal(fake.calls.length, 1);
  pending.resolve(success());
  assert.equal((await first).status, "signed-in");
  assert.equal((await attempt.consume({credential})).status, "ignored");
});

test("missing, malformed and oversized credentials fail without contacting Supabase", async () => {
  for (const response of [null, undefined, {}, {credential: null}, {credential: 1}, {credential: ""}, {credential: " padded "}, {credential: "x".repeat(16_001)}]) {
    const fake = fakeClient();
    const attempt = createGoogleCredentialAttempt(fake.client, nonce);
    const result = await attempt.consume(response);
    assert.equal(result.status, "error");
    assert.match(result.error!, /credential/i);
    assert.equal(fake.calls.length, 0);
    assert.equal((await attempt.consume({credential})).status, "ignored");
  }
});

test("invalid nonce context cannot be sent to Supabase", async () => {
  for (const badNonce of [{...nonce, raw: ""}, {...nonce, hashed: ""}, {...nonce, raw: "not safe!"}, {...nonce, hashed: "A".repeat(64)}]) {
    const fake = fakeClient();
    assert.equal((await createGoogleCredentialAttempt(fake.client, badNonce).consume({credential})).status, "error");
    assert.equal(fake.calls.length, 0);
  }
});

test("expired and clock-reversed attempts fail before making an authentication request", async () => {
  for (const age of [300_000, 300_001, -1]) {
    let now = 1_000;
    const fake = fakeClient();
    const attempt = createGoogleCredentialAttempt(fake.client, nonce, {now: () => now});
    now += age;
    assert.match((await attempt.consume({credential})).error!, /expired/i);
    assert.equal(fake.calls.length, 0);
  }
});

test("cancelling an attempt ignores any later Google callback", async () => {
  const fake = fakeClient();
  const attempt = createGoogleCredentialAttempt(fake.client, nonce);
  attempt.cancel();
  assert.equal(attempt.isConsumed(), true);
  assert.equal((await attempt.consume({credential})).status, "ignored");
  assert.equal(fake.calls.length, 0);
});

test("cancelling an in-flight exchange suppresses stale completion but does not claim to abort it", async () => {
  const pending = deferred<ReturnType<typeof success>>();
  const fake = fakeClient(() => pending.promise);
  const attempt = createGoogleCredentialAttempt(fake.client, nonce);
  const request = attempt.consume({credential});
  await Promise.resolve();
  attempt.cancel();
  assert.equal(fake.calls.length, 1);
  pending.resolve(success());
  assert.equal((await request).status, "ignored");
});

test("Supabase rejection and network failures produce generic errors without leaking provider details", async () => {
  const privateMessage = "raw provider details and personal information";
  for (const response of [{data: {user: null, session: null}, error: {message: privateMessage}}, () => Promise.reject(new Error(privateMessage))]) {
    const fake = fakeClient(response);
    const result = await createGoogleCredentialAttempt(fake.client, nonce).consume({credential});
    assert.equal(result.status, "error");
    assert.ok(!result.error!.includes(privateMessage));
    assert.ok(!result.error!.includes(credential));
    assert.ok(!result.error!.includes(nonce.raw));
  }
});

test("a missing or inconsistent server-established session is never reported as a successful login", async () => {
  for (const response of [
    {data: {user: null, session: null}, error: null},
    {data: {user: {id: "one"}, session: null}, error: null},
    {data: {user: {id: "one"}, session: {user: {id: "two"}}}, error: null},
  ]) {
    const fake = fakeClient(response);
    assert.equal((await createGoogleCredentialAttempt(fake.client, nonce).consume({credential})).status, "error");
  }
});

test("a hung exchange times out once and never automatically retries", async () => {
  const pending = deferred<ReturnType<typeof success>>();
  const fake = fakeClient(() => pending.promise);
  const attempt = createGoogleCredentialAttempt(fake.client, nonce, {timeoutMs: 5});
  const result = await attempt.consume({credential});
  assert.equal(result.status, "error");
  assert.match(result.error!, /taking longer/i);
  assert.equal((await attempt.consume({credential})).status, "ignored");
  assert.equal(fake.calls.length, 1);
  pending.resolve(success());
  await Promise.resolve();
  assert.equal(fake.calls.length, 1);
});
