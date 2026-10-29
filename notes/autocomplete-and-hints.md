# Question autocomplete and intelligent hints — 29 October 2026

## Existing progress preserved

The starting commit was `1755be1`, with a clean `main` working tree. That commit already provided dynamic, board-balanced one-time hints. Its production hint ranking, reducer, interface, saved-game compatibility and allowance handling are retained. This task fixes autocomplete relevance and adds explicit regression coverage for both requirements.

## Autocomplete cause and change

Previously, search required every meaningful token to be a substring of question wording, category or aliases. It assigned only an exact-match bonus; all other matches inherited the incoming question list's deduction-balance order. That order measures board splitting, not whether a typed word fits. A strongly balanced animal question could therefore beat the animated-film question for `anim`, a prefix name could beat a whole-word name, and an incidental runtime match could beat `2 hours`. `A` and `AN` were also discarded as grammatical filler, breaking progressive first-character exploration. `anim` could already find Animation when available; a question with unknown data or no useful split must still remain unavailable.

`lib/game/question-search.ts` now owns the existing search API, re-exported from `questions.ts` so callers and UI stay the same. It normalises case, accents, punctuation and existing minute/hour/half-hour forms, then matches all meaningful query tokens against wording, short labels, aliases, categories and a small search-only vocabulary for plural/category alternatives. No questions, answers or film data are created or changed.

Exact wording and aliases lead; subject whole words and word prefixes beat keyword/category hits and weaker interior substrings. Early subject positions distinguish direct animation wording from incidental animal wording. All terms must match, so one good keyword cannot mask another unrelated word. Stable wording/ID tie breaks replace incoming split-balance order. Numeric interior matches and full gender/negation confusion remain blocked. `male` does not become `female`, `90` does not match the interior of `1990`, and `not English` does not return the positive English question.

There is **no minimum search length**. Single-token prefixes such as `Y`, `U`, `A` and `AN` explore available questions immediately. Empty queries and complete filler-only phrases still avoid an automatic recommendation list. Existing valid-question gates, the twelve-result cap, de-duplication, keyboard behavior, styling, Browse interface and optional suggestion selection remain. Cached normalised fields in a WeakMap avoid repeating index preparation on each keystroke; search has no dependency on balance scores, secret film identity or Analytics.

## Intelligent hint verification

Hints continue using the canonical evaluator on **remaining films only**, excluding asked, unknown and one-sided questions. On a board with `N = Y + No` equally weighted candidates, expected elimination is:

`(Y / N) × No + (No / N) × Y = 2 × Y × No / N`.

For a fixed remaining board this orders questions identically to maximising the smaller Yes/No group. The existing three strongest distinct partitions are retained; equal-strength ties prefer different broad Browse categories. A weaker question is not promoted solely for variety. Fewer than three are shown when fewer honest useful partitions exist. New tests brute-force the ordinary elimination predicate on both hypothetical answers and verify the formula and all three selected opportunities on initial and narrowed Daily/Practice boards. They also use throwing accessors to prove eliminated-film metadata and the hidden mystery ID are not accessed by recommendation ranking.

Manual accepted answers refresh recommendations. Selecting or typing does not refresh or spend the allowance. The player may submit **one** suggested question per game on any turn; it counts within the usual five questions, then all hints disappear. The existing history marker, independent Daily/Practice storage, older saved-game compatibility, refresh/reopening behavior, duplicate guards and accepted-action-only Analytics remain unchanged. No scoring, catalogue, schedule, account/authentication/statistics, Supabase migration, consent, privacy, branding or hosting source changed.

## Validation and handoff

ESLint, TypeScript and all **397 automated tests** pass, including eight new text-search tests, three expected-elimination/current-board hint regressions and an actual-panel first-character-to-Animation submission test in both modes. Existing once-per-action Analytics, account, consent, persistence and gameplay suites remain passing. `npm run build:pages` passed catalogue/schedule integrity, domain-root assets, metadata, consent/public configuration, privacy and static-export checks. `/docs` was rebuilt: 96 files/about 5.04 MB, matching `out` byte for byte. Every exported file returned HTTP 200 from a plain loopback static server, and `docs/CNAME` remains `dailylineup.co.uk`.

Actual browser checks used rejected analytics and isolated local-port guest storage. Daily first-character `Y`, `U`, `A`, `AN` returned multiple questions; `anim` displayed the animated-film question first at 375px. Enter submitted it as a normal question, leaving the hint available. An ensuing manual Drama question replaced the recommendations with the stronger current-board set (release, co-production and Best Picture questions); selecting one retained three questions/one hint, while submitting it left two questions and removed the hint section. Refresh restored that used allowance and the exact question history. Practice started independently with five questions/one hint. Its search matched first characters, animation, thriller, year, actor, sequel and runtime phrasing; `2 hours` put the two-hour question above the two-and-a-half-hour alternative, and manual submission refreshed hints without consuming them. Disney was correctly unavailable on that random board; automated tests verify its ranking when the existing canonical studio question is available. Neither search nor hints bypass unknown metadata or no-split gates.

At 375px and 1440px, content width matched the viewport's usable width with no horizontal overflow. Console warnings/errors were empty. A local warmed 212-question Daily search sample had median 0.28 ms/P95 0.47 ms over 1,000 calls; this is a local measurement rather than a mobile or production performance guarantee. Temporary viewport, owned tab and server were cleaned up. No real Google login, Supabase operation or production Analytics delivery was attempted; their source is unchanged and existing tests pass.

This task commits locally to `main` only. It performs no push, deployment or external setting change.
