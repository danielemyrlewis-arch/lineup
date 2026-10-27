import type { SupabaseClient } from "@supabase/supabase-js";
import { trackEvent } from "../analytics.ts";
import { loadGoogleIdentity, type GoogleIdentityApi } from "./google-script.ts";
import { createGoogleCredentialAttempt, generateGoogleNonce, type GoogleCredentialAttempt, type GoogleNonce } from "./google-token.ts";

export interface GoogleSignInState {
  phase: "loading" | "ready" | "waiting" | "verifying" | "signed-in" | "error";
  error: string | null;
}
interface Flow {
  client: SupabaseClient;
  clientId: string;
  createdAt: number;
  phase: GoogleSignInState["phase"];
  error: string | null;
  preparing: Promise<void>;
  api?: GoogleIdentityApi;
  nonce?: GoogleNonce;
  attempt?: GoogleCredentialAttempt;
  initialized: boolean;
}
interface View {
  host: HTMLElement;
  flow: Flow;
  notify: (state: GoogleSignInState) => void;
  rendered: boolean;
  width?: number;
  button?: object;
  timer?: ReturnType<typeof setTimeout>;
}
const FAILED = "Google sign-in couldn’t load. Please try again. Guest play is still available.";
const EXPIRED = "This sign-in attempt has expired. Please try again.";
const NO_RESPONSE = "Sign-in hasn’t completed. If a Google window is open, close it before trying again. You can keep playing as a guest.";

