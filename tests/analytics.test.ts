import test from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_CONSENT_KEY, ANALYTICS_EVENTS_KEY, createAnalyticsController, getAnalyticsMeasurementId, sanitizeAnalyticsEvent } from "../lib/analytics.ts";

const measurementId = "G-4923ZXESXM";
const consentValue = (choice: "granted" | "denied") => JSON.stringify({schema: 1, choice});
class Script extends EventTarget {
  id = ""; src = ""; async = false; referrerPolicy = ""; removed = false;
  remove() { this.removed = true; }
}
class Page {
  scripts: Script[] = [];
  cookieWrites: string[] = [];
  jar = new Map<string, string>();
  blockAppend = false;
  head = {appendChild: (script: Script) => {
    if (this.blockAppend) throw new Error("blocked script");
    this.scripts.push(script); return script;
  }};
  createElement(name: string) { assert.equal(name, "script"); return new Script(); }
  getElementById(id: string) { return this.scripts.find(script => !script.removed && script.id === id) ?? null; }
  get cookie() { return [...this.jar].map(([key, value]) => `${key}=${value}`).join("; "); }
  set cookie(value: string) {
    this.cookieWrites.push(value);
    const name = value.split("=")[0];
    if (value.includes("Max-Age=0")) this.jar.delete(name);
  }
}
class Browser extends EventTarget {
  location = {hostname: "dailylineup.co.uk", pathname: "/", href: "https://dailylineup.co.uk/?code=private-code&email=private@example.test#token=private-token"};
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
function fixture({choice, blockedStorage = false, configured = true}: {choice?: "granted" | "denied"; blockedStorage?: boolean; configured?: boolean} = {}) {
  let time = 1_000_000;
  const page = new Page(), browser = new Browser(), values = new Map<string, string>();
  const reads: string[] = [], writes: string[] = [];
  if (choice) values.set(ANALYTICS_CONSENT_KEY, consentValue(choice));
  const storage = {
    getItem: (key: string) => { if (blockedStorage) throw new Error("storage unavailable"); reads.push(key); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (blockedStorage) throw new Error("storage unavailable"); writes.push(key); values.set(key, value); },
    removeItem: (key: string) => { if (blockedStorage) throw new Error("storage unavailable"); values.delete(key); },
  };
  const controller = createAnalyticsController({measurementId: () => configured ? measurementId : null,
    getWindow: () => browser as unknown as Window,
    getDocument: () => page as unknown as Document,
    getStorage: () => storage, now: () => time});
  const commands = () => (browser.dataLayer ?? []).map(command => Array.from(command as ArrayLike<unknown>));
  const events = (name?: string) => commands().filter(command => command[0] === "event" && (!name || command[1] === name));
  const storageEvent = (key: string | null, newValue: string | null) => {
    const event = new Event("storage");
    Object.defineProperties(event, {key: {value: key}, newValue: {value: newValue}});
    browser.dispatchEvent(event);
  };
  return {controller, page, browser, values, reads, writes, commands, events, storageEvent,
    setTime: (value: number) => { time = value; },
    disabled: () => (browser as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]};
}

test("only a valid public GA4 measurement ID enables the Google tag", () => {
  const previous = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  try {
    for (const value of [undefined, "", "not-an-id", "G-private@example.test", "G-4923ZXESXM?token=secret"]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = value;
      assert.equal(getAnalyticsMeasurementId(), null);
    }
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = ` ${measurementId} `;
    assert.equal(getAnalyticsMeasurementId(), measurementId);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previous;
  }
});

test("unknown and rejected consent never create a tag, data layer, ping or event queue", () => {
  for (const choice of [undefined, "denied"] as const) {
    const f = fixture({choice}); const stop = f.controller.startAnalytics();
    assert.equal(f.controller.getAnalyticsConsent(), choice ?? "unknown");
    assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "daily:start"), false);
    assert.equal(f.page.scripts.length, 0); assert.equal(f.browser.dataLayer, undefined);
    assert.equal(f.disabled(), true); assert.equal(f.values.has(ANALYTICS_EVENTS_KEY), false);
    stop();
  }
});

