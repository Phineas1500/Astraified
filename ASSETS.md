# Astraified artwork

## Bramble Bay point-and-click adventure

Six original illustrated backgrounds are in `public/adventure/`: `jetty.png`, `tearoom.png`, `workshop.png`, `storeroom.png`, `signalhouse.png`, and `lantern.png`. They were made with the built-in image-generation tool and individually inspected. See `ART_DIRECTION.md` for the exact prompts and scene placement notes. These are used inside the playable 2D rooms, not only as promotional covers.

Original code-native SVG characters, inventory objects, stateful room mechanisms, and the miniature-harbor reward live in `src/adventure/Character.tsx`, `ItemArt.tsx`, `SceneProp.tsx`, and `PocketHarbor.tsx`. Their layers can change independently of the backgrounds. Scientific apparatus is drawn and calculated deterministically. `RoomCanvas.tsx` uses Phaser 4.2.1 for the room layer, transitions, ambient motes, and the final light effect. Sound cues are synthesized locally in `audio.ts`; no commercial recordings or franchise assets are used.

The assets below belong to the earlier experiment edition, retained through Source studio.

## Harbor cover

- File: `public/harbor-key-art.png`
- Created for this project with the built-in `image_gen` tool.
- Generation brief: an original, cozy harbor island at blue hour, a lighthouse on the right, teal workshop huts, a small boat, warm windows, and atmospheric water. Painterly, stylized 3D composition in navy, sea-glass teal, and gold. Landscape framing with space for interface text; no baked-in text, logos, or interface.
- Used as the library cover and creator preview. This image is promotional artwork; the playable island is a separate, real-time 3D scene.

## Playable world

`src/game/harborScene.ts` builds the island, water, paths, buildings, vegetation, boat, robot, lighting, and animated beacon in Babylon.js. `src/game/HarborWorld.tsx` adds the accessible station controls and optional synthesized ocean ambience. The sound uses Web Audio and contains no downloaded recording.

Two original props were generated with headless Blender 4.5.0:

- `public/models/harbor-lighthouse.glb`
- `public/models/harbor-telescope.glb`

See `public/models/ASSET_MANIFEST.md` and `scripts/blender/build_harbor_props.py` for provenance and regeneration. Blender is needed only to rebuild these assets, not to play the game. The first build used the official macOS ARM64 Blender distribution mounted temporarily under `/tmp`; that temporary development path is not a project dependency.

Club Penguin missions informed the approachable investigation format. Astraified uses original characters, world art, story, and code.
