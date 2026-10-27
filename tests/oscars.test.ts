import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import * as awards from "../lib/data/awards.ts";
import { OSCAR_RECORDS } from "../lib/data/oscar-snapshot.ts";
import { withBundledAwards } from "../lib/data/bundled-awards.ts";
import { OSCAR_QUESTIONS, normaliseOscarRecord, UNKNOWN_OSCARS } from "../lib/data/awards.ts";
import { prepareOscarImport, awardPeriod, normaliseCategory, SOURCE, SOURCE_URL } from "../scripts/awards/importer.ts";
import type { SourceNomination, FilmReview } from "../scripts/awards/importer.ts";
import { FILM_REVIEWS } from "../scripts/awards/reviews.ts";
import { evaluateQuestion, generateQuestions, validQuestions, searchQuestions, suggestedQuestions } from "../lib/game/questions.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { initialState, activeMovies, gameReducer } from "../lib/game/engine.ts";
import type { Movie, Question } from "../lib/game/types.ts";

const get=(id:number)=>PRACTICE_CATALOGUE.find(m=>m.tmdbId===id)!;
const film=(id=1,fields:Partial<Movie>={}):Movie=>({...get(27205),id:String(id),tmdbId:id,title:"Test",releaseYear:2010,oscars:null,...fields});
const row=(fields:Partial<SourceNomination>={}):SourceNomination=>({category:"Best Picture",year:"2010",nominees:["Producer A","Producer B"],movies:[{title:"Test",tmdb_id:1,imdb_id:"tt1234567"}],won:true,...fields});
const review=(fields:Partial<FilmReview>={}):FilmReview=>({tmdbId:1,title:"Test",releaseYear:2010,nominations:1,wins:1,pictureNominated:true,pictureWon:true,evidence:["https://example.org/independent-film-review"],note:"Synthetic complete record fixture",...fields});
const question=(key:string):Question=>generateQuestions([]).find(q=>q.id===`oscar:${key}`)!;

test("exact TMDB ID join does not attach a same-title remake or use a title-only fallback",()=>{
  const movies=[film(),film(2,{releaseYear:1990})];
  const result=prepareOscarImport([row()],movies,[review()]);
  assert.equal(result.records[1].oscarNominations,1);
  assert.equal(result.records[2],undefined);
  assert.equal(prepareOscarImport([row({movies:[{title:"Test",tmdb_id:3,imdb_id:"tt7654321"}]})],movies,[review()]).records[1],undefined);
  assert.equal(prepareOscarImport([row({movies:[{title:"Different film",tmdb_id:1,imdb_id:"tt7654321"}]})],movies,[review()]).records[1],undefined);
  assert.equal(prepareOscarImport([row()], [film(1,{releaseYear:2020})], [review({releaseYear:2020})]).records[1],undefined);
});

test("shared recipients count once; repeated rows/orderings deduplicate; distinct entries in one category survive",()=>{
  const first=row({category:"Best Original Song",nominees:["Song A","Composer A"]});
  const duplicate={...first,nominees:[...first.nominees].reverse()};
  const second=row({category:"Best Original Song",nominees:["Song B"],won:false});
  const result=prepareOscarImport([first,duplicate,second],[film()],[review({nominations:2,wins:1,pictureNominated:false,pictureWon:false})]);
  assert.equal(result.records[1].oscarNominations,2);
  assert.equal(result.records[1].oscarWins,1);
  assert.equal(result.audit.duplicates.length,1);
  assert.equal(result.audit.films[0].entries.length,2);
});

test("conflicting duplicates, malformed data and multiple-film entries are quarantined without guessed splits",()=>{
  const conflict=prepareOscarImport([row(),row({won:false})],[film()],[review()]);
  assert.equal(conflict.records[1],undefined);
  assert.ok(conflict.audit.issues.some(i=>i.reason.includes("conflicting")));
  const multi=prepareOscarImport([row({movies:[...row().movies,{title:"Another",tmdb_id:2,imdb_id:"tt7654321"}]})],[film()],[review()]);
  assert.equal(multi.records[1],undefined);
  assert.ok(multi.audit.issues.some(i=>i.reason.includes("multi-film")));
  for(const invalid of [{...row(),won:null},{...row(),movies:[{title:"Test",tmdb_id:null}]},{...row(),year:"2025"}]) {
    const result=prepareOscarImport([row(),invalid],[film()],[review()]);
    assert.equal(result.audit.summary.malformedRecords,1);
    assert.deepEqual(result.records,{});
  }
  // The TMDB join is still valid when optional IMDb cross-check data is absent.
  assert.equal(prepareOscarImport([row({movies:[{...row().movies[0],imdb_id:null}]})],[film()],[review()]).records[1].oscarNominations,1);
});

