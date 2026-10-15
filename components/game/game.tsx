"use client";
import Link from "next/link";
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
import { shareResult } from "@/lib/game/share";
import { MovieBoard } from "./movie-board";
import { QuestionPanel } from "./question-panel";

import { HelpDialog, AboutDialog, StatsDialog } from "./info-dialogs";
import { PickDialog, RestartDialog } from "./pick-dialogs";
import { ResultDialog } from "./result-dialog";

type Sheet = "help" | "about" | "stats" | "restart" | "result" | null;
export function Game({ initialPuzzle }: { initialPuzzle: Puzzle }) {
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
  const [showShareText, setShowShareText] = useState(false);
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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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
      const r = await fetch("/api/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(practiceHistory.current),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      });
      if (!r.ok)
        throw new Error("The next lineup couldn’t load. Please try again.");
      const puzzle: Puzzle = await r.json();
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
      setShowShareText(false);
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    } catch {
      setError(
        "The next lineup couldn’t load. Check your connection and try again.",
      );
    } finally {
      setNewLoading(false);
    }
  };
  const share = async () => {
    try {
      const result = await shareResult(state);
      setShareStatus(
        result === "copied"
          ? "Result copied. No spoilers."
          : result === "shared"
            ? "Result shared."
            : "",
      );
    } catch {
      setShowShareText(true);
      setShareStatus("Copy your spoiler-free result below.");
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
    <div className="app-shell">
      <a className="skip-link" href="#lineup">
        Skip to the film lineup
      </a>
      <header className="site-header">
        <div className="header-brand">
          <Link className="brand" href="/" aria-label="LINEUP home">
            <span>LINEUP</span>
            <span className="brand-line" aria-hidden="true" />
          </Link>
          <span className="brand-tagline">Find the film.</span>
        </div>
        <nav aria-label="Main">
          <span className="practice-tab">Practice</span>
          <button type="button" className="header-help" onClick={openHelp}>
            How to play
          </button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <h1>
            24 films.
            <br />
            <span>One answer.</span>
          </h1>
          <p>Ask up to five questions. Find the film.</p>
        </section>
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
          ref={scrollRef}
          className="game-layout"
          aria-label="Practice game"
        >
          <QuestionPanel
            key={`questions-${state.puzzle.id}`}
            state={state}
            busy={busy}
            onAsk={ask}
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
      </main>
      <footer className="site-footer">
        <p>For the love of film.</p>
        <div className="footer-links">
          <button type="button" onClick={() => setSheet("stats")}>
            Practice stats
          </button>
          <button type="button" onClick={() => setSheet("about")}>
            About & credits
          </button>
        </div>
      </footer>
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
          showShareText={showShareText}
          onNew={newLineup}
          onShare={share}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