test("acceptance loads one official async tag and uses basic denied defaults before granted analytics", () => {
  const f = fixture(); f.controller.startAnalytics(); f.controller.setAnalyticsConsent("granted");
  assert.equal(f.page.scripts.length, 1);
  const script = f.page.scripts[0];
  assert.equal(script.src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  assert.equal(script.async, true); assert.equal(script.referrerPolicy, "no-referrer");
  assert.deepEqual(f.commands()[0], ["consent", "default", {analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"}]);
  assert.deepEqual(f.commands()[1], ["consent", "update", {analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"}]);
  assert.equal(f.disabled(), false); assert.equal(f.controller.getAnalyticsConsent(), "granted");
  assert.equal(f.values.get(ANALYTICS_CONSENT_KEY), consentValue("granted"));
});

test("configuration disables advertising, automatic pageviews and raw URL/referrer collection", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  const config = f.commands().find(command => command[0] === "config")![2] as Record<string, unknown>;
  assert.equal(config.send_page_view, false); assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false); assert.equal(config.ignore_referrer, true);
  assert.equal(config.cookie_expires, 15_552_000); assert.equal(config.cookie_update, false);
  assert.equal(config.page_location, "https://dailylineup.co.uk/"); assert.equal(config.page_referrer, "");
  const serialized = JSON.stringify(f.commands());
  for (const value of ["private-code", "private@example.test", "private-token", "user_id"]) assert.ok(!serialized.includes(value));
});

test("one sanitized manual page view is emitted per document despite StrictMode or repeated grant", () => {
  const f = fixture({choice: "granted"}); const stop = f.controller.startAnalytics(); stop();
  f.controller.startAnalytics(); f.controller.setAnalyticsConsent("granted");
  assert.equal(f.page.scripts.length, 1); assert.equal(f.events("page_view").length, 1);
  assert.deepEqual(f.events("page_view")[0][2], {page_location: "https://dailylineup.co.uk/", page_title: "LINEUP — Daily Movie Guessing Game | Find the Film", page_referrer: "", send_to: measurementId});
});

test("privacy page views use only their canonical fixed URL and page title", () => {
  const f = fixture({choice: "granted"}); f.browser.location.pathname = "/privacy/";
  f.controller.startAnalytics();
  const params = f.events("page_view")[0][2] as Record<string, unknown>;
  assert.equal(params.page_location, "https://dailylineup.co.uk/privacy/");
  assert.equal(params.page_title, "Privacy & cookies — LINEUP");
});

test("rejected pre-consent actions are never replayed after acceptance", () => {
  const f = fixture(); f.controller.startAnalytics();
  assert.equal(f.controller.trackEvent("game_complete", {mode: "daily", outcome: "won", questions_used: 2, films_remaining: 3}, "old:complete"), false);
  f.controller.setAnalyticsConsent("granted");
  assert.equal(f.events("game_complete").length, 0); assert.equal(f.values.has(ANALYTICS_EVENTS_KEY), false);
  assert.equal(f.controller.trackEvent("game_start", {mode: "practice"}, "new:start"), true);
  assert.equal(f.events("game_start").length, 1);
});

test("every allowed game/account event has a bounded spoiler-free schema", () => {
  const events = [
    ["game_start", {mode: "daily"}], ["question_asked", {mode: "practice", question_number: 5, question_category: "people"}],
    ["game_complete", {mode: "daily", outcome: "lost", questions_used: 0, films_remaining: 24}],
    ["guess_submitted", {mode: "practice", correct: false}], ["share_result", {mode: "daily", share_method: "copy_link"}],
    ["login", {method: "google"}], ["sign_up", {method: "google"}], ["daily_return", {mode: "daily"}], ["question_browse", {mode: "practice"}],
  ] as const;
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  for (const [name, params] of events) {
    assert.deepEqual(sanitizeAnalyticsEvent(name, params), params);
    assert.equal(f.controller.trackEvent(name, params), true);
    assert.equal(f.events(name).length, 1);
  }
});

test("unknown events, extra identity fields, film spoilers and malformed values are rejected wholesale", () => {
  for (const [name, value] of [
    ["game_abandoned", {mode: "daily"}], ["game_start", {mode: "daily", email: "private@example.test"}],
    ["game_complete", {mode: "daily", outcome: "won", questions_used: 6, films_remaining: 1}],
    ["game_complete", {mode: "daily", outcome: "won", questions_used: 2, films_remaining: 0}],
    ["question_asked", {mode: "daily", question_number: 1, question_category: "Tom Hanks"}],
    ["question_asked", {mode: "daily", question_number: 1, movie_title: "Secret film"}],
    ["guess_submitted", {mode: "daily", correct: "true"}], ["login", {method: "google", user_id: "private-id"}],
    ["daily_return", {mode: "practice"}], ["share_result", {mode: "daily", share_method: "email:private@example.test"}],
    ["game_start", {mode: "private-token"}], ["game_start", null],
  ] as const) assert.equal(sanitizeAnalyticsEvent(name, value), null);
});

test("semantic once keys deduplicate accepted actions locally and never enter GA payloads", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "private-daily-puzzle:start"), true);
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "private-daily-puzzle:start"), false);
  assert.equal(f.events("game_start").length, 1);
  assert.ok(f.values.get(ANALYTICS_EVENTS_KEY)!.includes("private-daily-puzzle:start"));
  assert.ok(!JSON.stringify(f.commands()).includes("private-daily-puzzle"));
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "invalid key / token"), false);
});

