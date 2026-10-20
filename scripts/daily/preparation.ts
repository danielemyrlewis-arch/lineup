import { createHash } from "node:crypto";
import type { Movie, Puzzle } from "../../lib/game/types.ts";
import type { DailyScheduleEntry } from "../../lib/game/daily-schedule.ts";
import { createPracticePuzzle, franchiseKeys, practiceQuestionQuality } from "../../lib/game/practice-selection.ts";
import { emptyPracticeHistory, rememberPracticePuzzle } from "../../lib/game/practice-history.ts";
import { eligiblePracticeMovie } from "../../lib/game/practice-eligibility.ts";
import { seededRandom } from "../../lib/game/engine.ts";
import { DAILY_CATALOGUE_VERSION } from "../../lib/data/daily-config.ts";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const digest = (value: unknown): string => createHash("sha256").update(stable(value)).digest("hex");
export const catalogueFingerprint = (catalogue: readonly Movie[]) => digest([...catalogue].sort((a,b)=>a.tmdbId-b.tmdbId));
export function addDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)
    throw new Error("A schedule date must be a valid YYYY-MM-DD date.");
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
export function daysThrough(start: string, end: string): number {
  addDays(start,0);addDays(end,0);
  return Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1;
}
export function validateSchedule(entries: readonly DailyScheduleEntry[], catalogue: readonly Movie[], launchDate: string) {
  const byId=new Map(catalogue.map(movie=>[movie.tmdbId,movie]));
  const ids=new Set<string>(),numbers=new Set<number>(),mysteries=new Set<number>();
  let previous:readonly number[]=[];
  const rows=entries.map((entry,index)=>{
    if(entry.id!==`daily-${String(entry.number).padStart(3,"0")}` || entry.number!==index+1 ||
        entry.date!==addDays(launchDate,index) || ids.has(entry.id)||numbers.has(entry.number) ||
        entry.catalogueVersion!==DAILY_CATALOGUE_VERSION || !Number.isSafeInteger(entry.seed)||entry.seed<0||entry.seed>0xffffffff ||
        entry.movieIds.length!==24 || new Set(entry.movieIds).size!==24 || !entry.movieIds.includes(entry.mysteryMovieId))
      throw new Error(`Invalid/changed Daily schedule identity at ${index+1}`);
    ids.add(entry.id);numbers.add(entry.number);
    const movies=entry.movieIds.map(id=>byId.get(id));
    if(movies.some(movie=>!movie || !eligiblePracticeMovie(movie)))throw new Error(`Unresolvable/unsuitable Daily film at ${entry.date}`);
    const known=movies as Movie[],families=known.flatMap(franchiseKeys);
    const titles=known.map(m=>m.title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g,""));
    if(new Set(families).size!==families.length||new Set(titles).size!==titles.length)
      throw new Error(`Duplicate family/title in ${entry.date}`);
    const recent=new Set(entries.slice(Math.max(0,index-5),index).flatMap(day=>[...day.movieIds]));
    if(entry.movieIds.some(id=>recent.has(id)))throw new Error(`Five-board cooldown failed at ${entry.date}`);
    if(index<365&&mysteries.has(entry.mysteryMovieId))throw new Error(`Initial 365 Daily mysteries must be unique: ${entry.date}`);
    mysteries.add(entry.mysteryMovieId);
    const quality=practiceQuestionQuality(known);
    if(!quality.healthy)throw new Error(`Poor question quality at ${entry.date}`);
    const decadeCounts=count(known.map(m=>String(Math.floor(m.releaseYear!/10)*10)));
    const genres=count(known.flatMap(m=>m.genres??[]));
    const overlap=entry.movieIds.filter(id=>previous.includes(id)).length;
    previous=entry.movieIds;
    return {date:entry.date,number:entry.number,filmIds:entry.movieIds,mysteryMovieId:entry.mysteryMovieId,
      decades:decadeCounts,genres,consecutiveOverlap:overlap,questionQuality:quality,
      voteCountMin:Math.min(...known.map(m=>m.voteCount)),recognitionTier:0,franchiseDuplicates:0,missingPosters:0};
  });
  return rows;
}
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(v=>v===value).length]));

/** Existing entries are copied verbatim; this function can only add dated future entries. */
export function appendSchedule(existing: readonly DailyScheduleEntry[], catalogue: Movie[], launchDate: string, totalDays: number,
  progress?: (count: number)=>void): DailyScheduleEntry[] {
  if(!Number.isSafeInteger(totalDays)||totalDays<1||totalDays>3650)throw new Error("Request 1–3650 total days.");
  validateSchedule(existing,catalogue,launchDate);
  const entries: DailyScheduleEntry[]=existing.map(entry=>({...entry,movieIds:[...entry.movieIds]}));
  let history=emptyPracticeHistory();
  const used=new Set<number>();
  for(const entry of existing) {
    used.add(entry.mysteryMovieId);
    history=rememberPracticePuzzle(history,{id:`practice-${entry.seed}`,mode:"practice",seed:entry.seed,
      movies:entry.movieIds.map(id=>catalogue.find(m=>m.tmdbId===id)!),mysteryId:String(entry.mysteryMovieId),source:"demo",createdAt:entry.date});
  }
  while(entries.length<totalDays) {
    const index=entries.length,date=addDays(launchDate,index);
    const seed=(0x4c494e45+Math.imul(index+1,2654435761))>>>0;
    let puzzle: Puzzle | null=null,answer: Movie | null=null;
    for(let attempt=0;attempt<12;attempt++) {
      const candidate=createPracticePuzzle(catalogue,(seed+attempt*977)>>>0,"demo",history);
      const fresh=candidate.movies.filter(movie=>!used.has(movie.tmdbId));
      if(fresh.length || index>=365) {
        const choices=fresh.length?fresh:candidate.movies.filter(m=>!history.mysteries.includes(m.tmdbId));
        if(!choices.length)continue;
        answer=choices[Math.floor(seededRandom(seed^0x5f3759df)()*choices.length)];
        puzzle=candidate;break;
      }
    }
    if(!puzzle||!answer)throw new Error(`Cannot create a suitable new mystery for ${date}; no obscure fallback was used.`);
    const entry:DailyScheduleEntry={id:`daily-${String(index+1).padStart(3,"0")}`,date,number:index+1,
      movieIds:puzzle.movies.map(m=>m.tmdbId),mysteryMovieId:answer.tmdbId,catalogueVersion:DAILY_CATALOGUE_VERSION,seed:puzzle.seed};
    entries.push(entry);used.add(answer.tmdbId);
    history=rememberPracticePuzzle(history,{...puzzle,mysteryId:answer.id});
    progress?.(entries.length);
  }
  return entries;
}
