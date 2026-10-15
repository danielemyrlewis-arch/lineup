"use client";
import { Dialog } from "./dialog";
import type { GameState } from "@/lib/game/types";
import { deductionPath } from "@/lib/game/engine";
import { RESULT_COPY } from "@/lib/game/copy";
import { shareText } from "@/lib/game/share";
import { Poster } from "./poster";
export function ResultDialog({
  state,
  error,
  newLoading,
  shareStatus,
  showShareText,
  onNew,
  onShare,
  onClose,
}: {
  state: GameState;
  error: string;
  newLoading: boolean;
  shareStatus: string;
  showShareText: boolean;
  onNew: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const movie = state.puzzle.movies.find(
    (m) => m.id === state.puzzle.mysteryId,
  )!;
  const won = state.status === "won";
  return (
    <Dialog
      title={won ? RESULT_COPY.won : RESULT_COPY.lost}
      onClose={onClose}
      className={`result-dialog ${won ? "result-won" : ""}`}
    >
      <h2>{won ? RESULT_COPY.won : RESULT_COPY.lost}</h2>
      {!won && (
        <p className="result-description">
          The film was <strong>{movie.title}.</strong>
        </p>
      )}
      <div className="result-film">
        <Poster movie={movie} eager />
      </div>
      {won && <h3 className="result-title">{movie.title}</h3>}
      <p className="result-questions">
        {state.history.length} question{state.history.length !== 1 ? "s" : ""}
      </p>
      <p
        className="deduction-path"
        aria-label={`Deduction path: ${deductionPath(state).join(", then ")}`}
      >
        {deductionPath(state).join(" → ")}
      </p>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="primary-button"
        onClick={onNew}
        disabled={newLoading}
      >
        {newLoading ? "Loading…" : "Play again"}
      </button>
      <button type="button" className="secondary-button" onClick={onShare}>
        Share result
      </button>
      {shareStatus && (
        <p className="share-status" role="status">
          {shareStatus}
        </p>
      )}
      {showShareText && (
        <textarea
          className="share-fallback"
          aria-label="Spoiler-free result"
          readOnly
          value={shareText(state)}
          onFocus={(e) => e.target.select()}
        />
      )}
    </Dialog>
  );
}