test("historical Best Picture equivalents are explicit; artistic production and contributor awards stay separate",()=>{
  for(const name of ["Best Picture","Outstanding Picture","Outstanding Production","Outstanding Motion Picture","Best Motion Picture"])
    assert.equal(normaliseCategory(name),"picture");
  assert.notEqual(normaliseCategory("Unique and Artistic Production"),"picture");
  const result=prepareOscarImport([row({category:"Best Actor"}),row({category:"Best Director",nominees:["Director"],won:false})],[film()],[review({nominations:2,pictureNominated:false,pictureWon:false})]);
  assert.equal(result.records[1].nominatedForBestPicture,false);
  assert.equal(normaliseCategory("A new undocumented category"),null);
  assert.notEqual(normaliseCategory("Best Cinematography (Color)"),normaliseCategory("Best Cinematography (Black and White)"));
});

test("honorary/special/noncompetitive awards never enter competitive totals",()=>{
  const result=prepareOscarImport([row(),row({category:"Honorary Award"})],[film()],[review()]);
  assert.equal(result.audit.films[0].candidateNominations,1);
  assert.ok(result.audit.issues.some(i=>i.reason==="noncompetitive award excluded"));
  // A known excluded honorary award does not change the reviewed competitive total.
  assert.equal(result.records[1].oscarNominations,1);
  const early=prepareOscarImport([row({category:"Best International Feature Film",year:"1950"})],[film(1,{releaseYear:1950})],[]);
  assert.equal(early.audit.films[0].candidateNominations,0);
});

test("eligibility periods map to ceremonies without adding one to every early calendar year",()=>{
  assert.deepEqual(awardPeriod("1927/28"),{start:1927,end:1928,ceremony:1,ceremonyYear:1929});
  assert.equal(awardPeriod("1928/29")?.ceremonyYear,1930);
  assert.equal(awardPeriod("1929/30")?.ceremonyYear,1930);
  assert.equal(awardPeriod("1932/33")?.ceremonyYear,1934);
  assert.deepEqual(awardPeriod("2023"),{start:2023,end:2023,ceremony:96,ceremonyYear:2024});
  assert.equal(awardPeriod("2024"),null);
});

test("absence stays unknown; zero requires explicit independent no-nomination evidence and covered eligibility years",()=>{
  assert.deepEqual(prepareOscarImport([], [film()], []).records,{});
  const zero=review({nominations:0,wins:0,pictureNominated:false,pictureWon:false,eligibleAwardYears:[2010]});
  assert.equal(prepareOscarImport([], [film()], [zero]).records[1].oscarNominations,0);
  for(const bad of [{...zero,eligibleAwardYears:undefined},{...zero,eligibleAwardYears:[2024]}, {...zero,evidence:[]}, {...zero,note:""}])
    assert.equal(prepareOscarImport([], [film()], [bad]).records[1],undefined);
  const recent=review({...zero,releaseYear:2025,eligibleAwardYears:[2025]});
  assert.equal(prepareOscarImport([], [film(1,{releaseYear:2025})], [recent]).records[1],undefined);
});

test("a film review must agree with the source totals and stable catalogue identity",()=>{
  for(const bad of [review({nominations:2}),review({wins:0}),review({pictureWon:false}),review({title:"Test remake"}),review({evidence:["http://example.org"]})])
    assert.equal(prepareOscarImport([row()],[film()],[bad]).records[1],undefined);
  assert.throws(()=>prepareOscarImport([], [film(),film()], []),/Duplicate catalogue/);
  assert.throws(()=>prepareOscarImport([], [film()], [review(),review()]),/Duplicate film reviews/);
});

test("reviewed real films preserve distinct song/acting nominations and correct Best Picture outcomes",()=>{
  for(const r of FILM_REVIEWS) {
    const m=get(r.tmdbId), record=m.oscars!;
    assert.equal(m.title,r.title);assert.equal(m.releaseYear,r.releaseYear);
    assert.equal(record.oscarNominations,r.nominations,r.title);
    assert.equal(record.oscarWins,r.wins,r.title);
    assert.equal(record.nominatedForBestPicture,r.pictureNominated,r.title);
    assert.equal(record.wonBestPicture,r.pictureWon,r.title);
    assert.equal(record.verifiedThroughAwardYear,2023);
    assert.equal(record.coverageThroughCeremony,96);
  }
  assert.equal(get(346698).oscars?.oscarNominations,8); // two separate songs
  assert.equal(get(545611).oscars?.oscarNominations,11); // two supporting actresses
  assert.equal(get(278).oscars?.oscarWins,0);
  assert.equal(get(872).oscars?.nominatedForBestPicture,false);
  assert.equal(get(244).oscars?.oscarNominations,0); // original King Kong
  assert.equal(get(254).oscars?.oscarNominations,null); // no zero leakage to its nominated remake
  assert.equal(get(238).oscars?.oscarNominations,null); // a confirmed positive is still not an exact total
});

