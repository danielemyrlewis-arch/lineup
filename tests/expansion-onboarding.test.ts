import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { normaliseOscarRecord, UNKNOWN_OSCARS } from "../lib/data/awards.ts";
import { producedBy } from "../lib/data/studios.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { emptyPracticeHistory, rememberPracticePuzzle } from "../lib/game/practice-history.ts";
import { activeMovies, gameReducer, initialState } from "../lib/game/engine.ts";
import { evaluateQuestion, generateQuestions, searchQuestions, suggestedQuestions, validQuestions } from "../lib/game/questions.ts";
import { dismissStrategyHint, shouldShowStrategyHint, STRATEGY_HINT_KEY } from "../lib/game/onboarding.ts";
import type { Movie, Question } from "../lib/game/types.ts";

const base = PRACTICE_CATALOGUE.find((m) => m.tmdbId === 27205)!;
const film = (id: number, fields: Partial<Movie> = {}): Movie => ({
  ...base, id: String(id), tmdbId: id, ...fields,
});
const q = (id: string, films: Movie[]): Question => {
  const question = generateQuestions(films).find((q) => q.id === id);
  assert.ok(question, id);
  return question;
};

test("genres use all actual tags, including documentary and western, without musical inference", () => {
  const films = [
    film(1, {genres:["Horror", "Science Fiction"]}),
    film(2, {genres:["Documentary", "Music"]}),
    film(3, {genres:["Western"]}),
  ];
  for (const genre of ["Horror", "Science Fiction", "Documentary", "Music", "Western"])
    for (const m of films)
      assert.equal(evaluateQuestion(m,q(`genre:${genre}`,films)),m.genres!.includes(genre));
  assert.equal(evaluateQuestion({...films[1],enrichment:undefined},q("curated:isMusical",films)),null);
  assert.ok(searchQuestions(validQuestions(films),"cowboy").some((q)=>q.id==="genre:Western"));
  assert.ok(searchQuestions(validQuestions(films),"documentaries").some((q)=>q.id==="genre:Documentary"));
  assert.ok(!generateQuestions(PRACTICE_CATALOGUE).some((q)=>q.id==="genre:Documentary"));
});

test("all musical aliases select curated narrative classification, never the Music tag", () => {
  const films = [313369,244786].map(id=>PRACTICE_CATALOGUE.find(m=>m.tmdbId===id)!);
  const questions = validQuestions(films);
  for (const alias of ["musical","musicals","singing","songs","musical film"])
    assert.equal(searchQuestions(questions,alias)[0]?.id,"curated:isMusical");
  assert.equal(evaluateQuestion(films[0],q("curated:isMusical",films)),true);
  assert.equal(evaluateQuestion(films[1],q("curated:isMusical",films)),false);
  assert.ok(!validQuestions([...films,film(3,{enrichment:{isMusical:null}})]).some(q=>q.id==="curated:isMusical"));
});

test("old cinema, strict year thresholds and inclusive decades retain exact boundaries", () => {
  const films = [1920,1929,1950,1959,1969,1970,1979,1980,1990,2000,2010,2020,2023].map((releaseYear,i)=>film(i+1,{releaseYear}));
  for (const m of films) {
    assert.equal(evaluateQuestion(m,q("before:1970",films)),m.releaseYear!<1970);
    assert.equal(evaluateQuestion(m,q("after:2010",films)),m.releaseYear!>2010);
    for (const decade of [1920,1950,1970,2020])
      assert.equal(evaluateQuestion(m,q(`decade:${decade}`,films)),m.releaseYear!>=decade&&m.releaseYear!<=decade+9);
  }
  assert.ok(!validQuestions(films).some(q=>q.id==="decade:1940"));
  assert.ok(generateQuestions(films).some(q=>q.id==="before:1950"));
  assert.ok(searchQuestions(validQuestions(films),"fifties").some(q=>q.id==="decade:1950"));
  assert.deepEqual(searchQuestions(validQuestions(films),"90s").map(q=>q.id),["decade:1990"]);
});

