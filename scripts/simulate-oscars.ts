/** Real Practice generation/history; opening examples, then neutral simulated player choices. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { OSCAR_KEYS } from "../lib/data/awards.ts";
import { createPracticePuzzle, franchiseKeys } from "../lib/game/practice-selection.ts";
import { emptyPracticeHistory, rememberPracticePuzzle } from "../lib/game/practice-history.ts";
import { initialState, activeMovies, gameReducer } from "../lib/game/engine.ts";
import { validQuestions, openingQuestionExamples, evaluateQuestion } from "../lib/game/questions.ts";
import type { OscarQuestionKey, RankedQuestion } from "../lib/game/types.ts";

const count=Math.max(1000,Math.min(5000,Number(process.argv[2])||1000));
const seedStart=0x4f534300;
const noAwards=PRACTICE_CATALOGUE.map(m=>({...m,oscars:null}));
const groups:Record<string,OscarQuestionKey[]>={
  anyOscar:[...OSCAR_KEYS],nomination:["nominated","nominations3","nominations5"],
  win:["won","wins3"],bestPicture:["pictureNominated","pictureWon"],
};
const initial:Record<string,number>={},playable:Record<string,number>={},suggestedInitial:Record<string,number>={},suggestedDuring:Record<string,number>={};
const perQuestion=Object.fromEntries(OSCAR_KEYS.map(key=>[key,{initialGames:0,playableGames:0}])) as Record<OscarQuestionKey,{initialGames:number;playableGames:number}>;
const boardCoverage=Object.fromEntries(OSCAR_KEYS.map(key=>[key,Array(25).fill(0)])) as Record<OscarQuestionKey,number[]>;
const filmCoverage=Object.fromEntries(OSCAR_KEYS.map(key=>[key,{yes:0,no:0,unknown:0}])) as Record<OscarQuestionKey,{yes:number;no:number;unknown:number}>;
const definitions=new Map(OSCAR_KEYS.map(key=>[key,{id:`oscar:${key}`,kind:"oscar" as const,value:key,label:"",shortLabel:"",category:"Awards",aliases:[]} ]));
for(const movie of PRACTICE_CATALOGUE)for(const key of OSCAR_KEYS) {
  const value=evaluateQuestion(movie,definitions.get(key)!);
  filmCoverage[key][value===true?"yes":value===false?"no":"unknown"]++;
}
let history=emptyPracticeHistory(),unchangedSelections=0,limitBlockedOnly=0;
const filmFrequencies=new Map<number,number>();
const availableByTurn=[0,0,0,0,0];
const offeredGroups=(questions:RankedQuestion[])=>Object.keys(groups).filter(group=>questions.some(q=>q.kind==="oscar"&&groups[group].includes(q.value as OscarQuestionKey)));
for(let i=0;i<count;i++) {
  const puzzle=createPracticePuzzle(PRACTICE_CATALOGUE,seedStart+i,"demo",history);
  const baseline=createPracticePuzzle(noAwards,seedStart+i,"demo",history);
  assert.deepEqual(puzzle.movies.map(m=>m.id),baseline.movies.map(m=>m.id),`Film selection changed at seed ${seedStart+i}`);
  assert.equal(puzzle.mysteryId,baseline.mysteryId,`Mystery selection changed at seed ${seedStart+i}`);
  unchangedSelections++;
  const recent=new Set(history.boards.slice(0,5).flat()),families=new Set<string>();
  assert.ok(!history.mysteries.includes(Number(puzzle.mysteryId)));
  for(const movie of puzzle.movies) {
    assert.ok(!recent.has(movie.tmdbId));
    for(const family of franchiseKeys(movie)) {assert.ok(!families.has(family));families.add(family);}
    filmFrequencies.set(movie.tmdbId,(filmFrequencies.get(movie.tmdbId)??0)+1);
  }
  for(const key of OSCAR_KEYS) {
    const known=puzzle.movies.filter(m=>evaluateQuestion(m,definitions.get(key)!)!==null).length;
    boardCoverage[key][known]++;
  }
  const gameGroups=new Set<string>(),gameQuestions=new Set<OscarQuestionKey>(),suggestedGroups=new Set<string>();
  let state=initialState(puzzle);
  for(let turn=0;turn<5;turn++) {
    const active=activeMovies(state),questions=validQuestions(active,state.history.map(h=>h.question.id));
    const awards=questions.filter(q=>q.kind==="oscar");
    if(awards.length)availableByTurn[turn]++;
    for(const q of awards) {
      assert.ok(active.every(m=>typeof evaluateQuestion(m,q)==="boolean"));
      const key=q.value as OscarQuestionKey;gameQuestions.add(key);
      if(!turn)perQuestion[key].initialGames++;
    }
    for(const group of offeredGroups(questions)) {
      gameGroups.add(group);if(!turn)initial[group]=(initial[group]??0)+1;
    }
    const suggestions=openingQuestionExamples(puzzle.movies,state.history.map(h=>h.question.id));
    for(const group of offeredGroups(suggestions)) {
      suggestedGroups.add(group);if(!turn)suggestedInitial[group]=(suggestedInitial[group]??0)+1;
    }
    const q=turn===0?suggestions[0]:questions[(i+turn)%questions.length];
    if(!q)break;
    state=gameReducer(state,{type:"ask",question:q});
    assert.ok(state.activeIds.includes(puzzle.mysteryId));assert.ok(state.history.length<=5);
  }
  for(const group of gameGroups)playable[group]=(playable[group]??0)+1;
  for(const group of suggestedGroups)suggestedDuring[group]=(suggestedDuring[group]??0)+1;
  for(const key of gameQuestions)perQuestion[key].playableGames++;
  if(!gameGroups.has("anyOscar")&&state.history.length===5&&validQuestions(activeMovies(state),state.history.map(h=>h.question.id)).some(q=>q.kind==="oscar"))limitBlockedOnly++;
  history=rememberPracticePuzzle(history,puzzle);
  if((i+1)%100===0)console.log(`Verified ${i+1}/${count} representative lineups`);
}
const percent=(n:number)=>Number((100*n/count).toFixed(2));
const summary=(counts:Record<string,number>)=>Object.fromEntries(Object.keys(groups).map(key=>[key,{games:counts[key]??0,percent:percent(counts[key]??0)}]));
const result={lineups:count,seedStart,selectionAndMysteryUnchanged:unchangedSelections,
  strategy:"First ordinary suggestion per turn; no awards preference, pool filtering or mystery-aware selection",
  initial:summary(initial),playableDuringGame:summary(playable),
  visibleInSuggestions:{initial:summary(suggestedInitial),duringGame:summary(suggestedDuring)},
  perQuestion:Object.fromEntries(OSCAR_KEYS.map(key=>[key,{...perQuestion[key],initialPercent:percent(perQuestion[key].initialGames),playablePercent:percent(perQuestion[key].playableGames)}])),
  availableByTurn,limitBlockedOnly,filmCoverage,boardCoverage,
  sampledFilms:filmFrequencies.size,totalAppearances:count*24,maxAppearances:Math.max(...filmFrequencies.values()),
  definition:"Initial: 24-film board. Playable: available before spending question five, with both answers and no unknown active film. Turn-five-only availability is excluded.",
  groupDefinitions:groups};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes("--report"))writeFileSync("notes/oscar-availability-1000.json",JSON.stringify(result,null,2)+"\n");
