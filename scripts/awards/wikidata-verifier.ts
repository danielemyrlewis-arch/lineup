import { createHash } from "node:crypto";
import type { Movie, OscarRecord, OscarQuestionKey, OscarAnswerEvidence } from "../../lib/game/types.ts";
import { OSCAR_KEYS, evaluateOscar } from "../../lib/data/awards.ts";
import { awardPeriod, normaliseCategory, SOURCE } from "./importer.ts";
import type { ImportedEntry } from "./importer.ts";
import type { WikidataOscarInput, WikidataStatement } from "./wikidata-types.ts";

export const setHash = (ids: Iterable<number>) => createHash("sha256")
  .update(JSON.stringify([...new Set(ids)].sort((a,b)=>a-b))).digest("hex");
const clean = (s:string) => s.replace(/\s*\(\d{4}(?: [^)]*film)?\)$/i,"")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const family = (s:string) => s.replace(/-(bw|color)$/,"");
/** Explicit competitive categories. These minima exclude known special-award eras. */
export const COMPETITIVE_CATEGORIES: Record<string,[string,number]> = {
  Q102427:["picture",1], Q103916:["actor",1], Q103618:["actress",1],
  Q106291:["supporting-actor",9], Q106301:["supporting-actress",9], Q103360:["director",1],
  Q107258:["adapted-screenplay",1], Q41417:["original-screenplay",13], Q504298:["original-story",1],
  Q131520:["cinematography",1], Q21995139:["cinematography",1], Q21995136:["cinematography",1],
  Q277751:["production-design",1], Q22253131:["production-design",1], Q22253133:["production-design",1],
  Q277536:["costume",21], Q22120066:["costume",21], Q22120095:["costume",21],
  Q281939:["editing",7], Q488651:["score",7], Q112243:["song",7],
  Q4671338:["secondary-score",11], Q22235305:["secondary-score",11], Q22235329:["score",11],
  Q22344608:["secondary-score",11], Q22752734:["score",11], Q22752811:["secondary-score",11],
  Q22752868:["score",11], Q830079:["sound",3], Q488645:["sound-editing",62],
  Q393686:["visual-effects",65], Q22917729:["visual-effects",65], Q487136:["makeup",54],
  Q105304:["international-feature",29], Q111332:["documentary-feature",15],
  Q1425151:["documentary-short",14], Q917808:["animated-short",5], Q106800:["animated-feature",74],
  Q1324407:["live-short-regular",5], Q3886464:["live-short-regular",5], Q22335251:["live-short-regular",5],
  Q1401974:["live-short-secondary",5], Q2297175:["live-short-secondary",5],
  Q3886465:["live-short-color",9], Q501004:["assistant-director",7], Q498690:["dance-direction",8],
  Q3298549:["unique-artistic-production",1],
};
export interface LegacyAudit {
  source: {sha256:string};
  films: {tmdbId:number;sourceMatched:boolean;entries:ImportedEntry[]}[];
}
export function resolveCeremony(input: WikidataOscarInput, statement: WikidataStatement) {
  if(statement.rank!=="normal"&&statement.rank!=="preferred") return null;
  if(statement.ceremony) {
    const event=input.ceremonies.find(c=>c.id===statement.ceremony);
    if(!event || event.ordinal>input.throughCeremony || (statement.date&&statement.date.slice(0,4)!==event.date.slice(0,4))) return null;
    return event;
  }
  if(!statement.date) return null;
  const sameDay=input.ceremonies.filter(c=>c.ordinal<=input.throughCeremony&&c.date.slice(0,10)===statement.date!.slice(0,10));
  if(sameDay.length===1)return sameDay[0];
  const sameYear=input.ceremonies.filter(c=>c.ordinal<=input.throughCeremony&&c.date.slice(0,4)===statement.date!.slice(0,4));
  return sameYear.length===1?sameYear[0]:null; // Two ceremonies occurred in 1930.
}
export function pictureGroups(input: WikidataOscarInput) {
  const nominees=new Map<number,Set<number>>(),winners=new Map<number,Set<number>>();
  const rejected:{statement:string;reason:string}[]=[];
  for(const row of input.picture) {
    const entity=input.entities[row.film],event=resolveCeremony(input,row);
    if(row.category!=="Q102427" || !row.tmdbId || !entity?.tmdb.includes(row.tmdbId) || !event) {
      rejected.push({statement:row.statement,reason:"missing/conflicting film or ceremony identity"});continue;
    }
    // A dated ceremony can have only regional release dates in Wikidata, or the
    // 2020 extended eligibility window. Date-only reports get the stricter bound.
    const end=event.ordinal+1927,upper=row.ceremony?Number(event.date.slice(0,4)):end;
    if(!entity.releaseYears.some(y=>y>=end-3&&y<=upper)) {
      rejected.push({statement:row.statement,reason:"release/ceremony chronology disagreement"});continue;
    }
    const group=nominees.get(event.ordinal)??new Set<number>();group.add(row.tmdbId);nominees.set(event.ordinal,group);
    if(row.kind==="won") {
      const wins=winners.get(event.ordinal)??new Set<number>();wins.add(row.tmdbId);winners.set(event.ordinal,wins);
    }
  }
  return {nominees,winners,rejected};
}

