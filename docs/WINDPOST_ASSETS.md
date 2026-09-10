# Windpost character assets

These three original characters were authored, rigged, animated, exported, and studio-rendered in **Blender 4.5.0** on 10 September 2026. The source is `scripts/blender/build_windpost_characters.py`. No stock characters, downloaded meshes, textures, or external animation clips are used. The rounded silhouettes and clear colors follow a broad cozy adventure art direction; the character designs are original.

| Character | Runtime asset                | Design                                                                                                               | Clips                                         |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Piper     | `/models/windpost/piper.glb` | Sky-blue courier bird, ivory bib, orange beak, yellow scalloped rain cape, navy boots, red mail satchel and envelope | `idle`, `walk`, `jump`, `carry`, `carry_walk` |
| Moss      | `/models/windpost/moss.glb`  | Terracotta mole/beaver engineer, brass forehead goggles, teal vest, tool belt, broad tail                            | `idle`                                        |
| Bea       | `/models/windpost/bea.glb`   | Round lavender postmaster, white face, purple postal cap and tie, brass envelope badge                               | `idle`                                        |

## Runtime contract

- glTF 2.0 binary files, meters/game units: **height 1.65**, feet at **Y = 0**, **+Y up**, **+Z forward**, centered left/right on X. No additional scale is required.
- Each character has a real seven-joint armature with `root`, `body`, `head`, `wing_l`, `wing_r`, `leg_l`, and `leg_r`. Every visible primitive has `JOINTS_0` and `WEIGHTS_0`. Mesh parts use rigid skin weights for a deliberate toy-like articulation; there is no cloth simulation or facial deformation rig.
- Each material is embedded PBR color with no texture dependencies. Same-material geometry is combined, preserving skin weights, to reduce draw calls. Material names are implementation details.
- Piper's clips are in place: `idle` 2 s (breathing and gentle head/wing motion), `walk` 1 s (alternating leg and wing swing), `jump` 0.75 s (raised wings and tucked legs), `carry` 2 s (wings held forward with breathing), and `carry_walk` 1 s (the walk leg stride and body cadence with wings held in the carrying pose). NPC idle clips are 2 s. Use the character controller for world movement and jump height. `jump` should play once; the other clips can loop. Select `carry_walk` while moving with cargo and `carry` while stationary with cargo.
- Suggested held-object center in character-local glTF space: approximately `(0, 0.86, 0.38)`, adjusted for the object's size. Runtime held objects are separate from the asset.
- Babylon's glTF importer creates its own conversion root in a left-handed scene. Parent that imported hierarchy under the controller transform and retain its conversion transform; do not overwrite or independently rotate imported mesh nodes.

| Asset | Uncompressed bytes | Triangles | Skinned material batches |
| ----- | -----------------: | --------: | -----------------------: |
| Piper |          1,212,924 |    32,104 |                       16 |
| Moss  |          1,185,216 |    31,384 |                       14 |
| Bea   |            955,404 |    25,600 |                       14 |

`public/models/windpost/manifest.json` records the exported counts, dimensions, axes, and clip names. These are authored prototype assets; compression and lower-detail variants have not been added.

## Rebuild and authoring files

Run from the worktree with a local Blender 4.5 installation:

```sh
blender --background --factory-startup --python scripts/blender/build_windpost_characters.py
```

This writes the GLBs and manifest to `public/models/windpost/`, and saves editable `.blend` scenes and PNG studio renders under `artifacts/windpost-characters/`. The latter are authoring/QA artifacts and are not shipped through the public asset directory. On the current machine the verified executable is `/private/tmp/astraified-blender-volume/Blender.app/Contents/MacOS/Blender`; sandboxed startup crashed during Metal initialization, so asset generation used the approved Blender invocation outside that sandbox.

## Verification performed

- The script completed in Blender and asserted the exact expected clip sets and presence of a skin for each exported asset.
- The binary GLBs were independently inspected: all floating-point accessors are finite, each asset has one seven-joint skin, all rendered primitives have joint indices and weights, and the raw geometry spans Y = 0 through Y = 1.65.
- Exported beak geometry is on the positive-Z front of Piper. Blender authoring uses -Y front and Z up; the glTF exporter performs the axis conversion.
- All three studio renders were visually inspected. Piper's carry pose was additionally rendered with the NLA clip active, confirming that the wings move forward. Exported walk/jump rotations vary over time; the clips are not empty labels.
- The exported `carry_walk` clip was compared numerically against the other exported clips: both leg rotation tracks and body translation track exactly match `walk`, while both wing rotation tracks exactly match `carry`. Its duration is 1 s; all five Piper clips contain actual motion.
- Actual Babylon browser appearance, runtime animation transitions, movement speed matching, held-object alignment, and device performance require the root task's integrated playthrough. Asset-level validation does not claim those checks have passed.

## Isolation

This asset work changes only the Windpost character build script, these model files/manifest, this document, and generated authoring artifacts. It does not change the old harbor, point-and-click adventure, source-generation pipeline, shared schemas, controller, scene implementation, or lesson model. No shared-interface changes are implemented here.
