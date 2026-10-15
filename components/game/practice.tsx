"use client";
import { useEffect, useState } from "react";
import type { Movie, Puzzle } from "@/lib/game/types";
import { createPracticePuzzle } from "@/lib/game/practice-selection";
import { readPracticeHistory } from "@/lib/game/practice-history";
import { Game } from "./game";
import { GameShell } from "./game-shell";

/** Load one cacheable static catalogue chunk, then generate every board locally. */
export function Practice() {
  const [session, setSession] = useState<{
    movies: Movie[];
    puzzle: Puzzle;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("@/lib/data/provider")
      .then(({ getCatalogue }) => getCatalogue())
      .then(({ movies, source }) => {
        if (cancelled) return;
        const seed = crypto.getRandomValues(new Uint32Array(1))[0];
        const puzzle = createPracticePuzzle(
          movies,
          seed,
          source,
          readPracticeHistory(),
        );
        setSession({ movies, puzzle });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (session)
    return <Game initialPuzzle={session.puzzle} catalogue={session.movies} />;
  return (
    <GameShell>
      <section className="game-toolbar" aria-label="Game controls">
        <h2>Practice</h2>
        <button className="text-button" disabled>
          New lineup
        </button>
      </section>
      <section className="game-loading" aria-live="polite" aria-busy={!error}>
        <p>
          {error
            ? "The film catalogue couldn’t load. Please reload to try again."
            : "Loading your lineup…"}
        </p>
        {error && (
          <button className="text-button" onClick={() => location.reload()}>
            Reload
          </button>
        )}
      </section>
      <noscript>LINEUP needs JavaScript enabled to play.</noscript>
    </GameShell>
  );
}
