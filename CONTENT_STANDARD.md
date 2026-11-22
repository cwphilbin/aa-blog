# Monthly content standard

This document is identical in aa-video-pipeline, customer_housing_analysis,
re-data, and aa-blog. It is the contract for every monthly asset. Current explicit
user instructions below supersede conflicting historical implementations; an old
implementation is not permission to restore a rejected rule.

Every task must read CONTENT_STANDARD.md first. Never change or violate any rule
in it unless the prompt explicitly names that rule and says to change it. Change
only what the prompt asks; everything else stays exactly the same.

## CS01 — One factual master

- The PDF deck and its registered payload are the master for long-form video,
  Shorts, blog, email, embed, market pages, and YouTube metadata. Read the same
  verified report package; never create independent channel statistics.
- Facts, rounding, comparisons, directions, units, salience selection, identities,
  dates, and contact details come from code and stored data. AI writes natural
  sentences around those facts. It must not invent numbers, names, quotes, news,
  agents, explanations of causes, predictions, or unavailable observations.
- Preserve page order and the registered chart series. Omit unavailable optional
  pages consistently across channels; hold required missing data. Never fill a
  gap with zero, reverse-engineer a prior observation from a rounded percentage,
  manufacture posts, or substitute an old report to fill a quota.
- Redfin three-month observations keep their actual semantics: sales are a
  three-month total, days on market is the provider's median, asking groups are
  provider percentages rather than invented counts, and county comparisons use
  the matching observation window. Keep existing eligibility and source filters.
- The current Redfin layout omits mortgage, price reductions, recent-sales
  examples, and quote pages. Local happenings appears only when supplied and
  grounded in the existing news source. Do not restore retired pages or change
  calculations, source providers, data windows, schedules, or publishing rules.

## CS02 — Stored geography, everywhere

- re-data/data/AA_zip_neighborhoods.csv is the approved 2,287-ZIP name list,
  alongside data/county_zips.csv. The shared territory_zip_lookup.json distributes
  its exact name_1, name_2, and full fields. Other pipelines consume those fields;
  never ask AI to generate or abbreviate names or maintain a competing name list.
- ZIPs are validated five-digit strings, including leading zeros.
- Written display is `name_1 & name_2 (ZIP)` when name_2 exists, otherwise
  `name_1 (ZIP)`. Under a real length limit use name_1 only; never drop the ZIP,
  truncate a stored name, or invent a nickname.
- Apply names to the cover, channel headlines, first sentence, long-form and
  Short narration, blog title/H1/meta, email subject/header, market-page title and
  meta tags, YouTube title/description, and chart legends. Preserve existing URLs.
- Spoken geography is `East Sacramento, 95816` or `Hancock Park and Larchmont,
  90004`. Never say `ZIP code`. The second slide must not repeat the ZIP.
- YouTube descriptions include county and all distinct names in full once,
  naturally; do not repeat a list in multiple paragraphs.

## CS03 — Voice and pace

- Inworld TTS-2 Flash (`inworld-tts-2-flash`) only. Alex is the male voice; Ashley
  is the female voice and default when a preference is absent. Respect the saved
  agent preference. Do not substitute another provider, model, or voice.
- Normal conversational pace, audio playbackRate 1. Never accelerate audio,
  truncate a sentence, or silently relax a duration check to fit a Short.
- Written domains remain agentsautomated.com; spoken audio may expand it to
  `agents automated dot com`. Reuse unchanged measured audio when text, voice,
  model, and style match exactly.

## CS04 — Number and date display

- Prices use compact dollars: `$1.28M`, `$520K`, including county figures such as
  `$920K`, never `$920,384`. Under one million use whole thousands; million
  figures use at most two decimals, without unnecessary trailing zeros.
- Price per square foot uses whole dollars, e.g. `$759` and `$589`, with thousands
  separators when necessary. Formatting belongs in code, before channel output.
- Visible report dates show the report month and year only, e.g. `October 2026`,
  not a day or a three-month date range. The YouTube title suffix may use the
  explicitly approved compact form `Oct 2026`. Never use the render date as the
  report date. Charts retain suitable monthly/year axis ticks.
