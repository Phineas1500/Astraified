# Astraified implementation status — September 10, 2026

## Current product

The cover offers the original **The Last Light at Bramble Bay**, the new **Create an adventure** studio, and **Earlier experiments**.

Bramble Bay remains a complete authored point-and-click case: six illustrated rooms, character conversations, inventory combinations, two independent investigations, three electrical apparatus, a story reversal, a ferry-arrival ending, and an optional interactive keepsake. Its existing save is preserved. Its earlier browser QA is recorded in `ADVENTURE_QA.md`.

The new studio accepts pasted text, public links, and text/Markdown/PDF files. It produces a quoted learning plan, generates the learning activities, writes a declarative adventure, checks its reference solution and reachable states, and runs a separate source-based content review before opening accepted packages in a reusable point-and-click player. Generation is staged, cancellable and resumable through private local checkpoints. The browser maintains separate episode saves, unfinished instrument drafts, and a six-case library.

The default **general-v1** pipeline has no subject whitelist. It generates numerical simulations or evidence investigations from arbitrary source-backed goals, including controls, formulas, quantities, cards, classifications, feedback and a changed transfer case. These activities are interpreted by a bounded deterministic runtime. Generated narrative varies dialogue, clues, props, discoveries and endings; a deterministic compiler supplies shared quest structures, one of two room layouts and two independently accessible leads. Cases reuse the existing harbor artwork. The earlier Transformer generator and packages remain compatible. New artwork and additional game genres are separate work.

The studio also includes **The Case of the Mixed-Up Messages**, a complete authored Transformer reference using the same package/runtime as generated cases. Ordinary play in either authored case makes no model calls.

## Generalization verification

**255 tests pass across 16 root-project files.** TypeScript and the production build pass. The generalized pipeline generates activities and narrative from source material rather than selecting from topic fixtures. A compact story blueprint is compiled into shared, validated quest structures. Mathematical HTML extraction now retains formula structure.

A real submission of the OpenStax derivative chapter produced **The Moment That Went Missing** without repair: four rooms, two generated activities, four mathematical scenarios and 1,273 certified reachable story states. A full browser playthrough, optional favor, wrong-answer feedback, reload recovery and mobile layout checks pass. The game provides guided calibration rather than an independent calculus assessment. Detailed live evidence and review limitations are in `GENERALIZATION_QA.md`.

A separate real National Archives submission produced **The Exhibit That Bowed** using generated evidence activities and the compact story compiler: four rooms, five items, four evidence rounds and 1,285 certified reachable states. The resumed story and content review completed in about 53 seconds without repair after earlier full-rule story calls exhausted their budgets. The browser playthrough verified wrong-arrangement feedback, source explanations, both transfer rounds, reload recovery, mobile and keyboard placement, inventory combination, the finale and a post-ending optional favor. Both generated cases are available in the local library with QA progress reset. `GENERALIZATION_QA.md` records the failures, corrections, observed usage and remaining limits.

## Earlier Transformer verification

- **190 tests pass across ten root-project test files.** The test configuration excludes the independent 3D worktree.
- **TypeScript and Vite production build pass.** The episode studio is lazy-loaded; the original cover does not eagerly load it or Phaser.
- **Complete Transformer reference browser playthrough passes:** two clue branches, inventory combination/use, position experiments, attention mixing/value intervention, rehearsal reversal, causal intervention on two dispatches, and final broadcast.
- **Unfinished-puzzle persistence passes:** the position tape arrangement and both recorded rail trials survived closing the instrument and leaving/reopening the case.
- **Post-ending optional favor passes:** returned Pip's ticket, received the pocket announcer and triggered its joke without undoing completion.
- **Mobile and desktop checks pass:** studio, mobile scene/inventory/notebook, no page-width overflow at 390×844 or 1280×900. The normal viewport was restored. Forward and reverse Tab stay inside the inspected dialog.
- **Generated-case browser playthrough passes:** completed the paper-generated theater mystery, verified the ending prerequisite, and completed its optional crab-usher favor.
- **Generation recovery passes in the browser:** a real timed-out story stage retained source analysis; explicit resume continued the same job. A page reload reconnected to the running job.

The runtime uses computed evidence, not model-written success flags. Its package checker rejects missing references, invalid geometry, unsupported apparatus, inaccessible required actions, reference solutions that do not complete, and reachable states without a completion route. Exploration is exhaustive for each accepted finite story-state graph, with an explicit 20,000-state rejection cap. Numerical experiment correctness is checked separately. The authored Transformer package's save audit restored all **3,277 reachable states**.

Detailed Transformer browser and real-generation evidence is in `EPISODE_QA.md`. Generalized generation, mathematical source extraction, acceptance checks and current limits are documented in `GENERALIZATION_QA.md`.

## Earlier real Transformer generation and shared limits

The first live source run uses the public HTML version of **Attention Is All You Need**, capped at 24,000 extracted characters. Its learning-stage claims were checked against the supplied excerpts. The initial story attempt timed out, and the next reached its output cap. The saved checkpoint was resumed after aligning SDK/job deadlines and tuning stage budgets: learning uses medium reasoning, 6,000 output tokens and 155 seconds; story/repair use low reasoning, 24,000 tokens and 420 seconds. The final resumed call produced **The Harbor That Applauded Too Soon**: four rooms, five items, 31 rules and a 19-action reference route. It passed certification over 403 reachable story states without a repair call, then passed a full browser playthrough including its optional favor. Its partially completed position experiment survived a full page reload. The package is available in this browser's studio library.

Reported tracked usage is 25,009 tokens, excluding the two earlier failed attempts' unavailable usage; it is not a complete billing total. The final story call took about 108 seconds. See `EPISODE_QA.md` for the run history and remaining narrative polish issues.

New generation sends source excerpts to OpenAI using the server API key. Private `.astraified/jobs/` records persist extracted text and completed work, but not raw upload files or API keys. These checkpoints are ignored by Git. The UI reports usage returned by provider responses, including incomplete responses when available. Interrupted calls and the pre-fix failed attempts may incur usage not represented by that count. There is no hosted account system, multi-user isolation or cloud save sync.

The retained Transformer instruments use illustrative vectors and selected Transformer computations. New activities use generated mathematical models or source-based evidence arrangements, with scope limits and a separate model review. A successful software test, matching quotation, or completed game does not establish pedagogical quality, enjoyment, transfer or retention. Human content review and playtesting with high-school/college learners remain necessary. Scanned PDFs, diagram interpretation, multi-source collections and automatic research from a topic alone are not supported by this creator yet. An unfamiliar subject is accepted only when its source can support meaningful learning through the available simulation/evidence interactions.

## Next milestones

1. Playtest generated cases with target learners; measure clue fairness, time spent experimenting, misconceptions and a separate transfer task.
2. Add source preview/selection, source-linked learning explanations, job/library management and generation-quality measurements across multiple sources.
3. Expand the generated interaction vocabulary and art workflow while preserving deterministic evidence, source fidelity and playable dependency checks.
4. Coordinate the separate 3D work through shared source/objective/evidence contracts. Its spatial renderer remains an independent workstream.

`SOURCE_TO_ADVENTURE.md` and `POINT_AND_CLICK_DIRECTION.md` retain the broader design. `SESSION_BOUNDARIES.md` records current parallel-development ownership.
