"use client";
import { Dialog } from "./dialog";
import { ArrowRight, Crosshair, RotateCcw } from "lucide-react";
import type { Movie } from "@/lib/game/types";
import { Poster } from "./poster";
export function PickDialog({
  movie,
  onLock,
  onClose,
}: {
  movie: Movie;
  onLock: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={`Lock in ${movie.title}?`}
      onClose={onClose}
      className="confirm-dialog"
    >
      <div className="confirm-poster">
        <Poster movie={movie} eager />
      </div>
      <div className="eyebrow">YOUR FINAL PICK</div>
      <h2>
        Lock in
        <br />
        <span>{movie.title}?</span>
      </h2>
      <p>
        {movie.releaseYear} <span>·</span>{" "}
        {movie.director ?? "The mystery is yours to solve."}
      </p>
      <p className="confirm-note">One pick. Make it yours.</p>
      <button type="button" className="primary-button" onClick={onLock}>
        Lock it in <Crosshair size={17} />
      </button>
      <button type="button" className="secondary-button" onClick={onClose}>
        Keep investigating
      </button>
    </Dialog>
  );
}
export function RestartDialog({
  onClose,
  onNew,
  error,
  newLoading,
}: {
  onClose: () => void;
  onNew: () => void;
  error: string;
  newLoading: boolean;
}) {
  return (
    <Dialog title="Start a new lineup?" onClose={onClose}>
      <div className="modal-icon">
        <RotateCcw size={24} />
      </div>
      <div className="eyebrow">A FRESH CASE</div>
      <h2>New lineup?</h2>
      <p className="modal-intro">
        A new cast of suspects. A new mystery film. Your current investigation
        will be left behind.
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
        {newLoading ? "Assembling the lineup…" : "New Lineup"}
        <ArrowRight size={17} />
      </button>
      <button type="button" className="secondary-button" onClick={onClose}>
        Keep investigating
      </button>
    </Dialog>
  );
}
