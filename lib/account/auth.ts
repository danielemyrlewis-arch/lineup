import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import { SITE_URL } from "../site.ts";

export interface AuthSnapshot {
  status: "loading" | "signed-in" | "signed-out" | "unavailable";
  user: User | null;
  error: string | null;
}
type AuthClient = Pick<SupabaseClient, "auth">;
const UNAVAILABLE = "Accounts are unavailable right now. You can keep playing as a guest.";
const CALLBACK_ERROR = "Google sign-in wasn’t completed. Please try again; guest play is always available.";
const snapshot = (status: AuthSnapshot["status"], user: User | null = null, error: string | null = null): AuthSnapshot => ({ status, user, error });

/** Inspect only known error keys. Never render provider messages or callback tokens. */
export function oauthErrorFromUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const fragment = new URLSearchParams(url.hash.slice(1));
    return [url.searchParams, fragment].some(params =>
      ["error", "error_code", "error_description"].some(key => params.has(key)));
  } catch { return false; }
}

/** Observe browser sessions without running async Supabase work inside its callback. */
export function watchAuth(
  client: AuthClient | null,
  onChange: (state: AuthSnapshot) => void,
  { timeoutMs = 10_000, oauthError = false }: { timeoutMs?: number; oauthError?: boolean } = {},
): () => void {
  if (!client) {
    onChange(snapshot("unavailable", null, UNAVAILABLE));
    return () => {};
  }
  let active = true;
  let revision = 0;
  let unsubscribe = () => {};
  const emit = (value: AuthSnapshot) => { if (active) onChange(value); };
  const apply = (session: Session | null) => {
    clearTimeout(timer);
    const user = session?.user;
    if (user?.id) oauthError = false;
    emit(user?.id ? snapshot("signed-in", user) : snapshot("signed-out", null, oauthError ? CALLBACK_ERROR : null));
  };
  emit(snapshot("loading"));
  const timer = setTimeout(() => emit(snapshot("unavailable", null, UNAVAILABLE)), timeoutMs);
  const initialRevision = revision;
  try {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      revision++;
      // State-only callback. The UI starts any data requests in a later effect.
      apply(_event === "SIGNED_OUT" ? null : session);
    });
    unsubscribe = () => data.subscription.unsubscribe();
    Promise.resolve(client.auth.getSession()).then(({ data, error }) => {
      if (!active || revision !== initialRevision) return;
      if (error) { clearTimeout(timer); emit(snapshot("unavailable", null, UNAVAILABLE)); }
      else apply(data.session);
    }).catch(() => {
      if (!active || revision !== initialRevision) return;
      clearTimeout(timer); emit(snapshot("unavailable", null, UNAVAILABLE));
    });
  } catch {
    clearTimeout(timer); emit(snapshot("unavailable", null, UNAVAILABLE));
  }
  return () => { active = false; clearTimeout(timer); unsubscribe(); };
}

async function boundedAuthRequest(
  action: () => PromiseLike<{ error: unknown }>,
  message: string,
  timeoutMs: number,
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve().then(action),
      new Promise<{ error: unknown }>(resolve => { timer = setTimeout(() => resolve({ error: true }), timeoutMs); }),
    ]);
    return result.error ? message : null;
  } catch { return message; }
  finally { clearTimeout(timer); }
}

export function signInWithGoogle(client: AuthClient | null, timeoutMs = 15_000): Promise<string | null> {
  if (!client) return Promise.resolve(UNAVAILABLE);
  return boundedAuthRequest(() => client.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: SITE_URL },
  }), "Google sign-in couldn’t start. Please try again. You can keep playing as a guest.", timeoutMs);
}

export function signOut(client: AuthClient | null, timeoutMs = 15_000): Promise<string | null> {
  if (!client) return Promise.resolve(UNAVAILABLE);
  return boundedAuthRequest(() => client.auth.signOut({ scope: "local" }),
    "Sign out couldn’t finish. Please try again.", timeoutMs);
}
