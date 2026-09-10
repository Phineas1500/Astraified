# Generalized lesson generation — September 10, 2026

## What changed

New studio jobs use `general-v1`. The planner chooses two or three objectives from the supplied source, with arbitrary concept IDs, quoted evidence, claims, misconceptions and scope limits. There is no topic whitelist and no production derivatives or civics fixture. Example buttons supply public source URLs and a focus; they do not select a prewritten game.

The mechanics stage creates the learning activity itself:

- **Simulation:** numerical, choice or toggle controls; arithmetic/logic expressions; derived quantities; an optional plot; trial goals; explanatory feedback; and a changed transfer case. First derivatives use automatic differentiation of supported smooth expressions.
- **Evidence:** source-attributed artifacts, destination slots, capacities, defensible accepted arrangements, explanatory feedback and a new set of transfer evidence.

The story stage writes a compact narrative blueprint: original dialogue, discoveries, locations, props, learning connections, an optional favor and a final action. It receives descriptions of the activities' controls and instructional context, without expression programs or answer keys. A deterministic compiler supplies one of two room layouts, independently accessible early leads, inventory combination, ordered interaction rules, hints and a reference route. Review and repair still receive the complete models and compiled story. Artwork comes from the existing harbor kit. Generated data cannot execute arbitrary JavaScript.

## Acceptance checks

1. Learning evidence quotes must occur in their source records. This checks quotation identity, not semantic entailment.
2. Machine configurations must satisfy the bounded interpreter contract. A simulation starts with an unsuccessful baseline and supplies a recomputed successful intervention with changed outputs. Evidence arrangements must place every card within slot capacity. Transfer cases must differ mechanically or introduce new evidence.
3. The episode reference route must finish using the actual transition engine. Every reachable story state must retain a completion route; state exploration rejects packages exceeding 20,000 states.
4. A separate model call reviews the proposed lesson against its sources, including scientific accuracy, classifications, assumptions, instructions and transfer. Blocking findings prevent release. One repair allowance is shared across mechanical, story and content failures, followed by revalidation and another content review.
5. Gameplay independently replays submitted trials. Caller-supplied outputs and pass flags cannot establish success. Completed goals and their sources remain available in the notebook.

Review is performed by the same configured model in a separate request, not by a human expert or a different provider. These checks do not establish fun, retention or mastery. Some models are intentionally rejected conservatively rather than evaluated outside their supported mathematical domain.

## Automated coverage

255 tests pass across 16 files with `npm test -- --maxWorkers=2`; TypeScript and the production build pass. An earlier unrestricted run concurrent with the build hit the default five-second limits in two existing exhaustive tests while the machine was under heavy load. Reducing worker concurrency passed every assertion without changing test timeouts or validation logic.

Tests cover generated calculus and ecology models, historical evidence with multiple accepted interpretations, causal ordering, choice/toggle controls, stack and number bounds, derivatives through dependent outputs, malformed and forged evidence, changed transfer cases, and incompatible source references.

Generation tests compile and complete both calculus and civics packages through the real episode engine. Job tests cover stage checkpoints, separate review, blocking findings after repair, cancelled mechanics repair, timed-out combined repair, restart recovery and exhausted repair retries. They also verify that a persisted blocking review must be repaired before a new review, review attempts cannot exceed three, and no repair is spent after the review budget is exhausted. Legacy Transformer providers and stored packages retain their existing behavior.

The model transport pairs Undici fetch and its connection agent with the configured stage deadline, avoiding Node’s independent five-minute HTTP timeout. Real local HTTP tests verify delayed headers, explicit cancellation, no automatic retry and connection-pool cleanup.

The compact story compiler is tested across both room layouts, swapped lead locations and two/three-objective plans. Every reachable story state is certified, and reference routes finish within 25 actions. Tests verify independent early leads, the third-activity gate, reverse inventory combination, consumed parts staying collected, source-linked discoveries, and optional favors before or after the ending.

Mathematical HTML extraction preserves MathML fractions, exponents, roots and limit notation, and removes duplicate alternative representations. Original TeX annotations take precedence when present. This improves source fidelity without interpreting scanned diagrams or repairing ambiguous PDF text.

## Live proof: derivatives

