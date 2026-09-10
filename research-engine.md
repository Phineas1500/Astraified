# Astraified: engine and asset research

Research checked 10 September 2026. This is a proposed architecture, not an installed or implemented system. Estimates and recommended budgets below are engineering judgments to validate with a prototype.

## Recommendation

Use a browser application with a shared TypeScript gameplay model, Babylon.js for the game world, and accessible HTML/React controls around it. Begin with two modes in the same runtime: a Club Penguin mission-inspired point-and-click adventure, and a compact 3D exploration/puzzle environment. The adventure can use fixed cameras, layered artwork, sprites, and selectable props. The 3D version uses the same inventory, dialogue, quest, learning-evidence, hint, save, and interaction systems with a different camera and world presentation.

Babylon's official specifications include WebGL and WebGPU, scene picking, sprites and 2D layers, audio, animations, collision support, navigation meshes, glTF import, and optimization facilities including LOD and instancing. Those features make one runtime plausible for both initial modes; this integration recommendation is our inference, not a turnkey education-game feature Babylon supplies. Use the full Babylon.js engine initially, with WebGL compatibility as a requirement and WebGPU as an enhancement. [Babylon specifications](https://www.babylonjs.com/specifications/)

Do not make two independent render engines part of the first build unless a prototype proves the need. Phaser is a strong future adapter for platformers or arcade games. It targets browsers, supports JavaScript/TypeScript, and offers WebGL and Canvas rendering. [Phaser documentation](https://docs.phaser.io/) PixiJS is a useful alternative for a primarily 2D, highly customized visual product, with WebGL/WebGPU rendering, a scene graph, assets, and pointer interaction. [PixiJS introduction](https://pixijs.com/8.x/guides/getting-started/intro)

## Comparison

| Option | Best fit | Astraified tradeoff |
| --- | --- | --- |
| Babylon.js + HTML UI | Browser 3D and spatial puzzles, with fixed-camera adventure mode | Recommended: keeps one TypeScript runtime and many useful game-world facilities. Still requires our gameplay and pedagogical systems. |
| Phaser | Dedicated 2D adventures, platformers, arcade genres | Good if the first product becomes mostly 2D. Adding it alongside Babylon creates another rendering and input integration to maintain. |
| PixiJS | Rich 2D scenes, animation and custom interaction | Flexible rendering layer; we would build more gameplay organization ourselves. |
| Three.js / React Three Fiber | Custom visualization and 3D interaction closely tied to React | Excellent candidate for simulations and diagrams; a game needs additional input, collision, physics, and navigation facilities. |
| Godot | Native distribution, editor-heavy world authoring, eventual standalone export | Serious alternative if downloadable games become the priority; browser export has more constraints than browser-native TypeScript. |
| Unity / Unreal | Native, ambitious authored 3D with a specialist team | Defer. Our near-term constraint is reliable generated lessons and shareable browser play, not access to a larger native engine. This is a product judgment, not a claim that these engines cannot do the job. |

Three.js describes itself as a 3D library rather than a complete game engine; its official game tutorial explicitly calls out systems the application must supply. [Three.js game tutorial](https://threejs.org/manual/en/game.html)

Godot can export without opening a window, using an editor binary with installed export templates and a defined preset, for example `godot --headless --path PROJECT --export-release Web BUILD/index.html`. Current stable web documentation requires WebAssembly and WebGL 2, says WebGPU is unsupported, and says Godot 4 C# projects cannot currently export to web. Single-threaded export avoids the cross-origin isolation requirement; threads introduce hosting constraints. Native Godot remains a valid later target. [Godot command line](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html), [Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

## What Astra should generate

Generate a typed, versioned game package instead of regenerating the whole engine for every lesson. The package describes sources, learning objectives, world entities, interactions, dialogue, assets, prerequisite relationships, puzzle rules, hints, scoring evidence, and an expected solution trace. Keep source references and educational claims in a separate linked layer so a beautiful asset cannot silently become the source of truth.

The trusted runtime supplies reusable verbs such as inspect, collect, combine, connect, rotate, compare, predict, run experiment, and explain. Generated puzzles compose these verbs into new situations. Variation comes from goals, spatial arrangement, causal relationships, evidence, characters, consequences, and art direction—not just reworded quiz cards.

Allow novel mechanics through a later extension route: Astra writes a bounded TypeScript module against a narrow gameplay API; an isolated build worker compiles and tests it; the artifact is accepted only after source, playability, and performance checks. Uploaded files never become executable instructions. Generator workers should have no production secrets and no unrestricted outbound network. Keep simulation rules deterministic when correctness matters; use the model for construction and explanation, not as the frame-by-frame physics engine or the sole grader of every action.

The first runtime should not need a model request to complete the game. Optional conversational tutoring can add grounded hints and explanations without becoming a required dependency for progression.

## Where headless Blender helps

Blender is the asset-production tool, while Babylon runs the playable game. A worker can invoke Blender without a UI, run Python, assemble parametric rooms/props, set camera and lighting, bake or render images, create animation assets, and export files. A command pattern is `blender --background scene.blend --python-exit-code 1 --python build_assets.py -- manifest.json`. Argument order matters. Verify the selected Blender release and its exporter in the first asset spike. [Blender command line documentation](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html)

Use Blender three ways:

1. Produce consistent architectural kits and props from scripts and controlled parameters.
2. Render polished fixed-camera backgrounds and prop sprites for the point-and-click mode.
3. Normalize and prepare 3D assets for browser delivery: scale, origin, materials, animation clips, and simplified collision meshes.

Standardize browser assets on glTF 2.0/GLB plus an Astraified manifest containing gameplay metadata. Blender's glTF export covers meshes and supported material/animation data; it does not preserve arbitrary Blender behavior. Supported animation categories include object transforms, pose bones, and shape keys; other animated properties and Blender physics do not automatically turn into live game behavior. Reconstruct those behaviors in the runtime. [Blender glTF manual](https://docs.blender.org/manual/en/4.0/addons/import_export/scene_gltf2.html)

## Asset strategy

Use an explicit art direction for each world: palette, material rules, camera language, character proportions, lighting, UI, and sound style. Favor a small memorable place with purposeful animation over a large generic map. A style sheet and approved reference assets should travel through every asset-generation request.

Combine curated reusable asset kits, procedural Blender output, and generated hero art. Kenney's asset pages provide CC0 game assets suitable for commercial use; Poly Haven offers CC0 models, textures, and HDRIs. Preserve per-asset provenance in the manifest anyway. Their website/API access terms are separate from asset copyright permissions, so bulk automated acquisition needs its own permitted route. [Kenney support](https://kenney.nl/support), [Poly Haven license and access terms](https://polyhaven.com/license)

Image-to-3D can be an optional provider, not the foundation of scene correctness. Meshy's documented REST API accepts images, supports remeshing controls, and can return GLB. Its own documentation notes failures with cluttered multi-object inputs and missing back details from one reference. Its web application documentation describes plan-dependent licensing; confirm the applicable API agreement before product integration. Treat generated meshes as drafts requiring silhouette, geometry, material, scale, animation, and browser checks. [Meshy Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d), [Meshy image guidance](https://docs.meshy.ai/en/webapp/image-to-3d)

Scientific diagrams, apparatus markings, formulas, and any shape whose dimensions teach the concept should be generated from verified data or procedural geometry. An invented but attractive model can misteach the very idea the game exists to explain.

## Validation and delivery

Run four distinct checks on every generated game:

1. **Learning/source checks:** every required objective has an observable action and assessment; factual claims link to source spans; puzzle success depends on the intended concept.
2. **Structural checks:** validate the package schema, asset references, prerequisites, state transitions, inventory dependencies, and whether a winning path exists. Explore alternate action orders for dead ends and soft locks.
3. **Playable browser checks:** actual pointer/keyboard routes through the rendered game; collision and interaction alignment; saves and reloads; hint recovery; missing assets and errors. Test tooling should expose state readouts, but a state-only bot must not count as proof the player can click and finish.
4. **Visual/performance checks:** screenshots from critical views, legibility, target sizes, frame time, loading time, memory, and reduced-effects modes on target devices.

Khronos's validator checks glTF structure and resource correctness and emits JSON reports and asset statistics; it cannot establish gameplay correctness. glTF Transform supplies a CLI for asset inspection and optimization. Playwright supports screenshot comparisons, which can catch rendering regressions but still need interaction assertions. [glTF Validator](https://github.com/KhronosGroup/glTF-Validator), [glTF Transform CLI](https://gltf-transform.dev/cli), [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)

Provisional browser budgets, to measure in the prototype: target 60 fps on a normal laptop and acceptable 30 fps on the agreed low-end device; keep the first playable room around 5–10 MB and a short 3D mission around 30–50 MB compressed; lazy-load additional rooms; use mostly 1K/2K textures, baked lighting where appropriate, limited shadow-casting lights, instancing, LOD, and simple colliders. These are starting targets, not benchmark results or universal guarantees. Establish actual scene complexity limits by profiling.

## Suggested technical sequence

1. **Engine/asset spike:** one visually polished room in adventure mode and one in 3D; same inspect/collect/use verbs, same source-linked objective, same save system. Prove Blender-to-GLB and browser performance before scaling generation.
2. **One complete mission:** approximately 10–15 minutes, a few rooms, three linked concept-driven puzzles, deliberate misconceptions, useful hints, and a final transfer challenge.
3. **Generator proof:** generate structurally different missions from several unrelated sources using the same package schema, then run the validation pipeline. Record cost, latency, failed attempts, repair count, and final acceptance rate.
4. **Expansion gate:** add genres only when their essential verbs and pedagogical use cases are explicit. Add native export or unrestricted custom mechanics only when actual user demand justifies the extra runtime and quality work.

Prefer deliverable-based gates over promising a calendar before we know the chosen learner age, subject breadth, quality bar, devices, and generation-cost ceiling.
