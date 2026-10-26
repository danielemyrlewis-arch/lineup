import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAILY_SCHEDULE } from "../lib/game/daily-schedule.ts";

const sql=readFileSync(new URL("../supabase/migrations/20261026_daily_player_results.sql",import.meta.url),"utf8");
const statements=sql.replace(/--[^\n]*/g,"");

test("the manual migration grants only private own-row authenticated SELECT/INSERT",()=>{
  assert.match(statements,/enable row level security/i);
  assert.match(statements,/force row level security/i);
  assert.match(statements,/revoke all privileges on table public\.daily_results from public, anon, authenticated/i);
  assert.match(statements,/for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(statements,/for insert\s+to authenticated\s+with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.ok(!/grant\s+(?:all|update|delete)|for\s+(?:all|update|delete)/i.test(statements));
  assert.ok(!/grant[^;]*to\s+(?:anon|public)\b/i.test(statements));
  assert.equal((statements.match(/create policy/gi)??[]).length,2);
});

test("the migration prevents replacement, constrains the real result and uses the existing frozen UK calendar",()=>{
  assert.match(statements,/primary key \(user_id, puzzle_id\)/i);
  assert.match(statements,/unique \(user_id, puzzle_date\)/i);
  assert.match(statements,/references auth\.users \(id\) on delete cascade/i);
  assert.match(statements,/questions_used between 0 and 5/i);
  assert.match(statements,/films_remaining between 1 and 24/i);
  assert.match(statements,/cardinality\(deduction_path\) = questions_used \+ 1/i);
  assert.match(statements,/array_position\(deduction_path, null\) is null/i);
  assert.match(statements,/outcome in \('won', 'lost'\)/i);
  assert.match(statements,/completed_at timestamptz not null/i);
  assert.match(statements,/created_at timestamptz not null default now\(\)/i);
  assert.match(statements,/at time zone 'Europe\/London'/i);
  const range=statements.match(/puzzle_number between 1 and (\d+)/i)!;
  assert.equal(Number(range[1]), DAILY_SCHEDULE.length,"schedule extension requires an explicitly reviewed SQL range migration");
  assert.ok(statements.includes(`date '${DAILY_SCHEDULE[0].date}'`));
  assert.ok(!/\bemail\b|access_token|refresh_token|service_role|password/i.test(statements));
  assert.match(statements,/^\s*begin;/i);
  assert.match(statements,/commit;\s*$/i);
});
