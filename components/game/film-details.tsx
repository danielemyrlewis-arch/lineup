"use client";
import { useState } from "react";
import type { Movie } from "../../lib/game/types";
import { oscarSummary } from "../../lib/data/awards";

/** Presentation only: all details already belong to the prepared puzzle. */
export function FilmDetails({ movie }: { movie: Movie }) {
  const cast = movie.castMembers
    ?.filter((member) => member.name.trim())
    .slice(0, 10);
  const genres = movie.genres?.slice(0, 3);
  const awards = oscarSummary(movie.oscars);
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
        {awards && <p className="film-credit" aria-label="Academy Awards">{awards}</p>}
        {movie.overview?.trim() && (
          <p className="confirm-synopsis">{movie.overview}</p>
        )}
      </div>
      {!!cast?.length && (
        <section className="film-cast" aria-label="Cast">
          <h3>Cast</h3>
          <ul className="film-cast-list">
            {cast.map((member, index) => (
              <li key={`${member.tmdbId ?? member.name}-${index}`}>
                {member.profilePath && (
                  <CastPortrait path={member.profilePath} />
                )}
                <div>
                  <p className="cast-name">{member.name}</p>
                  {member.character && (
                    <p className="cast-character">{member.character}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CastPortrait({ path }: { path: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !/^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(path)) return null;
  return (
    // Sized native images work in both supported runtimes; failed images disappear.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="cast-portrait"
      src={`https://image.tmdb.org/t/p/w185${path}`}
      width={48}
      height={48}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
