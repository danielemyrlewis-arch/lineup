/** Explicit offline-maintenance command. Never called by Next, builds or the game. */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";

const folder=process.argv[2];
if(!folder)throw new Error("Usage: npm run download:oscar-evidence -- /absolute/cache/folder");
const cache=resolve(folder);
if(["docs","public","lib"].some(dir=>cache===resolve(dir)||cache.startsWith(resolve(dir)+"/")))
  throw new Error("Raw evidence belongs outside published/runtime directories");
mkdirSync(cache,{recursive:true});
async function query(name:string,sparql:string):Promise<Record<string,{value:string}>[]> {
  const file=`${cache}/${name}.json`;
  const queryFile=`${cache}/${name}.sparql`;
  if(existsSync(file)) {
    if(!existsSync(queryFile) || readFileSync(queryFile,"utf8").replace(/\s+/g,"")!==sparql.replace(/\s+/g,""))
      throw new Error(`${name}: cache query differs; use a new cache folder rather than relabelling an old response`);
  } else {
    writeFileSync(queryFile,sparql);
    const url=new URL("https://query.wikidata.org/sparql");
    url.searchParams.set("query",sparql);url.searchParams.set("format","json");
    const response=await fetch(url,{headers:{"User-Agent":"LINEUP-offline-coverage-audit/1.0"},signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new Error(`${name}: HTTP ${response.status}; preserve cache and retry later`);
    writeFileSync(file,await response.text());
  }
  const rows=JSON.parse(readFileSync(file,"utf8")).results.bindings;
  console.log(`${name}: ${rows.length} rows`);
  return rows;
}
const identity:Record<string,{value:string}>[]=[];
for(let i=0;i<PRACTICE_CATALOGUE.length;i+=100) {
  const values=PRACTICE_CATALOGUE.slice(i,i+100).map(m=>`"${m.tmdbId}"`).join(" ");
  identity.push(...await query(`ids-${i/100}`,`SELECT ?film ?tmdb WHERE { VALUES ?tmdb { ${values} } ?film wdt:P4947 ?tmdb. }`));
}
await query("categories",`SELECT DISTINCT ?category ?label WHERE { { ?category wdt:P31 wd:Q19020. } UNION { ?category wdt:P361 wd:Q19020. } ?category rdfs:label ?label. FILTER(LANG(?label)="en") }`);
const picture=await query("picture-ranked",`SELECT ?subject ?property ?statement ?rank ?tmdb ?imdb ?date ?ceremony ?work ?workTmdb WHERE { VALUES (?property ?ps) { (p:P166 ps:P166) (p:P1411 ps:P1411) } ?subject ?property ?statement. ?statement ?ps wd:Q102427; wikibase:rank ?rank. FILTER(?rank != wikibase:DeprecatedRank) OPTIONAL{?subject wdt:P4947 ?tmdb.} OPTIONAL{?subject wdt:P345 ?imdb.} OPTIONAL{?statement pq:P585 ?date.} OPTIONAL{?statement pq:P805 ?ceremony.} OPTIONAL{?statement pq:P1686 ?work. OPTIONAL{?work wdt:P4947 ?workTmdb.}} }`);
await query("ceremony-metadata",`SELECT DISTINCT ?ceremony ?ordinal ?edition ?date WHERE { ?s p:P166 ?statement. ?statement ps:P166 wd:Q102427; pq:P805 ?ceremony. OPTIONAL{?ceremony wdt:P1545 ?ordinal.} OPTIONAL{?ceremony wdt:P393 ?edition.} OPTIONAL{?ceremony wdt:P585 ?date.} }`);
const qid=(url:string)=>url.split("/").at(-1)!;
const catalogueQids=[...new Set(identity.map(x=>qid(x.film.value)))].sort();
const allQids=new Set(catalogueQids);
for(const row of picture) {
  if(row.tmdb)allQids.add(qid(row.subject.value));
  if(row.work)allQids.add(qid(row.work.value));
}
const qids=[...allQids].sort();
for(let i=0;i<qids.length;i+=100) {
  const values=qids.slice(i,i+100).map(q=>`wd:${q}`).join(" ");
  await query(`meta-all-${i/100}`,`SELECT ?film ?field ?value WHERE { VALUES ?film { ${values} } { ?film rdfs:label ?value. FILTER(LANG(?value)="en") BIND("label" AS ?field) } UNION { ?film skos:altLabel ?value. FILTER(LANG(?value)="en") BIND("alias" AS ?field) } UNION { ?film wdt:P1476 ?value. BIND("title" AS ?field) } UNION { ?film p:P577 ?dateStatement. ?dateStatement ps:P577 ?value; wikibase:rank ?dateRank. FILTER(?dateRank != wikibase:DeprecatedRank) BIND("date" AS ?field) } UNION { ?film wdt:P345 ?value. BIND("imdb" AS ?field) } UNION { ?film wdt:P4947 ?value. BIND("tmdb" AS ?field) } }`);
}
// Query candidates generously; the verifier has an explicit competitive-category allow-list.
const categoryRows=JSON.parse(readFileSync(`${cache}/categories.json`,"utf8")).results.bindings as Record<string,{value:string}>[];
const excluded=new Set(["Q488151","Q489705","Q8624","Q8610","Q8636","Q844273","Q8250869","Q1699048","Q2032630","Q727328","Q111210907","Q116197098","Q31193514"]);
const categories=categoryRows.map(r=>qid(r.category.value)).filter(q=>!excluded.has(q)).sort().map(q=>`wd:${q}`).join(" ");
for(let i=0;i<catalogueQids.length;i+=75) {
  const values=catalogueQids.slice(i,i+75).map(q=>`wd:${q}`).join(" ");
  await query(`positive-${i/75}`,`SELECT ?film ?property ?award ?statement ?rank ?date ?ceremony WHERE { VALUES ?film { ${values} } VALUES (?property ?ps) { (p:P166 ps:P166) (p:P1411 ps:P1411) } ?film ?property ?statement. ?statement ?ps ?award; wikibase:rank ?rank. VALUES ?award { ${categories} } FILTER(?rank != wikibase:DeprecatedRank) OPTIONAL{?statement pq:P585 ?date.} OPTIONAL{?statement pq:P805 ?ceremony.} }`);
}
console.log("Raw CC0 evidence downloaded. Compile and review it explicitly before generating gameplay data.");