A real studio submission of [OpenStax Calculus Volume 1, section 3.1](https://openstax.org/books/calculus-volume-1/pages/3-1-defining-the-derivative) generated **The Moment That Went Missing**, an observatory mystery about a biscuit held up by a mislabeled interval. The run completed September 10, 2026, 17:25:03–17:29:47 UTC. It used the default provider through the actual browser form, with no topic adapter, hand-edited package, fixture injection or repair call.

- Four rooms, four inventory items, 27 rules, two generated simulation activities and an 18-action reference route.
- Validation certified 1,273 reachable story states. Both machines' four baselines fail and their computed reference interventions pass.
- The tangent investigation changes from `x²` at 3 (slope 6) to `3x²−4x+1` at 2 (slope 8). Paired secants are computed simultaneously; the changed curvature requires a smaller increment.
- The motion investigation distinguishes zero position from 2 m/s velocity, then positive height from −32 ft/s velocity. Units and signed velocity are explained in the task text.
- Full browser playthrough passed: physical clues, inventory combination, both activities and both transfer cases, explicit final bell action, biscuit ending and optional bookmark/cushion-review secret.
- A deliberately inadequate increment failed with explanatory feedback. An unfinished experiment, controls and recorded attempts survived a full page reload.
- Mobile numerical readouts were corrected to keep each number intact. At 390×844, the page width remained 390 pixels and controls, feedback and completion were usable. The normal viewport was restored.
- Both model content review and a separate agent audit found the formulas, units and source grounding acceptable. The model review recorded two advisory limitations: the exact limits are visible, making this guided calibration, and one model-note sentence overstates the proposed-line readout. No secant/tangent graph is generated in this case.

The run reported 61,357 tokens (46,501 input; 14,856 output) across four completed model calls. This is observed usage, not a per-job price or general cost estimate. The case remains in the user's local library; its QA progress was reset for a fresh playthrough. Bramble Bay and earlier cases were preserved.

## Civics generation reliability investigation

A second real source submission used the [National Archives overview of the Constitution](https://www.archives.gov/founding-docs/constitution/what-does-it-say). Its learning plan and two evidence activities passed configuration checks, and a separate audit verified their source quotations and accepted classifications. The initial job did not produce a playable episode: its first two story attempts encountered Node's independent five-minute HTTP timeout, and its third returned after 322 seconds but exhausted the then-24,000-token output budget. The three-attempt limit was respected; that job remains failed.

That run exposed the need for explicit matching HTTP/SDK deadlines. A fresh submission then used compact descriptions of the activities and a larger 32,000-token story allowance. Its new evidence activities passed a separate exhaustive audit, including a less-guided transfer task distinguishing supported, contradicted and unstated proposals. However, its first story request also exhausted the output allowance after 413 seconds. Increasing the budget and compressing the input alone did not solve the story-writing bottleneck.

The final architecture replaces low-level model-authored quest rules with a compact narrative blueprint and deterministic quest compiler. This is a subject-independent change: all new story calls use it, with a 12,000-token allowance. The model still generates the actual learning activities and source-specific narrative; spatial placement and reliable quest wiring come from shared structures. Existing generated episodes and full-story repair contracts remain supported.

The exhausted job reported 40,254 tokens from responses with available accounting. Provider usage from the first two interrupted requests is unknown, so this is not its complete bill. The failed job and completed checkpoints remain private local records.

## Live proof: the Constitution

The fresh National Archives submission was resumed through the normal studio button with its remaining story allowance. The compact story and separate content review completed September 10, 2026, 18:11:35–18:12:28 UTC, producing **The Exhibit That Bowed**. No checkpoint data, answer keys or generated story were manually edited, and no repair call was needed.

- Four rooms, five inventory items, 25 rules, two generated evidence activities, four rounds and a 14-action reference route.
- Validation certified 1,285 reachable story states. An independent mechanics audit checked every capacity-valid arrangement: all six valid branch-bay permutations pass, mismatched institutions fail, and the directory, relationship and proposal boards each accept their correct complete classification.
- The first investigation pairs branches with institutions, then repairs a fictional directory that merges two branches. The second reconstructs structure, safeguard and purpose, then distinguishes supported, contradicted and unstated exhibit proposals. Transfer instructions do not provide the complete answers.
- Full browser playthrough passed: both early leads, collected pole and hook, reverse-order inventory combination, both activities and transfer rounds, explicit curtain-pull finale, and the knitted-mussel favor completed after the ending for a curator badge.
- Deliberately wrong branch pairings failed with explanatory feedback. A partially repaired board, previous failed attempt and collected item survived a full page reload. Keyboard card selection and placement worked.
- At 390×844 the document width remained 390 pixels and the scrollable evidence dialog was 366 pixels wide. The first activity and its transfer were completed at that size. Normal viewport sizing was restored. The final browser error log was empty.
- The notebook retained each claim, scope, discoveries and the original Archives source link. Content review passed both objectives, all four rounds and the story without advisory or blocking findings.

The branch-directory task is near transfer, not an assessment of unfamiliar constitutional duties. The supplied excerpt does not describe particular powers or checks, and the generated lesson consistently acknowledges that scope. One presentation limitation remains: feedback describes a repaired relationship board, while the UI shows the sorted artifacts rather than a newly drawn arrow diagram.

The resumed story plus review reported 15,875 tokens (13,718 input; 2,157 output) and took about 53 seconds. That timing excludes the already completed source analysis and mechanics stages. The fresh job's cumulative reported usage is 61,194 tokens, including its earlier failed 32,000-output-token story request. Generation latency and success are not guaranteed by this one successful run.

Both new cases remain in the local studio library with QA progress reset for the user. Existing Bramble Bay and Transformer cases were preserved. Generated packages, full excerpts and job records were kept out of Git.

## Remaining limits

There is no guarantee that every topic or source can yield an acceptable lesson within these two activity types. The source must provide enough readable explanation for at least two meaningful objectives. The current creator uses one link, pasted text or text-based PDF/TXT/Markdown file, with 24,000 extracted characters and a 60-page PDF limit. It does not perform topic-only research, OCR, diagram understanding or multi-document synthesis.

The story checker certifies the finite adventure graph; model sampling and a declared successful intervention do not prove numerical validity at every possible combination of controls. Runtime domain failures are shown explicitly. Evidence answer keys and conceptual relevance depend partly on model judgment. A changed transfer round is practice, not a validated mastery assessment.

Generated cases and source excerpts remain private in `.astraified/jobs/` and the local browser library. Ordinary play makes no model calls. No new artwork, 3D mode, hosted accounts or public deployment is included in this increment.