- Chart footnote is exactly `*3-month rolling average`. Never show or say
  `Source: Redfin` or `Redfin` in customer-facing output:
  blog, email, subdomain, embed, YouTube descriptions, decks, or video speech and
  slides. Keep the underlying provider and internal source identifiers unchanged.
- Keep AA branding: navy #001F3F, chart/body ink #373D3F, gray background #F5F6F7,
  white content surfaces; retain existing metric up/down/neutral colors and
  series colors. Preserve the approved fonts for each existing surface and the
  native Shorts design rather than performing a redesign.

## CS05 — Native Shorts, hard maximum 30 seconds

- Restore the approved Nov 7 `CaptionedPdfShorts` look from commit `4b73229`
  at native 1080×1920: gray frame; `ZIP / <county> County` and month/year
  header; title;
  large statistic with its vs-last-year change; full-width native vertical
  ZIP-versus-county chart; captions; and the agent bar at the bottom. Retain
  the approved frame typography, spacing, motion, and territory-aware identity.
- Draw charts natively from the registered report series. Never use PDF pages,
  deck slide images, or cropped deck charts. Preserve the current Redfin facts,
  stored neighborhood names, number formats, normal Inworld voice, and the
  current look. Do not restore the reference's longer duration.
- Hook with one striking verified fact in the first second, then develop one
  clear buyer/seller point and an appropriate CTA. No greeting, logo preamble,
  filler, unsupported hype, or disconnected list of metrics. Preserve the
  approved Nov 7 frame styling and territory-aware agent/AA identity.
- Use the actual Nov 7 scene order: active-listings annual-change hook, median
  sale price, active-listings count, median days on market, then the saved CTA.
  Skip the retired Price Reductions scene. Each stat has its own big stat,
  year-over-year change where relevant, and matching native ZIP/county chart;
  do not reuse one statistic/chart for unrelated beats. The CTA may loop the hook.
- Narration covers all those statistics in that order under CS07, with natural
  buyer/seller meaning and code-supplied figures. Establish that comparisons are
  with last year. Preserve the saved contact/recruiting CTA and existing identity.
  The restored multi-stat narration still has to fit the hard 30-second limit.
- Duration includes every frame, audio padding, transition, and end card: at
  most 30.00 seconds. Measure actual synthesized audio and final encoded video.
  Reject and regenerate shorter text/audio when over; after bounded retries,
  hold with a clear failure. A render must never bypass this for Inworld.
- The production selector and review renderer use the same native path and
  checks. The approved Shorts research guides immediate hook, concise story,
  readable mobile framing, and satisfying payoff; it never overrides the
  30-second project limit or authorizes a new design.

## CS06 — Chart history and labels

- Five-year history appears on median-price and active-listings charts only.
  Keep the approved recent-history window on all other charts. Native Shorts
  visuals use their own scene data rather than deck chart images.
- Legends show the stored display name and ZIP, e.g.
  `Hancock Park & Larchmont (90004)`, alongside the existing county label.
- Keep the visible five-year annotation already in the approved deck unchanged.
  Add no new five-year slide copy. On those two long-form chart beats also say
  the code-computed five-year change, e.g. `and down 10% from five years ago`.
  Derive it from the real five-year baseline; report unavailable data honestly.
- Preserve axis meaning, dates, series, numeric direction, existing chart type,
  and the approved treatment of above/at/below asking and list-versus-sold ratios.

## CS07 — Natural narration from verified facts

- Sound like a local agent explaining the market. On each ordinary chart state
  the meaningful number, relevant year-over-year change, and one grounded buyer
  or seller implication. Do not simply recite all values printed on a slide.
- Never use `historical` in customer-facing output. Say `The median days on
  market is 54…`, retaining the actual number and the existing comparison and
  practical meaning. This wording change does not change the metric or data.
