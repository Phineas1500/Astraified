# Authored 3D episodes and shared learning

This document records the authored-episode milestone before the shared creator was integrated. [The unified creator guide](UNIFIED_GAMES.md) describes the current generation pipeline, shared library and additional experiment/evidence-crate capabilities.

The third-person harbor now provides two authored episodes through one player, camera, proximity-interaction system, inventory, route, journal and save framework. **Windpost** teaches opposing torques; **Minute Mail** teaches average and instantaneous velocity through moving carts and carried timing beacons.

## Stable foundation

The isolated `codex/3d-first-light` worktree was fast-forwarded to the finished point-and-click foundation, commit `2eab4b7658355c8fb1f147fa26c5545156b3b8b3`, on 10 September 2026. `src/domain/lesson-machines.ts` is now the same tracked shared interpreter, not a duplicate snapshot. No shared interpreter, episode contract, point-and-click renderer or generation pipeline was changed by the 3D implementation.

`EpisodeFixture` in `src/windpost/episodes.ts` reuses the existing `EpisodePackage` source, objective, puzzle and discovery content shapes. Its separate, local scene manifest binds lesson task IDs to supported 3D apparatus. This implements the approved proposal locally; it does not extend existing generated episode payloads.

## Authored fixtures and capabilities

The versioned `harbor-route-v1` scene kit has two ordered sites, `bridge` and `lift`. Each site refers to a puzzle and a task within that puzzle. The two sites are the first case and transfer case of one objective. Releasing the bridge proves that task, while whole-lesson evidence verification requires both cases.

The fixture supplies briefing, ending, NPC dialogue, hints, discoveries, optional postcards, sources, physical control bindings and readout labels. The runtime and UI do not branch on episode IDs or educational topics. The world selects its apparatus by the declared capability:

- `counterweight`: carry a 2 kg weight between 1 m, 2 m and 3 m sockets; shared torque outputs drive the explanatory beam tilt.
- `timing-gates`: carry a beacon between 1 s, 0.1 s and 0.01 s observation-window posts; turn a physical dial to predict signed instantaneous velocity; a sampled cart and position markers show the shared position calculation.

Validation rejects unsupported scene kits, missing source/objective/task references, mismatched apparatus, unbound controls and impossible control values. This is a finite authored kit, not an arbitrary generated 3D environment.

## Minute Mail mathematics

The outbound cart follows the authored position law `s(t) = t² − 2t` meters. At `t = 2 s`, its instantaneous velocity is `+2 m/s`. For backward windows `[t−h,t]`, the average velocities for `h = 1, 0.1, 0.01 s` are `1, 1.9, 1.99 m/s`.

The return cart follows `s(t) = 24 − 3t²` meters. At `t = 1 s`, its instantaneous velocity is `−6 m/s`. The same windows give averages `−3, −5.7, −5.97 m/s`. Negative velocity indicates decreasing position; speed remains nonnegative.

Calibration requires both the correct signed prediction and an average within `0.12 m/s` of instantaneous velocity. The first case accepts either shorter window; the changed case requires the shortest window. The tolerance is an authored instrument rule. A finite-window average is explicitly an approximation. Instantaneous velocity comes from automatic differentiation of the same shared position expression; it is not a separately hardcoded answer in the renderer.

Cart playback covers `0–2 s`. The three physical beacon posts select time windows: their spacing is not a measured distance along the cart's path. The position track uses its own calibrated meter scale. Repeating playback supports observation and does not change the trajectory when the beacon moves.

## Honest records and separate saves

The first allowed interaction captures the actual initial arrangement before any control changes. Operating a crank or testing calibration records an attempt and the hints requested by that point. A successful first attempt is valid. The journal compares actual starting observations with actual attempts; reference inputs are never turned into player history.

`runtime.ts` assembles the shared simulation evidence and verifies it through deterministic replay. `saves.ts` separates progress by episode ID and revision, validates stored data and recomputes results. Switching episodes keeps both deliveries. Resetting one episode leaves the other untouched.

Windpost's earlier version-1/version-2 save can migrate into this framework. Existing progress, carried objects, discoveries, favors and real attempts survive. Missing starting observations remain missing and are explained in the journal. The legacy model and learning adapters remain for migration and regression tests; both live episodes use the new runtime.

## Exploration and provenance

Both episodes include two physical discoveries, contextual NPC replies, three optional postcards and a postcard-delivery favor that raises a yellow pennant. These remain optional and cannot block the main delivery.

Sources support the physical and mathematical relationships. Island characters, correspondence, numerical examples, instrument tolerances and machinery are authored fiction. Source summaries are labelled editorial; neither episode claims that its model is measured data or that completion demonstrates mastery.

## Subsequent integration

The subsequent user-authorized integration connects source ingestion, generation jobs and a shared game library on the main site. Generation targets validated experiment and evidence-crate capabilities, explicitly binds each task, and rejects unsupported lessons. These two authored fixtures remain bundled reference games. The shared interface and current limits are documented in [UNIFIED_GAMES.md](UNIFIED_GAMES.md).

Runtime/fixture tests cover references, real evidence replay, first attempts, changed cases, forged saves, legacy migration and episode isolation. A finite graph check covers delivery reachability with optional exploration and reversible object operations. Physical reachability and readability require controller tests and a real browser playthrough in addition to that graph check.

Final validation on 10 September 2026: 306 tests across 22 files, TypeScript and the production build pass. The motion delivery was completed through real browser movement and interaction, including rejected/revised calibration, both bridge crossings and save restoration. Existing Windpost progress and honest legacy observations were verified in both browser origins. See [the prototype guide](WINDPOST.md) for detailed scope and build measurements.
