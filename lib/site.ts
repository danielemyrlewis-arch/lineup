/** The public static site. Keep shared links and crawler metadata consistent. */
export const SITE_URL = "https://danielemyrlewis-arch.github.io/lineup/";

export const SITE_TITLE = "LINEUP — Free Movie Guessing Game";
export const SITE_DESCRIPTION =
  "Find the mystery film among 24 movies. Ask up to five yes-or-no questions, narrow the lineup and lock in your answer. Play LINEUP free.";

export const SOCIAL_IMAGE = {
  url: new URL("social/lineup-og.png", SITE_URL).href,
  width: 1200,
  height: 630,
  alt: "LINEUP. 24 films. One answer. Five questions to find the film.",
};
