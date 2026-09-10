# Astraified: architecture for source-driven point-and-click missions

Research and repository assessment, September 10, 2026. This is a proposed design, not an implementation claim. Club Penguin mission-specific observations are covered by the companion mission research; this document translates the desired experience into a buildable system.

## Recommendation

Build a **2D adventure engine that runs generated, validated mission packages**, with a polished original reference mission establishing the quality bar. Keep React for the creator, library, accessible dialogue, notebook, and settings. Use Phaser for illustrated rooms, character animation, object interactions, camera movement, sound, and effects. Keep the adventure state and subject simulations in independent TypeScript modules.

The main change is structural. Currently a player selects one of three locations, opens a workbench, completes an experiment, and answers a question. A stronger adventure makes the player investigate a situation, talk to characters, discover useful objects, combine clues, change the environment, and solve a consequential problem. Learning should determine which actions succeed and why the world changes.

Do not begin by converting all existing screens into prettier rooms. First build one complete mission with branching investigation, inventory, revisited locations, character reactions, one optional secret, and a satisfying ending. Then use that mission's rules and authoring tools to produce source-driven variations.

## What the existing implementation contributes

Repository inspection found several useful foundations:

| Existing component | Decision |
| --- | --- |
| `server/sources.ts` | Retain text/PDF/URL extraction, source identities, bounded fetching, and provenance. Add richer document interpretation separately. |
| `server/generation.ts` | Retain structured generation and validation infrastructure; replace the three-station output contract. |
| `src/domain/circuits.ts`, `wiring.ts`, `routing.ts` | Retain deterministic calculations as puzzle adapters. They can drive physical apparatus inside rooms. |
| Library and saved-package validation | Retain the persistence approach; introduce a versioned adventure schema and state migration. |
| Notebook, creator, source UI | Reuse underlying functionality with an adventure-oriented presentation. |
| Babylon harbor | Preserve as an earlier experience. It should not constrain the new room renderer. |
| `Workbench.tsx` and linear App progression | Extract useful controls and feedback logic; replace the default modal-and-question progression. |

`StationId` currently permits only `workshop`, `relay`, and `beacon`; generation requires exactly three ordered stations; App enforces the preceding station's completion. Those constraints explain why newly generated sources still feel like the same lesson. Merely changing prompts will not remove them.

## Renderer choice

| Option | Assessment for this project |
| --- | --- |
| **Phaser with React** | Recommended. Phaser has scene lifecycle, loading, input, cameras, animation, and game effects. React already serves the surrounding application. Separate ownership prevents two frameworks from manipulating the same elements. |
| PixiJS with React | A strong alternative when fine control over rendering is the priority. Pixi offers a scene graph and pointer events, but more game orchestration becomes our responsibility. Its documented accessibility overlay is useful, though it does not eliminate the need for semantic interface design. |
| React plus SVG/DOM | Excellent for a first interaction prototype and precise apparatus. It can support an adventure, but we would build more animation, scene lifecycle, and asset orchestration ourselves. Keep SVG for instruments where labels and geometry matter. |
| Godot | Worth reconsidering if native desktop distribution, extensive character animation tooling, or a larger editor workflow becomes central. Current web export supports single-threaded builds, but brings another language/runtime and a less direct fit with the existing browser creator. |

