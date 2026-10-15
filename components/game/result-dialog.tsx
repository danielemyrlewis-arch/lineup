"use client";
import { Dialog } from "./dialog";
import { ArrowRight, Check, Crosshair, Share2, X } from "lucide-react";
import type { GameState } from "@/lib/game/types";
import { deductionPath } from "@/lib/game/engine";
import { RESULT_COPY, FAILURE_COPY } from "@/lib/game/copy";
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
  const mystery = state.puzzle.movies.find(
    (m) => m.id === state.puzzle.mysteryId,
  )!;
  const won = state.status === "won";
  return (
    <Dialog
      title={won ? "Case closed" : "Case unsolved"}
      onClose={onClose}
      className="result-dialog"
    >
      <div className={`case-stamp ${won ? "solved" : ""}`}>
        {won ? <Check size={14} /> : <X size={14} />}{" "}
        {won ? "CASE CLOSED" : "CASE UNSOLVED"}
      </div>
      <div className="result-film">
        <Poster movie={mystery} eager />
      </div>
      <h2>{won ? RESULT_COPY[state.history.length] : "Case unsolved."}</h2>
      <p className="result-description">
        {won ? (
          <>
            You found <strong>{mystery.title}</strong> in{" "}
            <strong>
              {state.history.length} question
              {state.history.length !== 1 ? "s" : ""}.
            </strong>
          </>
        ) : (
          <>
            The film was <strong>{mystery.title}.</strong>
            <br />
            <span>{FAILURE_COPY}</span>
          </>
        )}
      </p>
      <div
        className="deduction-path"
        aria-label={`Deduction path: ${deductionPath(state).join(", then ")}`}
      >
        {deductionPath(state).map((n, i) => (
          <span key={i}>
            {i > 0 && <ArrowRight size={12} />}
            <b>{n}</b>
          </span>
        ))}
        <ArrowRight size={12} />
        <span className="path-finish">
          {won ? <Crosshair size={20} /> : <X size={20} />}
        </span>
      </div>
      <p className="result-path-label">YOUR DEDUCTION PATH</p>
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
        {newLoading ? "Assembling the lineup…" : "New Lineup"}
        <ArrowRight size={17} />
      </button>
      <button type="button" className="secondary-button" onClick={onShare}>
        <Share2 size={15} /> Share Result
      </button>
      <p className="share-status" role="status">
        {shareStatus || "Keep the mystery. Share the result."}
      </p>
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
