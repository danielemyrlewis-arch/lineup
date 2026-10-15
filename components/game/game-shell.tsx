"use client";
import Link from "next/link";
import type { ReactNode } from "react";
export function GameShell({
  children,
  onHelp,
  onStats,
  onAbout,
}: {
  children: ReactNode;
  onHelp?: () => void;
  onStats?: () => void;
  onAbout?: () => void;
}) {
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
          <p>Ask up to five questions. Find the film.</p>
        </section>
        {children}
      </main>
      <footer className="site-footer">
        <p>For the love of film.</p>
        <div className="footer-links">
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