test("a refreshed controller respects saved deduplication and merges another tab's accepted actions", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  f.values.set(ANALYTICS_EVENTS_KEY, JSON.stringify({schema: 1, events: [["prior:complete", 1_000_000]]}));
  assert.equal(f.controller.trackEvent("game_complete", {mode: "daily", outcome: "won", questions_used: 1, films_remaining: 1}, "prior:complete"), false);
  assert.equal(f.events("game_complete").length, 0);
});

test("deduplication is bounded to 5000 recent action markers and does not retain expired records", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  f.values.set(ANALYTICS_EVENTS_KEY, JSON.stringify({schema: 1, events: Array.from({length: 5_000}, (_, i) => [`marker:${i}`, 1_000_000])}));
  assert.equal(f.controller.trackEvent("game_start", {mode: "practice"}, "new:start"), true);
  const rows = JSON.parse(f.values.get(ANALYTICS_EVENTS_KEY)!).events as [string, number][];
  assert.equal(rows.length, 5_000); assert.equal(rows.at(-1)![0], "new:start");
  f.setTime(1_000_000 + 366 * 86_400_000);
  assert.equal(f.controller.trackEvent("game_start", {mode: "practice"}, "marker:1"), true);
  assert.equal(JSON.parse(f.values.get(ANALYTICS_EVENTS_KEY)!).events.length, 1);
});

test("withdrawal disables collection, removes the tag/queue/ledger and deletes only analytics cookies", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  f.page.scripts[0].dispatchEvent(new Event("load"));
  f.page.jar.set("_ga", "identifier"); f.page.jar.set("_ga_4923ZXESXM", "session");
  f.page.jar.set("lineup-essential", "keep"); f.page.jar.set("supabase-session", "keep");
  f.controller.trackEvent("game_start", {mode: "daily"}, "daily:start");
  f.controller.setAnalyticsConsent("denied");
  assert.equal(f.disabled(), true); assert.equal(f.page.scripts[0].removed, true);
  assert.deepEqual(f.browser.dataLayer, []); assert.equal(f.values.has(ANALYTICS_EVENTS_KEY), false);
  assert.equal(f.page.jar.has("_ga"), false); assert.equal(f.page.jar.has("_ga_4923ZXESXM"), false);
  assert.equal(f.page.jar.get("lineup-essential"), "keep"); assert.equal(f.page.jar.get("supabase-session"), "keep");
  assert.equal(f.controller.trackEvent("game_start", {mode: "practice"}), false);
  assert.ok(f.page.cookieWrites.some(value => value.includes("domain=.dailylineup.co.uk")));
});

test("an already loaded library is not downloaded again after a deliberate regrant", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics(); f.page.scripts[0].dispatchEvent(new Event("load"));
  f.controller.setAnalyticsConsent("denied"); f.controller.setAnalyticsConsent("granted");
  assert.equal(f.page.scripts.length, 1); assert.equal(f.disabled(), false);
  assert.equal(f.events("page_view").length, 0, "The original document view was already sent and is not repeated");
  assert.equal(f.controller.trackEvent("game_start", {mode: "practice"}), true);
});

test("cross-tab rejection immediately stops tracking and a delayed storage event is not required", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  f.values.set(ANALYTICS_CONSENT_KEY, consentValue("denied"));
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}), false);
  assert.equal(f.controller.getAnalyticsConsent(), "denied"); assert.equal(f.disabled(), true);
});

test("consent subscriptions follow storage changes and cleaned-up mounts do not receive events", () => {
  const f = fixture(); const states: string[] = [];
  const unsubscribe = f.controller.subscribeAnalyticsConsent(() => states.push(f.controller.getAnalyticsConsent()));
  const stop = f.controller.startAnalytics(); f.values.set(ANALYTICS_CONSENT_KEY, consentValue("granted"));
  f.storageEvent(ANALYTICS_CONSENT_KEY, consentValue("granted"));
  assert.deepEqual(states, ["granted"]); assert.equal(f.page.scripts.length, 1);
  f.storageEvent(ANALYTICS_CONSENT_KEY, consentValue("denied")); assert.deepEqual(states, ["granted", "denied"]);
  unsubscribe(); stop(); f.storageEvent(ANALYTICS_CONSENT_KEY, consentValue("granted"));
  assert.equal(f.controller.getAnalyticsConsent(), "denied"); assert.equal(states.length, 2);
});

