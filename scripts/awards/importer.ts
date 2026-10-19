import type { Movie, OscarRecord } from "../../lib/game/types.ts";
import { normaliseOscarRecord } from "../../lib/data/awards.ts";

export interface SourceNomination {
  category: string;
  year: string;
  nominees: string[];
  movies: { title: string; tmdb_id: number; imdb_id: string | null }[];
  won: boolean;
}
export interface FilmReview {
  tmdbId: number;
  title: string;
  releaseYear: number;
  nominations: number;
  wins: number;
  pictureNominated: boolean;
  pictureWon: boolean;
  /** Explicit review of the film's complete competitive record, not just one win. */
  evidence: string[];
  note: string;
  /** Required for a zero: eligibility years checked against an explicit no-nominations reference. */
  eligibleAwardYears?: number[];
}
export const SOURCE = {
  repository: "https://github.com/delventhalz/json-nominations",
  commit: "e617f8a780d20a516280b35645585e66bdebec83",
  sha256: "b6562caf59a0432b9d7c09f2ad0b42b08ef6a39f07c54dd7b8f48fc311b83bcd",
  file: "oscar-nominations.json",
  verifiedOn: "2026-10-19",
  throughAwardYear: 2023,
  throughCeremony: 96,
} as const;
export const SOURCE_URL = `${SOURCE.repository}/blob/${SOURCE.commit}/${SOURCE.file}`;
const clean = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const id = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;

/** Source years are eligibility periods. Two ceremonies took place in 1930. */
export function awardPeriod(label: string) {
  const early: Record<string, [number, number, number, number]> = {
    "1927/28": [1927, 1928, 1, 1929], "1928/29": [1928, 1929, 2, 1930],
    "1929/30": [1929, 1930, 3, 1930], "1930/31": [1930, 1931, 4, 1931],
    "1931/32": [1931, 1932, 5, 1932], "1932/33": [1932, 1933, 6, 1934],
  };
  const value = early[label];
  if (value) return { start: value[0], end: value[1], ceremony: value[2], ceremonyYear: value[3] };
  if (!/^\d{4}$/.test(label) || +label < 1934 || +label > SOURCE.throughAwardYear) return null;
  return { start: +label, end: +label, ceremony: +label - 1927, ceremonyYear: +label + 1 };
}

