/** Sample real selection/history and a deterministic, ordinary balanced-question strategy. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { emptyPracticeHistory, rememberPracticePuzzle } from "../lib/game/practice-history.ts";
import { initialState, activeMovies, gameReducer } from "../lib/game/engine.ts";
import { validQuestions, suggestedQuestions } from "../lib/game/questions.ts";

const count=Math.max(20,Math.min(1000,Number(process.argv[2])||100));
let history=emptyPracticeHistory(),initialAvailable=0,everAvailable=0,turnsWithAvailability=0;
const availableByQuestion: Record<string,number>={},availableByTurn=[0,0,0,0,0,0];
for(let i=0;i<count;i++) {
  const puzzle=createPracticePuzzle(PRACTICE_CATALOGUE,0x4f534300+i,"demo",history);
  history=rememberPracticePuzzle(history,puzzle);
  let state=initialState(puzzle),ever=false;
  for(let turn=0;turn<=5;turn++) {
    const questions=validQuestions(activeMovies(state),state.history.map(h=>h.question.id));
    const oscars=questions.filter(q=>q.kind==="oscar");
    if(oscars.length) {
      ever=true;turnsWithAvailability++;availableByTurn[turn]++;
      if(!turn) initialAvailable++;
      for(const q of oscars)availableByQuestion[q.id]=(availableByQuestion[q.id]??0)+1;
    }
    if(turn===5)break;
    const q=suggestedQuestions(questions)[0];
    if(!q)break;
    state=gameReducer(state,{type:"ask",question:q});
    assert.ok(state.activeIds.includes(puzzle.mysteryId));
    assert.ok(state.history.length<=5);
  }
  if(ever)everAvailable++;
}
const result={lineups:count,seedStart:"0x4f534300",strategy:"First ordinary suggestion after each answer; no Oscar targeting or mystery-aware selection",
  initialAvailable,everAvailable,turnsWithAvailability,availableByTurn,availableByQuestion,
  initialPercent:100*initialAvailable/count,everPercent:100*everAvailable/count,
  note:"A question must have both answers and every active film verified. Turn 5 is visible but the question limit prevents another ask."};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes("--report"))writeFileSync("notes/oscar-availability.json",JSON.stringify(result,null,2)+"\n");
