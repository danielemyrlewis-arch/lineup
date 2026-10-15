import assert from "node:assert/strict";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import {
  createPracticePuzzle,
  practiceQuestionQuality,
  franchiseKey,
} from "../lib/game/practice-selection.ts";
import {
  emptyPracticeHistory,
  rememberPracticePuzzle,
} from "../lib/game/practice-history.ts";
const count = Math.max(20, Math.min(1000, Number(process.argv[2]) || 20));
const frequencies = new Map<number, number>();
const decades: Record<string, number> = {},
  genres: Record<string, number> = {};
let history = emptyPracticeHistory();
let fiveBoardRepeats = 0,
  tenBoardRepeats = 0,
  mysteryRepeats = 0,
  missingMetadata = 0,
  familyDuplicates = 0;
const perBoard: {
  decades: number;
  genres: number;
  balancedPartitions: number;
  questionCategories: number;
  nonEnglish: number;
}[] = [];
for (let i = 0; i < count; i++) {
  const puzzle = createPracticePuzzle(
    PRACTICE_CATALOGUE,
    0x12340000 + i,
    "demo",
    history,
  );
  const five = new Set(history.boards.slice(0, 5).flat()),
    ten = new Set(history.boards.flat());
  const quality = practiceQuestionQuality(puzzle.movies);
  const boardDecades = new Set<number>(),
    boardGenres = new Set<string>(),
    families = new Set<string>();
  assert.equal(puzzle.movies.length, 24);
  assert.equal(new Set(puzzle.movies.map((m) => m.tmdbId)).size, 24);
  for (const m of puzzle.movies) {
    frequencies.set(m.tmdbId, (frequencies.get(m.tmdbId) ?? 0) + 1);
    if (five.has(m.tmdbId)) fiveBoardRepeats++;
    if (ten.has(m.tmdbId)) tenBoardRepeats++;
    if (
      !m.posterPath ||
      !m.releaseYear ||
      !m.runtime ||
      !m.genres?.length ||
      !m.director ||
      !m.cast?.length ||
      !m.originalLanguage ||
      !m.productionCountries?.length ||
      m.belongsToCollection === null
    )
      missingMetadata++;
    const d = Math.floor(m.releaseYear! / 10) * 10;
    decades[d] = (decades[d] ?? 0) + 1;
    boardDecades.add(d);
    for (const g of m.genres ?? []) {
      genres[g] = (genres[g] ?? 0) + 1;
      boardGenres.add(g);
    }
    const family = franchiseKey(m);
    if (family) {
      if (families.has(family)) familyDuplicates++;
      families.add(family);
    }
  }
  if (history.mysteries.includes(Number(puzzle.mysteryId))) mysteryRepeats++;
  assert.ok(quality.healthy, `Board ${i} has too few useful splits`);
  perBoard.push({
    decades: boardDecades.size,
    genres: boardGenres.size,
    balancedPartitions: quality.balancedPartitions,
    questionCategories: quality.categories,
    nonEnglish: puzzle.movies.filter((m) => m.originalLanguage !== "en").length,
  });
  history = rememberPracticePuzzle(history, puzzle);
}
const range = (key: keyof (typeof perBoard)[number]) => ({
  min: Math.min(...perBoard.map((b) => b[key])),
  max: Math.max(...perBoard.map((b) => b[key])),
  mean: Number((perBoard.reduce((s, b) => s + b[key], 0) / count).toFixed(2)),
});
assert.equal(fiveBoardRepeats, 0);
assert.equal(mysteryRepeats, 0);
assert.equal(missingMetadata, 0);
assert.equal(familyDuplicates, 0);
console.log(
  JSON.stringify(
    {
      lineups: count,
      eligiblePool: PRACTICE_CATALOGUE.length,
      appearances: count * 24,
      uniqueFilms: frequencies.size,
      maxAppearancesPerFilm: Math.max(...frequencies.values()),
      fiveBoardRepeats,
      tenBoardRepeats,
      mysteryRepeats,
      missingMetadata,
      familyDuplicates,
      perBoard: {
        decades: range("decades"),
        genres: range("genres"),
        balancedPartitions: range("balancedPartitions"),
        questionCategories: range("questionCategories"),
        nonEnglish: range("nonEnglish"),
      },
      decades,
      genres,
    },
    null,
    2,
  ),
);
