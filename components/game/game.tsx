"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { GameAction, GameState, Movie, Puzzle, Question } from "@/lib/game/types";
import { gameReducer, initialState } from "@/lib/game/engine";
import { recordResult, readStats } from "@/lib/game/persistence";
import {
  emptyPracticeHistory,
  readPracticeHistory,
  rememberPracticePuzzle,
  writePracticeHistory,
} from "@/lib/game/practice-history";
import { copyText, gameUrl, shareResult, shareText } from "@/lib/game/share";
import { trackEvent } from "@/lib/analytics";
import { trackGameAction } from "@/lib/game/analytics";
import { MovieBoard } from "./movie-board";
import { QuestionPanel } from "./question-panel";

import { HelpDialog, AboutDialog, StatsDialog } from "./info-dialogs";
import { PickDialog, RestartDialog } from "./pick-dialogs";
import { ResultDialog } from "./result-dialog";
import { GameShell } from "./game-shell";
import { createPracticePuzzle } from "@/lib/game/practice-selection";
import { writePracticeProgress } from "@/lib/game/practice-persistence";
import { dismissStrategyHint, shouldShowStrategyHint } from "@/lib/game/onboarding";
import { advanceDailyProgress, dailyProgressKey, readDailyProgress, reconcileDailyProgress } from "@/lib/game/daily-persistence";
import { formatDailyDate } from "@/lib/game/daily-date";

type Sheet = "help" | "about" | "stats" | "restart" | "result" | null;

