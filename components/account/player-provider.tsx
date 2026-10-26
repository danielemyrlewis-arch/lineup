"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UserRound } from "lucide-react";
import type { GameState } from "@/lib/game/types";
import { getBrowserClient, hasPersistentAuthStorage } from "@/lib/account/client";
import { oauthErrorFromUrl, signInWithGoogle, signOut, watchAuth, type AuthSnapshot } from "@/lib/account/auth";
import { completedDailyResult, type CompletedDailyResult, type DailyResult } from "@/lib/account/results";
import { loadDailyResults, saveDailyResult, type SaveStatus } from "@/lib/account/repository";
import { pendingGuestResult, readGuestResults, rememberGuestResult, writeGuestResults } from "@/lib/account/guest-results";
import { AccountPanel } from "./account-panel";

export interface AccountResultAction { label: string; message: string; onClick: () => void }
interface PlayerAccount {
  status: AuthSnapshot["status"];
  open: () => void;
  observeDaily: (state: GameState) => void;
  completeDaily: (state: GameState) => void;
  resultAction: (state: GameState) => AccountResultAction;
}
const noAccount: PlayerAccount = {
  status: "signed-out", open: () => {}, observeDaily: () => {}, completeDaily: () => {},
  resultAction: () => ({label: "Sign in to save your result", message: "Optional. Daily and Practice are always free to play.", onClick: () => {}}),
};
const PlayerContext = createContext<PlayerAccount>(noAccount);
export const usePlayerAccount = () => useContext(PlayerContext);

export function AccountControl() {
  const player = usePlayerAccount();
  return <button type="button" className="header-account" onClick={player.open} title={player.status === "signed-in" ? "Account and Daily statistics" : "Sign in to LINEUP"} aria-label={player.status === "signed-in" ? "Account and Daily statistics" : "Sign in to LINEUP"}>
    <UserRound size={17} aria-hidden="true" />
    <span className="account-control-label">{player.status === "signed-in" ? "Account" : "Sign in"}</span>
  </button>;
}

