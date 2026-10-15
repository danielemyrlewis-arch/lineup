import type { Movie } from "../../lib/game/types";

/** Presentation only: all details already belong to the prepared puzzle. */
export function FilmDetails({ movie }: { movie: Movie }) {
  const actor =
    movie.topBilledLead === undefined
      ? movie.cast?.[0]
      : movie.topBilledLead?.name;
  const character = movie.topBilledLead?.character;
  const genres = movie.genres?.slice(0, 3);
  return (
    <>
      <div className="confirm-summary">
        <h2>{movie.title}</h2>
        {movie.releaseYear != null && (
          <p className="film-credit">{movie.releaseYear}</p>
        )}
        {!!genres?.length && (
          <p className="confirm-genres">{genres.join(" • ")}</p>
        )}
      </div>
      <div className="confirm-details">
        {movie.director && <p>Directed by {movie.director}</p>}
        {actor && (
          <p>
            Starring {actor}
            {character && <> as {character}</>}
          </p>
        )}
        {movie.overview?.trim() && (
          <p className="confirm-synopsis">{movie.overview}</p>
        )}
      </div>
    </>
  );
}
