# One suggested question per game

Historical implementation report: current-board balanced ranking now replaces the fixed neutral choices. The one-use allowance and saved-history provenance remain. See [useful one-time suggestions](useful-suggestions.md).

This change builds on the completed analytics/SEO/privacy commit `615c3bb`. The original three category-varied examples now remain available until one is submitted, including on question five. They are selected from the original board using the existing stable hash and category/partition diversity rules. They never refresh, reorder or use the mystery ID/answers to choose replacements.

Clicking a suggestion selects it and fills the search field. **Ask this question** or Enter submits it. Changing/clearing the search, opening Browse or selecting another suggestion cancels/replaces that pending choice without spending anything. Selection is transient UI state and is not persisted or tracked as a question.

The canonical reducer stores `suggested: true` only on an accepted answer. `hasUsedSuggestion` derives the allowance from that history; no separate counter or Supabase field is added. A second suggested submission, a non-original question disguised as a suggestion, duplicate/invalid question, completed game or sixth question is rejected. A suggestion uses one of the existing five questions and preserves normal elimination/scoring.

Manual search/Browse questions remain manual, even when their ID matches one of the three suggestions. An already asked or no-longer-useful original slot is disabled, never replaced. If no useful unused originals remain, the section hides. Using the one suggestion removes the whole section for that game.

## Persistence

Daily keeps `lineup:daily:progress:v1:<date>` and schema 1. Its existing compact history now optionally includes the accepted `suggested: true` marker. Resume replays through the canonical engine, including the one-suggestion guard. Old records without provenance remain readable as manual asks; the implementation does not guess how an earlier question was chosen or reset its question budget. Existing completed Daily attempts remain complete.

Practice previously had no durable current-game save. `lineup:practice:progress:v1` now holds one compact unfinished Practice snapshot: exact ordered board IDs, mystery ID, seed and creation/source identity, plus replayable question progress. Seed alone cannot reproduce recency-aware selection, so the exact board is retained locally. Full movie objects are not duplicated. No puzzle identity or snapshot is sent to Analytics or Supabase.

The initial/new board and every accepted Practice action are saved synchronously. Refresh/reopen resumes the same unfinished board, budget and allowance. Completing Practice removes only this snapshot; starting a genuinely new lineup replaces it and restores the allowance. Practice statistics, recency history, Daily records, account sessions/results and consent records keep their existing separate keys. Corrupt Practice snapshots can be replaced by a fresh unlimited Practice game; corrupt Daily records retain their existing protected behaviour. Blocked/full browser storage can only preserve in-memory progress, so refresh/reopen persistence cannot be guaranteed when browser storage is unavailable.

## Analytics and preserved features

The existing consent-gated `question_asked` hook still runs only after an accepted submission. Selecting a suggestion creates no asked-question event. Existing semantic event keys suppress duplicate starts/questions/completions on retry/resume. No new Analytics parameter is necessary; suggestion provenance stays local. Authentication, account results/statistics/streaks, film data, the 365-puzzle schedule, question bank, five-question limit, sharing, canonical metadata and static GitHub Pages configuration are preserved.

The homepage's strategy paragraph and privacy storage inventory were updated only to explain the changed assistance and new unfinished-Practice save. The older opening-example audit remains a labelled historical report. The offline Oscar availability simulator now consumes only its first original suggestion and then uses neutral manual choices; historical reports were not regenerated.

## Validation

Use the actual final test/build output for this release. Coverage includes stable three originals, manual questions preserving the allowance, use on questions 1/3/5, selection without submission, invalid/duplicate/stale requests, final-question limits, Daily legacy/replay and Practice exact-board resume, mode independence, new-game reset, hidden-answer independence and normal once-per-accepted-action Analytics.


Recorded completion checks: ESLint, TypeScript, all **362 automated tests**, the public-source audit and `npm run build:pages` passed. The export remains 96 files/about 5.04 MB, with root assets, metadata, consent-gated public configuration and `docs/CNAME` verified. No credentials/private metadata were found; `.env.local` stays ignored.

Local browser checks served the built `/docs` at `http://localhost:3000/`. A resumed Daily retained the same three originals after two manual asks, disabled already-asked/useless slots, kept the allowance after selection/reload, and spent it only on submitting question three. Refresh retained the used allowance and remaining budget. Practice restored the exact board, original choices and unused/used allowance after closing and reopening the test tab; Daily and Practice retained their independent budgets. A confirmed new Practice lineup reset to 24 films, five questions and three fresh originals, also after refresh. The pending-selection control fit a 375px mobile viewport; desktop play was also checked. Analytics remained rejected during this browser test, and accepted-action Analytics tests confirmed normal single events. No real Google account, live deployment or production GA delivery was tested by this change.