/** Accounts observe the game; no network request is awaited by a game action. */
export function PlayerProvider({children}: {children: ReactNode}) {
  const [auth, setAuth] = useState<AuthSnapshot>({status: "loading", user: null, error: null});
  const authRef = useRef(auth);
  const client = useRef<SupabaseClient | null>(null);
  const [open, setOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [authRetry, setAuthRetry] = useState(0);
  const [guests, setGuests] = useState<CompletedDailyResult[]>(readGuestResults);
  const guestsRef = useRef(guests);
  const [loaded, setLoaded] = useState<{owner: string | null; results: DailyResult[]; loading: boolean; error: string | null}>({owner: null, results: [], loading: false, error: null});
  const [resultsRetry, setResultsRetry] = useState(0);
  const [saving, setSaving] = useState<{owner: string | null; puzzleId: string | null; status: SaveStatus; error: string | null}>({owner: null, puzzleId: null, status: "idle", error: null});
  const request = useRef(0);
  const authGeneration = useRef(0);
  const saveInFlight = useRef(false);
  const userId = auth.status === "signed-in" ? auth.user?.id ?? null : null;

  useEffect(() => {
    const oauthError = oauthErrorFromUrl(window.location.href);
    let showCallback = oauthError || new URL(window.location.href).searchParams.has("code");
    client.current = getBrowserClient();
    return watchAuth(client.current, next => {
      // Updating this ref in the subscription also guards pending requests before a render.
      if (authRef.current.user?.id !== next.user?.id) {
        authGeneration.current++;
        request.current++;
        saveInFlight.current = false;
        setOperationError(null); setAuthBusy(false);
      }
      authRef.current = next;
      setAuth(next);
      if (showCallback && next.status !== "loading") {
        // Return the player to the optional save offer after the OAuth round trip.
        showCallback = false;
        setOpen(true);
      }
    }, {oauthError});
  }, [authRetry]);

  useEffect(() => {
    if (!userId || !client.current) return;
    let active = true;
    setLoaded({owner: userId, results: [], loading: true, error: null});
    loadDailyResults(client.current, userId).then(result => {
      if (active && authRef.current.user?.id === userId)
        setLoaded({owner: userId, results: result.results, loading: false, error: result.error});
    });
    return () => { active = false; };
  }, [userId, resultsRetry]);

  const remember = useCallback((state: GameState): CompletedDailyResult | null => {
    const existing = guestsRef.current.find(row => row.puzzle_id === state.puzzle.id);
    const result = completedDailyResult(state, existing?.completed_at);
    if (!result) return null;
    const next = rememberGuestResult(guestsRef.current, result);
    if (next !== guestsRef.current) {
      guestsRef.current = next;
      writeGuestResults(next);
      setGuests(next);
    }
    return existing ?? result;
  }, []);

  const save = useCallback(async (result: CompletedDailyResult) => {
    const owner = authRef.current.status === "signed-in" ? authRef.current.user?.id : null;
    if (!owner || !client.current || saveInFlight.current) return;
    const ticket = ++request.current;
    saveInFlight.current = true;
    setSaving({owner, puzzleId: result.puzzle_id, status: "saving", error: null});
    const outcome = await saveDailyResult(client.current, {user_id: owner, ...result});
    if (ticket !== request.current || authRef.current.user?.id !== owner) return;
    saveInFlight.current = false;
    setSaving({owner, puzzleId: result.puzzle_id, ...outcome});
    if (outcome.status !== "error") {
      const next = guestsRef.current.filter(row => row.puzzle_id !== result.puzzle_id);
      guestsRef.current = next; setGuests(next); writeGuestResults(next);
      setResultsRetry(value => value + 1);
    }
  }, []);

  const completeDaily = useCallback((state: GameState) => {
    const result = remember(state);
    // Only a new final guess made while signed in uploads automatically.
    // Restored/guest results are offered explicitly in Account instead.
    if (result && authRef.current.status === "signed-in") void save(result);
  }, [remember, save]);
  const observeDaily = useCallback((state: GameState) => { remember(state); }, [remember]);
  const showAccount = useCallback(() => { setOperationError(null); setOpen(true); }, []);

  const resultAction = useCallback((state: GameState): AccountResultAction => {
    const ownSave = saving.owner === userId && saving.puzzleId === state.puzzle.id ? saving : null;
    const message = auth.status !== "signed-in" ? "Optional. Keep your Daily results with a free account."
      : ownSave?.status === "saving" ? "Saving your Daily result…"
      : ownSave?.status === "saved" ? "Saved to your account."
      : ownSave?.status === "duplicate" ? "Your account already has this Daily result. It hasn’t been replaced."
      : ownSave?.error ?? "Your result is available in this browser. View account statistics or save this result.";
    return {label: auth.status === "signed-in" ? "Account & Daily statistics" : "Sign in to save your result", message, onClick: showAccount};
  }, [auth.status, saving, showAccount, userId]);

  // Owner checks prevent a previous account's private data flashing after a user change.
  const results = userId && loaded.owner === userId ? loaded.results : [];
  const resultsLoading = !!userId && (loaded.owner !== userId || loaded.loading);
  const resultsError = loaded.owner === userId ? loaded.error : null;
  const ownSaving = saving.owner === userId ? saving : null;
  const pending = pendingGuestResult(guests, results);
  const value = useMemo(() => ({status: auth.status, open: showAccount, observeDaily, completeDaily, resultAction}), [auth.status, showAccount, observeDaily, completeDaily, resultAction]);
  const identity = auth.user ? {
    name: typeof auth.user.user_metadata?.full_name === "string" ? auth.user.user_metadata.full_name : "LINEUP player",
    email: auth.user.email ?? null,
  } : null;

  return <PlayerContext.Provider value={value}>
    {children}
    {open && <AccountPanel status={auth.status} user={identity}
      error={operationError ?? auth.error ?? (!hasPersistentAuthStorage() ? "Browser storage is restricted. Your sign-in may not survive closing this page." : null)}
      authBusy={authBusy} resultsLoading={resultsLoading} resultsError={resultsError} results={results}
      pending={pending} saveStatus={ownSaving?.status ?? "idle"} saveError={ownSaving?.error ?? null}
      onClose={() => setOpen(false)}
      onSignIn={() => {
        if (authBusy) return;
        const generation = authGeneration.current;
        setAuthBusy(true); setOperationError(null);
        signInWithGoogle(client.current).then(error => { if (generation === authGeneration.current) { setOperationError(error); setAuthBusy(false); } });
      }}
      onSignOut={() => {
        if (authBusy || authRef.current.user?.id !== userId) return;
        const generation = authGeneration.current;
        setAuthBusy(true); setOperationError(null);
        signOut(client.current).then(error => {
          if (generation !== authGeneration.current) return;
          setOperationError(error); setAuthBusy(false);
          if (!error) { const next: AuthSnapshot = {status: "signed-out", user: null, error: null}; authRef.current = next; setAuth(next); request.current++; saveInFlight.current = false; }
        });
      }}
      onRetry={() => { setOperationError(null); if (auth.status === "unavailable") setAuthRetry(value => value + 1); else setResultsRetry(value => value + 1); }}
      onSaveGuest={() => { if (pending && userId && authRef.current.user?.id === userId) void save(pending); }}
    />}
  </PlayerContext.Provider>;
}
