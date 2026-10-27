/** The public static site. Keep shared links and crawler metadata consistent. */
export const SITE_URL = "https://dailylineup.co.uk/";

export const SITE_TITLE = "LINEUP — Daily Movie Guessing Game | Find the Film";
export const SITE_DESCRIPTION =
  "Play LINEUP, the free daily movie guessing game. Ask up to five yes-or-no questions, narrow a lineup of 24 films and find the mystery movie. New each day.";

export const SOCIAL_IMAGE = {
  url: new URL("social/lineup-og.png", SITE_URL).href,
  width: 1200,
  height: 630,
  alt: "LINEUP. 24 films. One answer. Five questions to find the film.",
};

/** Describes only the game visible on the homepage; no fabricated ratings or offers. */
export const GAME_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": ["VideoGame", "WebApplication"],
  name: "LINEUP",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: SOCIAL_IMAGE.url,
  inLanguage: "en-GB",
  applicationCategory: "GameApplication",
  gamePlatform: "Web browser",
  operatingSystem: "Any",
  browserRequirements: "JavaScript required to play.",
  playMode: "https://schema.org/SinglePlayer",
  isAccessibleForFree: true,
};
