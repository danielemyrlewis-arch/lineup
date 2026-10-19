/** Turn cached CC0 query responses into a reviewable, pinned offline preparation input. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SOURCE, SOURCE_URL, awardPeriod } from "./awards/importer.ts";
import { pictureGroups, setHash } from "./awards/wikidata-verifier.ts";
import type { WikidataOscarInput, WikidataStatement, WikidataEntity } from "./awards/wikidata-types.ts";

type Row=Record<string,{value:string}>;
const folder=process.argv[2],legacyFile=process.argv[3],retrievedOn=process.argv[4]??new Date().toISOString().slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(retrievedOn))throw new Error("Supply the actual evidence retrieval date as YYYY-MM-DD");
if(!folder||!legacyFile)throw new Error("Usage: npm run compile:oscar-evidence -- /cache /pinned/oscar-nominations.json");
const hash=(raw:string|Buffer)=>createHash("sha256").update(raw).digest("hex");
const raw=readFileSync(legacyFile);
if(hash(raw)!==SOURCE.sha256)throw new Error("Original corroboration source pin differs");
const receipts:WikidataOscarInput["receipts"]=[];
const files=readdirSync(folder).filter(f=>/^(ids-\d+|meta-all-\d+|positive-\d+|picture-ranked|ceremony-metadata|categories)\.json$/.test(f)).sort();
const tables=new Map<string,Row[]>();
for(const file of files) {
  const bytes=readFileSync(`${folder}/${file}`),query=readFileSync(`${folder}/${file.replace(/\.json$/,".sparql")}`,"utf8");
  const data=JSON.parse(bytes.toString("utf8"));
  if(!Array.isArray(data.results?.bindings))throw new Error(`Malformed response ${file}`);
  tables.set(file,data.results.bindings);
  receipts.push({file,sha256:hash(bytes),query});
}
const qid=(s:string)=>s.split("/").at(-1)!;
const ids:[number,string][]=[];
const sets:Record<string,{tmdb:Set<number>;imdb:Set<string>;names:Set<string>;releaseYears:Set<number>}>={};
for(const [file,rows] of tables) {
  if(file.startsWith("ids-"))for(const row of rows)ids.push([Number(row.tmdb.value),qid(row.film.value)]);
  if(file.startsWith("meta-all-"))for(const row of rows) {
    const entity=sets[qid(row.film.value)]??={tmdb:new Set(),imdb:new Set(),names:new Set(),releaseYears:new Set()};
    const field=row.field.value,value=row.value.value;
    if(field==="tmdb")entity.tmdb.add(Number(value));
    else if(field==="imdb")entity.imdb.add(value);
    else if(field==="date")entity.releaseYears.add(Number(value.slice(0,4)));
    else entity.names.add(value);
  }
}
const entities:Record<string,WikidataEntity>=Object.fromEntries(Object.entries(sets).sort(([a],[b])=>a.localeCompare(b)).map(([q,v])=>[q,{
  tmdb:[...v.tmdb].sort((a,b)=>a-b),imdb:[...v.imdb].sort(),names:[...v.names].sort(),releaseYears:[...v.releaseYears].sort((a,b)=>a-b),
}]));
const statement=(row:Row,film:string,category:string,tmdbId?:number):WikidataStatement=>({
  film,category,kind:row.property.value.endsWith("P166")?"won":"nominated",statement:row.statement.value,
  rank:row.rank.value.endsWith("DeprecatedRank")?"deprecated":row.rank.value.endsWith("PreferredRank")?"preferred":"normal",
  ...(tmdbId?{tmdbId}:{}),...(row.ceremony?{ceremony:qid(row.ceremony.value)}:{}),...(row.date?{date:row.date.value}:{}),
});
const picture:WikidataStatement[]=[],positive:WikidataStatement[]=[];
for(const row of tables.get("picture-ranked.json")??[]) {
  if(row.tmdb)picture.push(statement(row,qid(row.subject.value),"Q102427",Number(row.tmdb.value)));
  if(row.work&&row.workTmdb)picture.push(statement(row,qid(row.work.value),"Q102427",Number(row.workTmdb.value)));
}
for(const [file,rows] of tables)if(file.startsWith("positive-"))for(const row of rows)
  positive.push(statement(row,qid(row.film.value),qid(row.award.value)));
const sortStatements=(rows:WikidataStatement[])=>rows.sort((a,b)=>a.statement.localeCompare(b.statement)||a.film.localeCompare(b.film)||String(a.date).localeCompare(String(b.date)));
const input:WikidataOscarInput={schema:1,retrievedOn,throughCeremony:98,
  ids:ids.sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1])),entities,
  ceremonies:(tables.get("ceremony-metadata.json")??[]).map(row=>({id:qid(row.ceremony.value),ordinal:Number((row.edition??row.ordinal).value),date:row.date.value})).sort((a,b)=>a.ordinal-b.ordinal),
  picture:sortStatements(picture),positive:sortStatements(positive),references:[],receipts};
const original=JSON.parse(raw.toString("utf8")) as {category:string;year:string;won:boolean;movies:{tmdb_id:number}[]}[];
for(let ordinal=1;ordinal<=96;ordinal++) {
  const rows=original.filter(r=>r.category==="Best Picture"&&awardPeriod(r.year)?.ceremony===ordinal);
  const nominees=rows.flatMap(r=>r.movies.map(m=>m.tmdb_id)),winners=rows.filter(r=>r.won).flatMap(r=>r.movies.map(m=>m.tmdb_id));
  input.references.push({ordinal,nominees:new Set(nominees).size,nomineeHash:setHash(nominees),winnerHash:setHash(winners),source:SOURCE_URL});
}
const groups=pictureGroups(input);
// These two boundary lists were checked against the broadcaster/AP nomination
// lists and independent distributor/label winner reports. Only CC0 values ship.
const boundaryReferences:Record<number,string>={
  97:"https://apnews.com/article/fab5f8ce66e992c20c5a0caa0c9b6427",
  98:"https://abc.com/news/ad570605-f133-4543-a644-f7b799659c70/category/3590739",
};
for(const ordinal of [97,98]) {
  const nominees=groups.nominees.get(ordinal)??new Set<number>(),winners=groups.winners.get(ordinal)??new Set<number>();
  if(nominees.size!==10||winners.size!==1)throw new Error(`Boundary ceremony ${ordinal} needs a fresh completeness review`);
  input.references.push({ordinal,nominees:10,nomineeHash:setHash(nominees),winnerHash:setHash(winners),source:boundaryReferences[ordinal]});
}
const output=JSON.stringify(input)+"\n";
writeFileSync("notes/oscar-wikidata-input.json",output);
console.log(JSON.stringify({sha256:hash(output),identityRows:ids.length,entities:Object.keys(entities).length,pictureStatements:picture.length,positiveStatements:positive.length,
  boundaryReviews:[97,98].map(ordinal=>({ordinal,nominees:[...(groups.nominees.get(ordinal)??[])].map(id=>({id,names:Object.values(entities).find(e=>e.tmdb.includes(id))?.names})),winners:[...(groups.winners.get(ordinal)??[])]}))},null,2));
console.log("Candidate input written. Review the audit and explicitly update the verifier's input pin before publication.");
