# One studio, two game formats

The main site at `/` contains the source form, format selector, generated library and both players. `windpost.html` remains an optional development entry; users do not need it. The 3D design follows the third-person exploration direction: a visible character, places to explore, residents to meet and objects with meaningful effects.

## Shared interface

`src/games/types.ts` defines `GamePackage = {version:1, format, episode}` with a discriminated `point-and-click` or `3d` episode. Each format retains its existing schema and independent save key. Validation dispatches to the complete format-specific validator; it does not coerce unknown content into a demo.

The job endpoint accepts multipart `format`. Omitted format remains `point-and-click` for compatibility. Ready responses expose `job.game`; point-and-click responses also retain `job.episode`. Old stored jobs retain their old pipeline. New 3D jobs use `harbor-v1`, while new point-and-click jobs use `general-v1`.

The shared browser library holds six generated games within its existing 3,000,000-character budget, with format-qualified identity. It reads legacy point-and-click entries individually and preserves the original storage key. Authored demos do not consume generated slots. Each player is loaded on demand and returns to the studio without navigating away.

## Generated 3D scope

The model selects exactly one quoted, source-grounded objective and generates exactly two cases. The second case applies the idea in a changed context. It generates the lesson configuration, station descriptions, discoveries, hints, dialogue and delivery story. A deterministic compiler binds these to a fixed island with two stations, a bridge, a parcel platform, two residents, an optional postcard favor and an explicit parcel delivery ending.

- **Experiments:** one three-choice sample dock control and one or two visible computed outputs. New generation has no second dial. Every allowed setting is checked for finite results. Initial settings fail; reference settings pass; the first case's reference setting must fail the transfer case. Numeric values and labels come from the source-specific model. The player must place the sample before submitting an attempt.
- **Evidence crates:** exactly three short source-linked cards and two destination crates per case. The player reads a card, carries it to a category, places it, and can retrieve it. Slot capacities and explicit accepted alternatives come from the source-specific configuration. Feedback explains the relationship. Tasks requiring additional categories, long ordered sequences or unavailable interactions should be scoped down during planning.

Both modes now default to a curious beginner with no prior knowledge. Planning favors a source-supported foundation within the focus, even for technical sources or older audiences. Each activity explains a plain-language principle and a tiny example before asking for a different application; the second case changes only one feature and keeps the same support. Essential terms must be introduced before use. The separate content review checks for missing instruction, unexplained prerequisites, compound decisions and unnecessary mental calculation.

`server/generation-simplicity.ts` narrows structured model output on initial generation and both repair paths. Task prompts are limited to 360 characters, feedback to 240, and evidence card text to 220; additional detail remains in notes. Sentence fields require terminal punctuation and explicit instructions to write below the limit; the content review also rejects unfinished thoughts rather than approving clipped text because another field repeats it. These authoring schemas do not narrow runtime/save validators or add a new API field. Existing adventures retain their content, and older three-objective point-and-click checkpoints still request every planned machine. Resumed model calls use the new authoring/review guidance, so a rich older draft may need simplification within its existing repair budget. New point-and-click plans select exactly two related small ideas because the existing quest structure requires two leads.

The model produces bounded data, never executable JavaScript. No topic whitelist or fallback to a canned torque/velocity lesson is used. Subjects still need enough explanatory material to support one of the available interactions. The island and characters are authored assets; generation does not create a bespoke world, new animation system, unrestricted physics or arbitrary gameplay.

Both formats share source ingestion: one pasted excerpt, readable public URL, UTF-8 TXT/Markdown or text PDF; 10 MB upload and 60 PDF page limits; up to 24,000 extracted characters. Public HTML has a 10 MB transport budget to accommodate embedded assets, followed by a 2 MB retained-markup budget and element/nesting bounds before JSDOM. Asset data, scripts and styles are removed through an HTML parser; page scripts and linked resources are never executed or loaded. Public text/Markdown remains limited to 2 MB. No scanned-page OCR, diagram interpretation, audio/video ingestion, source collections or topic-only research.

## Checks and recovery

Both pipelines persist completed learning, mechanics, story and review stages in private `.astraified/jobs/` files. One total repair pass is shared across deterministic and content failures. A separate model review must pass before release. Cancellation, interrupted calls and recoverable failures can resume within the existing three-attempt stage budgets. Keys and raw uploads are not written into checkpoints.

The 3D runtime records real initial observations, submissions, hint counts and changed-case evidence. Saves replay their claims against the model. Missing observations in old saves remain missing. Completing the game demonstrates agreement with that model, not measured mastery or independent factual certification.

## Verification

**339 tests pass across 25 test files.** TypeScript and the main production build pass after the final presentation changes. This includes the existing point-and-click suite and both 3D kits. The main-page browser checks reported no console errors.

The test providers used by automated job tests are isolated from the production provider; no fixture substitution is available in the live creator. Tests cover both generated kits, legacy saves, library migration, source quotation checks, deterministic replay, repair limits, cancellation and checkpoint recovery.

Two real jobs were submitted through the main site's 3D source form on September 10, 2026, using pasted authored teaching notes. Both passed the separate model content review and are saved in the main browser's shared library:

| Game | Generated lesson | Provider-reported usage |
| --- | --- | --- |
| **A Parcel of Evidence** | Producer, consumer and decomposer roles; two rounds of four source-linked cards, with the second distinguishing scavenging from decomposition | 11,541 input + 10,756 output = 22,297 tokens |
| **A Current Delivery** | Maintain 2 A using the ideal relationship I = V/R: 8 V across 4 Ω, followed by 12 V across 6 Ω | 9,884 input + 3,492 output = 13,376 tokens |

