"use client";
import { Dialog } from "./dialog";
import Image from "next/image";
import { publicAsset } from "@/lib/assets";
import type { PracticeStats } from "@/lib/game/persistence";
import { HowToPlay } from "./how-to-play";
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="How to play" className="help-dialog" onClose={onClose}>
      <HowToPlay />
      <button type="button" className="primary-button" onClick={onClose}>
        Let’s play
      </button>
    </Dialog>
  );
}
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About and credits" onClose={onClose}>
      <h2>For the love of film.</h2>
      <p className="modal-intro">
        A movie deduction game. Free practice. No account needed.
      </p>
      <div className="about-data">
        <h3>The films</h3>
        <p>
          Movie metadata and poster artwork are provided by{" "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
            TMDB
          </a>
          .
        </p>
        <p>
          Best Picture records cover the 2026 ceremony. Other Oscar records have
          separate verified coverage. Data from{" "}
          <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">
            Wikidata
          </a>{" "}
          (CC0) and{" "}
          <a href="https://github.com/delventhalz/json-nominations" target="_blank" rel="noreferrer">
            JSON Nominations
          </a>{" "}
          by Zac Delventhal.{" "}
          <a href={publicAsset("/licenses/oscar-source.txt")}>Source and licence</a>.
        </p>
      </div>
      <a
        className="tmdb-logo-link"
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noreferrer"
      >
        <Image
          unoptimized
          src={publicAsset("/tmdb.svg")}
          alt="The Movie Database"
          width="100"
          height="72"
        />
      </a>
      <p className="tmdb-notice">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
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
      <h2>Your practice.</h2>
      <div className="stat-grid">
        <div>
          <strong>{stats.played}</strong>
          <span>Played</span>
        </div>
        <div>
          <strong>
            {stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%
          </strong>
          <span>Won</span>
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
          <span>Avg. questions</span>
        </div>
      </div>
      <h3 className="stats-title">Wins by questions used</h3>
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
      <p className="local-note">Saved on this browser.</p>
    </Dialog>
  );
}
