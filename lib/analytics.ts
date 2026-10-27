import { validatedAnalyticsCampaign } from "./analytics-campaign.ts";

/** Optional GA4. No Google tag, consent ping or event exists before an explicit opt-in. */
export type AnalyticsConsent = "unknown" | "granted" | "denied";
export type AnalyticsEventName = "game_start" | "question_asked" | "game_complete" | "guess_submitted" | "share_result" | "login" | "sign_up" | "daily_return" | "question_browse";
type Parameters = Record<string, string | number | boolean>;
type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {dataLayer?: unknown[]; gtag?: Gtag};
export const ANALYTICS_CONSENT_KEY = "lineup:analytics:consent:v1";
export const ANALYTICS_EVENTS_KEY = "lineup:analytics:events:v1";
const SCRIPT_ID = "lineup-google-analytics";
const DAY = 86_400_000;
const LEDGER_LIMIT = 5_000;
const denied = {analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"};
const granted = {...denied, analytics_storage: "granted"};

export function getAnalyticsMeasurementId(): string | null {
  const value = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return value && /^G-[A-Z0-9]{5,20}$/.test(value) ? value : null;
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const mode = (value: unknown) => value === "daily" || value === "practice";
const integer = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
/** Explicit schema: neither arbitrary event names nor extra fields can cross the boundary. */
export function sanitizeAnalyticsEvent(name: unknown, value: unknown): Parameters | null {
  if (!object(value)) return null;
  const allowed: Record<AnalyticsEventName, readonly string[]> = {
    game_start: ["mode"], question_asked: ["mode", "question_number", "question_category"],
    game_complete: ["mode", "outcome", "questions_used", "films_remaining"],
    guess_submitted: ["mode", "correct"], share_result: ["mode", "share_method"],
    login: ["method"], sign_up: ["method"], daily_return: ["mode"], question_browse: ["mode"],
  };
  if (typeof name !== "string" || !Object.hasOwn(allowed, name)) return null;
  if (Object.keys(value).some(key => !allowed[name as AnalyticsEventName].includes(key))) return null;
  if (name === "login" || name === "sign_up") return value.method === "google" ? {method: "google"} : null;
  if (!mode(value.mode)) return null;
  const params: Parameters = {mode: value.mode as string};
  if (name === "daily_return" && value.mode !== "daily") return null;
  if (name === "question_asked") {
    if (!integer(value.question_number, 1, 5)) return null;
    params.question_number = value.question_number as number;
    if (value.question_category !== undefined) {
      if (!["release", "genre", "people", "studios", "awards", "details"].includes(value.question_category as string)) return null;
      params.question_category = value.question_category as string;
    }
  }
  if (name === "game_complete") {
    if (!["won", "lost"].includes(value.outcome as string) || !integer(value.questions_used, 0, 5) || !integer(value.films_remaining, 1, 24)) return null;
    params.outcome = value.outcome as string;
    params.questions_used = value.questions_used as number;
    params.films_remaining = value.films_remaining as number;
  }
  if (name === "guess_submitted") {
    if (typeof value.correct !== "boolean") return null;
    params.correct = value.correct;
  }
  if (name === "share_result" && value.share_method !== undefined) {
    if (!["native", "copy_result", "copy_link"].includes(value.share_method as string)) return null;
    params.share_method = value.share_method as string;
  }
  return params;
}
function decodeConsent(raw: string | null): AnalyticsConsent {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return object(value) && value.schema === 1 && (value.choice === "granted" || value.choice === "denied") ? value.choice : "unknown";
  } catch { return "unknown"; }
}

/** Dependency boundary supports tests without contacting Google or relying on browser globals. */
export function createAnalyticsController({
  measurementId = getAnalyticsMeasurementId,
  getWindow = () => typeof window === "undefined" ? null : window as AnalyticsWindow,
  getDocument = () => typeof document === "undefined" ? null : document,
  getStorage = () => typeof window === "undefined" ? null : window.localStorage,
  now = () => Date.now(),
}: {
  measurementId?: () => string | null;
  getWindow?: () => AnalyticsWindow | null;
  getDocument?: () => Document | null;
  getStorage?: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  now?: () => number;
} = {}) {
  let consent: AnalyticsConsent = "unknown";
  let initialized = false;
  let preferencePersisted = false;
  let subscribed = 0;
  let listeningWindow: AnalyticsWindow | null = null;
  let script: HTMLScriptElement | null = null;
  let configured = false;
  let loaded = false;
  let downloadAttempted = false;
  let failed = false;
  let pageSent = false;
  let ledger = new Map<string, number>();
  const subscribers = new Set<() => void>();
  const notify = () => { for (const listener of subscribers) { try { listener(); } catch { /* Analytics cannot break a subscriber or game action. */ } } };
  const storage = () => { try { return getStorage(); } catch { return null; } };
  const id = () => { try { const value = measurementId(); return value && /^G-[A-Z0-9]{5,20}$/.test(value) ? value : null; } catch { return null; } };
  const browser = () => { try { return getWindow(); } catch { return null; } };
  const doc = () => { try { return getDocument(); } catch { return null; } };
  const disable = (value: boolean) => {
    const win = browser(), currentId = id();
    if (win && currentId) (win as unknown as Record<string, unknown>)[`ga-disable-${currentId}`] = value;
  };
  const command = (...args: unknown[]): boolean => {
    try { const tag = browser()?.gtag; if (!tag) return false; tag(...args); return true; }
    catch { return false; }
  };
  const safePage = () => {
    const privacy = browser()?.location?.pathname === "/privacy/" || browser()?.location?.pathname === "/privacy";
    return {page_location: privacy ? "https://dailylineup.co.uk/privacy/" : "https://dailylineup.co.uk/",
      page_title: privacy ? "Privacy & cookies — LINEUP" : "LINEUP — Daily Movie Guessing Game | Find the Film", page_referrer: ""};
  };
  const clearCookies = () => {
    const document = doc(), win = browser();
    if (!document || !win) return;
    try {
      const names = document.cookie.split(";").map(value => value.split("=")[0].trim()).filter(name => /^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name));
      const hostname = win.location.hostname;
      const labels = hostname.split(".");
      const domains = ["", ...labels.map((_, index) => labels.slice(index).join(".")).filter(value => value.includes(".")).flatMap(value => [value, `.${value}`])];
      const pieces = win.location.pathname.split("/").filter(Boolean);
      const paths = ["/", ...pieces.map((_, index) => `/${pieces.slice(0, index + 1).join("/")}/`), ...pieces.map((_, index) => `/${pieces.slice(0, index + 1).join("/")}`)];
      for (const name of names) for (const domain of domains) for (const path of paths)
        document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ""}; SameSite=Lax`;
    } catch { /* Cookie/storage restrictions are a supported guest scenario. */ }
  };
  const readLedger = () => {
    const boundary = now() - 365 * DAY;
    ledger = new Map([...ledger].filter(([, at]) => at >= boundary && at <= now()));
    try {
      const raw = storage()?.getItem(ANALYTICS_EVENTS_KEY);
      if (!raw || raw.length > 1_500_000) return;
      const value: unknown = JSON.parse(raw);
      if (!object(value) || value.schema !== 1 || !Array.isArray(value.events) || value.events.length > LEDGER_LIMIT) return;
      for (const row of value.events) if (Array.isArray(row) && row.length === 2 && typeof row[0] === "string" && /^[A-Za-z0-9:_.-]{1,260}$/.test(row[0]) && typeof row[1] === "number" && Number.isFinite(row[1]) && row[1] >= boundary && row[1] <= now()) ledger.set(row[0], row[1]);
    } catch { /* Best-effort local dedup; no persistent player identifier is created. */ }
  };
  const remember = (key: string) => {
    ledger.set(key, now());
    ledger = new Map([...ledger].filter(([, at]) => at >= now() - 365 * DAY).sort((a, b) => a[1] - b[1]).slice(-LEDGER_LIMIT));
    try { storage()?.setItem(ANALYTICS_EVENTS_KEY, JSON.stringify({schema: 1, events: [...ledger]})); } catch { /* Page-local dedup remains available. */ }
  };
  const stop = () => {
    // Set this before any consent update: no cookieless denial ping is intentionally sent.
    disable(true);
    if (configured) command("consent", "update", {...denied});
    try { const layer = browser()?.dataLayer; if (layer) layer.length = 0; } catch {}
    try { script?.remove(); } catch {}
    script = null; configured = false;
    clearCookies();
    ledger.clear();
    try { storage()?.removeItem(ANALYTICS_EVENTS_KEY); } catch {}
  };
  const install = () => {
    if (configured || failed || consent !== "granted") return;
    const win = browser(), document = doc(), currentId = id();
    if (!win || !document || !currentId) return;
    // A removed in-flight script may still execute. Never start a competing copy;
    // after a blocked/withdrawn pending load, refresh before granting again.
    if (downloadAttempted && !loaded) { failed = true; disable(true); return; }
    try {
      disable(false);
      win.dataLayer ??= [];
      if (!win.gtag) {
        const layer = win.dataLayer;
        // Google documents an arguments queue; never expose a general event API elsewhere.
        // eslint-disable-next-line prefer-rest-params -- Preserve Google's documented arguments-object queue format.
        win.gtag = function() { layer.push(arguments); };
      }
      command("consent", "default", {...denied});
      command("consent", "update", {...granted});
      command("set", "ads_data_redaction", true);
      command("set", "url_passthrough", false);
      command("js", new Date(now()));
      // Read only now, after explicit/stored grant. No landing campaign is saved or replayed.
      const campaign = validatedAnalyticsCampaign(win.location.href);
      command("config", currentId, {send_page_view: false, ...safePage(), ignore_referrer: true,
        // Config updates merge in a loaded runtime: clear old fields before applying fresh safe values.
        campaign_source: "", campaign_medium: "", campaign_name: "", ...campaign,
        allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_expires: 180 * 24 * 60 * 60, cookie_update: false, cookie_path: "/", cookie_domain: "auto", cookie_flags: "SameSite=Lax;Secure"});
      configured = true;
      if (!pageSent) { command("event", "page_view", {...safePage(), send_to: currentId}); pageSent = true; }
      if (loaded) return; // The library remains in memory after withdrawal; do not load it twice.
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) { failed = true; stop(); return; }
      const element = document.createElement("script");
      element.id = SCRIPT_ID;
      element.async = true;
      element.src = `https://www.googletagmanager.com/gtag/js?id=${currentId}`;
      element.referrerPolicy = "no-referrer";
      element.addEventListener("load", () => { loaded = true; });
      element.addEventListener("error", () => {
        if (script !== element) return;
        failed = true; stop();
        // Remembered consent remains granted, but no automatic network retry occurs.
      });
      script = element;
      downloadAttempted = true;
      document.head.appendChild(element);
    } catch { failed = true; stop(); }
  };
  const apply = (next: AnalyticsConsent, explicit = false) => {
    const changed = next !== consent;
    consent = next;
    if (next !== "granted") stop();
    else {
      if (explicit) failed = false;
      readLedger(); install();
    }
    if (changed) notify();
  };
  const initialize = () => {
    if (initialized) return;
    initialized = true;
    let choice: AnalyticsConsent = "unknown";
    try { choice = decodeConsent(storage()?.getItem(ANALYTICS_CONSENT_KEY) ?? null); preferencePersisted = choice !== "unknown"; } catch {}
    apply(choice);
  };
  const sync = (event: StorageEvent) => {
    if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) { preferencePersisted = event.newValue !== null; apply(decodeConsent(event.newValue)); }
    if (event.key === ANALYTICS_EVENTS_KEY && consent === "granted") readLedger();
  };
  return {
    getAnalyticsConsent: () => consent,
    subscribeAnalyticsConsent(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    startAnalytics() {
      initialize(); subscribed++;
      if (!listeningWindow) { listeningWindow = browser(); listeningWindow?.addEventListener("storage", sync); }
      return () => {
        subscribed = Math.max(0, subscribed - 1);
        if (!subscribed) { listeningWindow?.removeEventListener("storage", sync); listeningWindow = null; }
      };
    },
    setAnalyticsConsent(choice: "granted" | "denied") {
      if (choice !== "granted" && choice !== "denied") return;
      initialized = true;
      try { const target = storage(); target?.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({schema: 1, choice})); preferencePersisted = !!target; } catch { preferencePersisted = false; }
      apply(choice, true);
    },
    trackEvent(name: AnalyticsEventName, params: Record<string, unknown>, onceKey?: string): boolean {
      try {
        initialize();
        // A tab that has not yet received the storage event still respects a withdrawal.
        let saved: string | null | undefined;
        try { saved = storage()?.getItem(ANALYTICS_CONSENT_KEY); } catch {}
        if (saved !== undefined && (saved !== null || preferencePersisted) && decodeConsent(saved) !== consent) apply(decodeConsent(saved));
        if (consent !== "granted" || failed || !configured || !id()) return false;
        const clean = sanitizeAnalyticsEvent(name, params);
        if (!clean || (onceKey !== undefined && !/^[A-Za-z0-9:_.-]{1,260}$/.test(onceKey))) return false;
        if (onceKey) { readLedger(); if (ledger.has(onceKey)) return false; }
        if (!command("event", name, {...clean, ...safePage(), send_to: id()})) return false;
        if (onceKey) remember(onceKey);
        return true;
      } catch { return false; }
    },
  };
}
const analytics = createAnalyticsController();
export const getAnalyticsConsent = analytics.getAnalyticsConsent;
export const subscribeAnalyticsConsent = analytics.subscribeAnalyticsConsent;
export const setAnalyticsConsent = analytics.setAnalyticsConsent;
export const startAnalytics = analytics.startAnalytics;
export const trackEvent = analytics.trackEvent;
