# Opening question examples — 27 October 2026

This finishes the interrupted suggestion task on top of the committed account implementation `6f04bc3`. Before resuming, only `tests/opening-examples.test.ts` and a revised suggestion assertion in `tests/game.test.ts` had been saved. Those edits were retained. The production selector and panel still had their old behavior; no completed production change was overwritten.

## Cause and hidden-answer audit

`validQuestions` ranks valid, fully known YES/NO splits by `min(yesCount, noCount) / activeFilmCount`, then existing category/ID tie-breakers. For equally likely remaining candidates this also maximizes expected immediate elimination: `2 × yesCount × noCount / activeFilmCount`. The old `suggestedQuestions` always put that top-ranked question first. Its later choices tried category diversity while staying close to the best split. `QuestionPanel` recalculated those three buttons after every answer.

A local replay extracted the actual old selector from commit `6f04bc3` and applied the normal canonical reducer to each frozen Daily. Selecting its first suggestion for up to five turns left **one remaining film in all 365 of 365 puzzles**. No guess was invented, and no future per-puzzle answer/path data was added to this report. This demonstrates an effective greedy guide on the committed schedule; the code is not a proof of globally optimal deduction for every possible board.

No mystery-ID or mystery-answer input was found in the selection or ranking call graph. It receives the current films and asked question IDs. The current films reflect answers already earned. The game reducer alone looks up the mystery when answering an asked question. The problem was repeated mathematical assistance, not hidden-answer-dependent recommendation selection.

An empty search also opened the top eight balance-ranked questions, including for filler-only queries. Removing only the three visible buttons would have left that implicit recommendation channel available.

## Current behavior

- A fresh Daily or Practice game shows **three Example questions**, after the existing full-width Browse control.
- Categories use the existing browser groups (Release, Genre, People, Studios, Awards and Film details). A stable hash of the board's sorted film IDs orders those groups and their question IDs. One valid question per group is chosen, with duplicate/equivalent/inverse partitions suppressed. Selection reads no balance, YES/NO counts, mystery ID or answer. Refresh/poster order does not reshuffle the examples. A strong split may occur by chance; examples are not forced to be weak.
- After any first question, `openingQuestionExamples` returns no examples before doing further selection, and the panel removes the label/buttons. This applies to typed, browsed or example questions, either YES/NO result, resumed games and both modes. Early-completed games also hide examples.
- Search and Browse remain in the same prominent positions. Empty focus does not open ranked choices. Typed autocomplete still uses the same aliases, relevance ordering and current validity checks. Empty/filler-only search returns no questions. Explicit category browsing retains its existing canonical question order, pagination, focus behavior and safe unknown-data filtering.
- The five-question budget, answer evaluator, eliminations, scoring/result values, movie/mystery selection, catalogue, frozen schedule and UK rollover are unchanged. Existing saved progress remains valid. Auth, Google login, SQL/schema, account results/statistics/streaks and storage are untouched.

The selector API accepts only movies and asked IDs; it cannot receive a puzzle's hidden identity. Defensive tests replace every possible mystery on representative Daily and Practice boards, perturb ranking counts/order (including getters that throw if read), and validate all 365 opening boards. Sparse/incompatible sets return fewer honest examples rather than repeated categories; every published Daily still has three.

## Files and offline audits

- `lib/game/questions.ts`: neutral example selector and opening-only wrapper; empty/filler-only autocomplete guard. Question definitions, `evaluateQuestion`, `validQuestions` ranking/filtering and meaningful-query ranking remain unchanged.
- `components/game/question-panel.tsx`: opening-only examples and no empty-focus recommendation popover. Existing styles and controls are reused.
- Tests: completed the interrupted opening-example coverage, added actual-panel Daily/Practice/resume/completion checks, and updated former assertions that required recommendations to be mathematically strongest. Awards/unknown-data and canonical ranking coverage remain intact.
- `scripts/simulate-oscars.ts`: offline availability audit now models opening-only examples, then deterministic neutral player choices. It no longer presents repeated example selection as the current UI. Historical Oscar audit reports were not rewritten or regenerated; their earlier measurements remain historical.
- README links this change and no longer describes old during-game recommendation exposure as current.

No dependency, server, hosting, authentication, account database or deployment-setting change is part of this task. The source remains a completely static export with optional browser Supabase accounts, at https://dailylineup.co.uk/ from main `/docs`.

## Validation and handoff

Completed validation:

- `npm run lint` and `npm run typecheck` passed without warnings/errors. **All 239 tests passed**, zero failures/skips, including the unchanged account suite. All 365 frozen Daily boards have three valid examples from three broad browser categories; tests verify hidden-answer independence, rank/count independence, stable refresh/poster order, canonical validity and no post-answer/completed-game examples. The bank, aliases, unknown/Oscar gates and five-question limits remain covered.
- `npm run build:pages` passed with the frozen schedule/catalogue prebuild checks and static `/` + `_not-found` routes. `/docs` was rebuilt: **89 files / 5,157,631 bytes (4.92 MiB)**. Root assets, metadata, `.nojekyll`, `dailylineup.co.uk` CNAME and the existing public Supabase browser configuration all passed export validation. No runtime film API references were found.
- Plain static HTTP verification returned 200 for all 89 exported files, byte-identical to both `out` and `docs`. Root Daily and direct Daily/Practice query URLs loaded. Source checks show no changes to account/auth/SQL, scoring/engine, schedule/catalogue, guest persistence, root hosting configuration, CNAME or global visual styles.
- Actual browser play opened Daily **#008 / 27 Oct** with three examples (Studios, Film details and People). Empty input focus showed no options. Pressing Enter on the first example removed the examples and moved focus to the remaining-question budget. A filler-only query showed no ranked list; typing `drama` produced the canonical match. Asking it consumed another question. Refresh restored the two-question history with three questions left and no examples.
- Browse still opened all categories, the Release list and its ten-row pagination. Escape returned focus to Browse. Practice showed three opening examples, removed them after the first question, and accepted a second question through Browse. New lineup restored 24 films/five questions/three examples. Switching back preserved the Daily's three-question budget and hidden example state. The existing optional Google sign-in panel opened normally; no real login or Supabase setting/database change was attempted.
- At **375, 390 and 1440px**, resting layouts had no horizontal overflow. Mobile retained three poster columns and a 60px header; desktop retained six columns and 72px header. Browse stayed 44px high. Browser warning/error logs were empty. The temporary viewport, owned preview tab and server were cleaned up.
- Public-source/export audit passed with no credential/private-hosting findings; `.env.local` remains ignored. Screenshots are stored outside the repository/export.

The local commit contains the complete fix; no push, deployment, GitHub settings or DNS change was performed. Account security/OAuth live-project verification retains the existing account handoff's limitations and was not repeated as part of this focused UI task.