test("all runtime thresholds are strict and word/numeric aliases resolve controlled questions", () => {
  const films=[89,90,91,119,120,121,149,150,151,179,180,181].map((runtime,i)=>film(i+1,{runtime}));
  for(const m of films) {
    assert.equal(evaluateQuestion(m,q("under:90",films)),m.runtime!<90);
    for(const threshold of [90,120,150,180])
      assert.equal(evaluateQuestion(m,q(`over:${threshold}`,films)),m.runtime!>threshold);
  }
  const questions=validQuestions(films);
  for(const [query,id] of [
    ["shorter than 90 minutes","under:90"], ["longer than 2 hours","over:120"],
    ["longer than 2hrs","over:120"],
    ["120 minutes","over:120"], ["150 minutes","over:150"],
    ["two and a half hours","over:150"], ["2½ hours","over:150"], ["three hours","over:180"],
  ]) assert.ok(searchQuestions(questions,query).some(q=>q.id===id),query);
  assert.ok(!validQuestions(films.slice(0,2)).some(q=>q.id==="over:180"));
});

test("original-language questions describe metadata rather than dialogue, and distinguish negation", () => {
  const films=[film(1,{originalLanguage:"en"}),film(2,{originalLanguage:"fr"}),film(3,{originalLanguage:"ko"})];
  const other=q("languageNot:en",films);
  assert.deepEqual(films.map(m=>evaluateQuestion(m,other)),[false,true,true]);
  assert.equal(searchQuestions(validQuestions(films),"non-English")[0]?.id,other.id);
  assert.equal(searchQuestions(validQuestions(films),"not english")[0]?.id,other.id);
  assert.ok(!validQuestions([...films,film(4,{originalLanguage:null})]).some(q=>q.kind==="language"||q.kind==="languageNot"));
  assert.ok(!other.label.includes("primarily"));
});

test("production-country and international co-production answers use distinct country credits", () => {
  const films=[film(1,{productionCountries:["GB"]}),film(2,{productionCountries:["FR","GB"]}),film(3,{productionCountries:["KR","KR"]})];
  assert.deepEqual(films.map(m=>evaluateQuestion(m,q("coProduction:true",films))),[false,true,false]);
  assert.deepEqual(films.map(m=>evaluateQuestion(m,q("country:GB",films))),[true,true,false]);
  assert.ok(searchQuestions(validQuestions(films),"British").some(q=>q.id==="country:GB"));
  assert.ok(searchQuestions(validQuestions(films),"Korean").some(q=>q.id==="country:KR"));
  assert.ok(!validQuestions([...films,film(4,{productionCountries:[]})]).some(q=>q.kind==="coProduction"));
  assert.ok(!generateQuestions(films).some(q=>/set in|filmed in/.test(q.label)));
});

test("studio IDs take precedence over conflicting names; incomplete credits cannot produce NO", () => {
  assert.equal(producedBy(film(1,{productionCompanies:[{id:999999,name:"Pixar"}]}),"pixar"),false);
  assert.equal(producedBy(film(2,{productionCompanies:[{id:3,name:"Historic spelling"}]}),"pixar"),true);
  assert.equal(producedBy(film(3,{productionCompanies:[{id:null,name:"Pixar Animation Studios"}]}),"pixar"),true);
  assert.equal(producedBy(film(4,{productionCompanies:[{id:3,name:"Pixar"},{id:2,name:""}]}),"disney"),null);
  assert.equal(producedBy(film(5,{productionCompanies:[{id:3,name:"Pixar"}]}),"disney"),false);
});

test("people searches support natural questions, partial surnames and punctuation without case sensitivity", () => {
  const films=[film(1,{cast:["Tom Hanks"],director:"Christopher Nolan"}),film(2,{cast:["Tom Cruise"],director:"Bong Joon-ho"})];
  const questions=validQuestions(films);
  for(const [query,id] of [
    ["Is Tom Hanks in it?","cast:Tom Hanks"], ["hanks","cast:Tom Hanks"],
    ["Does it feature Tom Cruise?","cast:Tom Cruise"], ["tom cru","cast:Tom Cruise"],
    ["Was it directed by Christopher Nolan?","director:Christopher Nolan"],
    ["NOLAN","director:Christopher Nolan"], ["Bong Joon ho","director:Bong Joon-ho"],
  ]) assert.ok(searchQuestions(questions,query).some(q=>q.id===id),query);
});

test("lead wording names the performer without changing gender evaluation or inferring characters", () => {
  const m=film(1,{topBilledLead:{tmdbId:1,name:"Performer",gender:"female",character:"A man"}});
  const female=q("leadGender:female",[m]);
  assert.match(female.label,/top-billed performer/);
  assert.equal(evaluateQuestion(m,female),true);
  assert.equal(evaluateQuestion({...m,topBilledLead:{...m.topBilledLead!,gender:null}},female),null);
});

