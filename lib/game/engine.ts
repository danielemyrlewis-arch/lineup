import type { GameAction, GameState, Movie, Puzzle } from "./types.ts";
import { evaluateQuestion, suggestedQuestions, validQuestions } from "./questions.ts";
export const QUESTION_LIMIT = 5;
export const LINEUP_SIZE = 24;

/** A stored seed and movie order can reproduce a future Daily puzzle exactly. */
export function seededRandom(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createPuzzle(
  pool: Movie[],
  seed: number,
  source: Puzzle["source"] = "demo",
  mode: Puzzle["mode"] = "practice",
): Puzzle {
  const unique = [
    ...new Map(
      pool.filter((m) => m.title && m.posterPath).map((m) => [m.tmdbId, m]),
    ).values(),
  ];
  if (unique.length < LINEUP_SIZE)
    throw new Error("A lineup needs 24 unique films.");
  const rng = seededRandom(seed);
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  const movies = unique.slice(0, LINEUP_SIZE);
  return {
    id: `${mode}-${seed >>> 0}`,
    seed,
    mode,
    movies,
    mysteryId: movies[Math.floor(rng() * movies.length)].id,
    source,
    createdAt: new Date().toISOString(),
  };
}
export function initialState(puzzle: Puzzle): GameState {
  if (
    puzzle.movies.length !== LINEUP_SIZE ||
    !puzzle.movies.some((m) => m.id === puzzle.mysteryId)
  )
    throw new Error("Invalid puzzle.");
  return {
    puzzle,
    activeIds: puzzle.movies.map((m) => m.id),
    history: [],
    status: "playing",
    guessId: null,
  };
}
export function activeMovies(state: GameState): Movie[] {
  return state.puzzle.movies.filter((m) => state.activeIds.includes(m.id));
}
/** A question selection alone has no state; only an accepted submitted answer spends this. */
export function hasUsedSuggestion(state: GameState): boolean {
  return state.history.some(answer => answer.suggested === true);
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "new") return initialState(action.puzzle);
  if (state.status !== "playing") return state;
  if (action.type === "guess") {
    if (!state.activeIds.includes(action.movieId)) return state;
    return {
      ...state,
      guessId: action.movieId,
      status: action.movieId === state.puzzle.mysteryId ? "won" : "lost",
    };
  }
  if (state.history.length >= QUESTION_LIMIT) return state;
  if (action.suggested && hasUsedSuggestion(state)) return state;
  // Resolve the canonical question by ID. UI-supplied labels/predicates cannot alter the rules.
  const available = validQuestions(
    activeMovies(state),
    state.history.map((h) => h.question.id),
  );
  if (action.suggested && !suggestedQuestions(available).some(question => question.id === action.question.id)) return state;
  const question = available.find((q) => q.id === action.question.id);
  if (!question) return state;
  const mystery = state.puzzle.movies.find(
    (m) => m.id === state.puzzle.mysteryId,
  )!;
  const answer = evaluateQuestion(mystery, question);
  if (answer === null) return state;
  const activeIds = activeMovies(state)
    .filter((m) => evaluateQuestion(m, question) === answer)
    .map((m) => m.id);
  const eliminatedIds = state.activeIds.filter((id) => !activeIds.includes(id));
  return {
    ...state,
    activeIds,
    history: [
      ...state.history,
      { question, answer, remaining: activeIds.length, eliminatedIds, ...(action.suggested ? {suggested: true as const} : {}) },
    ],
  };
}
export function deductionPath(state: GameState): number[] {
  return [LINEUP_SIZE, ...state.history.map((h) => h.remaining)];
}
