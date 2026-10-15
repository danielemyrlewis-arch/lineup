"use client";
import { Dialog } from "./dialog";
import type { Movie } from "@/lib/game/types";
import { Poster } from "./poster";
import { FilmDetails } from "./film-details";
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
      <div className="confirm-film">
        <div className="confirm-poster">
          <Poster movie={movie} eager />
        </div>
        <FilmDetails movie={movie} />
      </div>
      <p className="confirm-note">This will be your final answer.</p>
      <button type="button" className="primary-button" onClick={onLock}>
        Lock it in
      </button>
      <button type="button" className="secondary-button" onClick={onClose}>
        Cancel
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
      <h2>New lineup?</h2>
      <p className="modal-intro">
        Start again with 24 films and five questions. Your current game will
        end.
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
        {newLoading ? "Loading…" : "New lineup"}
      </button>
      <button type="button" className="secondary-button" onClick={onClose}>
        Cancel
      </button>
    </Dialog>
  );
}
