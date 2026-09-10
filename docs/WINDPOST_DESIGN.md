# Windpost — third-person reference episode

This replaces the presentation of the earlier First Light diorama. A player-scale camera follows an expressive courier through a small, authored seaside world. Walk up to characters, jump across stepping stones, carry a counterweight, repair a bridge, recover a parcel and bring it home. The reference points are Lil Gator Game's welcoming exploration and Tinykin's legible object interactions; characters, assets and setting are original.

## Scope and learning

Two islands, two characters, two related mechanisms and three optional postcards. Moss needs a parcel from the far island. A 2 kg counterweight balances a 4 kg load at twice its distance from the pivot. Across the repaired bridge, a heavier 6 kg lift load needs a new arrangement. Position, weight and visible beam movement communicate the relationship before the journal names torque. Outcomes come from deterministic calculations, with assistance and attempts recorded independently. Completing the fixture is not evidence of mastery.

Transformers remain a useful subject for the separate investigation game. Levers demonstrate this mode's spatial strengths immediately: walking around, carrying, positioning and observing a mechanism. No source generation is needed for this authored fixture.

## Art and presentation

Palette: sea #379CBA, sky #BBDCEA, grass #A7BC70, pine #276E65, mail yellow #F5C64D, berry #B96177. Rounded original Blender characters, chalk cliffs, cedar bridges and oversized flowers create a tactile storybook world. The small courier's yellow cape is the visual anchor. Trebuchet/system rounded sans supplies readable dialogue; Georgia supplies the story title only. Most text is left aligned.

The canvas fills the viewport. A small quest note occupies the upper left; journal and sound controls sit upper right. One contextual interaction prompt appears beside the character near the bottom. Dialogue briefly occupies a low panel with a speaker name and a small number of meaningful choices. There is no persistent puzzle sidebar, remote station selector or numeric slider.

```
quest note                           journal / sound

                3D environment
                 NPC       bridge
                       courier
                    [E interact]
movement help                           pocket item
```

Design review: a large title card would obscure the thing this prototype must prove. The opening instead frames the courier, the first islander and the raised bridge together. Interface decoration stays restrained; silhouette, movement, scenery and reactions carry the personality.

## Isolation and possible shared interfaces

All runtime work lives in `src/windpost`, with a separate HTML entry and Vite configuration. Blender source and assets are namespaced. The point-and-click adventure, server, source pipeline and existing episode contract are untouched.

Proposal only, not implemented: eventually share source references, learning objectives, inventory IDs, dialogue outcomes, save-version metadata and computed evidence envelopes. Keep 3D transforms, collision geometry, character controllers, proximity interactions and camera cues specific to the 3D renderer. Revisit these boundaries after this fixture is playtested; do not force 3D spatial data into the point-and-click percentage layout.

## September learning/adventure iteration

The accepted first transfer uses the existing renderer-independent learning machine without changing its interface. An unchanged interpreter snapshot now lives at the same `src/domain/lesson-machines.ts` path in this worktree, with the provenance and synchronization boundary documented in [WINDPOST_LEARNING.md](WINDPOST_LEARNING.md). Windpost's authored adapter owns the mapping from physical sockets to lesson inputs.

The field notes distinguish starting observations from player attempts, show before/after torques, and preserve older deliveries without inventing missing history. Two optional discoveries add conversation branches; returning the workshop postcard adds a small visible world reward. These borrow the point-and-click mode's idea that discoveries should affect characters and quest state while keeping the interactions spatial.

The broader source/objective/save envelope and renderer-binding proposals above remain unimplemented. No shared interface was changed in this iteration.
