export type LeadGender = "female" | "male" | "nonbinary";
export interface ProductionCompany {
  id: number | null;
  name: string;
}
export interface TopBilledLead {
  tmdbId: number | null;
  name: string;
  character: string | null;
  /** TMDB performer gender, never inferred from the character or name. */
  gender: LeadGender | null;
}
export interface CastMember {
  tmdbId: number | null;
  name: string;
  character: string | null;
  profilePath: string | null;
  /** TMDB credit order; retained for preparation, never displayed. */
  order: number | null;
}
export interface MovieEnrichment {
  hasMainAnimalCharacter?: boolean | null;
  isMusical?: boolean | null;
}
export type CuratedAttribute = keyof MovieEnrichment;
export type OscarQuestionKey =
  | "nominated" | "won" | "pictureNominated" | "pictureWon"
  | "nominations3" | "nominations5" | "wins3";
export interface OscarAnswerEvidence {
  value: boolean;
  source: string;
  verifiedOn: string;
  verifiedThroughAwardYear: number;
  coverageThroughCeremony: number;
  basis: "reviewed-film" | "positive-entry" | "minimum-count" | "complete-category";
}
/** Optional offline enrichment. No Oscar questions are enabled without verified coverage. */
export interface OscarRecord {
  oscarNominations: number | null;
  oscarWins: number | null;
  nominatedForBestPicture: boolean | null;
  wonBestPicture: boolean | null;
  awardsDataStatus: "verified" | "partial" | "unknown";
  /** Independently verified answers. Missing/null is UNKNOWN, never NO. */
  answers?: Partial<Record<OscarQuestionKey, OscarAnswerEvidence | null>>;
  awardsSource: string | null;
  verifiedOn: string | null;
  coverageThroughCeremony: number | null;
  /** Eligibility/nomination year, not the calendar year of the ceremony. */
  verifiedThroughAwardYear: number | null;
  countingMethod: "competitive-film-category-entries" | null;
}
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
  /** First ten usable credits for the detail sheet; question cast stays unchanged. */
  castMembers?: CastMember[] | null;
  overview?: string | null;
  productionCompanies?: ProductionCompany[] | null;
  /** Lowest-billed-order principal performer; not a claim about an ensemble's protagonist. */
  topBilledLead?: TopBilledLead | null;
  enrichment?: MovieEnrichment;
  oscars?: OscarRecord | null;
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
  | "languageNot"
  | "country"
  | "coProduction"
  | "studio"
  | "leadGender"
  | "oscar"
  | "curated";
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
  /** Frozen schedule identity; absent for unlimited Practice. */
  daily?: { date: string; number: number; catalogueVersion: string };
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
  /** Present only when the game's single suggested-question allowance was submitted. */
  suggested?: true;
}
export interface GameState {
  puzzle: Puzzle;
  activeIds: string[];
  history: Answer[];
  status: "playing" | "won" | "lost";
  guessId: string | null;
}
export type GameAction =
  | { type: "ask"; question: Question; suggested?: true }
  | { type: "guess"; movieId: string }
  | { type: "new"; puzzle: Puzzle };