test("blocked storage keeps an explicit choice and action deduplication in page memory", () => {
  const f = fixture({blockedStorage: true}); f.controller.startAnalytics(); f.controller.setAnalyticsConsent("granted");
  assert.equal(f.controller.getAnalyticsConsent(), "granted");
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "daily:start"), true);
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "daily:start"), false);
  f.controller.setAnalyticsConsent("denied"); assert.equal(f.disabled(), true);
});

test("blocked Google script never retries automatically and failures cannot interrupt game actions", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  f.page.scripts[0].dispatchEvent(new Event("error"));
  assert.equal(f.page.scripts.length, 1); assert.equal(f.disabled(), true);
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}), false);
  assert.equal(f.page.scripts.length, 1); assert.equal(f.controller.getAnalyticsConsent(), "granted");
  f.controller.setAnalyticsConsent("granted"); assert.equal(f.page.scripts.length, 1);
  assert.equal(f.disabled(), true, "A blocked download requires refresh rather than another tag attempt");
});

test("missing configuration, SSR and synchronous browser failures remain harmless", () => {
  const f = fixture({configured: false}); f.controller.startAnalytics(); f.controller.setAnalyticsConsent("granted");
  assert.equal(f.page.scripts.length, 0); assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}), false);
  const server = createAnalyticsController({getWindow: () => null, getDocument: () => null, getStorage: () => null});
  assert.doesNotThrow(() => { server.startAnalytics(); server.setAnalyticsConsent("denied"); server.trackEvent("game_start", {mode: "daily"}); });
  const blocked = fixture({choice: "granted"}); blocked.page.blockAppend = true;
  assert.doesNotThrow(() => blocked.controller.startAnalytics());
  assert.equal(blocked.controller.trackEvent("game_start", {mode: "daily"}), false);
});


test("a late removed-tag error cannot cancel a newer explicitly granted flow", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  const old = f.page.scripts[0]; old.dispatchEvent(new Event("load")); f.controller.setAnalyticsConsent("denied"); f.controller.setAnalyticsConsent("granted");
  old.dispatchEvent(new Event("error"));
  assert.equal(f.controller.getAnalyticsConsent(), "granted"); assert.equal(f.disabled(), false);
  assert.equal(f.controller.trackEvent("game_start", {mode: "practice"}), true);
});

test("late library load after withdrawal cannot queue an event or turn collection back on", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics(); const pending = f.page.scripts[0];
  f.controller.trackEvent("game_start", {mode: "daily"}, "daily:start"); f.controller.setAnalyticsConsent("denied");
  pending.dispatchEvent(new Event("load"));
  assert.equal(f.disabled(), true); assert.equal(f.controller.getAnalyticsConsent(), "denied");
  assert.deepEqual(f.commands(), []); assert.equal(f.controller.trackEvent("game_complete", {mode: "daily", outcome: "won", questions_used: 2, films_remaining: 1}), false);
  assert.equal(f.page.scripts.length, 1);
});

test("a denied preference removes stale analytics cookies without touching authentication/game storage", () => {
  const f = fixture({choice: "denied"}); f.page.jar.set("_ga", "old-identifier"); f.page.jar.set("_gid", "old-session");
  f.values.set("lineup:auth:v1", "existing-account"); f.values.set("lineup:daily:progress:v1:2026-10-27", "existing-progress");
  f.controller.startAnalytics();
  assert.equal(f.page.scripts.length, 0); assert.equal(f.page.jar.size, 0);
  assert.equal(f.values.get("lineup:auth:v1"), "existing-account");
  assert.equal(f.values.get("lineup:daily:progress:v1:2026-10-27"), "existing-progress");
});

test("a throwing tag cannot report an event as accepted or mark its local once key", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics();
  f.browser.gtag = () => { throw new Error("blocked runtime"); };
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}, "daily:start"), false);
  assert.equal(f.values.has(ANALYTICS_EVENTS_KEY), false);
});


test("withdrawal during a pending load followed by regrant never starts a competing tag download", () => {
  const f = fixture({choice: "granted"}); f.controller.startAnalytics(); const pending = f.page.scripts[0];
  f.controller.setAnalyticsConsent("denied"); f.controller.setAnalyticsConsent("granted");
  assert.equal(f.page.scripts.length, 1); assert.equal(f.disabled(), true);
  assert.equal(f.controller.getAnalyticsConsent(), "granted", "The stored preference still applies after refresh");
  assert.equal(f.controller.trackEvent("game_start", {mode: "daily"}), false);
  pending.dispatchEvent(new Event("load"));
  assert.equal(f.disabled(), true, "A late script cannot restart collection automatically");
  assert.deepEqual(f.commands(), []);
  const refreshed = fixture({choice: "granted"}); refreshed.controller.startAnalytics();
  assert.equal(refreshed.page.scripts.length, 1); assert.equal(refreshed.disabled(), false);
});