test("exact totals remain twenty records; question evidence is separate and raw source stays outside runtime data",()=>{
  assert.equal(PRACTICE_CATALOGUE.length,1206);
  assert.equal(Object.keys(OSCAR_RECORDS).length,20);
  assert.equal(PRACTICE_CATALOGUE.filter(m=>m.oscars?.awardsDataStatus==="verified").length,20);
  assert.equal(PRACTICE_CATALOGUE.filter(m=>m.oscars?.awardsDataStatus==="unknown").length,6);
  assert.equal(PRACTICE_CATALOGUE.filter(m=>m.oscars?.awardsDataStatus==="partial").length,1180);
  assert.deepEqual(withBundledAwards(film(99999999)).oscars,UNKNOWN_OSCARS);
  const audit=JSON.parse(readFileSync(new URL('../notes/oscar-import-audit.json',import.meta.url),'utf8'));
  assert.equal(audit.source.sha256,SOURCE.sha256);
  assert.equal(audit.summary.exactMatchedFilms,549);
  assert.equal(audit.zeroAudit.length,10);
  assert.equal(audit.reviewFailures.length,0);
});

test("all seven canonical Oscar questions evaluate known YES and NO using the existing engine",()=>{
  const yes=get(597),no=get(694);
  assert.equal(OSCAR_QUESTIONS.length,7);
  const questions=validQuestions([yes,no]).filter(q=>q.kind==="oscar");
  assert.equal(questions.length,7);
  for(const q of questions) {
    assert.equal(evaluateQuestion(yes,q),true);
    assert.equal(evaluateQuestion(no,q),false);
    assert.equal(q.yesCount,1);assert.equal(q.noCount,1);
  }
  assert.equal(evaluateQuestion(get(872),question("nominations3")),false);
  assert.equal(evaluateQuestion(get(389),question("nominations3")),true);
  assert.equal(evaluateQuestion(get(389),question("nominations5")),false);
  assert.equal(evaluateQuestion(get(27205),question("pictureWon")),false);
  assert.equal(evaluateQuestion(yes,{...question("won"),value:"unsupported"}),null);
});

test("nomination and win thresholds include exactly three and exactly five",()=>{
  for(const [count,three,five] of [[0,false,false],[2,false,false],[3,true,false],[4,true,false],[5,true,true]] as const) {
    const m=film(1,{oscars:{...OSCAR_RECORDS[597],oscarNominations:count,oscarWins:count,
      nominatedForBestPicture:false,wonBestPicture:false}});
    assert.equal(evaluateQuestion(m,question("nominations3")),three);
    assert.equal(evaluateQuestion(m,question("nominations5")),five);
    assert.equal(evaluateQuestion(m,question("wins3")),three);
  }
});

test("any unknown, malformed, partial or beyond-cutoff film suppresses Oscar questions, never yielding a false NO",()=>{
  const known=[get(597),get(694)];
  for(const oscars of [null,undefined,{}, {...OSCAR_RECORDS[597],oscarNominations:null}, {...OSCAR_RECORDS[597],verifiedThroughAwardYear:null}]) {
    const missing=film(42,{oscars:oscars as Movie['oscars']});
    assert.equal(evaluateQuestion(missing,question("won")),null);
    assert.ok(!validQuestions([...known,missing]).some(q=>q.kind==="oscar"));
  }
  const future=film(42,{releaseYear:2025,oscars:OSCAR_RECORDS[597]});
  assert.equal(evaluateQuestion(future,question("nominated")),null);
  assert.deepEqual(normaliseOscarRecord({...OSCAR_RECORDS[597],verifiedThroughAwardYear:2027}),UNKNOWN_OSCARS);
  assert.deepEqual(normaliseOscarRecord({...OSCAR_RECORDS[597],coverageThroughCeremony:98}),UNKNOWN_OSCARS);
  assert.deepEqual(normaliseOscarRecord({...OSCAR_RECORDS[597],verifiedThroughAwardYear:2026,coverageThroughCeremony:99}),UNKNOWN_OSCARS);
  assert.ok(!validQuestions([get(597),get(27205)]).some(q=>q.id==="oscar:nominated"));
});

test("Oscar aliases surface only available canonical questions and keep Oscar Isaac searchable",()=>{
  const films=[get(597),get(694),get(872),get(278)],questions=validQuestions(films);
  for(const query of ["Oscar","academy award","awards","nominated","won an Oscar","best picture","3 nominations","five nominations"])
    assert.ok(searchQuestions(questions,query).some(q=>q.kind==="oscar"),query);
  assert.equal(searchQuestions(questions,"Was it nominated for an Oscar?")[0].id,"oscar:nominated");
  for(const query of ["Oscar","academy award","best picture"])
    assert.ok(!searchQuestions(validQuestions([...films,get(28)]),query).some(q=>q.kind==="oscar"));
  const people=validQuestions([film(1,{cast:["Oscar Isaac"]}),film(2,{cast:["Another Actor"]})]);
  assert.equal(searchQuestions(people,"Oscar Isaac")[0].id,"cast:Oscar Isaac");
  assert.equal(new Set(searchQuestions([...questions,...questions],"Oscar").map(q=>q.id)).size,7);
});