/** Disabled async controls can lose keyboard focus while a share/copy request is pending. */
function preserveShareFocus() {
  const trigger = document.activeElement;
  const dialog = trigger?.closest("dialog[open]");
  return () => {
    if (!(trigger instanceof HTMLButtonElement) || !dialog ||
        !trigger.closest(".result-share-block")) return;
    window.requestAnimationFrame(() => {
      if (!trigger.isConnected || trigger.disabled ||
          trigger.closest("dialog[open]") !== dialog) return;
      const active = document.activeElement;
      // Respect deliberate focus movement while the platform request was open.
      if (active && active !== trigger && active !== document.body && active !== dialog) return;
      trigger.focus({ preventScroll: true });
    });
  };
}
export function Game({
  initialPuzzle,
  catalogue,
  initialGameState,
  onPracticeChange,
  onDailyChange,
  onModeChange,
  dailyToday,
  onToday,
  hasNextDaily = false,
  hasCurrentDaily = true,
  accountControl,
  onDailyComplete,
  accountResultAction,
}: {
  initialPuzzle: Puzzle;
  catalogue: Movie[];
  initialGameState?: GameState;
  onPracticeChange?: (state: GameState) => void;
  onDailyChange?: (state: GameState) => void;
  onModeChange?: (mode: Puzzle["mode"]) => void;
  dailyToday?: string;
  onToday?: () => void;
  hasNextDaily?: boolean;
  hasCurrentDaily?: boolean;
  accountControl?: ReactNode;
  onDailyComplete?: (state: GameState) => void;
  accountResultAction?: (state: GameState) => {label: string; message: string; onClick: () => void};
}) {
  const daily = initialPuzzle.mode === "daily";
  const [restored] = useState(() => daily ? readDailyProgress(initialPuzzle) : null);
  const [state, setState] = useState(() => daily
    ? reconcileDailyProgress(initialGameState ?? initialState(initialPuzzle), restored!)
    : initialGameState ?? initialState(initialPuzzle));
  const [storageKind, setStorageKind] = useState(() => {
    if (restored && (restored.kind === "missing" || restored.kind === "saved") &&
        (state.history.length > restored.state.history.length ||
         (state.status !== "playing" && restored.state.status === "playing"))) return "unavailable";
    return restored?.kind ?? "missing";
  });
  const [sheet, setSheet] = useState<Sheet>(() => daily && restored?.kind !== "invalid" && state.status !== "playing" ? "result" : null);
  const dailyIsCurrent = !daily || state.puzzle.daily?.date === dailyToday;
  const blocked = daily && storageKind === "invalid";
  const [selected, setSelected] = useState<Movie | null>(null);
  const [departing, setDeparting] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [newLoading, setNewLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [shareFallback, setShareFallback] = useState<{ text: string; label: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [showStrategyHint, setShowStrategyHint] = useState(shouldShowStrategyHint);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionLock = useRef(false);
  const practiceHistory = useRef(emptyPracticeHistory());
  const scrollRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!daily) {
      practiceHistory.current = rememberPracticePuzzle(readPracticeHistory(), initialPuzzle);
      writePracticeHistory(practiceHistory.current);
    }
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        document.getElementById("question-search")?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [initialPuzzle, daily]);
  useEffect(() => {
    if (!daily) onPracticeChange?.(state);
    else if (storageKind !== "invalid") onDailyChange?.(state);
  }, [state, daily, storageKind, onPracticeChange, onDailyChange]);
  useEffect(() => {
    if (!daily || !initialPuzzle.daily) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== dailyProgressKey(initialPuzzle.daily!.date)) return;
      const latest = readDailyProgress(initialPuzzle);
      setStorageKind(latest.kind);
      if (latest.kind === "saved") {
        setState(current => reconcileDailyProgress(current, latest));
        setSelected(null);
        if (latest.state.status !== "playing") setSheet("result");
      } else if (latest.kind === "invalid") {
        setSelected(null); setSheet(null);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [daily, initialPuzzle]);

  const advance = (action: GameAction) => {
    if (blocked) return null;
    if (!daily) {
      const next = gameReducer(state, action);
      if (next !== state) writePracticeProgress(next);
      setState(next);
      return { state: next, accepted: next !== state };
    }
    const result = advanceDailyProgress(state, action);
    setStorageKind(result.kind);
    if (result.kind === "invalid") { setSelected(null); setSheet(null); return null; }
    setState(result.state);
    if (result.state.status !== "playing") {
      setSelected(null); setSheet("result");
    }
    return result;
  };
  const ask = (question: Question, suggested?: true) => {
    if (actionLock.current || state.status !== "playing") return;
    const result = advance({ type: "ask", question, ...(suggested ? {suggested: true as const} : {}) });
    if (!result?.accepted) return;
    const next = result.state;
    trackGameAction(state, next, "ask", catalogue);
    setShowStrategyHint(false);
    dismissStrategyHint();
    actionLock.current = true;
    setBusy(true);
    setDeparting(next.history.at(-1)!.eliminatedIds);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      setDeparting([]); setBusy(false); actionLock.current = false;
    }, reduced ? 50 : 650);
  };
  const guess = () => {
    if (!selected || busy) return;
    const result = advance({ type: "guess", movieId: selected.id });
    if (!result?.accepted) return;
    trackGameAction(state, result.state, "guess", catalogue);
    if (!daily) recordResult(result.state);
    else onDailyComplete?.(result.state);
    setSelected(null);
    setSheet("result");
  };
  const newLineup = async () => {
    if (daily) { onModeChange?.("practice"); return; }
    if (newLoading) return;
    setNewLoading(true);
    setError("");
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const puzzle = createPracticePuzzle(
        catalogue,
        seed,
        "demo",
        practiceHistory.current,
      );
      const fresh = initialState(puzzle);
      writePracticeProgress(fresh);
      practiceHistory.current = rememberPracticePuzzle(
        practiceHistory.current,
        fresh.puzzle,
      );
      writePracticeHistory(practiceHistory.current);
      setState(fresh);
      setDeparting([]);
      setBusy(false);
      actionLock.current = false;
      setSheet(null);
      setSelected(null);
      setShareStatus("");
      setShareFallback(null);
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    } catch {
      setError("The next lineup couldn’t be prepared. Please try again.");
    } finally {
      setNewLoading(false);
    }
  };
  const share = async () => {
    if (shareBusy) return;
    const restoreFocus = preserveShareFocus();
    setShareBusy(true);
    setShareStatus("");
    setShareFallback(null);
    try {
      const result = await shareResult(state);
      if (result === "shared" || result === "copied") trackEvent("share_result", {mode: state.puzzle.mode, share_method: result === "shared" ? "native" : "copy_result"});
      if (result === "manual") {
        setShareFallback({ text: shareText(state), label: "Spoiler-free result to copy" });
        setShareStatus("Automatic sharing isn’t available. Select and copy your result below.");
      } else {
        setShareStatus(result === "copied" ? "Result copied. No spoilers." :
          result === "shared" ? "Result shared." : "Sharing cancelled.");
      }
    } finally {
      setShareBusy(false);
      restoreFocus();
    }
  };
  const copy = async (kind: "result" | "link") => {
    if (shareBusy) return;
    const restoreFocus = preserveShareFocus();
    setShareBusy(true);
    setShareStatus("");
    setShareFallback(null);
    const text = kind === "link" ? gameUrl(state) : shareText(state);
    const label = kind === "link" ? "Game link to copy" : "Spoiler-free result to copy";
    try {
      const result = await copyText(text);
      if (result === "copied") {
        trackEvent("share_result", {mode: state.puzzle.mode, share_method: kind === "link" ? "copy_link" : "copy_result"});
        setShareStatus(kind === "link" ? "Game link copied." : "Result copied. No spoilers.");
      } else {
        setShareFallback({ text, label });
        setShareStatus("Automatic copying isn’t available. Select and copy the text below.");
      }
    } finally {
      setShareBusy(false);
      restoreFocus();
    }
  };
  const openHelp = () => {
    setSheet("help");
    try {
      localStorage.setItem("lineup:help-seen", "true");
    } catch {}
  };
  const stats = sheet === "stats" ? readStats() : null;
  return (
    <GameShell
      mode={state.puzzle.mode}
      onModeChange={onModeChange}
      dailyIsCurrent={dailyIsCurrent}
      accountControl={accountControl}
      onHelp={openHelp}
      onStats={() => setSheet("stats")}
      onAbout={() => setSheet("about")}
    >
      <section className="game-toolbar" aria-label="Game controls">
        <h2>{daily ? `Daily #${String(state.puzzle.daily!.number).padStart(3, "0")}` : "Practice"}</h2>
        {daily ? <time className="daily-date" dateTime={state.puzzle.daily!.date}>{formatDailyDate(state.puzzle.daily!.date)}</time> : <button
          type="button"
          className="text-button"
          onClick={() =>
            state.status === "playing" ? setSheet("restart") : newLineup()
          }
          disabled={newLoading || busy}
        >
          {newLoading ? "Loading…" : "New lineup"}
        </button>}
      </section>
      {daily && !dailyIsCurrent && <div className="daily-notice" role="status">
        <p>{hasCurrentDaily ? `A new Daily is ready. You’re viewing ${formatDailyDate(state.puzzle.daily!.date)}’s lineup. Finish it here, or open the new puzzle.` : `The UK date has changed. You’re viewing ${formatDailyDate(state.puzzle.daily!.date)}’s lineup. No Daily is scheduled today; Practice is available.`}</p>
        {hasCurrentDaily ? <button type="button" className="text-button" onClick={onToday}>Play today’s lineup →</button> : <button type="button" className="text-button" onClick={() => onModeChange?.("practice")}>Play Practice</button>}
      </div>}
      {daily && storageKind === "unavailable" && <p className="daily-storage-note" role="status">Browser storage is unavailable. You can play and switch modes, but Daily progress may not survive a refresh.</p>}
      {blocked && <section className="daily-notice" role="alert">
        <p>Your saved Daily progress couldn’t be read safely. Today’s attempt hasn’t been reset. Practice is still available.</p>
        <button type="button" className="secondary-button" onClick={() => onModeChange?.("practice")}>Play Practice</button>
      </section>}
      {!blocked && <section
        id="lineup"
        tabIndex={-1}
        ref={scrollRef}
        className="game-layout"
        aria-label={daily ? "Daily game" : "Practice game"}
      >
        {daily && state.status !== "playing" ? <aside className="daily-complete" aria-label="Daily complete">
          <h3>{dailyIsCurrent ? "Today’s LINEUP is complete." : "This Daily is complete."}</h3>
          <p>{dailyIsCurrent ? hasNextDaily ? "The next one arrives at midnight UK time." : "You’ve reached the end of the current Daily schedule. Practice is always open." : hasCurrentDaily ? "Today’s new lineup is ready above." : "Practice is available while the Daily schedule is updated."}</p>
          <button type="button" className="secondary-button" onClick={() => setSheet("result")}>View your result</button>
          <button type="button" className="primary-button" onClick={() => onModeChange?.("practice")}>Play Practice</button>
        </aside> : <QuestionPanel
          key={`questions-${state.puzzle.id}`}
          state={state}
          busy={busy}
          onAsk={ask}
          showStrategyHint={showStrategyHint}
        />}
        <MovieBoard
          key={`board-${state.puzzle.id}`}
          movies={state.puzzle.movies}
          activeIds={state.activeIds}
          departingIds={departing}
          onSelect={(m) => {
            if (!busy) setSelected(m);
          }}
          finished={state.status !== "playing"}
          selectedId={selected?.id}
        />
      </section>}
      <div className="board-bottom">
        {!daily && state.status !== "playing" && (
          <button className="text-button" onClick={() => setSheet("result")}>
            View your result
          </button>
        )}
        <a href="#lineup" className="text-button">
          Back to the lineup ↑
        </a>
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state.history.length
          ? `${state.history.at(-1)!.question.label} ${state.history.at(-1)!.answer ? "Yes" : "No"}. ${state.activeIds.length} films still in. ${5 - state.history.length} questions left.`
          : "24 films. 5 questions left."}
      </div>
      {error && !sheet && (
        <div className="toast" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {selected && (
        <PickDialog
          movie={selected}
          onLock={guess}
          onClose={() => setSelected(null)}
        />
      )}
      {sheet === "help" && <HelpDialog onClose={() => setSheet(null)} />}
      {sheet === "about" && <AboutDialog onClose={() => setSheet(null)} />}
      {sheet === "stats" && stats && (
        <StatsDialog stats={stats} onClose={() => setSheet(null)} />
      )}
      {sheet === "restart" && (
        <RestartDialog
          error={error}
          newLoading={newLoading}
          onNew={newLineup}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "result" && (
        <ResultDialog
          state={state}
          dailyReminder={daily && dailyIsCurrent && hasNextDaily ? "Tomorrow’s LINEUP brings a new mystery film at midnight UK time." : undefined}
          error={error}
          newLoading={newLoading}
          shareStatus={shareStatus}
          shareBusy={shareBusy}
          shareFallback={shareFallback}
          onNew={newLineup}
          onShare={share}
          onCopyResult={() => copy("result")}
          onCopyLink={() => copy("link")}
          onClose={() => setSheet(null)}
          accountAction={daily && accountResultAction ? {...accountResultAction(state), onClick: () => { setSheet(null); accountResultAction(state).onClick(); }} : undefined}
        />
      )}
    </GameShell>
  );
}
