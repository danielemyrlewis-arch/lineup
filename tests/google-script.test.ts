import test from "node:test";
import assert from "node:assert/strict";
import { getGoogleClientId, GIS_SCRIPT_URL, loadGoogleIdentity, type GoogleIdentityApi } from "../lib/account/google-script.ts";

class Script extends EventTarget {
  id = "";
  src = "";
  tagName = "SCRIPT";
  async = false;
  defer = false;
  removed = false;
  owner: Page | null = null;
  remove() {
    this.removed = true;
    if (this.owner) this.owner.scripts = this.owner.scripts.filter(script => script !== this);
  }
}
class Page {
  baseURI = "https://example.test/";
  scripts: Script[] = [];
  created = 0;
  appended = 0;
  failAppend = false;
  head = {appendChild: (script: Script) => {
    if (this.failAppend) throw new Error("DOM insert blocked");
    this.appended++; script.owner = this; this.scripts.push(script); return script;
  }};
  body = this.head;
  createElement(tag: string) {
    assert.equal(tag, "script"); this.created++;
    const script = new Script(); script.owner = this; return script;
  }
  getElementById(id: string) { return this.scripts.find(script => script.id === id) ?? null; }
  querySelector(selector: string) {
    assert.equal(selector, `script[src="${GIS_SCRIPT_URL}"]`);
    return this.scripts.find(script => script.src === GIS_SCRIPT_URL) ?? null;
  }
  get document() { return this as unknown as Document; }
}
const api = (): GoogleIdentityApi => ({
  initialize: () => { throw new Error("The loader must not initialize sign-in"); },
  renderButton: () => { throw new Error("The loader must not render sign-in"); },
  disableAutoSelect: () => {},
});

test("only a real-shaped public Web client ID enables native Google sign-in", () => {
  const previous = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  try {
    for (const value of [undefined, "", "PASTE_YOUR_GOOGLE_WEB_CLIENT_ID_HERE", "client-secret", "https://accounts.google.com", "123-fixture.apps.googleusercontent.com/path"]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = value;
      assert.equal(getGoogleClientId(), null);
    }
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = " 123456-fixture.apps.googleusercontent.com ";
    assert.equal(getGoogleClientId(), "123456-fixture.apps.googleusercontent.com");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = previous;
  }
});

test("server/static rendering cannot load the Google browser library", async () => {
  await assert.rejects(loadGoogleIdentity(), /Google sign-in couldn’t load/);
});

test("concurrent component mounts share one official async/defer script and one promise", async () => {
  const page = new Page();
  let ready: GoogleIdentityApi | undefined = undefined;
  const first = loadGoogleIdentity(page.document, () => ready);
  const second = loadGoogleIdentity(page.document, () => ready);
  assert.equal(first, second);
  assert.equal(page.created, 1);
  assert.equal(page.appended, 1);
  const script = page.scripts[0];
  assert.equal(script.src, "https://accounts.google.com/gsi/client");
  assert.equal(script.async, true); assert.equal(script.defer, true);
  ready = api(); script.dispatchEvent(new Event("load"));
  assert.equal(await first, ready); assert.equal(await second, ready);
  assert.equal(await loadGoogleIdentity(page.document, () => ready), ready);
  assert.equal(page.appended, 1);
});

test("an already available GIS API needs no script insertion or initialization", async () => {
  const page = new Page(), ready = api();
  assert.equal(await loadGoogleIdentity(page.document, () => ready), ready);
  assert.equal(page.created, 0); assert.equal(page.appended, 0);
});

test("an existing official script is reused and never removed as an app-owned script", async () => {
  const page = new Page(), external = new Script();
  external.src = GIS_SCRIPT_URL; external.owner = page; page.scripts.push(external);
  let ready: GoogleIdentityApi | undefined = undefined;
  const loaded = loadGoogleIdentity(page.document, () => ready);
  assert.equal(page.created, 0); assert.equal(page.appended, 0);
  ready = api(); external.dispatchEvent(new Event("load"));
  assert.equal(await loaded, ready); assert.equal(external.removed, false);
});

test("blocked script errors are sanitized and retry occurs only on another explicit call", async () => {
  const page = new Page();
  let ready: GoogleIdentityApi | undefined = undefined;
  const loaded = loadGoogleIdentity(page.document, () => ready);
  const failed = page.scripts[0]; failed.dispatchEvent(new Event("error"));
  await assert.rejects(loaded, /Guest play is still available/);
  assert.equal(failed.removed, true); assert.equal(page.scripts.length, 0);
  assert.equal(page.appended, 1, "No automatic retry should be started");
  const retried = loadGoogleIdentity(page.document, () => ready);
  assert.equal(page.appended, 2);
  ready = api(); page.scripts[0].dispatchEvent(new Event("load"));
  assert.equal(await retried, ready);
});

test("a script timeout removes only its own tag and does not loop", async () => {
  const own = new Page();
  await assert.rejects(loadGoogleIdentity(own.document, () => undefined, 1), /Google sign-in couldn’t load/);
  assert.equal(own.appended, 1); assert.equal(own.scripts.length, 0);
  const externalPage = new Page(), external = new Script();
  external.src = GIS_SCRIPT_URL; external.owner = externalPage; externalPage.scripts.push(external);
  await assert.rejects(loadGoogleIdentity(externalPage.document, () => undefined, 1), /Google sign-in couldn’t load/);
  assert.equal(external.removed, false); assert.equal(externalPage.created, 0);
});

test("a load event without a usable GIS API fails safely", async () => {
  const page = new Page();
  const loaded = loadGoogleIdentity(page.document, () => undefined);
  const script = page.scripts[0]; script.dispatchEvent(new Event("load"));
  await assert.rejects(loaded, /Google sign-in couldn’t load/);
  assert.equal(script.removed, true);
});

test("a synchronous DOM failure clears the shared promise so an explicit retry can succeed", async () => {
  const page = new Page(); page.failAppend = true;
  let ready: GoogleIdentityApi | undefined = undefined;
  await assert.rejects(loadGoogleIdentity(page.document, () => ready), /Google sign-in couldn’t load/);
  page.failAppend = false;
  const retry = loadGoogleIdentity(page.document, () => ready);
  ready = api(); page.scripts[0].dispatchEvent(new Event("load"));
  assert.equal(await retry, ready); assert.equal(page.created, 2);
});

test("a reserved script element with another origin is never executed or removed", async () => {
  const page = new Page(), unexpected = new Script();
  unexpected.id = "lineup-google-identity-script";
  unexpected.src = "https://example.test/not-google.js";
  page.scripts.push(unexpected);
  await assert.rejects(loadGoogleIdentity(page.document, () => undefined), /Google sign-in couldn’t load/);
  assert.equal(page.appended, 0); assert.equal(unexpected.removed, false);
});
