export interface WikidataEntity {
  tmdb: number[];
  imdb: string[];
  names: string[];
  releaseYears: number[];
}
export interface WikidataStatement {
  film: string;
  tmdbId?: number;
  category: string;
  kind: "nominated" | "won";
  statement: string;
  rank: "normal" | "preferred" | "deprecated";
  ceremony?: string;
  date?: string;
}
export interface CeremonyReference {
  ordinal: number;
  nominees: number;
  nomineeHash: string;
  winnerHash: string;
  source: string;
}
export interface WikidataOscarInput {
  schema: 1;
  retrievedOn: string;
  throughCeremony: number;
  ids: [number,string][];
  entities: Record<string,WikidataEntity>;
  ceremonies: {id:string;ordinal:number;date:string}[];
  picture: WikidataStatement[];
  positive: WikidataStatement[];
  references: CeremonyReference[];
  receipts: {file:string;sha256:string;query:string}[];
}
