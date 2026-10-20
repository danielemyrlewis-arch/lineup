# LINEUP design research and future product notes

Reviewed 20 October 2026. This is a bounded review of the ten requested galleries, their public descriptions and a small selection of relevant public example pages. It informs original LINEUP decisions; it is not evidence that any gallery pattern will improve conversion. No gallery artwork, source code, screenshots, testimonials or performance claims are incorporated into LINEUP.

## Transferable principles

| Reference reviewed | Relevant observation | LINEUP decision |
| --- | --- | --- |
| [Landbook](https://land-book.com/) and [Milk Agency](https://land-book.com/websites/85524-milk-agency) | The gallery distinguishes typography, mobile, industry and layout treatments; the portfolio entry foregrounds a short proposition and a coherent identity. | Retain the existing typography, charcoal/cobalt and poster grid. Reduce framing around the actual game instead of adding marketing sections or agency-style motion. |
| [Supahero](https://supahero.io/) and [35mm](https://supahero.io/hero/35mm) | Hero sections are treated as a discrete communication task; the 35mm entry identifies its subject immediately. | Keep “24 films. One answer.” Add a literal yes/no explanation and bring the question field into the opening mobile view. No extra Start button. |
| [Pricing Pages](https://pricingpages.design/) and [URL Box](https://pricingpages.design/sites/url-box) | The gallery categorises comparison tables, feature sections, FAQs and billing switches separately. | Future LINEUP+ should describe concrete benefits and total billing terms clearly. Pricing UI has no purpose in today's free game. |
| [Social Proof Examples](https://socialproofexamples.com/) | The gallery groups evidence by presentation type, including measurable impact and attributed user feedback. Its examples concern other products. | Build credibility through working interactions, accurate results and accessible credits. LINEUP has no approved public testimonials or aggregate usage figures to publish. |
| [Really Good Emails welcome collection](https://reallygoodemails.com/categories/welcome) and [Womp welcome example](https://reallygoodemails.com/emails/womp-welcome-onboarding) | Welcome messaging introduces a product and sets expectations; the example is clearly identified by brand and purpose. | Use a human, brief invitation and one next action in help/results. Defer email capture and reminders until a daily game and an explicitly approved delivery service exist. |
| [Deck Gallery](https://www.deck.gallery/) and [Unknown Worlds identity guidelines](https://www.deck.gallery/unknownworlds-visual-identity-2024/) | The public entry describes consistent logo, typography and cross-platform applications; its preview sequence separates identity topics. | Explain rules in a short sequence and show results in the order outcome → film → questions → actual remaining-film path → replay/share. Use the same LINEUP identity in social assets. |
| [Posts.design](https://posts.design/) and [its OG collection](https://posts.design/opengraph) | The gallery separates posts, headers and OGs while keeping brand references attached to each format. | Adapt the same wordmark, line motif and typographic hierarchy to a social-sized composition. Do not use a whole-page screenshot or poster collage. |
| [Adfolio](https://www.adfolio.design/) and [its editorial approach](https://www.adfolio.design/about) | Its stated analysis focuses on the hook, visual and call to action. Its B2B conversion claims do not establish results for a consumer puzzle. | Lead with the actual challenge rather than a feature list. A natural challenge after a result is enough; avoid artificial urgency, social pressure or an advertising-style landing page. |
| [Navbar Gallery](https://www.navbar.gallery/) | Its taxonomy distinguishes simple navigation from dropdown, mega-menu and full-screen patterns. | LINEUP needs the wordmark, Practice context and How to play. No hamburger, accounts, pricing, placeholder Daily link or sticky navigation is justified by today's functions. |
| [OG Image Gallery](https://www.ogimage.gallery/) and [Arts & Culture](https://www.ogimage.gallery/category/arts-culture) | The arts/culture collection presents brand-specific previews, including film/music/cultural organisations. | Create a static 1200×630 original typographic LINEUP graphic with a clear proposition and generous safe space. Use absolute public GitHub Pages image URLs in server-generated metadata. |

These are product-design inferences from the reviewed material, not copied layouts. Public text and previews were sufficient for this focused pass. Full paid gallery archives were not accessed, accounts were not created, and one Navbar illustration CDN request failed; no claim is made to have inspected every example's mobile implementation or measured its effectiveness. Supahero currently notes that it is part of Screensdesign; no external subscription is needed for LINEUP.

## Findings from the existing LINEUP source

The existing identity, real poster grid, immediate playable game, elimination strategy tutorial and honest one-guess rule already serve the product well. The source audit identified clearer priorities than a wholesale restyle:

1. The original share text contains a real deduction path but omits the public URL, a path explanation and an invitation. Native sharing cancellation is distinguished, but clipboard rejection needs a useful visible fallback.
2. The original metadata has a title/description and SVG favicon, but no Open Graph/Twitter raster preview, canonical or Apple touch icon.
3. Search is strong for someone who already knows the categories. A compact browser of the engine's currently valid questions can make less obvious categories discoverable without changing ranking or accuracy.
4. The original result presents the question count and path, but does not explain what the final remaining-film number means. It should never append an invented final `1`.
5. The hero's existing copy is brief but does not explicitly say yes/no. Small copy and spacing changes are more appropriate than adding another onboarding gate.

The source review alone does not establish mobile fold positions, keyboard behaviour or performance scores; those require the owner's browser and build verification. Keep the approved catalogue, awards verification, selection/diversity rules, scoring, detail content and static publishing mechanism intact.

## Future daily navigation and retention

When a genuine daily puzzle exists, retain a compact wordmark and two clear modes: **Today's lineup** and **Practice**, with How to play as the utility action. A completed daily game can link directly to Practice. Practice results must continue to say Practice and must not imply that friends receive an identical seeded board. No Daily placeholder, countdown, promised release date, streak, account or notification is added now.

If daily reminders are approved later, a useful message has one truthful proposition and one link: subject “Your next lineup is ready”; body “24 films. Five questions. Find today's film.” The actual delivered puzzle must exist, and reminders must be voluntary, easy to stop and free of invented urgency. This is draft copy for a future product decision, not a campaign to send or a service to install.

Potential future marketing hooks using the existing product facts:

- “24 films. One answer. How few questions do you need?”
- “Know your films? Find the one we're thinking of.”
- “A film night argument, settled in five questions.”

The last is playful positioning, not a claim about comparative scores or identical shared Practice puzzles. Test copy with actual players before paid distribution. No ad campaign or external posting is authorised by this document.

## Future LINEUP+ presentation

Do not interrupt the current free game with an upgrade. If paid features are later built and approved, explain the actual free/paid distinction in a compact comparison, show billing frequency and full price together, and make the free game easy to return to. Archives, saved cross-device history and any daily benefits must work before being marketed. Avoid “most popular” labels without evidence, preset annual billing that hides total cost, fabricated discounts and enterprise-style sales flows.

## Privacy-conscious measurement plan

Documentation is sufficient now; no analytics provider, tracking script, stored event queue or fake dashboard is needed. A later approved implementation can use the following small event vocabulary. Keep properties enumerated or bounded; exclude mystery answers, film IDs/titles, free-text question input, names, email addresses, account IDs, persistent device identifiers and full URLs.

| Event | Useful bounded properties | Product question |
| --- | --- | --- |
| `game_viewed` | mode: `practice` | Do visitors reach the ready-to-play board? |
| `help_opened` | source: header/footer | Do people seek an explanation? |
| `first_question_asked` | source: search/suggestion/browser | Can new players begin? |
| `question_browser_opened` | no properties required | Is browsing useful? |
| `game_completed` | outcome: won/lost; questions: 0–5 | Where does the core experience succeed or fail? |
| `practice_started` | source: initial/new-lineup/play-again | Is replay friction low? |
| `share_started` | method: native/text/link | Do players express sharing intent? |
| `share_finished` | outcome: shared/copied/cancelled/failed; method | Does the action work? |

Do not equate native-share completion with a friend opening the result, or a share click with a successful share. Define whether “new” and “returning” can be answered without persistent identifiers before attempting cohort metrics. No event payload should contain the answer.

## Intentionally deferred

- Daily mode, accounts, streaks, archives, premium, emails, notifications and external analytics: not live or approved for this task.
- Public social proof: no publishable evidence supplied.
- Per-result server-rendered link previews: incompatible with the deliberately static site; the default branded preview is enough.
- A project-folder `robots.txt`: robots rules are read at the origin root. `/lineup/robots.txt` would not control this GitHub Pages origin, so no misleading project-level robots file is added. The static one-URL sitemap and canonical metadata can be used independently.
- A downloadable/shareable result image: optional only if mobile file sharing and failure handling prove reliable without substantial dependency weight. Text/native sharing and a strong default OG image take priority.
- Ranking changes or an awards-only mode: question discovery can improve without altering question accuracy, catalogue diversity or the existing balanced suggestions.

The primary growth loop is simply understand → play → see an accurate satisfying result → optionally share → play again. The implementation should make each step clearer before adding another feature.
