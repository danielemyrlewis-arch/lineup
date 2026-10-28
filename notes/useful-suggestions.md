# Useful one-time question recommendations — 28 October 2026

This replaces the neutral fixed examples from `70b0498` while keeping its single submitted suggestion per game. The prior selector deliberately ignored split strength to avoid a repeated automatic solving path. That made many examples obscure or poorly balanced. Assistance is now useful again, with the one-use rule preventing a chain of assisted questions.

## Ranking and answer independence

`validQuestions` still generates the existing question bank and calls the actual `evaluateQuestion` for every remaining film. A question is unavailable if any answer is unknown, if it has already been asked, or if either Yes or No has no films. Neither evaluation rules nor elimination rules changed.

`recommendedQuestions(movies, askedIds)` passes those canonical candidates to `suggestedQuestions`. It ranks by `min(yesCount, noCount)` descending. On the same remaining board this maximises the weaker side and puts the closest available 50/50 split first. Stable existing category/ID tie breaks make refreshes and poster order deterministic. For each subsequent slot, a different broad Browse category is preferred only among equally strong candidates. A weaker question is never promoted for variety. Equivalent/inverse partitions are not repeated. Fewer than three honest suggestions are shown if fewer useful distinct partitions exist.

The selector accepts films and asked IDs, never a puzzle, mystery ID or secret answer. The UI supplies only the current remaining candidates, reflecting answers the player already earned. The reducer checks current recommendation membership before it looks up the mystery to answer an accepted question. Changing the hidden film while keeping the same current board/asked IDs cannot change recommendations. A useful split is a deduction opportunity, not a promise of a particular outcome, a guaranteed half-board reduction, or a globally optimal strategy.

## One-use allowance, interface and persistence

The existing wording, controls, styling, position, search and Browse remain. Manual submissions refresh the current suggestions. Selecting, changing/clearing the search and busy rerenders do not rerank or spend anything. Selection remains transient; **Ask this question** or Enter must actually submit an accepted suggested question. That accepted history row gets the existing `suggested: true` marker and uses one of the normal five questions. The whole suggestion section then disappears; another suggested submission is rejected.

Daily and unfinished Practice keep their existing independent localStorage schemas/keys. New games reset the allowance. A stale or already-asked question cannot be resubmitted as a suggestion. Games with no useful split and finished games hide the section gracefully. Already saved suggestions remain historical provenance even when an updated algorithm would choose a different question. The shared decoder replays canonical game facts, validates every saved answer/elimination, restores at most one assistance marker, and rejects duplicate markers; this avoids invalidating old progress or restoring a used allowance after an update. Frozen pre-change Daily (including completed) and Practice snapshots cover compatibility.

No Analytics event is sent for selection. The existing parent accepted-action tracking still emits and deduplicates `question_asked`, starts and completions. No new event fields, personal information or film identities are added. Account/authentication/statistics, scoring, five-question budget, catalogue, all 365 scheduled puzzles, SEO/privacy/consent, branding and static hosting remain unchanged. No dependency, database, server route or external setting is introduced.

## Comparison

The aggregate [comparison](recommendation-comparison.json) uses the same 365 frozen opening boards and replays the preceding neutral selector from `92ccd9b`. It records no secret film or per-puzzle solving path.

| Top opening recommendation | Previous examples | Current ranking |
| --- | ---: | ---: |
| Average smaller side out of 24 | 3.02 | 11.48 |
| Exact 12/12 opportunities | 2 of 365 | 194 of 365 |
| Only 1 or 2 films on smaller side | 212 of 365 | 0 of 365 |

The new top recommendation's smallest weaker side is 10 (a 10/14 opportunity). Across three suggestions the mean smaller side improves from 3.13 to 10.77. A second audit checks both possible answer branches of a predetermined manual question per board; on 704 comparable boards the mean smaller-side fraction improves from 18.38% to 46.82%. The other 26 branches had no useful old original remaining. These figures describe metadata splits, not actual eliminations, win rates or future mystery outcomes.

## Validation

ESLint and TypeScript passed without warnings/errors. All **385 automated tests** passed, including all 365 opening boards, both earned answer branches, exact ranking/unknown-data gates, UI selection memoization, turn 1/3/5 use in both modes, duplicate and stale submissions, Analytics deduplication, and legacy/current Daily/Practice persistence. The public-source audit reported no credentials or private metadata; `.env.local` remains ignored.

`npm run build:pages` passed all catalogue/schedule, root-asset, metadata, privacy, consent-gated public configuration and static checks. The 96-file/about 5.04 MB `/docs` matches `out` byte for byte; every file returned HTTP 200 from an ordinary loopback static server. `/docs/CNAME` is unchanged at `dailylineup.co.uk`.

Actual local browser play (analytics rejected) verified a manual Daily Browse question refreshes the three recommendations; selecting one leaves four questions and the allowance untouched; refreshing restores the same useful choices/unused allowance; submitting spends one normal question and hides the section; refresh retains three questions and no suggestions. Practice manual search also refreshed recommendations. A suggested submission spent its independent allowance, and closing/reopening the local tab restored the same board, history and used allowance. A confirmed new Practice lineup restored 24 films, five questions and three recommendations while the Daily remained at its earlier independent progress. At 375px and 1440px, layouts fit without horizontal overflow; the pending mobile selection/submit action fits cleanly. The reopened test tab's warning/error log was empty. Temporary viewport, owned tabs and loopback server were cleaned up. No real Google login, account database operation or production Analytics delivery was attempted; existing account/analytics tests pass and their production source is unchanged.

The local main commit is prepared for manual GitHub Desktop **Push origin**. This task performs no push, deployment or external settings change.