These are project judgments based on documented capabilities, not performance benchmarks. Phaser documents scene-owned input, tweens, cameras, and display lists; its loader supports staged asset loading. [Phaser scenes](https://docs.phaser.io/phaser/concepts/scenes), [input](https://docs.phaser.io/phaser/concepts/input), [loader](https://docs.phaser.io/phaser/concepts/loader). Pixi documents event dispatch and a DOM accessibility overlay. [Pixi events](https://pixijs.com/8.x/guides/components/events), [accessibility](https://pixijs.com/8.x/guides/components/accessibility). Godot's current web-export constraints should be checked against the intended host. [Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html).

Do not select versions from old tutorials: Phaser's official archive currently lists **4.2.1**, released July 9, 2026. Pin a tested version after a small integration spike. [Official release archive](https://phaser.io/download/archive).

## The adventure runtime

Make the mission a collection of authored data interpreted by a stable runtime:

```text
MissionPackage v2
  source evidence and learning objectives
  scenes, exits, hotspots, characters, item definitions
  dialogue graphs, interaction rules, puzzle adapters
  progression dependencies, optional objectives, ending rules
  art/audio manifest, accessibility descriptions, solution witnesses

AdventureState
  current scene, inventory, object states, knowledge flags
  dialogue history, puzzle configurations, discovered evidence
  hints used, meaningful action history, checkpoint
```

The central operation is `reduce(state, action) → state + events`. Rendering observes state; sound and animation respond to events. An interrupted animation cannot lose an item or apply an action twice. Autosave happens after successful state transitions. Dialogue text cannot silently grant inventory or unlock doors.

Support a small, expressive action vocabulary: inspect, talk, take, use item on object, combine items, move, operate apparatus, present evidence, and choose a dialogue response. Every interaction has explicit conditions, effects, feedback, and a recoverable outcome. Typed conditions include `hasItem`, `flagIs`, `objectStateIs`, and `puzzleSatisfied`; typed effects include `grantItem`, `setObjectState`, `discoverEvidence`, and `startDialogue`. Never execute expressions or scripts supplied as strings in generated content.

For example, inspecting a locked maintenance hatch reveals corroded contacts. A technician lends a tester after a conversation. Using the tester produces a meaningful reading; repairing the correct connection changes the room lighting and the technician's dialogue. A wrong attempt yields a visible consequence and a useful observation. The learner is solving the world's problem through the concept.

Inventory needs inspectable objects, selected-item feedback, combinations with clear affordances, and useful reactions to plausible failures. Support click-item then click-target as well as dragging. Important tools should be reusable; consumed objects need explicit replacement or guaranteed remaining supply. Items that have finished their purpose can move to a keepsake pocket without silently disappearing.

Use short dialogue nodes with conditions and state-aware reactions. Characters remember discoveries and respond to shown objects. Live conversational AI can be added later for optional banter or explanations, but the main quest should run from the validated package without waiting for a model or allowing invented quest facts.

## Design dependencies, not a sequence of worksheets

Keep three separate graphs:

1. **Knowledge graph:** concepts, prerequisites, misconceptions, and source evidence.
2. **Puzzle graph:** what discoveries and actions enable other actions.
3. **Spatial graph:** where the player can travel and what changes there.

They should influence each other without being identical. Two early leads can be investigated in either order and converge on a repair; a previously visited room can acquire new meaning once the player has a tool. Optional kindness, curiosity, or a harder application can reveal a secret or extra ending beat. Required conceptual evidence must remain on a reliable route to completion.

A useful first mission scope is five or six rooms, three distinctive characters, roughly eight useful inventory objects, two converging investigation branches, two or three substantial concept-bearing puzzles, and one optional secret. These are design targets, not empirically optimal counts. Avoid an inventory full of decorative junk or combinations that depend on guessing the author's private logic.

## Make learning part of the actions

Habgood and Ainsworth compared versions of an educational mathematics game and found better learning under fixed play time for its intrinsically integrated version; a small free-choice study also found longer voluntary play. Their participants were children, so the findings support a design principle, not an efficacy guarantee for Astraified's older audience. The relevant principle is that the subject should be embodied in the mechanics and representations players use. [Original research, 2011](https://shura.shu.ac.uk/3556/1/Habgood_Ainsworth_final.pdf).

For circuits, an independent emergency light should keep functioning when another branch fails. For weighted graphs, a courier's travel costs should affect a delivery plan and expose why choosing the cheapest next step can fail. For experimental science, choosing a comparison condition should change what a character can legitimately conclude. For historical material, corroborating competing accounts can determine which reconstruction is defensible; disputed interpretation must remain visibly disputed.

Ordinary adventure actions can remain playful without carrying a learning objective. The important boundary is that the major concept-bearing decisions cannot all be bypassed by unrelated collection tasks or a final multiple-choice gate. Conversely, physically finding an item should not be treated as evidence that the learner understands the associated concept.

Define a learning claim, the observable evidence that would support it, and a task that elicits that evidence. Record meaningful events such as a prediction, a controlled change, an observation, and success in a changed situation. Newton's Playground research illustrates this evidence-centered approach to embedded assessment; a study of 165 eighth- and ninth-grade learners reported pre/post physics gains and correlations with prior knowledge. It did not include a no-game comparison group, and does not establish that completion alone measures mastery. [Original study, 2013](https://myweb.fsu.edu/vshute/pdf/AIED%20NP.pdf).

Use these observations initially to deliver graduated hints and a clear debrief, not a falsely precise mastery score. After a supported repair, introduce a new apparatus elsewhere that requires the same principle with fewer cues. Preserve a short independent transfer task and later retention check during learner evaluation. Learning evidence, game completion, assistance, and enjoyment should be reported separately.

## Generating meaningful variation

Split generation into reviewable stages:

1. Extract a focused source packet with page/URL references and unsupported or uncertain claims marked.
2. Choose two or three learning objectives and the actions that could demonstrate them.
3. Select compatible mechanic adapters and a narrative situation where those actions matter.
4. Produce the puzzle dependency graph, inventory economy, dialogue, hints, and world changes.
5. Produce scene compositions and asset briefs using a consistent art specification.
6. Compile and validate the package; reject or repair invalid outputs.
7. Run a complete solution trace and browser checks before presenting a playable release.

Astra should invent the situation, dialogue, clue relationships, arrangements, and supported parameters. The runtime should define legal actions and enforce outcomes. Early generation can compose reviewed puzzle patterns in new combinations; later, new mechanics can be developed as sandboxed, separately tested extensions. Unrestricted freshly generated game code should not be the default way a learner's uploaded PDF becomes playable.

Variation must change at least some reasoning requirements, dependency links, evidence, or consequences. New names and artwork around identical solutions are insufficient. A second source should produce demonstrably different puzzles while retaining coherent pedagogy. Broad topical coverage requires new mechanic families; forcing all source material into circuits or routes will recreate the current limitation.

## Solvability and quality gates

Package validation needs more than valid JSON and a list of source IDs. Check every reference, predicate type, reachable location, dialogue exit, usable item, asset, and mandatory objective. Check recipes cannot accidentally consume a unique prerequisite. Check re-entering rooms, repeated clicks, interrupted dialogue, and reloads are safe.

Require a generated candidate solution, then independently execute it through the same reducer used by the game. For a bounded finite mission, explore reachable abstract states and reverse-reachability from success states: every reachable nonterminal state should retain a completion path, unless it is a deliberately reversible failure. A successful solution trace alone does not prove freedom from softlocks. If exhaustive search is too large, restrict the authoring language and report the search bounds; random exploration is additional evidence, not proof.

Scientific puzzle adapters need their own solution and misconception tests. Semantic source support requires claim-level review beyond quotation matching. Visual QA must confirm that important objects can be found and selected, text fits, states look different, and clues remain legible across supported sizes. Human playtesting is still necessary for fairness, humor, pacing, and whether a valid solution feels discoverable.

## Art pipeline and delivery order

Use illustrated room compositions with separate background, foreground, interactive props, characters, and effect layers. Define a shared palette, line weight, perspective, light direction, character model sheets, and scale rules before producing many images. Generate backgrounds with reserved spaces for gameplay objects; do not paint puzzle-critical wires, labels, quantities, or inventory items irreversibly into the background.

Render scientific apparatus from deterministic SVG/canvas geometry. Use generated art for expressive environments and character assets, then inspect it against the interaction layout. Maintain state variants for opened drawers, repaired machines, collected objects, and changing weather. Small idle animations, expressive reactions, local sound, and scene transitions will contribute more to this genre than a freely orbiting 3D camera.

Blender remains useful for consistent prop angles, occlusion, and sprite renders; it is optional infrastructure, not the runtime. Its supported background rendering allows reproducible exports. [Blender command-line rendering](https://docs.blender.org/manual/en/2.80/advanced/command_line/render.html?highlight=background+render). Keep scripts, source assets, provenance, dimensions, anchors, and hit regions alongside each exported asset.

Build in this order: a paper dependency map and room storyboard; a gray-box playable mission; the reducer, inventory, dialogue, and save system; finished art and sound for that mission; then generation of a second source-driven mission using the same language. The decisive milestone is a player independently solving a coherent adventure and applying a concept in a new situation. Only then expand automatic art production, mechanic families, and additional genres.
