import { LINEUP_SIZE, seededRandom } from "./engine.ts";
import { validQuestions } from "./questions.ts";
import {
  eligiblePracticeMovie,
  type RecognitionTier,
} from "./practice-eligibility.ts";
import {
  emptyPracticeHistory,
  sanitisePracticeHistory,
  STRONG_COOLDOWN_BOARDS,
  type PracticeHistory,
} from "./practice-history.ts";
import type { Movie, Puzzle } from "./types.ts";

// TMDB splits these universes across separate collections. Group them only for selection.
const MCU_IDS = new Set([
  1726, 1724, 10138, 10195, 1771, 24428, 68721, 76338, 100402, 118340, 99861,
  102899, 271110, 284052, 283995, 315635, 284053, 284054, 299536, 363088,
  299537, 299534, 429617, 497698, 566525, 524434, 634649, 453395, 616037,
  505642, 640146, 447365, 609681, 533535, 822119, 986056,
]);
const titleKey = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function franchiseKeys(movie: Movie): string[] {
  const keys: string[] = [];
  if (MCU_IDS.has(movie.tmdbId)) keys.push("marvel-cinematic-universe");
  const name = movie.collectionName ?? "";
  if (/middle.earth|lord of the rings|hobbit/i.test(name + " " + movie.title))
    keys.push("middle-earth");
  if (/harry potter|fantastic beasts/i.test(name + " " + movie.title))
    keys.push("wizarding-world");
  if (movie.franchiseKey) keys.push(movie.franchiseKey);
  // Match live records to the name-only historical snapshot as well as each
  // other by ID. Keep both universe and series keys (e.g. MCU + Deadpool).
  if (name) keys.push(`collection-name-${titleKey(name)}`);
  if (movie.collectionId) keys.push(`collection-${movie.collectionId}`);
  return [...new Set(keys)];
}
export function franchiseKey(movie: Movie): string | null {
  return franchiseKeys(movie)[0] ?? null;
}
const decade = (movie: Movie) =>
  String(Math.floor(movie.releaseYear! / 10) * 10);
const increment = (counts: Map<string, number>, keys: string[]) => {
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
};
export function practiceQuestionQuality(movies: Movie[]) {
  const questions = validQuestions(movies);
  const balanced = questions.filter(
    (q) => Math.min(q.yesCount, q.noCount) >= 4,
  );
  const partitions = new Set(balanced.map((q) => q.partitionKey)).size;
  const categories = new Set(questions.map((q) => q.category)).size;
  const balancedCategories = new Set(balanced.map((q) => q.category)).size;
  return {
    valid: questions.length,
    balancedPartitions: partitions,
    categories,
    balancedCategories,
    healthy: partitions >= 6 && categories >= 4 && balancedCategories >= 3,
    score: Math.min(partitions, 12) + categories * 2 + balancedCategories * 3,
  };
}

function chooseBoard(
  pool: Movie[],
  rng: () => number,
  history: PracticeHistory,
): Movie[] {
  const recent = new Set(history.boards.flat());
  const veryRecent = new Set(
    history.boards.slice(0, STRONG_COOLDOWN_BOARDS).flat(),
  );
  const answers = new Set(history.mysteries);
  const remaining = new Map(pool.map((m) => [m.tmdbId, m]));
  const movies: Movie[] = [];
  const families = new Set<string>(),
    titles = new Set<string>();
  const decades = new Map<string, number>(),
    genres = new Map<string, number>(),
    directors = new Map<string, number>(),
    cast = new Map<string, number>(),
    languages = new Map<string, number>(),
    countries = new Map<string, number>(),
    formats = new Map<string, number>(),
    collections = new Map<string, number>();
  const weight = (m: Movie) => {
    let w = veryRecent.has(m.tmdbId) ? 0.002 : recent.has(m.tmdbId) ? 0.035 : 1;
    if (answers.has(m.tmdbId)) w *= 0.005;
    w /= (1 + (decades.get(decade(m)) ?? 0)) ** 1.6;
    w *=
      (m.genres ?? []).reduce(
        (sum, g) => sum + (1 + (genres.get(g) ?? 0)) ** -0.8,
        0,
      ) / m.genres!.length;
    w /= (1 + (directors.get(m.director ?? "") ?? 0)) ** 2;
    w /=
      (1 + Math.max(0, ...(m.cast ?? []).map((c) => cast.get(c) ?? 0))) ** 1.3;
    w /= (1 + (languages.get(m.originalLanguage ?? "") ?? 0)) ** 0.65;
    w *=
      (m.productionCountries ?? []).reduce(
        (sum, c) => sum + (1 + (countries.get(c) ?? 0)) ** -0.3,
        0,
      ) / (m.productionCountries?.length || 1) || 0.7;
    w /=
      (1 + (formats.get(String(m.genres?.includes("Animation"))) ?? 0)) ** 0.4;
    w /= (1 + (collections.get(String(m.belongsToCollection)) ?? 0)) ** 0.3;
    for (const metadata of [
      m.director,
      m.cast?.length,
      m.originalLanguage,
      m.productionCountries?.length,
      m.belongsToCollection !== null,
    ])
      if (!metadata) w *= 0.7;
    // Modest confidence preference, never a top-popularity ranking.
    w *= Math.log10(10 + m.voteCount) ** 0.3;
    return w;
  };
  while (movies.length < LINEUP_SIZE) {
    const available = [...remaining.values()];
    // Prefer one representative per family/title. Relax only if the pool cannot fill the board.
    const different = available.filter(
      (m) =>
        !titles.has(titleKey(m.title)) &&
        !franchiseKeys(m).some((key) => families.has(key)),
    );
    const choices = different.length ? different : available;
    const weighted = choices.map((movie) => ({ movie, weight: weight(movie) }));
    let target = rng() * weighted.reduce((sum, x) => sum + x.weight, 0);
    const chosen =
      weighted.find((x) => (target -= x.weight) < 0)?.movie ?? choices.at(-1)!;
    movies.push(chosen);
    remaining.delete(chosen.tmdbId);
    titles.add(titleKey(chosen.title));
    for (const family of franchiseKeys(chosen)) families.add(family);
    increment(decades, [decade(chosen)]);
    increment(genres, chosen.genres ?? []);
    increment(directors, chosen.director ? [chosen.director] : []);
    increment(cast, chosen.cast ?? []);
    increment(
      languages,
      chosen.originalLanguage ? [chosen.originalLanguage] : [],
    );
    increment(countries, chosen.productionCountries ?? []);
    increment(formats, [String(chosen.genres?.includes("Animation"))]);
    increment(collections, [String(chosen.belongsToCollection)]);
  }
  return movies;
}