- Never say `minus`, `plus`, `ZIP code`, or a signed numeric expression. Say
  `down 2.1% from this time last year` or `up 4.6% from a year ago`; speak zero
  change as unchanged. Avoid the rigid `X versus Y a year ago (±%)` template in
  every channel. Do not read parentheses, arrows, signs, or technical units aloud.
- Code supplies and validates the numerical facts; AI may vary sentence
  structure around them without changing their values, metric, time period,
  comparison, or direction. Numerical validation must support natural wording;
  it must not force the old fixed sentence back into output.
- Above/at/below asking is an explicit exception to reading numbers: narrate one
  verified takeaway, e.g. `most homes sold below asking, more than last year`.
  Determine the dominant group and its direction from real shares; never infer
  a majority from a group below 50%.
- Explain list price versus sold price in plain words, e.g. `homes are selling
  for about 3% under their asking price`. Compute the distance from 100 and its
  over/under direction in code; distinguish original and final asking when used.
  No `percentage points` or `relative` jargon in public prose.
- Keep the approved realtor introduction and saved contact CTA; remove the
  redundant ZIP on slide two. Preserve agent identity and the separate county
  recruiting behavior for an unclaimed territory.

## CS08 — Headline, subject, and opening

- Email subject and shared blog/email headline use exactly
  `<full neighborhood name> (<ZIP>) <stat> <direction> <X>% vs last year`, e.g.
  `Hancock Park (90004) home values fell 26.3% vs last year`. Select the striking
  verified statistic using the existing code salience rule; do not change data.
  If its headline still exceeds its ZIP’s character limit after the stored-name fallback,
  try the next-strongest available verified statistic in that same order until
  one fits. Preserve the existing stable tie order, format, and precision;
  never invent or abbreviate a name, statistic, or comparison to make it fit.
- Use the full stored `name_1 & name_2` when name_2 exists, else name_1. Maximum
  65 characters including spaces and punctuation, except 30313, 30314, 33617,
  92648, and 98101 only, whose maximum is 75. Only when the full name exceeds
  that ZIP’s limit use name_1 alone. Never drop ZIP or abbreviate a stored name.
  No `YoY`, semicolon, advice clause, second statistic, or invented comparison.
  The practical meaning remains in the opening; do not append it to the headline.
- The opening is one sentence, at most 25 words, grounded in that selected fact
  and implication, with the place and ZIP. Do not repeat a boilerplate welcome,
  list unrelated metrics, or use the old multi-sentence TL;DR template.
- Blog, email, embed, market title, and metadata share the factual headline/summary
  contract and code-formatted figures. The long-form opening matches the existing
  PDF cover home-price statistic; the blog/email lead selects the strongest stat.
  Both openings have at most 25 words. These scoped channel adaptations do not
  authorize a second factual writer or an unrequested deck-cover metric change.

## CS09 — Reader and agent CTAs

- Do not include the bottom reader block `Own a home, or thinking of buying or
  selling in [names]? Get this report every month.` or its associated signup
  button in blogs, subdomains, embeds, or emails. Reject either the block or
  its `Get this report every month` / `Get next month’s report` button.
- Preserve separate agent contact and county recruiting CTAs.
  Agent contact uses the actual current seat, saved contact method, name,
  brokerage, photo, and real formatted phone. Never substitute TEST identity in
  production. Unclaimed territory keeps AA branding and existing recruiting.
- Preserve existing signup consent, honeypot, county/ZIP selection, and backend
  behavior. Review pages cannot create subscriptions, send messages, or submit
  real forms. Do not change seat assignment or signup destinations.

## CS10 — Blog, email, embed, and market presentation

- All report content is inside ONE white content card on a gray background in
  blog, email, and embed. Images, sections, agent identity, CTAs, and buttons do
  not each get separate white boxes. Preserve responsive spacing and readability.
- On blog and subdomain pages the global Agents Automated header scrolls away;
  the email signup bar stays at the top of the screen while scrolling. Preserve
  those pages exactly when changing the embed.
- The drop-in embed has no global Agents Automated header: it lives inside the
  host website. Its signup bar is inside the existing white content card, the
  same width as that card, and stays at the top of the card area while scrolling.
  Constrain it to the card, including when the host page scrolls an auto-height
  iframe. Verify collection and report views in the actual embed browser.
