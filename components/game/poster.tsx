"use client";
import { useState } from "react";
import type { Movie } from "@/lib/game/types";
export function Poster({
  movie,
  eager = false,
}: {
  movie: Movie;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src =
    movie.localPoster ??
    (movie.posterPath
      ? `https://image.tmdb.org/t/p/w342${movie.posterPath}`
      : null);
  return (
    <div className="poster-image">
      {src &&
      !failed /* Sized native images keep the same behaviour on Next and the Sites runtime. */ ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          srcSet={
            movie.localPoster || !movie.posterPath
              ? undefined
              : `https://image.tmdb.org/t/p/w185${movie.posterPath} 185w, https://image.tmdb.org/t/p/w342${movie.posterPath} 342w, https://image.tmdb.org/t/p/w500${movie.posterPath} 500w`
          }
          sizes="(max-width: 600px) 30vw, (max-width: 1000px) 20vw, 150px"
          width={342}
          height={513}
          alt={`${movie.title} poster`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="poster-fallback">
          <span>{movie.title}</span>
          <small>Artwork unavailable</small>
        </div>
      )}
    </div>
  );
}
