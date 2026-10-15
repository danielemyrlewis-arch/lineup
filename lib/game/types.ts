export interface Movie {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  localPoster?: string;
  releaseYear: number | null;
  genres: string[] | null;
  runtime: number | null;
  director: string | null;
  cast: string[] | null;
  originalLanguage: string | null;
  productionCountries: string[] | null;
  belongsToCollection: boolean | null;
  /** Selection hints only; question evaluation still uses belongsToCollection. */
  collectionId?: number | null;
  collectionName?: string | null;
  franchiseKey?: string | null;
  popularity: number;
  voteCount: number;
}

export type QuestionKind =
  | "before"
  | "after"
  | "decade"
  | "genre"
  | "under"
  | "over"
  | "collection"
  | "director"
  | "cast"
  | "language"
  | "country";
export interface Question {
  id: string;
  kind: QuestionKind;
  value: string | number | boolean;
  label: string;
  shortLabel: string;
  category: string;
  aliases: string[];
}
export interface RankedQuestion extends Question {
  yesCount: number;
  noCount: number;
  balance: number;
  partitionKey: string;
}
export interface Puzzle {
  id: string;
  mode: "practice" | "daily";
  seed: number;
  movies: Movie[];
  mysteryId: string;
  source: "demo" | "tmdb";
  createdAt: string;
}
export interface Answer {
  question: Question;
  answer: boolean;
  remaining: number;
  eliminatedIds: string[];
}
export interface GameState {
  puzzle: Puzzle;
  activeIds: string[];
  history: Answer[];
  status: "playing" | "won" | "lost";
  guessId: string | null;
}
export type GameAction =
  | { type: "ask"; question: Question }
  | { type: "guess"; movieId: string }
  | { type: "new"; puzzle: Puzzle };