function candidatePool(pool: Movie[], history: PracticeHistory) {
  const recentFive = new Set(
    history.boards.slice(0, STRONG_COOLDOWN_BOARDS).flat(),
  );
  let candidates: Movie[] = [],
    tier: RecognitionTier = 0;
  for (tier of [0, 1, 2] as const) {
    candidates = [
      ...new Map(
        pool
          .filter((m) => eligiblePracticeMovie(m, tier))
          .map((m) => [m.tmdbId, m]),
      ).values(),
    ];
    if (
      candidates.filter((m) => !recentFive.has(m.tmdbId)).length >= LINEUP_SIZE
    )
      break;
  }
  if (candidates.length < LINEUP_SIZE)
    throw new Error(
      "A practice lineup needs 24 suitable unique feature films.",
    );
  const fresh = candidates.filter((m) => !recentFive.has(m.tmdbId));
  return {
    candidates: fresh.length >= LINEUP_SIZE ? fresh : candidates,
    eligible: candidates.length,
    tier,
    recentFive,
  };
}

/** Practice only. Seeded Daily generation and all game/question rules are unchanged. */
export function createPracticePuzzle(
  pool: Movie[],
  seed: number,
  source: Puzzle["source"] = "demo",
  rawHistory: PracticeHistory = emptyPracticeHistory(),
): Puzzle {
  const history = sanitisePracticeHistory(rawHistory);
  const selection = candidatePool(pool, history);
  const rng = seededRandom(seed);
  let movies: Movie[] = [],
    bestScore = -1;
  for (let attempt = 0; attempt < 5; attempt++) {
    const board = chooseBoard(selection.candidates, rng, history);
    const quality = practiceQuestionQuality(board);
    if (quality.score > bestScore) {
      movies = board;
      bestScore = quality.score;
    }
    if (quality.healthy) {
      movies = board;
      break;
    }
  }
  const mysteries = new Set(history.mysteries);
  const answerChoices = movies.filter((m) => !mysteries.has(m.tmdbId));
  const mystery =
    answerChoices[Math.floor(rng() * answerChoices.length)] ??
    movies[Math.floor(rng() * movies.length)];
  const puzzle: Puzzle = {
    id: `practice-${seed >>> 0}`,
    seed,
    mode: "practice",
    movies,
    mysteryId: mystery.id,
    source,
    createdAt: new Date().toISOString(),
  };
  if (
    process.env.NODE_ENV === "development" &&
    process.env.LINEUP_DEBUG === "1"
  )
    console.debug(
      "LINEUP practice",
      practiceSelectionReport(pool, puzzle, history),
    );
  return puzzle;
}

/** Optional development diagnostics; never included in API responses or production UI. */
export function practiceSelectionReport(
  pool: Movie[],
  puzzle: Puzzle,
  history: PracticeHistory = emptyPracticeHistory(),
) {
  if (process.env.NODE_ENV === "production") return undefined;
  const selection = candidatePool(pool, sanitisePracticeHistory(history));
  const recent = new Set(history.boards.flat());
  const counts = (values: string[]) =>
    Object.fromEntries(
      [...new Set(values)]
        .sort()
        .map((v) => [v, values.filter((x) => x === v).length]),
    );
  return {
    eligiblePool: selection.eligible,
    recognitionTier: selection.tier,
    recentlyExcluded: selection.eligible - selection.candidates.length,
    recentlyDeprioritised: selection.candidates.filter((m) =>
      recent.has(m.tmdbId),
    ).length,
    selectedIds: puzzle.movies.map((m) => m.tmdbId),
    decades: counts(puzzle.movies.map(decade)),
    genres: counts(puzzle.movies.flatMap((m) => m.genres ?? [])),
    questions: practiceQuestionQuality(puzzle.movies),
  };
}
