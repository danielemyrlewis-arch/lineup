import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDailyResults, saveDailyResult } from "../lib/account/repository.ts";
import type { DailyResult } from "../lib/account/results.ts";

const userId = "11111111-2222-4333-8444-555555555555";
const otherUser = "66666666-7777-4888-9999-aaaaaaaaaaaa";
const result = (changes: Partial<DailyResult> = {}): DailyResult => ({
  user_id: userId, puzzle_id: "daily-001", puzzle_date: "2026-10-20", puzzle_number: 1,
  outcome: "won", questions_used: 2, films_remaining: 8, deduction_path: [24, 13, 8],
  completed_at: "2026-10-20T12:00:00.000Z", ...changes,
});
type Reply = { data?: unknown; error: {code?: string; message?: string} | null };
function fakeClient(reply: Reply | Promise<Reply> | (() => Reply | Promise<Reply>)) {
  const calls: {method: string; values: unknown[]}[] = [];
  const signals: AbortSignal[] = [];
  const record = (method: string, ...values: unknown[]) => { calls.push({method,values}); };
  const builder = {
    select(columns: string) { record("select", columns); return this; },
    eq(column: string, value: string) { record("eq", column, value); return this; },
    order(column: string, options: unknown) { record("order", column, options); return this; },
    range(start: number, end: number) { record("range", start, end); return this; },
    insert(value: unknown) { record("insert", value); return this; },
    abortSignal(signal: AbortSignal) {
      signals.push(signal);
      return typeof reply === "function" ? reply() : Promise.resolve(reply);
    },
    upsert() { throw new Error("Results must never be upserted"); },
    update() { throw new Error("Results must never be updated"); },
    delete() { throw new Error("Results must never be deleted"); },
  };
  return {calls,signals,client:{from(table: string) { record("from", table); return builder; }} as unknown as SupabaseClient};
}

test("history loads only the signed-in user's bounded private result columns and validates returned rows", async () => {
  const row=result();
  const fake=fakeClient({data:[{...row,email:"not-for-the-game@example.test",created_at:"extra"}],error:null});
  const loaded=await loadDailyResults(fake.client,userId);
  assert.deepEqual(loaded,{results:[row],error:null});
  assert.deepEqual(fake.calls.find(call=>call.method==="from")?.values,["daily_results"]);
  assert.deepEqual(fake.calls.find(call=>call.method==="eq")?.values,["user_id",userId]);
  assert.deepEqual(fake.calls.find(call=>call.method==="order")?.values,["puzzle_date",{ascending:false}]);
  assert.deepEqual(fake.calls.find(call=>call.method==="range")?.values,[0,499]);
  const columns=String(fake.calls.find(call=>call.method==="select")?.values[0]);
  assert.ok(columns.includes("completed_at") && columns.includes("deduction_path"));
  assert.ok(!columns.includes("email") && !columns.includes("*"));
  assert.equal(fake.calls.filter(call=>call.method==="insert").length,0);
});

test("a missing migration, denied query or offline service returns a safe error without private provider details", async () => {
  for(const reply of [
    {data:null,error:{code:"42P01",message:"relation/private-account-details"}},
    {data:null,error:{code:"PGRST205",message:"private schema cache"}},
    {data:null,error:{code:"42501",message:"private denied response"}},
    {data:null,error:null},
  ]) {
    const fake=fakeClient(reply);
    const loaded=await loadDailyResults(fake.client,userId);
    assert.deepEqual(loaded.results,[]);
    assert.match(loaded.error??"",/game and local progress are safe/i);
    assert.ok(!loaded.error?.includes("private"));
  }
  const offline=fakeClient(()=>{throw new Error("private offline detail");});
  const loaded=await loadDailyResults(offline.client,userId);
  assert.deepEqual(loaded.results,[]);
  assert.match(loaded.error??"",/couldn’t load/);
  assert.ok(!loaded.error?.includes("private"));
});

test("foreign-user or malformed history responses are rejected as a whole, not shown as partial trusted statistics", async () => {
  for (const invalid of [result({user_id:otherUser}),result({questions_used:6}),{...result(),puzzle_id:"practice-1"}]) {
    const fake=fakeClient({data:[result(),invalid],error:null});
    const loaded=await loadDailyResults(fake.client,userId);
    assert.deepEqual(loaded.results,[]);
    assert.ok(loaded.error);
  }
});

test("new account results use INSERT only with a sanitized immutable result payload", async () => {
  const row=result();
  const fake=fakeClient({error:null});
  const saved=await saveDailyResult(fake.client,{...row,email:"private@example.test",created_at:"client-forged"} as DailyResult);
  assert.deepEqual(saved,{status:"saved",error:null});
  assert.deepEqual(fake.calls.map(call=>call.method),["from","insert"]);
  assert.deepEqual(fake.calls.find(call=>call.method==="insert")?.values,[row]);
  assert.equal(fake.signals[0]?.aborted,false);
});

test("uniqueness conflicts preserve the first account result and never retry with replacement", async () => {
  const fake=fakeClient({error:{code:"23505",message:"private existing result"}});
  assert.deepEqual(await saveDailyResult(fake.client,result()),{status:"duplicate",error:null});
  assert.deepEqual(fake.calls.map(call=>call.method),["from","insert"]);
  assert.equal(fake.calls.filter(call=>call.method==="insert").length,1);
});

test("invalid local result summaries do not make a database request", async () => {
  for (const bad of [result({puzzle_id:"practice-001"}),result({questions_used:-1}),result({user_id:"not-an-id"}),result({deduction_path:[24,1]})]) {
    const fake=fakeClient({error:null});
    const saved=await saveDailyResult(fake.client,bad);
    assert.equal(saved.status,"error");
    assert.match(saved.error??"",/remains in this browser/);
    assert.deepEqual(fake.calls,[]);
  }
});

test("failed inserts keep a retryable browser result and never expose raw database messages", async () => {
  for(const code of ["42P01","PGRST205","42501","23514"]) {
    const fake=fakeClient({error:{code,message:"private SQL statement and identifier"}});
    const saved=await saveDailyResult(fake.client,result());
    assert.equal(saved.status,"error");
    assert.match(saved.error??"",/try again from Account/);
    assert.ok(!saved.error?.includes("private"));
    assert.equal(fake.calls.filter(call=>call.method==="insert").length,1);
  }
  const offline=fakeClient(()=>Promise.reject(new Error("offline private detail")));
  assert.equal((await saveDailyResult(offline.client,result())).status,"error");
});

test("hung account reads and writes time out, abort their requests and leave guest play unblocked", async () => {
  const never=new Promise<Reply>(()=>{});
  const reader=fakeClient(never);
  const loaded=await loadDailyResults(reader.client,userId,5);
  assert.deepEqual(loaded.results,[]);
  assert.ok(loaded.error);
  assert.equal(reader.signals[0]?.aborted,true);
  const writer=fakeClient(never);
  const saved=await saveDailyResult(writer.client,result(),5);
  assert.equal(saved.status,"error");
  assert.equal(writer.signals[0]?.aborted,true);
});