- The embed review is the actual drop-in agent snippet running on a sample
  agent webpage, not the hosted blog page placed in an iframe. Use the existing
  embed implementation and its isolation, URL hashes, and attribution behavior.
- Keep market URLs/slugs, canonical URLs, archive behavior, current-seat/byline
  attribution, author/schema handling, pagination of nine when enough real
  reports exist, and unavailable states. Do not manufacture historical posts.
- Title, H1, description, Open Graph/Twitter metadata, and image alt text carry
  the stored geography. Long-form embeds use the long-form video, not the Short.

## CS11 — YouTube titles

- Long-form and Shorts follow the same factual local-title pattern:
  `[Place] [metric] Down/Up [magnitude] in a Year (ZIP) | Mon YYYY`, e.g.
  `Hancock Park Home Prices Down 26% in a Year (90004) | Oct 2026`.
- Lead with stored place and the most striking verified number. Use accurate
  curiosity through the real change and its implication, never sensationalism,
  unsupported predictions, an invented cause, all-caps shouting, or emoji.
- Hard maximum 100 characters. Aim to put place, metric, striking number, and ZIP
  within the first 60–70 characters; actual visible truncation varies by surface.
  Use name_1 if both names do not fit the visibility target or hard maximum.
  Keep ZIP and report month. Do not append unnecessary `Market Update` or Shorts
  boilerplate that pushes the useful information out of view.
- A rounded whole-percent title may use code rounding (26.3% → 26%); narrative
  facts retain the code's approved precision. Never round a nonzero change to a
  misleading zero or change direction.

## CS12 — YouTube descriptions

- Begin with one plain-English summary sentence about the actual report,
  identifying stored names, ZIP, county, and the meaningful result. Include any
  additional full-column names once, naturally, without a repeated keyword list.
- Follow with four or five distinct key stats in natural wording, each from the
  same verified deck facts. No repeated summary/stat, duplicate nonempty lines,
  rigid versus templates, signed numbers, `percentage points`, or `relative`.
- Then put the existing market-page link and the separate actual agent CTA.
  Format phones as `(916) 212-8640`. For an unclaimed ZIP use the existing county
  recruiting CTA instead of inventing an agent or phone. Keep the rolling-average
  footnote; never include the prohibited provider credit or `historical` wording.
- Keep the first lines useful before Show more. Do not bury the summary under
  links, hashtags, boilerplate, or a verbatim duplicate of the title.

## CS13 — Mandatory deploy gate

- Every deploy entrypoint must run the content gate before any upload, publish,
  infrastructure change, or email. A standalone test is insufficient if the
  deployment command can skip it. Fail closed on missing prerequisites.
- Render the real 90004 no-agent and 93536 agent fixture chain before every
  deploy using the candidate code; inspect all eleven artifacts and provenance.
- Block on any Short over 30 seconds or any deck-chart/page image in its visual
  scene; forbidden spoken words/signs; slide narration that merely reads all its
  numbers; missing factual meaning; title/subject/opening limit failure; more
  than one white content card; a header that stays on screen or a signup bar
  that scrolls away on blog/subdomain/embed; the prohibited bottom reader block
  or its button on those surfaces or email; duplicate description
  lines; missing required geography; wrong voice, model, or accelerated audio.
- Also block if `Redfin` or `historical` appears in any customer-facing text,
  metadata, narration, PDF slide, or native video scene. Inspect actual rendered
  browser/scene text and PDF text. Block a headline/subject containing `YoY`, a
  semicolon, more than its CS08 ZIP-specific limit, or a different CS08 pattern/name fallback.
- Inspect measured encoded duration, native composition identity/visual inputs,
  structured numerical validation, actual browser layout/scrolling, metadata,
  and full media decode. Source-string assertions alone do not prove a render.
- Record failures clearly with the rule ID and affected asset. Tests must include
  deliberate violating fixtures to prove the gate rejects them. No provider,
  model, TEST-mode, missing-baseline, environment-flag, or legacy-route bypass.