/** One GIS configuration at a time. Re-renders reuse it; explicit retries get a new nonce. */
export function createGoogleSignInController({
  load = loadGoogleIdentity,
  nonce = generateGoogleNonce,
  now = () => Date.now(),
  ttlMs = 5 * 60_000,
  waitMs = 60_000,
}: {
  load?: () => Promise<GoogleIdentityApi>;
  nonce?: () => Promise<GoogleNonce>;
  now?: () => number;
  ttlMs?: number;
  waitMs?: number;
} = {}) {
  let current: Flow | null = null;
  let view: View | null = null;
  let loadedApi: GoogleIdentityApi | undefined;
  const expired = (flow: Flow) => {
    const age = now() - flow.createdAt;
    return !Number.isFinite(age) || age < 0 || age >= ttlMs;
  };
  const buttonWidth = (host: HTMLElement) => Math.min(400, Math.max(200, host.clientWidth || 280));
  const clearView = () => {
    if (!view) return;
    clearTimeout(view.timer);
    view.host.replaceChildren();
    view.host.inert = false;
    view = null;
  };
  const publish = (flow: Flow) => {
    if (!view || view.flow !== flow || current !== flow) return;
    view.host.inert = flow.phase !== "ready";
    if (flow.phase === "error" || flow.phase === "signed-in") view.host.replaceChildren();
    view.notify({phase: flow.phase, error: flow.error});
  };
  const fail = (flow: Flow, message: string) => {
    flow.attempt?.cancel();
    flow.phase = "error"; flow.error = message;
    if (view?.flow === flow) clearTimeout(view.timer);
    publish(flow);
  };
  const expire = (flow: Flow) => {
    if (!view || view.flow !== flow) return;
    clearTimeout(view.timer);
    view.timer = setTimeout(() => fail(flow, flow.phase === "waiting" ? NO_RESPONSE : EXPIRED),
      Math.max(1, Math.min(ttlMs - (now() - flow.createdAt), flow.phase === "waiting" ? waitMs : ttlMs)));
  };
  const receive = async (flow: Flow, response: unknown) => {
    // No callback authenticates without an explicit click on this mounted official button.
    if (current !== flow || view?.flow !== flow || flow.phase !== "waiting" || !flow.attempt) return;
    if (expired(flow)) { fail(flow, EXPIRED); return; }
    clearTimeout(view.timer);
    flow.phase = "verifying"; publish(flow);
    const result = await flow.attempt.consume(response);
    if (current !== flow || view?.flow !== flow || result.status === "ignored") return;
    flow.phase = result.status === "signed-in" ? "signed-in" : "error";
    flow.error = result.error;
    if (result.status === "signed-in") trackEvent("login", {method: "google"});
    publish(flow);
  };
  const render = (flow: Flow) => {
    if (current !== flow || !view || view.flow !== flow || !flow.api || !flow.nonce || !flow.attempt) return;
    if (expired(flow)) { fail(flow, EXPIRED); return; }
    if (view.rendered) return;
    try {
      if (!flow.initialized) {
        flow.api.initialize({client_id: flow.clientId, nonce: flow.nonce.hashed, ux_mode: "popup",
          auto_select: false, button_auto_select: false, callback: response => { void receive(flow, response); }});
        flow.initialized = true;
      }
      const mounted = view;
      const button = {};
      mounted.button = button;
      mounted.width = buttonWidth(mounted.host);
      flow.api.renderButton(mounted.host, {type: "standard", theme: "filled_black", size: "large",
        text: "continue_with", shape: "rectangular", width: mounted.width,
        click_listener: () => {
          if (view !== mounted || mounted.button !== button || current !== flow || flow.phase !== "ready") return;
          if (expired(flow)) { fail(flow, EXPIRED); return; }
          flow.phase = "waiting"; publish(flow); expire(flow);
        }});
      mounted.rendered = true;
      flow.phase = "ready"; publish(flow); expire(flow);
    } catch { fail(flow, FAILED); }
  };
  const prepare = (client: SupabaseClient, clientId: string): Flow => {
    const flow: Flow = {client, clientId, createdAt: now(), phase: "loading", error: null,
      initialized: false, preparing: Promise.resolve()};
    flow.preparing = Promise.all([Promise.resolve().then(load), Promise.resolve().then(nonce)]).then(([api, value]) => {
      loadedApi = api;
      if (current !== flow) return;
      flow.api = api; flow.nonce = value;
      flow.attempt = createGoogleCredentialAttempt(client, value, {now, ttlMs});
      flow.phase = "ready";
      render(flow);
    }).catch(() => { if (current === flow) fail(flow, FAILED); });
    return flow;
  };
  return {
    mount(host: HTMLElement, client: SupabaseClient, clientId: string, notify: View["notify"]) {
      // Only a still-unused configuration can survive a panel remount or StrictMode cycle.
      if (current && (current.client !== client || current.clientId !== clientId ||
          !["loading", "ready"].includes(current.phase) || expired(current))) {
        current.attempt?.cancel(); current = null;
      }
      clearView();
      current ??= prepare(client, clientId);
      const mounted: View = {host, flow: current, notify, rendered: false};
      view = mounted;
      publish(current);
      if (current.phase === "ready") render(current);
      return {
        resize() {
          if (view !== mounted || mounted.flow.phase !== "ready" || mounted.width === buttonWidth(host)) return;
          host.replaceChildren(); mounted.rendered = false;
          render(mounted.flow);
        },
        retry() {
          if (view !== mounted || mounted.flow.phase === "verifying" || mounted.flow.phase === "loading") return;
          mounted.flow.attempt?.cancel();
          clearTimeout(mounted.timer);
          host.replaceChildren(); mounted.rendered = false;
          current = prepare(client, clientId); mounted.flow = current;
          publish(current);
        },
        dispose() {
          if (view !== mounted) return;
          if (mounted.flow.phase === "waiting" || mounted.flow.phase === "verifying") {
            mounted.flow.attempt?.cancel(); current = null;
          }
          clearView();
        },
      };
    },
    reset() {
      current?.attempt?.cancel(); current = null;
      clearView();
      // Never load Google or request another login during sign-out.
      try { loadedApi?.disableAutoSelect(); } catch { /* Sign-out still proceeds through Supabase. */ }
    },
  };
}
const controller = createGoogleSignInController();
export const mountGoogleSignIn = controller.mount;
export const resetGoogleSignIn = controller.reset;
