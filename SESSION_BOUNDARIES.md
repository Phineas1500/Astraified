# Parallel development boundaries

The point-and-click/source-generation session owns `src/episodes/`, `src/EpisodeStudio.tsx`, `src/domain/transformers.ts`, the new `server/episode-*` modules, and integration with `src/AdventureApp.tsx` and `server/index.ts`.

The 3D prototype should use a separate worktree and keep work in `src/game/` or a dedicated 3D directory. The existing Bramble Bay player remains available during migration. Avoid overwriting its entry point or modifying the source-creation contract without coordinating.

The version-1 episode contract is implemented in `src/episodes/types.ts`. Source records, learning objectives, and computed puzzle evidence can be shared across renderers. Percentage-based scene layouts belong to the 2D renderer; a future 3D renderer can supply its own spatial layout. The Transformer math module is renderer-independent.

Local source-processing job data is private and ignored in `.astraified/`. Do not commit uploads or generation checkpoints. Current verification evidence is recorded in `EPISODE_QA.md` and `IMPLEMENTATION_STATUS.md`.
