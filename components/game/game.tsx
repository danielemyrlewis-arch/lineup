"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Movie, Puzzle, Question } from "@/lib/game/types";
import { gameReducer, initialState } from "@/lib/game/engine";
import { recordResult, readStats } from "@/lib/game/persistence";
import {
  emptyPracticeHistory,
  readPracticeHistory,
  rememberPracticePuzzle,
  writePracticeHistory,
} from "@/lib/game/practice-history";
import { copyText, GAME_URL, shareResult, shareText } from "@/lib/game/share";
import { MovieBoard } from "./movie-board";
import { QuestionPanel } from "./question-panel";

import { HelpDialog, AboutDialog, StatsDialog } from "./info-dialogs";
import { PickDialog, RestartDialog } from "./pick-dialogs";
import { ResultDialog } from "./result-dialog";
import { GameShell } from "./game-shell";
import { createPracticePuzzle } from "@/lib/game/practice-selection";
import { dismissStrategyHint, shouldShowStrategyHint } from "@/lib/game/onboarding";

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
}: {
  initialPuzzle: Puzzle;
  catalogue: Movie[];
}) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialPuzzle,
    initialState,
  );
  const [sheet, setSheet] = useState<Sheet>(null);
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
    practiceHistory.current = rememberPracticePuzzle(
      readPracticeHistory(),
      initialPuzzle,
    );
    writePracticeHistory(practiceHistory.current);
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
  }, [initialPuzzle]);
  const ask = (question: Question) => {
    if (actionLock.current || state.status !== "playing") return;
    const next = gameReducer(state, { type: "ask", question });
    if (next === state) return;
    setShowStrategyHint(false);
    dismissStrategyHint();
    actionLock.current = true;
    setBusy(true);
    setDeparting(next.history.at(-1)!.eliminatedIds);
    dispatch({ type: "ask", question });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    timer.current = setTimeout(
      () => {
        setDeparting([]);
        setBusy(false);
        actionLock.current = false;
      },
      reduced ? 50 : 650,
    );
  };
  const guess = () => {
    if (!selected || busy) return;
    dispatch({ type: "guess", movieId: selected.id });
    const next = gameReducer(state, { type: "guess", movieId: selected.id });
    recordResult(next);
    setSelected(null);
    setSheet("result");
  };
  const newLineup = async () => {
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
      practiceHistory.current = rememberPracticePuzzle(
        practiceHistory.current,
        fresh.puzzle,
      );
      writePracticeHistory(practiceHistory.current);
      dispatch({ type: "new", puzzle: fresh.puzzle });
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
    const text = kind === "link" ? GAME_URL : shareText(state);
    const label = kind === "link" ? "Game link to copy" : "Spoiler-free result to copy";
    try {
      const result = await copyText(text);
      if (result === "copied") {
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
      onHelp={openHelp}
      onStats={() => setSheet("stats")}
      onAbout={() => setSheet("about")}
    >
      <section className="game-toolbar" aria-label="Game controls">
        <h2>Practice</h2>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            state.status === "playing" ? setSheet("restart") : newLineup()
          }
          disabled={newLoading || busy}
        >
          {newLoading ? "Loading…" : "New lineup"}
        </button>
      </section>
      <section
        id="lineup"
        tabIndex={-1}
        ref={scrollRef}
        className="game-layout"
        aria-label="Practice game"
      >
        <QuestionPanel
          key={`questions-${state.puzzle.id}`}
          state={state}
          busy={busy}
          onAsk={ask}
          showStrategyHint={showStrategyHint}
        />
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
      </section>
      <div className="board-bottom">
        {state.status !== "playing" && (
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
        />
      )}
    </GameShell>
  );
}
