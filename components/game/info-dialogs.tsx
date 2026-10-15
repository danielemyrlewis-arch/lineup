"use client";
import { Dialog } from "./dialog";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Crosshair, Film } from "lucide-react";
import type { PracticeStats } from "@/lib/game/persistence";
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="How to play" onClose={onClose}>
      <div className="modal-icon">
        <Crosshair size={25} />
      </div>
      <div className="eyebrow">THE BRIEFING</div>
      <h2>Find the film.</h2>
      <p className="modal-intro">
        One mystery film is hidden in the lineup.
        <br />
        Your job is to find it.
      </p>
      <ol className="how-steps">
        <li>
          <span>01</span>
          <div>
            <h3>Ask a good question.</h3>
            <p>
              Search for a genre, year, director or actor. Pick a question from
              the list. You get five.
            </p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <h3>Follow the evidence.</h3>
            <p>Get a yes or no. Films that don’t fit are eliminated.</p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <h3>Make your final pick.</h3>
            <p>
              Select a poster and lock it in whenever you’re ready. Fewer
              questions, better detective work.
            </p>
          </div>
        </li>
      </ol>
      <button type="button" className="primary-button" onClick={onClose}>
        Let’s investigate <ArrowRight size={17} />
      </button>
    </Dialog>
  );
}
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About and credits" onClose={onClose}>
      <div className="eyebrow">BEHIND THE LINEUP</div>
      <h2>
        For the love
        <br />
        of film.
      </h2>
      <p className="modal-intro">
        A little deduction game for curious minds and movie lovers. Free
        practice. No account needed.
      </p>
      <div className="about-data">
        <Film size={19} />
        <div>
          <h3>The films & their stories</h3>
          <p>
            Movie metadata and poster artwork are provided by{" "}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noreferrer"
            >
              TMDB <ArrowUpRight size={12} />
            </a>
            .
          </p>
        </div>
      </div>
      <a
        className="tmdb-logo-link"
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noreferrer"
      >
        <Image
          unoptimized
          src="/tmdb.svg"
          alt="The Movie Database"
          width="100"
          height="72"
        />
      </a>
      <p className="tmdb-notice">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <div className="about-note">
        <strong>Practice is just the beginning.</strong>
        <p>Daily lineups, streaks and more cases are on the horizon.</p>
      </div>
    </Dialog>
  );
}
export function StatsDialog({
  onClose,
  stats,
}: {
  onClose: () => void;
  stats: PracticeStats;
}) {
  return (
    <Dialog title="Your practice statistics" onClose={onClose}>
      <div className="eyebrow">YOUR CASE FILE</div>
      <h2>
        Practice makes
        <br />
        perceptive.
      </h2>
      <div className="stat-grid">
        <div>
          <strong>{stats.played}</strong>
          <span>PLAYED</span>
        </div>
        <div>
          <strong>
            {stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%
          </strong>
          <span>SOLVED</span>
        </div>
        <div>
          <strong>
            {stats.won
              ? (
                  stats.distribution.reduce((a, n, i) => a + n * i, 0) /
                  stats.won
                ).toFixed(1)
              : "—"}
          </strong>
          <span>AVG. QUESTIONS</span>
        </div>
      </div>
      <h3 className="stats-title">Questions to close the case</h3>
      <div className="distribution">
        {stats.distribution.map((n, i) => (
          <div key={i}>
            <span>{i}</span>
            <div>
              <span
                style={{
                  width: `${Math.max(n ? 8 : 0, (n / Math.max(1, ...stats.distribution)) * 100)}%`,
                }}
              />
              <b>{n}</b>
            </div>
          </div>
        ))}
      </div>
      <p className="local-note">
        Saved on this browser. Your practice, your pace.
      </p>
    </Dialog>
  );
}
