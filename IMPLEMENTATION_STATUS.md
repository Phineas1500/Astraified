# Astraified implementation status — September 10, 2026

## Current product

The cover offers the original **The Last Light at Bramble Bay**, the new **Create an adventure** studio, and **Earlier experiments**.

Bramble Bay remains a complete authored point-and-click case: six illustrated rooms, character conversations, inventory combinations, two independent investigations, three electrical apparatus, a story reversal, a ferry-arrival ending, and an optional interactive keepsake. Its existing save is preserved. Its earlier browser QA is recorded in `ADVENTURE_QA.md`.

The new studio accepts pasted text, public links, and text/Markdown/PDF files. It produces a quoted learning plan, writes a declarative adventure, checks its reference solution and reachable states, and opens accepted packages in a reusable point-and-click player. Generation is staged, cancellable and resumable through private local checkpoints. The browser maintains separate episode saves, unfinished instrument drafts, and a six-case library.

The first supported subject is **Transformer neural networks**, requiring source coverage of sequence position, scaled dot-product attention and causal masking. Generated stories use the existing harbor art and three reviewed numerical instruments. They can vary dialogue, clues, inventory, room arrangements, dependencies, discoveries and endings. They do not generate arbitrary mechanics, artwork, or game genres yet.

The studio also includes **The Case of the Mixed-Up Messages**, a complete authored Transformer reference using the same package/runtime as generated cases. Ordinary play in either authored case makes no model calls.

## Verification in this increment

- **190 tests pass across ten root-project test files.** The test configuration excludes the independent 3D worktree.
- **TypeScript and Vite production build pass.** The episode studio is lazy-loaded; the original cover does not eagerly load it or Phaser.
- **Complete Transformer reference browser playthrough passes:** two clue branches, inventory combination/use, position experiments, attention mixing/value intervention, rehearsal reversal, causal intervention on two dispatches, and final broadcast.
- **Unfinished-puzzle persistence passes:** the position tape arrangement and both recorded rail trials survived closing the instrument and leaving/reopening the case.
- **Post-ending optional favor passes:** returned Pip's ticket, received the pocket announcer and triggered its joke without undoing completion.
- **Mobile and desktop checks pass:** studio, mobile scene/inventory/notebook, no page-width overflow at 390×844 or 1280×900. The normal viewport was restored. Forward and reverse Tab stay inside the inspected dialog.
- **Generated-case browser playthrough passes:** completed the paper-generated theater mystery, verified the ending prerequisite, and completed its optional crab-usher favor.
- **Generation recovery passes in the browser:** a real timed-out story stage retained source analysis; explicit resume continued the same job. A page reload reconnected to the running job.

The runtime uses computed evidence, not model-written success flags. Its package checker rejects missing references, invalid geometry, unsupported apparatus, inaccessible required actions, reference solutions that do not complete, and reachable states without a completion route. Exploration is exhaustive for each accepted finite story-state graph, with an explicit 20,000-state rejection cap. Numerical experiment correctness is checked separately. The authored Transformer package's save audit restored all **3,277 reachable states**.

Detailed current browser and real-generation evidence is in `EPISODE_QA.md`.

## Real generation and limits

The first live source run uses the public HTML version of **Attention Is All You Need**, capped at 24,000 extracted characters. Its learning-stage claims were checked against the supplied excerpts. The initial story attempt timed out, and the next reached its output cap. The saved checkpoint was resumed after aligning SDK/job deadlines and tuning stage budgets: learning uses medium reasoning, 6,000 output tokens and 155 seconds; story/repair use low reasoning, 24,000 tokens and 420 seconds. The final resumed call produced **The Harbor That Applauded Too Soon**: four rooms, five items, 31 rules and a 19-action reference route. It passed certification over 403 reachable story states without a repair call, then passed a full browser playthrough including its optional favor. Its partially completed position experiment survived a full page reload. The package is available in this browser's studio library.

Reported tracked usage is 25,009 tokens, excluding the two earlier failed attempts' unavailable usage; it is not a complete billing total. The final story call took about 108 seconds. See `EPISODE_QA.md` for the run history and remaining narrative polish issues.

New generation sends source excerpts to OpenAI using the server API key. Private `.astraified/jobs/` records persist extracted text and completed work, but not raw upload files or API keys. These checkpoints are ignored by Git. The UI reports usage returned by provider responses, including incomplete responses when available. Interrupted calls and the pre-fix failed attempts may incur usage not represented by that count. There is no hosted account system, multi-user isolation or cloud save sync.

The instruments use illustrative vectors and selected Transformer computations. A successful software test, matching quotation, or completed game does not establish pedagogical quality, enjoyment, transfer or retention. Human content review and playtesting with high-school/college learners remain necessary. Scanned PDFs, diagrams, arbitrary subjects, multi-source collections and automatic research from a topic alone are not supported by this creator yet.

## Next milestones

1. Playtest generated cases with target learners; measure clue fairness, time spent experimenting, misconceptions and a separate transfer task.
2. Add source preview/selection, source-linked learning explanations, job/library management and generation-quality measurements across multiple sources.
3. Broaden the reviewed mechanic families and generated art workflow while preserving deterministic evidence and playable dependency checks.
4. Coordinate the separate 3D work through shared source/objective/evidence contracts. Its spatial renderer remains an independent workstream.

`SOURCE_TO_ADVENTURE.md` and `POINT_AND_CLICK_DIRECTION.md` retain the broader design. `SESSION_BOUNDARIES.md` records current parallel-development ownership.