test("undefined, empty and malformed metadata stay unknown across every supported category", () => {
  const missing={...base,releaseYear:undefined,runtime:NaN,genres:[],director:"",cast:undefined,
    originalLanguage:"",productionCountries:[],productionCompanies:undefined,belongsToCollection:undefined,
    topBilledLead:undefined,enrichment:undefined} as unknown as Movie;
  for(const question of generateQuestions(PRACTICE_CATALOGUE))
    assert.equal(evaluateQuestion(missing,question),null,question.id);
  assert.deepEqual(validQuestions([base,missing]),[]);
  const unsupported={...generateQuestions([base])[0],kind:"unsupported"} as unknown as Question;
  assert.equal(evaluateQuestion(base,unsupported),null);
});

test("autocomplete de-duplicates IDs and suppresses unavailable awards and unsupported plot attributes", () => {
  const questions=validQuestions(PRACTICE_CATALOGUE);
  const matches=searchQuestions([...questions,...questions],"old");
  assert.equal(new Set(matches.map(q=>q.id)).size,matches.length);
  // Oscar Isaac is a legitimate cast search, not an awards question.
  assert.ok(searchQuestions(questions,"Oscar").every(q=>q.kind==="cast"||q.kind==="director"));
  assert.ok(searchQuestions(questions,"Oscar Isaac").some(q=>q.id==="cast:Oscar Isaac"));
  for(const query of ["Best Picture","Christmas","time travel","based on a book"])
    assert.deepEqual(searchQuestions(questions,query),[],query);
});

test("explicitly uncredited cameos are excluded without rewriting cached cast or detail data", () => {
  const cameo=film(1,{cast:["A Cameo","A Lead"],castMembers:[{tmdbId:1,name:"A Cameo",character:"Passerby (uncredited)",profilePath:null,order:0}]});
  const credited=film(2,{cast:["A Cameo"],castMembers:null});
  const question=q("cast:A Cameo",[cameo,credited]);
  assert.equal(evaluateQuestion(cameo,question),false);
  assert.equal(evaluateQuestion(credited,question),true);
  assert.deepEqual(cameo.cast,["A Cameo","A Lead"]);
  assert.ok(!generateQuestions([cameo]).some(q=>q.id==="cast:A Cameo"));
});

const reviewed={oscarNominations:4,oscarWins:2,nominatedForBestPicture:true,wonBestPicture:false,
  awardsDataStatus:"verified",awardsSource:"https://example.org/reviewed-record",
  verifiedOn:"2026-10-19",coverageThroughCeremony:98,verifiedThroughAwardYear:2025,countingMethod:"competitive-film-category-entries"};
test("optional Oscar records preserve reviewed counts and explicitly verified zero without inventing data", () => {
  assert.deepEqual(normaliseOscarRecord(reviewed),reviewed);
  const zero={...reviewed,oscarNominations:0,oscarWins:0,nominatedForBestPicture:false};
  assert.deepEqual(normaliseOscarRecord(zero),zero);
});
test("missing, partial, inconsistent or unverified Oscar rows remain entirely unknown", () => {
  for(const row of [undefined,null,{}, {...reviewed,awardsDataStatus:"unknown"},
    {...reviewed,awardsSource:null},{...reviewed,coverageThroughCeremony:null},
    {...reviewed,oscarWins:5},{...reviewed,oscarNominations:null},
    {...reviewed,wonBestPicture:true,oscarWins:0}, {...reviewed,verifiedOn:"2026-02-30"},
    {...reviewed,countingMethod:null}]) assert.deepEqual(normaliseOscarRecord(row),UNKNOWN_OSCARS);
  const films=[film(1,{oscars:normaliseOscarRecord(reviewed)}),film(2,{oscars:null})];
  assert.deepEqual(searchQuestions(validQuestions(films),"Oscar"),[]);
  assert.equal(PRACTICE_CATALOGUE.filter(m=>m.oscars?.awardsDataStatus==="verified").length,20);
});

