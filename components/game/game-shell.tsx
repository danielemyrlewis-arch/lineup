"use client";
import type { ReactNode } from "react";
export function GameShell({
  children,
  onHelp,
  onStats,
  onAbout,
  mode = "daily",
  onModeChange,
  dailyIsCurrent = true,
}: {
  children: ReactNode;
  onHelp?: () => void;
  onStats?: () => void;
  onAbout?: () => void;
  mode?: "daily" | "practice";
  onModeChange?: (mode: "daily" | "practice") => void;
  dailyIsCurrent?: boolean;
}) {
  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#lineup">
        Skip to the film lineup
      </a>
      <header className="site-header">
        <div className="header-brand">
          <a className="brand" href="#top" aria-label="LINEUP — back to top">
            <span>LINEUP</span>
            <span className="brand-line" aria-hidden="true" />
          </a>
          <span className="brand-tagline">Find the film.</span>
        </div>
        <nav aria-label="Main">
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button type="button" aria-pressed={mode === "daily"} onClick={() => onModeChange?.("daily")} disabled={!onModeChange}>Daily</button>
            <button type="button" aria-pressed={mode === "practice"} onClick={() => onModeChange?.("practice")} disabled={!onModeChange}>Practice</button>
          </div>
          <button
            type="button"
            className="header-help"
            onClick={onHelp}
            disabled={!onHelp}
          >
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
          <p>{mode === "daily" && dailyIsCurrent ? "Five yes-or-no questions. Find today’s film." : "Ask up to five yes-or-no questions. Find the film."}</p>
        </section>
        {children}
      </main>
      <footer className="site-footer">
        <div>
          <p>For the love of film.</p>
          <p className="footer-description">
            A free movie guessing game. Narrow 24 films with up to five questions,
            then make one final guess. A shared Daily, plus unlimited Practice.
          </p>
        </div>
        <div className="footer-links">
          <button type="button" onClick={onHelp} disabled={!onHelp}>
            How to play
          </button>
          <button type="button" onClick={onStats} disabled={!onStats}>
            Practice stats
          </button>
          <button type="button" onClick={onAbout} disabled={!onAbout}>
            About & credits
          </button>
        </div>
      </footer>
    </div>
  );
}
