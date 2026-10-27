"use client";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleClientId } from "@/lib/account/google-script";
import { mountGoogleSignIn, type GoogleSignInState } from "@/lib/account/google-sign-in";

/** Google owns the button and chooser; LINEUP only presents status and an explicit retry. */
export function GoogleSignInButton({client}: {client: SupabaseClient | null}) {
  const host = useRef<HTMLDivElement>(null);
  const connection = useRef<ReturnType<typeof mountGoogleSignIn> | null>(null);
  const [state, setState] = useState<GoogleSignInState>({phase: "loading", error: null});
  const clientId = getGoogleClientId();
  useEffect(() => {
    if (!client || !clientId || !host.current) return;
    const active = mountGoogleSignIn(host.current, client, clientId, setState);
    connection.current = active;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => active.resize());
    observer?.observe(host.current);
    return () => { observer?.disconnect(); active.dispose(); connection.current = null; };
  }, [client, clientId]);
  const unavailable = !client || !clientId;
  const error = unavailable ? "Google sign-in isn’t configured right now. You can keep playing as a guest." : state.error;
  return <div className="google-sign-in">
    <div ref={host} className="google-sign-in-host" aria-label="Google sign-in" />
    {error ? <p className="error-text" role="alert">{error}</p> : state.phase !== "ready" && <p className="account-small" role="status">
      {state.phase === "loading" ? "Loading Google sign-in…" : state.phase === "waiting" ? "Complete sign-in in the Google window." : state.phase === "verifying" ? "Signing in…" : "Signed in."}
    </p>}
    {!unavailable && (state.phase === "error" || state.phase === "waiting") && <button type="button" className="text-button" onClick={() => connection.current?.retry()}>Reload Google sign-in</button>}
  </div>;
}