export function verifyWikidataCoverage(input: WikidataOscarInput, catalogue: Movie[], legacy: LegacyAudit,
  completeRecords: Readonly<Record<number,OscarRecord>>) {
  if(input.schema!==1 || !Number.isInteger(input.throughCeremony) || input.throughCeremony<1 || input.throughCeremony>98)
    throw new Error("Unreviewed evidence schema or ceremony cutoff");
  if(legacy.source.sha256!==SOURCE.sha256)throw new Error("Legacy corroboration pin changed");
  const ordinals=input.ceremonies.map(c=>c.ordinal);
  if(new Set(ordinals).size!==ordinals.length || !Array.from({length:input.throughCeremony},(_,i)=>i+1).every(n=>ordinals.includes(n)))
    throw new Error("Ceremony registry is incomplete or duplicated");
  const groups=pictureGroups(input),closedWinners:boolean[]=[],closedNominees:boolean[]=[];
  const categoryAudit=[];
  for(let ordinal=1;ordinal<=input.throughCeremony;ordinal++) {
    const reference=input.references.filter(r=>r.ordinal===ordinal),ref=reference[0];
    const nominees=groups.nominees.get(ordinal)??new Set<number>(),winners=groups.winners.get(ordinal)??new Set<number>();
    const winnerVerified=reference.length===1&&winners.size===1&&setHash(winners)===ref.winnerHash;
    const nomineeVerified=reference.length===1&&nominees.size===ref.nominees&&setHash(nominees)===ref.nomineeHash
      &&winnerVerified&&[...winners].every(id=>nominees.has(id));
    closedWinners.push(winnerVerified);closedNominees.push(nomineeVerified);
    categoryAudit.push({ordinal,nominees:nominees.size,winners:winners.size,winnerVerified,nomineeVerified,source:ref?.source??null});
  }
  const winnerCoverage=closedWinners.every(Boolean),nomineeCoverage=closedNominees.every(Boolean);
  const allNominees=new Set([...groups.nominees.values()].flatMap(s=>[...s]));
  const allWinners=new Set([...groups.winners.values()].flatMap(s=>[...s]));
  const idMap=new Map<number,Set<string>>();
  for(const [tmdb,qid] of input.ids) { const set=idMap.get(tmdb)??new Set<string>();set.add(qid);idMap.set(tmdb,set); }
  const identities=new Map<number,string>();
  const identityIssues:{tmdbId:number;title:string;reason:string;candidates:string[]}[]=[];
  for(const movie of catalogue) {
    const candidates=[...(idMap.get(movie.tmdbId)??[])];
    const entity=input.entities[candidates[0]];
    const reason=candidates.length!==1?"ambiguous/missing exact TMDB crosswalk":
      !entity?.tmdb.includes(movie.tmdbId)?"metadata/crosswalk disagreement":
      !entity.names.some(name=>clean(name)===clean(movie.title))?"title disagreement":
      movie.releaseYear===null||!entity.releaseYears.includes(movie.releaseYear)?"release-year disagreement":null;
    if(reason)identityIssues.push({tmdbId:movie.tmdbId,title:movie.title,reason,candidates});
    else identities.set(movie.tmdbId,candidates[0]);
  }
  const movieByQid=new Map([...identities].map(([id,q])=>[q,id]));
  const legacyEntries=new Map(legacy.films.map(m=>[m.tmdbId,m.entries]));
  const nominations=new Map<number,Set<string>>(),wins=new Map<number,Set<string>>();
  const accepted:{tmdbId:number;statement:string;category:string;ceremony:number;kind:string;legacyRows:number[]}[]=[];
  const rejected:{statement:string;reason:string}[]=[];
  const seen=new Set<string>();
  for(const row of input.positive) {
    const movieId=movieByQid.get(row.film),category=COMPETITIVE_CATEGORIES[row.category],event=resolveCeremony(input,row);
    if(!movieId || !category || !event || event.ordinal<category[1] || event.ordinal>SOURCE.throughCeremony) {
      rejected.push({statement:row.statement,reason:"unresolved identity, competitive category or ceremony"});continue;
    }
    const matches=(legacyEntries.get(movieId)??[]).filter(entry=>{
      const c=normaliseCategory(entry.category),period=awardPeriod(entry.awardYear);
      return c&&family(c)===category[0]&&period?.ceremony===event.ordinal&&(row.kind!=="won"||entry.won);
    });
    if(!matches.length) {rejected.push({statement:row.statement,reason:"no matching audited source category/year/win"});continue;}
    // Count categories as a lower bound. Shared recipients and duplicate statements
    // cannot inflate it; multiple acting/song entries can only make the true total larger.
    const key=`${event.ordinal}:${category[0]}`,dedup=`${movieId}:${row.kind}:${key}`;
    if(seen.has(dedup))continue;seen.add(dedup);
    const n=nominations.get(movieId)??new Set<string>();n.add(key);nominations.set(movieId,n);
    if(row.kind==="won") {const w=wins.get(movieId)??new Set<string>();w.add(key);wins.set(movieId,w);}
    accepted.push({tmdbId:movieId,statement:row.statement,category:category[0],ceremony:event.ordinal,kind:row.kind,legacyRows:matches.map(m=>m.index)});
  }
  const answers: Record<number,NonNullable<OscarRecord["answers"]>>={};
  const conflicts:{tmdbId:number;question:OscarQuestionKey}[]=[];
  const records:Record<number,OscarRecord>={};
  const coverage=Object.fromEntries(OSCAR_KEYS.map(key=>[key,{yes:0,no:0,unknown:0}])) as Record<OscarQuestionKey,{yes:number;no:number;unknown:number}>;
  const distribution:Record<string,number>={};
  const films=catalogue.map(movie=>{
    const qid=identities.get(movie.tmdbId),facts:NonNullable<OscarRecord["answers"]>={};
    const set=(key:OscarQuestionKey,value:boolean,basis:OscarAnswerEvidence["basis"],through=input.throughCeremony+1927)=>{
      facts[key]={value,source:`https://www.wikidata.org/wiki/${qid}`,verifiedOn:input.retrievedOn,
        verifiedThroughAwardYear:through,coverageThroughCeremony:through-1927,basis};
    };
    if(qid && movie.releaseYear!==null && movie.releaseYear<=input.throughCeremony+1927) {
      if(nomineeCoverage)set("pictureNominated",allNominees.has(movie.tmdbId),"complete-category");
      if(winnerCoverage)set("pictureWon",allWinners.has(movie.tmdbId),"complete-category");
      const n=nominations.get(movie.tmdbId)?.size??0,w=wins.get(movie.tmdbId)?.size??0;
      if(n)set("nominated",true,"positive-entry",SOURCE.throughAwardYear);
      if(w)set("won",true,"positive-entry",SOURCE.throughAwardYear);
      if(n>=3)set("nominations3",true,"minimum-count",SOURCE.throughAwardYear);
      if(n>=5)set("nominations5",true,"minimum-count",SOURCE.throughAwardYear);
      if(w>=3)set("wins3",true,"minimum-count",SOURCE.throughAwardYear);
      // Positive Picture claims establish these two broad positives, never negatives.
      if(facts.pictureNominated?.value)set("nominated",true,"positive-entry");
      if(facts.pictureWon?.value)set("won",true,"positive-entry");
    }
    const complete=completeRecords[movie.tmdbId];
    for(const key of OSCAR_KEYS) {
      const old=complete?evaluateOscar(complete,key,movie.releaseYear):null;
      if(old!==null && facts[key] && old!==facts[key]!.value) {
        conflicts.push({tmdbId:movie.tmdbId,question:key});facts[key]=null;
      }
    }
    if(Object.keys(facts).length)answers[movie.tmdbId]=facts;
    const record:OscarRecord=complete?{...complete,...(Object.keys(facts).length?{answers:facts}:{})}:
      {oscarNominations:null,oscarWins:null,nominatedForBestPicture:null,wonBestPicture:null,
        awardsDataStatus:Object.values(facts).some(Boolean)?"partial":"unknown",awardsSource:null,
        verifiedOn:null,coverageThroughCeremony:null,verifiedThroughAwardYear:null,countingMethod:null,
        ...(Object.keys(facts).length?{answers:facts}:{})};
    records[movie.tmdbId]=record;
    const evaluations=Object.fromEntries(OSCAR_KEYS.map(key=>[key,evaluateOscar(record,key,movie.releaseYear)]));
    let known=0;
    for(const key of OSCAR_KEYS) {
      const value=evaluations[key];coverage[key][value===true?"yes":value===false?"no":"unknown"]++;
      if(value!==null)known++;
    }
    distribution[known]=(distribution[known]??0)+1;
    return {tmdbId:movie.tmdbId,title:movie.title,releaseYear:movie.releaseYear,entity:qid??null,
      sourceMatched:legacy.films.find(m=>m.tmdbId===movie.tmdbId)?.sourceMatched??false,
      minimumConfirmedNominationCategories:nominations.get(movie.tmdbId)?.size??0,
      minimumConfirmedWinCategories:wins.get(movie.tmdbId)?.size??0,answers:evaluations};
  });
  return {answers,records,audit:{inputCutoff:input.throughCeremony,identityVerified:identities.size,identityIssues,
    bestPicture:{winnerCoverage,nomineeCoverage,nominees:allNominees.size,winners:allWinners.size,ceremonies:categoryAudit,
      rejectedStatements:groups.rejected},positiveEvidence:{accepted,rejected},conflicts,coverage,distribution,
    noKnownAnswers:films.filter(f=>Object.values(f.answers).every(v=>v===null)).length,
    exactTotals:Object.values(completeRecords).filter(r=>r.awardsDataStatus==="verified").length,
    verifiedZeroNominations:Object.values(completeRecords).filter(r=>r.awardsDataStatus==="verified"&&r.oscarNominations===0).length,films}};
}