- Commit and push task-only changes in each repo before any authorized deploy.
  Do not stage unrelated work. A task without explicit deployment permission
  ends with private review artifacts, never production actions.

## CS14 — Review delivery and approval baseline

- Refresh only ~/Desktop/AA-review/FINAL-redfin/ with exactly:
  1-long-form-agent.mp4, 2-long-form-no-agent.mp4, 3-short-agent.mp4,
  4-short-no-agent.mp4, 5-blog-agent.html, 6-blog-no-agent.html,
  7-email-agent.html, 8-email-no-agent.html, 9-blog-embed.html,
  10-subdomain.html, and 11-youtube-metadata.txt. Agent = 93536; no agent = 90004.
  The metadata file covers all four videos. Back up before replacement; keep
  supporting artifacts outside this review folder. Publish nothing, send nothing.
- Report each of the sixteen review issues and its fix and enforcing rule.
  Treat native restoration and its 30-second enforcement as one combined Shorts
  issue; the remaining issues correspond to prompt items 6–20.
- PART H IS PENDING USER APPROVAL of these rebuilt review files. Do not label the
  present or previous review approved, copy it as an approved baseline, or silently
  accept new output. After explicit approval, save all eleven files as the approved
  baseline in each repo, with content hashes and rendering/input provenance.
- Every future deploy re-renders both ZIPs and compares with that approved
  baseline. Any unrequested change in layout, native Shorts format/duration,
  voice, wording style, titles, CTAs, or charts blocks deployment and is reported.
  Task-specific explicit exceptions identify the exact requested rule/assets;
  they do not waive unrelated differences. The baseline changes only after the
  user approves new review files. No automatic baseline update on deploy.

## Evidence and precedence

The 2026-11-17 correction explicitly removes provider credit and the word
`historical` from customer-facing output and restores the CS08 headline format.
It supersedes earlier source-credit and headline-advice wording only; all other
approved rules remain unchanged. Internal data provenance still identifies the
original provider and retains its existing calculations and source filters.

The current scoped restoration selects the Nov 7 gray Shorts frame with native
charts and the scrolling header/sticky signup behavior, and removes the bottom
reader CTA from blog/subdomain/embed/email. These instructions supersede the
conflicting Shorts, signup-position, and reader-CTA clauses only.

The 2026-11-16 content-lock prompt explicitly replaces older PDF-chart Shorts,
40–50-second targets, signed comparison recitation, separate section cards,
fixed signup bars, ZIP-code speech, and generic YouTube metadata. All unrelated
behavior stays unchanged. The current eleven-file delivery replaces older
two-Desktop-PDF review instructions for this task. Superseded/rejected notes are
historical evidence, not active rules.

Prior rules are evidenced by pipeline commits 73f91b7/f3a8284/369dd8f (native
territory-aware scenes), 4704d97/a800bb6/96492af/a26e3a2/917caa4 (PDF master and
fact checks), 36d97c1/d9cec17/4b73229 (buyer/seller meaning, intros and CTAs;
later chart-slide/voice specifics superseded), f4a903b (Inworld), 89f65ed
(one-stat headline), 1038219/808dab5/811fac2 (Redfin windows/comparisons), and
637c7cc/afd7f22 (stored names). Also reviewed: docs/county-pipeline.md, the
customer deck/review notes, aa-blog/review/review-notes.txt, re-data display/email
handoffs, and AA-review/PROMPTS/2-aa-video-pipeline-shorts.txt. That older prompt's
deck-chart treatment is superseded by CS05; do not silently carry it forward.

Current research, checked 2026-11-16: YouTube recommends accurate, succinct
titles with important words first, and useful descriptions before Show more.
Applying that to local market content means leading with the real place and
verified change. The 60–70-character visibility target and exact title/description
formats above are project rules, not guarantees about every YouTube surface.

- https://support.google.com/youtube/answer/12340300?hl=en
- https://support.google.com/youtube/answer/12948449?hl=en
- https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/