test("Oscar splits use ordinary balance ranking and never duplicate a suggestion partition",()=>{
  const films=[get(597),get(27205),get(694),get(949)];
  const questions=validQuestions(films);
  const won=questions.find(q=>q.id==="oscar:won")!;
  assert.equal(won.balance,0.5);
  const suggestions=suggestedQuestions(questions,100);
  assert.equal(new Set(suggestions.map(q=>q.partitionKey)).size,suggestions.length);
  assert.equal(new Set(suggestions.map(q=>q.category)).size,suggestions.length);
  assert.ok(suggestions.every(q=>questions.includes(q)));
  assert.ok(!validQuestions(films,[won.id]).some(q=>q.id===won.id));
});

test("Oscar questions keep the mystery, reject injected answers/unknowns, and respect the existing five-question limit",()=>{
  const realReviewed=PRACTICE_CATALOGUE.filter(m=>m.oscars?.awardsDataStatus==="verified");
  // Four explicit test-only copies fill a regulation-size board; production data is unchanged.
  const reviewed=[...realReviewed,...realReviewed.slice(0,4).map((m,i)=>({...m,id:String(900000+i),tmdbId:900000+i}))];
  for(const mystery of reviewed) {
    const puzzle={...createPracticePuzzle(PRACTICE_CATALOGUE,902),movies:reviewed,mysteryId:mystery.id};
    for(const q of validQuestions(reviewed).filter(q=>q.kind==="oscar")) {
      const before=initialState(puzzle),after=gameReducer(before,{type:"ask",question:{...q,value:"forged"}});
      assert.ok(after.activeIds.includes(mystery.id));
      assert.deepEqual(after.activeIds,reviewed.filter(m=>evaluateQuestion(m,q)===evaluateQuestion(mystery,q)).map(m=>m.id));
    }
    let state=initialState(puzzle);
    for(let turn=0;turn<5;turn++) {
      const choices=validQuestions(activeMovies(state),state.history.map(h=>h.question.id));
      const q=choices.find(q=>q.kind==="oscar")??choices[0];
      if(!q)break;
      state=gameReducer(state,{type:"ask",question:q});
      assert.ok(state.activeIds.includes(mystery.id));
    }
    if(state.history.length===5)assert.equal(gameReducer(state,{type:"ask",question:question("won")}),state);
  }
  const state=initialState(createPracticePuzzle(PRACTICE_CATALOGUE,23));
  assert.equal(gameReducer(state,{type:"ask",question:question("won")}),state);
});

test("film details show compact verified totals, keep synopsis/cast, and omit unknown awards",()=>{
  const exports={} as {FilmDetails:React.ComponentType<{movie:Movie}>};
  const source=ts.transpileModule(readFileSync(new URL('../components/game/film-details.tsx',import.meta.url),'utf8'),{
    compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS},
  });
  runInNewContext(source.outputText,{React,exports,require:(name:string)=>name==="react"?React:awards});
  const render=(m:Movie)=>renderToStaticMarkup(React.createElement(exports.FilmDetails,{movie:m}));
  const inception=render(get(27205));
  assert.match(inception,/8 Oscar nominations · 4 wins/);
  assert.match(inception,/confirm-synopsis/);assert.match(inception,/aria-label="Cast"/);
  assert.match(inception,/Leonardo DiCaprio/);
  assert.match(render(get(597)),/Best Picture winner/);
  assert.match(render(get(949)),/0 Oscar nominations · 0 wins/);
  assert.doesNotMatch(render(get(238)),/aria-label="Academy Awards"/);
  assert.equal(awards.oscarSummary(null),null);
  assert.equal(awards.oscarSummary({...OSCAR_RECORDS[597],oscarNominations:null}),null);
});

test("audit retains a reproducible source pin and every published positive has complete independent review",()=>{
  assert.ok(SOURCE_URL.includes(SOURCE.commit));
  for(const record of Object.values(OSCAR_RECORDS))assert.equal(record.verifiedThroughAwardYear,2023);
  const audit=JSON.parse(readFileSync(new URL('../notes/oscar-import-audit.json',import.meta.url),'utf8'));
  assert.equal(Object.values(audit.periods).length,96);
  assert.equal(audit.summary.sourceRecords,10568);
  assert.equal(audit.summary.sourceWinnerRecords,2183);
  assert.equal(audit.summary.duplicateRecords,0);
  assert.equal(audit.summary.malformedRecords,0);
});
