# Astraified implementation status — September 10, 2026

## Current playable showcase

**The Last Light at Bramble Bay** is now the default experience. It is a complete authored point-and-click case with six illustrated rooms, four speaking characters, Button the crab, inventory inspection and combination, two independent investigations, source-linked observations, three physical apparatus, a story reversal, a ferry-arrival ending, and an optional keepsake quest.

The optional reward is interactive: ring a bell, sail a miniature ferry, and promote its crab captain. Humor, discoveries, and the favor are separate from mandatory educational progression. No multiple-choice gates or countdowns interrupt the case.

Phaser 4.2.1 renders the room layer, transitions, ambient motes and the ending light. React renders accessible objects, dialogue, inventory, map, notebook and deterministic apparatus. Four original SVG character designs plus the crab sit on six generated raster backgrounds. The Phaser bundle loads only when entering play; the old Babylon experience loads through Source studio.

Ordinary play makes no model calls. Mission progress and unfinished puzzle drafts save locally. Restart clears only this case and its three apparatus drafts. The earlier mission library remains available.

## Verification

- **120 tests passed across six files**, including the existing localhost API tests. No paid model calls were made for this increment.
- **Production build and TypeScript check passed.** The main bundle is approximately 335 KB minified / 107 KB gzip; Phaser room code is separately loaded, approximately 1.38 MB / 359 KB gzip. Artwork is additional.
- **Complete browser playthrough passed:** obtain tester, collect and test parts, combine retrieval tools, follow photograph and recover record, assemble portable lamp, reveal hidden junction, present both pieces of evidence, wire independent branches, diagnose and repair the shared supply, and bring the ferry home.
- **Incorrect-action feedback passed:** a direct supply short trips the practice supply without corrupting progression; undo recovers the valid path.
- **Persistence passed in the browser:** lamp wiring survives closing and reopening; partial signal wiring survives a full page reload and remains playable.
- **Optional post-ending path passed:** return Pip's charm, inspect the closed tin, show it to Button, unlock the toy, ring the bell, launch the ferry and promote the captain.
- **Responsive checks:** no page-width overflow at 390×844 or 1280×900; mobile dialogue uses its measured height, avoiding overlap with the inventory. The normal viewport was restored afterward.
- **Keyboard checks:** Tab and reverse Tab stay within conversations; choosing a dialogue branch retains focus within the conversation. Maps and notes remain accessible independently.

The domain suite also exercises both lead orders and 50 seeded exploratory traces of 80 actions, followed by successful completion. This is bounded recovery testing, not a proof over every possible state. Detailed browser coverage is in `ADVENTURE_QA.md`.

## Source creation and limits

Source studio retains the earlier uploader and generated circuit/routing experiments. Its live API integration was established in the earlier increment; this turn did not consume new generation credits or repeat live generation. **The creator does not yet generate Bramble Bay-style adventures.** The new case establishes the format and quality bar for that work.

The authored episode expresses closed paths, series/parallel behavior and shared-supply faults through actions and observations, using the existing reviewed electrical rules and an OpenStax source. It has not yet been observed with target learners. Successful software tests and a completed case do not establish enjoyment, transfer or retention.

## Next milestones

1. Observe high-school/college learners playing this case; refine clue fairness, pacing, character interactions, and independent transfer tasks.
2. Move case-specific interaction definitions into a validated mission authoring format; generate a second source-driven episode with meaningfully different evidence and dependency relationships.
3. Extend the creator with a direction preview, resumable generation and partial regeneration, source review, and measured usage.

The agreed broader design remains in `POINT_AND_CLICK_DIRECTION.md`; art prompts and provenance are in `ART_DIRECTION.md`.
