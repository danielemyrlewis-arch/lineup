"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Movie } from "@/lib/game/types";
import { Poster } from "./poster";
export function MovieBoard({
  movies,
  activeIds,
  departingIds,
  onSelect,
  finished,
  selectedId,
}: {
  movies: Movie[];
  activeIds: string[];
  departingIds: string[];
  onSelect: (m: Movie) => void;
  finished: boolean;
  selectedId?: string;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, DOMRect>());
  const displayed = movies.filter(
    (m) => activeIds.includes(m.id) || departingIds.includes(m.id),
  );
  const isExpanded = expanded ?? movies.length - activeIds.length < 4;
  const eliminated = movies.filter(
    (m) => !activeIds.includes(m.id) && !departingIds.includes(m.id),
  );
  useLayoutEffect(() => {
    const cards =
      gridRef.current?.querySelectorAll<HTMLElement>("[data-movie]");
    const next = new Map<string, DOMRect>();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    cards?.forEach((card) => {
      const id = card.dataset.movie!;
      const rect = card.getBoundingClientRect();
      const previous = positions.current.get(id);
      if (previous && !reduced) {
        const dx = previous.left - rect.left,
          dy = previous.top - rect.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
          card.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 340, easing: "cubic-bezier(.2,.7,.2,1)" },
          );
      }
      next.set(id, rect);
    });
    positions.current = next;
  }, [activeIds, departingIds]);
  return (
    <section className="board" aria-label="Film lineup">
      <div className="board-heading">
        <h2>
          <strong>{activeIds.length}</strong> still in
        </h2>
        <span className="board-hint">Select a film to lock it in</span>
      </div>
      <div className="movie-grid" ref={gridRef}>
        {displayed.map((movie, i) => {
          const departing = departingIds.includes(movie.id);
          return (
            <button
              type="button"
              key={movie.id}
              data-movie={movie.id}
              className={`movie-card ${departing ? "departing" : ""} ${selectedId === movie.id ? "selected" : ""}`}
              disabled={departing || finished}
              aria-label={
                departing
                  ? `${movie.title}, eliminated`
                  : `Choose ${movie.title}, ${movie.releaseYear ?? "year unknown"}`
              }
              aria-haspopup="dialog"
              onClick={() => onSelect(movie)}
            >
              <div className="poster-frame">
                <Poster movie={movie} eager={i < 6} />
                {departing && (
                  <span className="eliminated-mark">
                    <X size={26} />
                    <span>Eliminated</span>
                  </span>
                )}
              </div>
              <div className="movie-details">
                <h3 title={movie.title}>{movie.title}</h3>
                <span>{movie.releaseYear ?? "—"}</span>
              </div>
            </button>
          );
        })}
      </div>
      {eliminated.length > 0 && (
        <section className="eliminated-section" aria-label="Eliminated films">
          <button
            type="button"
            className="eliminated-toggle"
            aria-expanded={isExpanded}
            aria-controls="eliminated-grid"
            onClick={() => setExpanded(!isExpanded)}
          >
            <span>
              <X size={14} />
              <strong>{eliminated.length}</strong> Eliminated
            </span>
            <span>
              {isExpanded ? "Hide films" : "Show films"}
              <ChevronDown size={16} className={isExpanded ? "rotated" : ""} />
            </span>
          </button>
          {isExpanded && (
            <div id="eliminated-grid" className="movie-grid eliminated-grid">
              {eliminated.map((movie) => (
                <div className="movie-card eliminated-card" key={movie.id}>
                  <div className="poster-frame">
                    <Poster movie={movie} />
                    <span className="eliminated-mark">
                      <X size={22} />
                      <span>Eliminated</span>
                    </span>
                  </div>
                  <div className="movie-details">
                    <h3 title={movie.title}>{movie.title}</h3>
                    <span>{movie.releaseYear ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
