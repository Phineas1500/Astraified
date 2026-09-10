# Parallel development boundaries

The point-and-click/source-generation session owns `src/episodes/`, `src/EpisodeStudio.tsx`, `src/domain/transformers.ts`, `src/domain/lesson-machines.ts`, `server/general-generation.ts`, `server/story-blueprint.ts`, `server/math-text.ts`, `server/model-client.ts`, the `server/episode-*` modules, and integration with `src/AdventureApp.tsx` and `server/index.ts`.

The 3D prototype should use a separate worktree and keep work in `src/game/` or a dedicated 3D directory. The existing Bramble Bay player remains available during migration. Avoid overwriting its entry point or modifying the source-creation contract without coordinating.

The version-1 episode contract is implemented in `src/episodes/types.ts`. Source records, learning objectives, and computed puzzle evidence can be shared across renderers. Percentage-based scene layouts belong to the 2D renderer; a future 3D renderer can supply its own spatial layout. Both the Transformer math module and the generated simulation/evidence interpreter are renderer-independent. `EpisodePuzzleConfig` accepts legacy Transformer apparatus and the new `simulation`/`evidence` data contracts; `src/episodes/puzzle-adapters.ts` dispatches validation and evidence replay.

New jobs use the `general-v1` generation pipeline. Old stored jobs without a discriminator keep their original Transformer pipeline and remain resumable when eligible. A 3D renderer can consume the new generated learning machines without changing source ingestion or the source/claim/evidence contract. Do not assume objective IDs name a fixed subject family. Compact narrative blueprints are compiled into the existing episode rules; their quest structure and room placement are currently specific to the point-and-click renderer.

Local source-processing job data is private and ignored in `.astraified/`. Do not commit uploads or generation checkpoints. Current verification evidence is recorded in `GENERALIZATION_QA.md` and `IMPLEMENTATION_STATUS.md`; `EPISODE_QA.md` records earlier checks.