The first ecology planning attempt exhausted a 7,000-token output budget. Its failed checkpoint and usage were preserved. After narrowing planning to the single source-backed goal and moving apparatus design fully into the mechanics stage, the same job resumed successfully with low reasoning and a 10,000-token cap. The numerical job completed in four calls without a retry. Neither game required a mechanics/story repair. These counts describe returned provider usage, including the first failed ecology call, and are not a complete billing record.

The numerical game was played from the main library through its full ending using normal browser controls. Its four meters displayed voltage, resistance, calculated current and target current. The bridge opened at 8 V; reusing 8 V at the changed 6 Ω station was rejected; 12 V succeeded. The parcel was physically collected and delivered to Moss. Field notes replayed two actual baselines and three submissions, and completion persisted when the game was reopened. Its QA progress was reset through the game menu so it is ready for a new player.

The ecology game's main-site check opened a generated source card with its three category definitions, picked it up, returned to the shared library and reopened the same carried state. The original generated point-and-click game **The Exhibit That Bowed** and the authored **Windpost** also opened in the main page and returned to the same library. Existing generated point-and-click library entries remained available. All of these interactions stayed at `/`.

The exact real ecology package also passed a complete physical browser playthrough using the unchanged 3D player through a temporary worktree QA entry. A deliberately wrong four-card arrangement was rejected. The player retrieved, dropped and carried cards again to correct it, crossed the bridge, sorted the changed second set, raised the parcel platform and delivered to Moss. The journal replayed both baselines, all eight final assignments and three submissions with zero hints. Carried cards and crate assignments survived a full reload and a fresh-tab restore after a browser-tool reconnection. The host's return-to-library callback also fired. The temporary entry and copied package were removed after verification; they are not a generation fallback or part of the main site.

A third real job, **Special Delivery, Weighted Carefully**, used the site's editorial Transformer starter notes with an explicit attention focus. It completed in 120 seconds without a retry or repair, reporting 11,674 input and 5,517 output tokens. Its 18 allowed input combinations matched an independent softmax and weighted-sum calculation within 1.8 × 10⁻¹⁵; each case has one passing setting, and the first solution fails the changed case. Main-page browser checks verified movement, character dialogue, carrying and placing a value-pair token, and unchanged attention weights with a changed weighted output. Its test progress was reset and it remains in the local library. A complete browser playthrough was not performed for this third lesson.

The Transformer review passed with one advisory issue that remains in the generated package: bridge feedback says a zero-valued term contributes because its attention weight is nonzero. The numerical calculation correctly makes that term zero. This lesson covers the notes' attention distinction, not embeddings, positional information or causal masking. Its numerical targets can also be reached through trial and error; clearer introductory explanations, token examples and predictions remain product improvements. Generated packages and their source records are private local data, not bundled Git fixtures.

These checks establish concrete generation, rendering and runtime behavior for these limited lessons. They do not establish quality across arbitrary topics or independently measure learning effectiveness.

## Public lecture import correction

The Purdue `transformers_part1.html` lecture initially failed the former 2 MB HTML download guard because its 4,079,020-byte file embeds several large PNGs. The corrected shared importer accepts bounded HTML downloads up to 10 MB and prepares them with a non-executing HTML parser before JSDOM/Readability. The actual lecture becomes 78,020 bytes of retained markup and 5,149 characters of readable source across three excerpts, with the original URL preserved. This does not interpret the diagrams. Plain-text and PDF transport limits, DNS pinning, redirect checks, cancellation, the 15-second download timeout and the extracted-context limit remain enforced.

After this correction, **354 tests across 26 files** and the production build pass. Fifteen new tests exercise asset-heavy lecture extraction, declared and streamed response limits, unchanged text/PDF limits, cancellation, private redirects, unsupported compression, MathML and TeX preservation, malformed attribute boundaries, and retained-markup/element/depth bounds. The studio format picker also has a separately verified CSS correction: text-input styles no longer enlarge its radio controls, and its card text wraps within the form on desktop and narrow screens.

Retrying the user's original URL submission in Helium, preserving 3D format and the focus “The architecture,” generated **One Cache, Special Delivery** in 102.554 seconds without retry or repair. It focuses on MQA key/value sharing and KV-cache savings. All 12 configurations matched independent arithmetic, the earlier solution fails the transfer case, and the model content review passed without issues. The actual shared library and 3D start screen were verified in that browser with no console errors; this was not a complete gameplay run. Reported usage was 16,719 input plus 4,342 output tokens. The generated lesson remains in that browser's local library.

## Beginner-default verification

After the simplicity changes, **398 tests across 28 files** and the production build pass. Generator-schema tests cover the smaller activity sizes, short copy, sentence endings and compatibility with richer runtime fixtures. Provider tests inspect actual structured-output requests for both modes and all generation/repair stages, including retained objectives in older three-objective checkpoints. The job test checks that an omitted audience reaches every 3D generation stage as a curious beginner with no prior knowledge.

The same public Purdue Transformer source and broad “The architecture” focus were exercised through Helium with the beginner default. The final sample, **A Word in the Right Place.**, teaches word order versus words alone using two rounds of three cards and two crates, with no arithmetic. It completed with one content repair to make the second example a new presentation of the same idea, and passed review. In-game field notes were checked for complete, readable prompts; the sample's test progress was reset. A full physical playthrough of this sample was not performed.

The final sample retains one review advisory: both rounds have the same positional answer pattern despite meaningful changes in the cards. Future generation guidance now explicitly asks for fresh neutral labels, changed representation, and a different answer pattern. This sample does not prove independent learning. An earlier test sample, **Words Aboard**, exposed clipped text at the new length caps; its existing package retains that advisory, while new generation now requires sentence endings and review of complete thoughts. Neither existing library entry was silently rewritten.