const categories: Record<string, string> = {
  "Best Picture": "picture", "Outstanding Picture": "picture", "Outstanding Production": "picture",
  "Outstanding Motion Picture": "picture", "Best Motion Picture": "picture",
  "Unique and Artistic Production": "unique-artistic-production",
  "Best Actor": "actor", "Best Actress": "actress", "Best Supporting Actor": "supporting-actor",
  "Best Supporting Actress": "supporting-actress", "Best Director": "director",
  "Best Adapted Screenplay": "adapted-screenplay", "Best Original Screenplay": "original-screenplay",
  "Best Original Story": "original-story", "Best Assistant Director": "assistant-director",
  "Best Dance Direction": "dance-direction", "Best Score": "score",
  "Best Original Musical/Secondary Score Category": "secondary-score", "Best Original Song": "song",
  "Best Film Editing": "editing", "Best Animated Short": "animated-short",
  "Best Animated Feature": "animated-feature", "Best Documentary Feature": "documentary-feature",
  "Best Documentary Short": "documentary-short", "Best International Feature Film": "international-feature",
  "Best Foreign Language Film": "international-feature", "Best Makeup and Hairstyling": "makeup",
  "Best Sound Mixing": "sound", "Best Sound": "sound", "Best Sound Editing": "sound-editing",
  "Best Visual/Special Effects": "visual-effects", "Best Visual Effects": "visual-effects",
  "Best Production Design (Black and White)": "production-design-bw",
  "Best Production Design (Color)": "production-design-color",
  "Best Cinematography (Black and White)": "cinematography-bw",
  "Best Cinematography (Color)": "cinematography-color",
  "Best Costume Design (Black and White)": "costume-bw", "Best Costume Design (Color)": "costume-color",
  "Best Live Action Short (Comedy or One Reel or Regular)": "live-short-regular",
  "Best Live Action Short (Two-Reel or Novelty)": "live-short-secondary",
  "Best Live Action Short (Color)": "live-short-color",
};
/** Color/B&W and different short/score competitions remain distinct. */
export const normaliseCategory = (name: string): string | null => categories[name] ?? null;
export function excludedAward(category: string, year: number): boolean {
  return /honorary|special achievement|scientific|technical|memorial|humanitarian|juvenile/i.test(category)
    || (category === "Best International Feature Film" && year < 1956)
    || (category === "Best Makeup and Hairstyling" && [1964, 1968].includes(year));
}
function isRow(value: unknown): value is SourceNomination {
  if (!value || typeof value !== "object") return false;
  const r = value as SourceNomination;
  return text(r.category) && text(r.year) && awardPeriod(r.year) !== null && typeof r.won === "boolean"
    && Array.isArray(r.nominees) && r.nominees.length > 0 && r.nominees.every(text)
    && Array.isArray(r.movies) && r.movies.every(m => m && text(m.title) && id(m.tmdb_id)
      && (m.imdb_id === null || (typeof m.imdb_id === "string" && /^tt\d{7,9}$/.test(m.imdb_id))));
}
export interface ImportedEntry {
  index: number;
  category: string;
  canonicalCategory: string;
  awardYear: string;
  won: boolean;
}
export function prepareOscarImport(input: unknown, catalogue: Movie[], reviews: FilmReview[]) {
  if (!Array.isArray(input)) throw new Error("The source must be a nominations array");
  if (new Set(catalogue.map(m => m.tmdbId)).size !== catalogue.length) throw new Error("Duplicate catalogue TMDB IDs");
  if (new Set(reviews.map(r => r.tmdbId)).size !== reviews.length) throw new Error("Duplicate film reviews");
  const films = new Map(catalogue.map(m => [m.tmdbId, m]));
  const issues: { index: number; reason: string; tmdbIds: number[] }[] = [];
  const matches = new Set<number>(), winners = new Set<number>(), blocked = new Set<number>();
  const seen = new Map<string, { index: number; won: boolean }>();
  const entries = new Map<number, ImportedEntry[]>();
  const unmatchedRecords: number[] = [];
  const duplicates: { index: number; original: number }[] = [];
  const periods: Record<string, { records: number; winners: number; categories: Record<string, { records: number; winners: number }> }> = {};
  const aliases: Record<number, string[]> = { 6114: ["Bram Stoker's Dracula"], 194662: ["Birdman or (The Unexpected Virtue of Ignorance)"] };
  let malformed = 0, missingImdb = 0;
  for (const [index, value] of input.entries()) {
    if (!isRow(value)) { malformed++; issues.push({index, reason:"malformed source record", tmdbIds:[]}); continue; }
    const row = value, period = awardPeriod(row.year)!;
    missingImdb += row.movies.filter(m=>m.imdb_id===null).length;
    const ids = [...new Set(row.movies.map(m => m.tmdb_id))];
    const matched = ids.filter(movieId => films.has(movieId));
    matched.forEach(movieId => { matches.add(movieId); if (row.won) winners.add(movieId); });
    if (!matched.length) unmatchedRecords.push(index);
    const year = periods[row.year] ??= {records:0,winners:0,categories:{}};
    const category = year.categories[row.category] ??= {records:0,winners:0};
    year.records++; category.records++; if (row.won) {year.winners++; category.winners++;}
    const canonical = normaliseCategory(row.category);
    const key = JSON.stringify([row.year, canonical ?? row.category, row.nominees.map(clean).sort(), ids.sort((a,b)=>a-b)]);
    const prior = seen.get(key);
    if (prior) {
      if (prior.won !== row.won) {
        issues.push({index,reason:"conflicting win status for the same nomination",tmdbIds:ids});
        matched.forEach(movieId=>blocked.add(movieId));
      } else duplicates.push({index,original:prior.index});
      continue;
    }
    seen.set(key,{index,won:row.won});
    let reason: string | null = null;
    if (excludedAward(row.category,period.end)) reason = "noncompetitive award excluded";
    else if (!canonical) reason = "unrecognised category requires review";
    else if (!ids.length) reason = "not associated with a film";
    else if (row.movies.length > 1) reason = "multi-film nomination requires individual review";
    // Winner-only historical effects awards mix special awards with competitions.
    else if (canonical === "visual-effects" && period.end < 1980) reason = "historical effects award requires competitive-status review";
    if (reason) {
      issues.push({index,reason,tmdbIds:ids});
      if (reason !== "noncompetitive award excluded") matched.forEach(movieId=>blocked.add(movieId));
      continue;
    }
    for (const sourceFilm of row.movies) {
      const film = films.get(sourceFilm.tmdb_id);
      if (!film) continue;
      const titleOK = [film.title,...(aliases[film.tmdbId]??[])].some(t=>clean(t)===clean(sourceFilm.title));
      // Plausibility only; not a substitute for a US eligibility-year review.
      const yearOK = film.releaseYear !== null && film.releaseYear <= period.end && film.releaseYear >= period.start - 3;
      if (!titleOK || !yearOK) {
        blocked.add(film.tmdbId);
        issues.push({index,reason:!titleOK?"TMDB ID/title disagreement":"release/eligibility year requires review",tmdbIds:[film.tmdbId]});
        continue;
      }
      const list = entries.get(film.tmdbId) ?? [];
      list.push({index,category:row.category,canonicalCategory:canonical!,awardYear:row.year,won:row.won});
      entries.set(film.tmdbId,list);
    }
  }
  const records: Record<number, OscarRecord> = {};
  const reviewFailures: {tmdbId:number;reason:string}[] = [];
  for (const review of reviews) {
    const film = films.get(review.tmdbId), list = entries.get(review.tmdbId) ?? [];
    const fail = (reason: string) => reviewFailures.push({tmdbId:review.tmdbId,reason});
    if (!film || film.title !== review.title || film.releaseYear !== review.releaseYear) {fail("review/catalogue identity disagreement");continue;}
    if (malformed || blocked.has(film.tmdbId)) {fail("source contains unresolved records");continue;}
    if (!review.evidence.length || !review.evidence.every(u=>URL.canParse(u)&&new URL(u).protocol==="https:") || !review.note.trim()) {fail("missing independent evidence");continue;}
    const counts = {nominations:list.length,wins:list.filter(e=>e.won).length,
      pictureNominated:list.some(e=>e.canonicalCategory==="picture"),pictureWon:list.some(e=>e.canonicalCategory==="picture"&&e.won)};
    if (Object.entries(counts).some(([key,value])=>review[key as keyof typeof counts]!==value)) {fail("source and independent review disagree");continue;}
    if (review.releaseYear > SOURCE.throughAwardYear || (review.nominations === 0 && (!review.eligibleAwardYears?.length
      || !review.eligibleAwardYears.every(y=>Number.isSafeInteger(y)&&y>=review.releaseYear&&y<=SOURCE.throughAwardYear)))) {fail("no reviewed eligibility coverage for a zero/recent film");continue;}
    const record = normaliseOscarRecord({
      oscarNominations:counts.nominations,oscarWins:counts.wins,nominatedForBestPicture:counts.pictureNominated,
      wonBestPicture:counts.pictureWon,awardsDataStatus:"verified",awardsSource:review.nominations?SOURCE_URL:review.evidence[0],
      verifiedOn:SOURCE.verifiedOn,coverageThroughCeremony:SOURCE.throughCeremony,
      verifiedThroughAwardYear:SOURCE.throughAwardYear,countingMethod:"competitive-film-category-entries",
    });
    if (record.awardsDataStatus!=="verified") {fail("invalid reviewed record");continue;}
    records[film.tmdbId]=record;
  }
  const byDecade: Record<string,{films:number;exactMatches:number;verifiedPositive:number;verifiedZero:number;unknown:number}> = {};
  const filmAudit = catalogue.map(film=>{
    const list=entries.get(film.tmdbId)??[], record=records[film.tmdbId];
    const status=record ? record.oscarNominations!>0?"verified-positive":"verified-zero":"unknown";
    const decade=String(Math.floor((film.releaseYear??0)/10)*10);
    const group=byDecade[decade]??={films:0,exactMatches:0,verifiedPositive:0,verifiedZero:0,unknown:0};
    group.films++;if(matches.has(film.tmdbId))group.exactMatches++;
    if(status==="verified-positive")group.verifiedPositive++;else if(status==="verified-zero")group.verifiedZero++;else group.unknown++;
    return {tmdbId:film.tmdbId,title:film.title,releaseYear:film.releaseYear,status,sourceMatched:matches.has(film.tmdbId),
      candidateNominations:list.length,candidateWins:list.filter(e=>e.won).length,blocked:blocked.has(film.tmdbId),entries:list};
  });
  return {records, audit:{source:SOURCE,summary:{sourceRecords:input.length,sourceWinnerRecords:Object.values(periods).reduce((s,y)=>s+y.winners,0),
    sourcePeriods:Object.keys(periods).length,totalFilms:catalogue.length,exactMatchedFilms:matches.size,sourceMatchedWinningFilms:winners.size,
    verifiedPositive:filmAudit.filter(m=>m.status==="verified-positive").length,verifiedZero:filmAudit.filter(m=>m.status==="verified-zero").length,
    unknown:filmAudit.filter(m=>m.status==="unknown").length,unmatchedAwardRecords:unmatchedRecords.length,
    duplicateRecords:duplicates.length,malformedRecords:malformed,missingImdbAssociations:missingImdb,quarantinedMatchedFilms:blocked.size,
    ambiguousMatchedFilms:new Set(issues.filter(i=>/disagreement|requires review$/.test(i.reason)&&!i.reason.startsWith("historical")).flatMap(i=>i.tmdbIds.filter(id=>films.has(id)))).size},
    periods,byDecade,issues,duplicates,unmatchedRecords,reviewFailures,
    zeroAudit:reviews.filter(r=>records[r.tmdbId]?.oscarNominations===0),films:filmAudit}};
}
