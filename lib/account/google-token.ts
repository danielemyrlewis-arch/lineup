import type { SupabaseClient } from "@supabase/supabase-js";

export interface GoogleNonce {
  readonly raw: string;
  readonly hashed: string;
}
export interface GoogleCredentialOutcome {
  status: "signed-in" | "error" | "ignored";
  error: string | null;
}
export interface GoogleCredentialAttempt {
  consume(response: unknown): Promise<GoogleCredentialOutcome>;
  cancel(): void;
  isConsumed(): boolean;
}
type AuthClient = Pick<SupabaseClient, "auth">;
const FAILED = "Google sign-in couldn’t finish. Please try again. You can keep playing as a guest.";
const EXPIRED = "This sign-in attempt has expired. Please try again.";
const INVALID = "Google didn’t return a usable sign-in credential. Please try again.";
const TIMED_OUT = "Sign-in is taking longer than expected. Check your account status before trying again; guest play is still available.";
const ignored = (): GoogleCredentialOutcome => ({status: "ignored", error: null});
const error = (message: string): GoogleCredentialOutcome => ({status: "error", error: message});

/** Keep both values in memory: SHA-256 hex goes to Google, raw nonce to Supabase. */
export async function generateGoogleNonce(cryptoApi: Crypto = globalThis.crypto): Promise<GoogleNonce> {
  if (!cryptoApi?.getRandomValues || !cryptoApi.subtle?.digest)
    throw new Error("Secure Google sign-in is unavailable in this browser.");
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return {raw, hashed};
}

/**
 * One terminal callback per nonce. Supabase performs token/nonce verification;
 * the browser never decodes the token or treats its claims as authentication.
 */
export function createGoogleCredentialAttempt(
  client: AuthClient,
  nonce: GoogleNonce,
  {now = () => Date.now(), ttlMs = 5 * 60_000, timeoutMs = 15_000}: {
    now?: () => number;
    ttlMs?: number;
    timeoutMs?: number;
  } = {},
): GoogleCredentialAttempt {
  const createdAt = now();
  let consumed = false;
  let cancelled = false;
  return {
    isConsumed: () => consumed,
    cancel: () => { cancelled = true; consumed = true; },
    async consume(response) {
      if (consumed || cancelled) return ignored();
      // Lock synchronously, before any asynchronous work or duplicate callback.
      consumed = true;
      const age = now() - createdAt;
      if (!Number.isFinite(age) || age < 0 || !Number.isFinite(ttlMs) || ttlMs <= 0 || age >= ttlMs) return error(EXPIRED);
      const credential = typeof response === "object" && response !== null && "credential" in response
        ? response.credential : null;
      if (typeof credential !== "string" || credential.length === 0 || credential.length > 16_000 || credential.trim() !== credential ||
          typeof nonce.raw !== "string" || nonce.raw.length < 32 || nonce.raw.length > 512 || !/^[A-Za-z0-9+/_=-]+$/.test(nonce.raw) ||
          !/^[a-f0-9]{64}$/.test(nonce.hashed)) return error(INVALID);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      try {
        const result = await Promise.race([
          Promise.resolve().then(() => client.auth.signInWithIdToken({provider: "google", token: credential, nonce: nonce.raw})),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { timedOut = true; reject(new Error("Google sign-in timeout")); }, timeoutMs);
          }),
        ]);
        if (cancelled) return ignored();
        if (result.error || !result.data?.user?.id || !result.data.session?.user?.id ||
            result.data.user.id !== result.data.session.user.id) return error(FAILED);
        return {status: "signed-in", error: null};
      } catch {
        return cancelled ? ignored() : error(timedOut ? TIMED_OUT : FAILED);
      } finally { clearTimeout(timer); }
      // A timeout/cancel cannot abort the SDK's in-flight network request. A late
      // authenticated session can still arrive through the existing auth observer.
    },
  };
}