function storage(entries:Record<string,string>={}) {
  const values=new Map(Object.entries(entries));
  return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
}
test("strategy hint appears only for a new browser and its dismissal persists without changing existing keys", () => {
  const fresh=storage();
  assert.equal(shouldShowStrategyHint(fresh),true);
  dismissStrategyHint(fresh);
  assert.equal(fresh.getItem(STRATEGY_HINT_KEY),"true");
  assert.equal(shouldShowStrategyHint(fresh),false);
  const returning: Record<string,string>[] = [
    {"lineup:help-seen":"true"},
    {"lineup:practice:v1":JSON.stringify({played:1})},
    {"lineup:practice-films:v1":JSON.stringify({boards:[[1,2]],mysteries:[1]})},
  ];
  for(const entries of returning) assert.equal(shouldShowStrategyHint(storage(entries)),false);
  const blocked={getItem:()=>{throw Error("blocked");},setItem:()=>{throw Error("full");}};
  assert.equal(shouldShowStrategyHint(blocked),false);
  assert.doesNotThrow(()=>dismissStrategyHint(blocked));
});

test("real Help content gives beginners an explicitly illustrative elimination example and one final guess", () => {
  const exports={} as {HowToPlay:React.ComponentType};
  const compiled=ts.transpileModule(readFileSync(new URL("../components/game/how-to-play.tsx",import.meta.url),"utf8"),{
    compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS},
  });
  runInNewContext(compiled.outputText,{React,exports});
  const html=renderToStaticMarkup(React.createElement(exports.HowToPlay));
  assert.match(html,/<h2>How to play<\/h2>/);
  assert.equal((html.match(/<li>/g)??[]).length,4);
  assert.match(html,/Illustrative example, not your current lineup/);
  assert.match(html,/24 films/);
  assert.match(html,/15 films remaining/);
  assert.match(html,/one final/);
  assert.match(html,/depends on the lineup and the answer/);
  assert.match(html,/before using all five/);
  assert.match(html,/after each answer|After each answer/);
});

test("Help keeps a named native dialog with an accessible close button and actual tutorial content", () => {
  const exports={} as {Dialog:React.ComponentType<{title:string;onClose:()=>void;children?:React.ReactNode}>};
  const compiled=ts.transpileModule(readFileSync(new URL("../components/game/dialog.tsx",import.meta.url),"utf8"),{
    compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS},
  });
  runInNewContext(compiled.outputText,{React,exports,require:(name:string)=>name==="react"?React:{X:()=>null}});
  const html=renderToStaticMarkup(React.createElement(exports.Dialog,{title:"How to play",onClose:()=>{}},React.createElement("h2",null,"How to play")));
  assert.match(html,/<dialog[^>]*aria-label="How to play"/);
  assert.match(html,/aria-label="Close How to play"/);
  assert.match(html,/<button type="button"/);
});

test("real sequential lineups offer only known splits, keep the mystery and enforce five questions", () => {
  let history=emptyPracticeHistory();
  for(const seed of [3,11,29,74,101,212,913,2026]) {
    const puzzle=createPracticePuzzle(PRACTICE_CATALOGUE,seed,"demo",history);
    history=rememberPracticePuzzle(history,puzzle);
    assert.equal(puzzle.movies.length,24);
    let state=initialState(puzzle);
    for(let turn=0;turn<5;turn++) {
      const active=activeMovies(state);
      const questions=validQuestions(active,state.history.map(h=>h.question.id));
      for(const question of questions) {
        const answers=active.map(m=>evaluateQuestion(m,question));
        assert.ok(answers.every(answer=>typeof answer==="boolean"));
        assert.ok(answers.includes(true)&&answers.includes(false));
      }
      const suggestions=suggestedQuestions(questions);
      assert.equal(new Set(suggestions.map(q=>q.partitionKey)).size,suggestions.length);
      if(questions.length) assert.equal(suggestions[0].balance,questions[0].balance);
      if(!questions.length) break;
      const question=questions[(seed+turn)%questions.length];
      const mystery=puzzle.movies.find(m=>m.id===puzzle.mysteryId)!;
      const answer=evaluateQuestion(mystery,question);
      const expected=active.filter(m=>evaluateQuestion(m,question)===answer).map(m=>m.id);
      state=gameReducer(state,{type:"ask",question});
      assert.deepEqual(state.activeIds,expected);
      assert.ok(state.activeIds.includes(puzzle.mysteryId));
      if(state.history.length===5) assert.equal(gameReducer(state,{type:"ask",question}),state);
    }
    const changedMystery={...puzzle,mysteryId:puzzle.movies.find(m=>m.id!==puzzle.mysteryId)!.id};
    assert.deepEqual(suggestedQuestions(validQuestions(activeMovies(initialState(changedMystery)))),suggestedQuestions(validQuestions(puzzle.movies)));
  }
});
