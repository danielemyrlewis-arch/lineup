-- LINEUP optional accounts: run manually in the Supabase SQL Editor.
-- No auth provider/project setting is changed. No service-role credential is needed.
-- This migration is transactional and intentionally fails rather than silently
-- adopting a pre-existing table with unknown constraints/policies.
begin;

create table public.daily_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_id text not null,
  puzzle_date date not null,
  puzzle_number integer not null,
  outcome text not null,
  questions_used smallint not null,
  films_remaining smallint not null,
  deduction_path integer[] not null,
  completed_at timestamptz not null,
  -- Receipt time is database-generated; it is separate from client completion time.
  created_at timestamptz not null default now(),
  constraint daily_results_pkey primary key (user_id, puzzle_id),
  constraint daily_results_one_per_date unique (user_id, puzzle_date),
  constraint daily_results_known_number check (puzzle_number between 1 and 365),
  constraint daily_results_known_date check (
    puzzle_date = date '2026-10-20' + (puzzle_number - 1)
  ),
  constraint daily_results_known_id check (
    puzzle_id = 'daily-' || lpad(puzzle_number::text, 3, '0')
  ),
  constraint daily_results_not_future_puzzle check (
    puzzle_date <= (now() at time zone 'Europe/London')::date
  ),
  constraint daily_results_outcome check (outcome in ('won', 'lost')),
  constraint daily_results_question_limit check (questions_used between 0 and 5),
  constraint daily_results_remaining_range check (films_remaining between 1 and 24),
  constraint daily_results_path_shape check (
    array_ndims(deduction_path) = 1
    and array_lower(deduction_path, 1) = 1
    and cardinality(deduction_path) = questions_used + 1
    and array_position(deduction_path, null) is null
    and 0 < all(deduction_path)
    and 24 >= all(deduction_path)
    and deduction_path[1] = 24
    and deduction_path[questions_used + 1] = films_remaining
    and (questions_used < 1 or deduction_path[2] <= deduction_path[1])
    and (questions_used < 2 or deduction_path[3] <= deduction_path[2])
    and (questions_used < 3 or deduction_path[4] <= deduction_path[3])
    and (questions_used < 4 or deduction_path[5] <= deduction_path[4])
    and (questions_used < 5 or deduction_path[6] <= deduction_path[5])
  ),
  constraint daily_results_completion_time check (
    isfinite(completed_at)
    and (completed_at at time zone 'Europe/London')::date >= puzzle_date
    and completed_at <= now() + interval '5 minutes'
  )
);

comment on table public.daily_results is
  'Private immutable Daily LINEUP results. Client claims are bounded, not cheat-proof. No Practice results or public profile data.';
comment on column public.daily_results.deduction_path is
  'Existing game result: actual films remaining after each question, starting at 24. No invented numeric score.';
comment on constraint daily_results_known_number on public.daily_results is
  'Matches frozen daily-001 through daily-365. Extend deliberately with the committed future puzzle schedule; never shift published identities.';

-- The unique (user_id, puzzle_date) index supports each player's ordered history.
-- Authenticated clients only receive SELECT + limited-column INSERT. No UPSERT,
-- UPDATE or DELETE permission/policy exists; a duplicate cannot replace a result.
alter table public.daily_results enable row level security;
alter table public.daily_results force row level security;
revoke all privileges on table public.daily_results from public, anon, authenticated;
grant select on table public.daily_results to authenticated;
grant insert (
  user_id, puzzle_id, puzzle_date, puzzle_number, outcome,
  questions_used, films_remaining, deduction_path, completed_at
) on table public.daily_results to authenticated;

create policy "Players read their own Daily results"
  on public.daily_results for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players insert their own Daily results"
  on public.daily_results for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

commit;
