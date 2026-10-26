import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_RESULTS_KEY, readGuestResults, writeGuestResults, rememberGuestResult, pendingGuestResult } from "../lib/account/guest-results.ts";
import { completedDailyResult, type CompletedDailyResult, type DailyResult } from "../lib/account/results.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "../lib/game/daily-schedule.ts";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { gameReducer, initialState } from "../lib/game/engine.ts";

class MemoryStorage {
  values=new Map<string,string>();
  writes=0;
  getItem(key:string) { return this.values.get(key)??null; }
  setItem(key:string,value:string) { this.writes++; this.values.set(key,value); }
}
function completed(index=0, timestamp?:string):CompletedDailyResult {
  const puzzle=resolveDailyPuzzle(DAILY_SCHEDULE[index],PRACTICE_CATALOGUE);
  const state=gameReducer(initialState(puzzle),{type:"guess",movieId:puzzle.mysteryId});
  return completedDailyResult(state,timestamp??`${puzzle.daily!.date}T12:00:00.000Z`)!;
}
const account = (guest:CompletedDailyResult):DailyResult => ({user_id:"11111111-2222-4333-8444-555555555555",...guest});

test("a guest completion survives OAuth navigation in its own queue without touching game or auth storage",()=>{
  const storage=new MemoryStorage();
  storage.values.set("lineup:daily:progress:v1:2026-10-20","existing-game");
  storage.values.set("lineup:auth:v1","existing-session");
  const result=completed();
  assert.equal(writeGuestResults([result],storage),true);
  assert.deepEqual(readGuestResults(storage),[result]);
  assert.equal(storage.values.get("lineup:daily:progress:v1:2026-10-20"),"existing-game");
  assert.equal(storage.values.get("lineup:auth:v1"),"existing-session");
  const raw=storage.values.get(GUEST_RESULTS_KEY)!;
  assert.ok(!raw.includes("user_id")&&!raw.includes("access_token")&&!raw.includes("mystery"));
});

test("refresh observation never replaces the first completion timestamp or outcome",()=>{
  const first=completed();
  const queue=[first];
  const later={...completed(),completed_at:"2026-10-21T12:00:00.000Z",outcome:"lost" as const};
  const remembered=rememberGuestResult(queue,later);
  assert.equal(remembered,queue);
  assert.equal(remembered[0].completed_at,first.completed_at);
  assert.equal(remembered[0].outcome,"won");
  const storage=new MemoryStorage();
  storage.values.set(GUEST_RESULTS_KEY,JSON.stringify([first,later]));
  assert.deepEqual(readGuestResults(storage),[first]);
});

test("new completed dates are retained in newest-first order without mutating previous queue state",()=>{
  const older=completed(0);
  const newer=completed(1);
  const queue=[older];
  const remembered=rememberGuestResult(queue,newer);
  assert.deepEqual(remembered,[newer,older]);
  assert.deepEqual(queue,[older]);
  assert.notEqual(remembered,queue);
});

test("only canonical completed Daily state enters the migration pipeline, never Practice or unfinished play",()=>{
  const puzzle=resolveDailyPuzzle(DAILY_SCHEDULE[0],PRACTICE_CATALOGUE);
  const playing=initialState(puzzle);
  const finished=gameReducer(playing,{type:"guess",movieId:puzzle.mysteryId});
  assert.equal(completedDailyResult(playing),null);
  assert.equal(completedDailyResult({...finished,puzzle:{...puzzle,mode:"practice"}}),null);
  assert.ok(completedDailyResult(finished));
  const storage=new MemoryStorage();
  storage.values.set(GUEST_RESULTS_KEY,JSON.stringify([{...completed(),puzzle_id:"practice-1"},completed()]));
  assert.deepEqual(readGuestResults(storage),[completed()]);
});

test("corrupt, oversized or restricted storage cannot break guest play or grant a fake account result",()=>{
  const storage=new MemoryStorage();
  for(const value of ["{invalid",JSON.stringify({status:"won"}),"x".repeat(500001),JSON.stringify(Array.from({length:366},()=>completed()))]) {
    storage.values.set(GUEST_RESULTS_KEY,value);
    const writes=storage.writes;
    assert.deepEqual(readGuestResults(storage),[]);
    assert.equal(storage.writes,writes,"reading a corrupt queue does not overwrite guest progress");
  }
  const denied={getItem:()=>{throw new Error("denied");},setItem:()=>{throw new Error("quota");}};
  assert.deepEqual(readGuestResults(denied),[]);
  assert.equal(writeGuestResults([completed()],denied),false);
  const valid=completed();
  assert.deepEqual(rememberGuestResult([],valid),[valid],"memory queue remains usable even when writes fail");
});

test("invalid guest facts are omitted and unknown private fields are stripped on read",()=>{
  const storage=new MemoryStorage();
  const first=completed();
  storage.values.set(GUEST_RESULTS_KEY,JSON.stringify([
    null,{...first,questions_used:6},{...first,puzzle_number:20},
    {...first,user_id:"foreign-user",email:"private@example.test",access_token:"untrusted"},
  ]));
  assert.deepEqual(readGuestResults(storage),[first]);
});

test("the migration offer excludes every already-saved puzzle or date and preserves the account result",()=>{
  const first=completed(0);
  const second=completed(1);
  const guests=[second,first];
  const saved=account(second);
  assert.equal(pendingGuestResult(guests,[saved]),first);
  assert.equal(pendingGuestResult(guests,[saved,account(first)]),null);
  const sameDate={...saved,puzzle_id:"another-reference"};
  assert.equal(pendingGuestResult([second],[sameDate]),null);
  const samePuzzle={...saved,puzzle_date:"2026-10-22"};
  assert.equal(pendingGuestResult([second],[samePuzzle]),null);
  assert.deepEqual(saved,account(second));
});

test("offering a guest result is a pure operation, with no upload, consumption or automatic replacement",()=>{
  const first=completed();
  const guests=Object.freeze([first]);
  const saved=Object.freeze([] as DailyResult[]);
  const before=JSON.stringify(guests);
  assert.equal(pendingGuestResult(guests as CompletedDailyResult[],saved as DailyResult[]),first);
  assert.equal(pendingGuestResult(guests as CompletedDailyResult[],saved as DailyResult[]),first,"the explicit Save action owns consumption/submission");
  assert.equal(JSON.stringify(guests),before);
  assert.deepEqual(saved,[]);
});
