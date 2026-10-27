"use client";
import { Dialog } from "./dialog";
import type { GameState } from "@/lib/game/types";
import { deductionPath } from "@/lib/game/engine";
import { RESULT_COPY } from "@/lib/game/copy";
import { dailyResultLabel, questionCount } from "@/lib/game/share";
import { Poster } from "./poster";

export function ResultDialog({
  state,
  error,
  newLoading,
  shareStatus,
  shareBusy,
  shareFallback,
  onNew,
  onShare,
  onCopyResult,
  onCopyLink,
  onClose,
  accountAction,
  dailyReminder,
}: {
  state: GameState;
  error: string;
  newLoading: boolean;
  shareStatus: string;
  shareBusy: boolean;
  shareFallback: { text: string; label: string } | null;
  onNew: () => void;
  onShare: () => void;
  onCopyResult: () => void;
  onCopyLink: () => void;
  onClose: () => void;
  dailyReminder?: string;
  accountAction?: {label: string; message: string; onClick: () => void};
}) {
  const movie = state.puzzle.movies.find(
    (m) => m.id === state.puzzle.mysteryId,
  )!;
  const won = state.status === "won";
  const dailyLabel = dailyResultLabel(state);
  const path = deductionPath(state);
  const remaining = state.activeIds.length;
  return (
    <Dialog
      title={won ? RESULT_COPY.won : RESULT_COPY.lost}
      onClose={onClose}
      className={`result-dialog ${won ? "result-won" : ""}`}
    >
      {dailyLabel && <p className="result-mode">{dailyLabel}</p>}
      <h2>{won ? RESULT_COPY.won : RESULT_COPY.lost}</h2>
      {!won && (
        <p className="result-description">
          The film was <strong>{movie.title}.</strong>
        </p>
      )}
      <div className="result-film-summary">
        <div className="result-film">
          <Poster movie={movie} eager />
        </div>
        <div>
          {won && <h3 className="result-title">{movie.title}</h3>}
          <p className="result-questions">
            {won && !dailyLabel ? `Found in ${questionCount(state)}.` : `${questionCount(state)} used.`}
          </p>
        </div>
      </div>
      <p className="result-path-label">Films remaining after each question</p>
      <ol
        className="deduction-path"
        aria-label={`Films remaining: ${path.join(", then ")}`}
      >
        {path.map((count, i) => (
          <li key={i} className={i === path.length - 1 ? "path-final" : undefined}>
            {i > 0 && <span className="path-connector" aria-hidden="true">→</span>}
            <span className="path-count">{count}</span>
          </li>
        ))}
      </ol>
      {dailyLabel && dailyReminder && <p className="result-context">{dailyReminder}</p>}
      <p className="result-context">
        {won ? "Correct" : "Incorrect"} guess with {remaining} film{remaining === 1 ? "" : "s"} remaining.
      </p>
      {error && <p className="error-text" role="alert">{error}</p>}
      {accountAction && <div className="result-account" aria-live="polite">
        <p>{accountAction.message}</p>
        <button type="button" className="text-button" onClick={accountAction.onClick}>{accountAction.label}</button>
      </div>}
      <button
        type="button"
        className="primary-button"
        onClick={onNew}
        disabled={newLoading || shareBusy}
      >
        {newLoading ? "Preparing…" : dailyLabel ? "Practice" : "Play again"}
      </button>
      <div className="result-share-block">
        <p className="result-invite">Think a friend could do better?</p>
        <button
          type="button"
          className="secondary-button"
          onClick={onShare}
          disabled={shareBusy}
        >
          {shareBusy ? "One moment…" : "Share your result"}
        </button>
        <div className="share-copy-actions">
          <button type="button" onClick={onCopyResult} disabled={shareBusy}>Copy result</button>
          <button type="button" onClick={onCopyLink} disabled={shareBusy}>Copy game link</button>
        </div>
      </div>
      <p className="share-status" role="status" aria-atomic="true">{shareStatus}</p>
      {shareFallback && (
        <textarea
          className="share-fallback"
          aria-label={shareFallback.label}
          readOnly
          value={shareFallback.text}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.currentTarget.select()}
        />
      )}
    </Dialog>
  );
}
