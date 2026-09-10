# Astraified harbor adventures

Two playable, authored third-person learning adventures for Astraified, built with Babylon.js, TypeScript, React and original Blender characters. Both are available from the main site's shared library, alongside generated games. Each keeps its own save. See [the unified creator guide](UNIFIED_GAMES.md) for source generation and current integration checks; this document covers the authored episodes and their standalone development entry.

**Windpost — torque and balance.** Walk around two seaside islands as Piper the courier. Meet Moss and Bea, carry and reposition counterweights, reopen a bridge, adapt the idea to a heavier parcel lift, and bring the mail home. Three optional postcards reward exploring beyond the delivery route. Read workshop sketches and cargo notes to inform conversations, and bring Moss’s postcard to Bea for a small island favor. Physical socket positions now feed the same deterministic learning-machine interpreter used by the point-and-click mode.

**Minute Mail — motion and rates of change.** Carry timing beacons, watch moving mail carts, and choose signed velocity predictions. Narrow an observation window to calibrate the outbound cart; adapt to the faster-changing return cart. Both episodes use the same harbor, controller, NPCs, delivery route, optional exploration and evidence framework.

## Standalone development entry

From this worktree:

```sh
npm install
npx vite --config vite.windpost.config.ts
```

Open http://127.0.0.1:5175/windpost.html. Deep links select `/windpost.html#windpost` or `/windpost.html#minute-mail`. On this machine the worktree can also resolve the main checkout's existing dependencies through its parent directory; no dependency symlink is required. Vite's cache is isolated under this worktree's ignored `artifacts/` directory.

```sh
npm test
npx tsc --noEmit
npx vite build --config vite.windpost.config.ts
npx vite preview --config vite.windpost.config.ts --host 127.0.0.1 --port 4175 --strictPort
```

The standalone build is in `dist/windpost`. Serve that directory as the site root and open `/windpost.html`. Its asset paths assume a site root, not a nested URL prefix. The build copies only Windpost's character assets and favicon. No API server, credentials or source-processing job is required.

## Play

- WASD / arrows: camera-relative movement. Shift: run. Space: jump.
- Drag: look around. Q / R: rotate the camera. F: recenter.
- E: talk to a nearby islander, lift/place an object, turn a prediction dial, test an apparatus, or collect a postcard. The contextual prompt is also clickable.
- V: toggle automatic walking. Manual direction, touch input, pause or focus loss stops it.
- X: return a carried object to its stand. B: field notes. Escape: pause.
- Touch controls appear on coarse-pointer devices and can be enabled in the pause menu. Reduced-motion mode removes camera smoothing and ambient scenery motion.

Dialogue pauses movement and uses a native modal with keyboard focus containment. Saves live only in this browser, keyed by episode ID and revision under `astraified:harbor-episodes:v1`. Reloading restores quest progress and the carried object, and starts Piper at Moss landing. Switching episodes keeps each delivery. Restarting in the pause menu clears only the current episode.

Windpost can migrate the earlier `astraified:windpost:authored-v1` save. Valid older deliveries retain their progress and actual attempts without inventing missing starting observations. Development and production origins keep separate browser saves.

## Earlier authored-episode validation

Verified on 10 September 2026 after the two-episode refactor:

- **306 tests pass across 22 files**, including the finished point-and-click foundation, both authored fixtures, legacy saves and Babylon controller tests. API transport tests use temporary loopback servers and make no paid model calls.
- TypeScript and the isolated production build pass. Main JavaScript chunk: **1,430.25 kB / 370.72 kB gzip**. Complete uncompressed output: **6,692,377 bytes**, including both fixtures and the existing original character GLBs.
- Exhaustive quest checks cover **576 Windpost** and **3,280 Minute Mail** state abstractions. Every state has a path to delivery, saves roundtrip, optional actions preserve completion, and every prediction choice is reachable. This verifies quest logic, not geometry or learner understanding.
- The Minute Mail browser playthrough completed both bridge crossings, NPC conversations, carried-beacon placement, prediction changes, parcel pickup and delivery. The outbound 0.1-second window with +2 m/s passed on the first attempt. The return 0.1-second window with −6 m/s failed; replacing it with 0.01 seconds passed. Field notes retained two real baselines and exactly three attempts, and shared evidence replay accepted the completed lesson.
- Switching away while carrying the parcel and returning restored the parcel and lesson history. Both old Windpost saves migrated: the development delivery retained its discoveries, optional favor and observed baselines; the earlier production delivery retained four attempts, two hints and an explicit missing-observation notice. Resetting the production Minute Mail smoke test left Windpost's delivery and three postcards intact.
- Motion-specific discovery text and sampled diagrams were checked in the world. Nearby measurements and the journal fit at **390×844** without horizontal overflow. Original Windpost's full delivery and optional favor had also been played through before this refactor; its migrated completed world was inspected again afterward.
- Both development and production previews reported no browser warnings or errors during the final checks. Observed desktop gameplay ran around **60 fps**. Narrow-screen checks do not establish performance on a physical phone.

At this verification milestone, the production preview was left at a fresh Minute Mail opening screen. Windpost's prior production progress was preserved, with the completed motion test delivery saved separately on the development origin.

## Current boundaries

These are compact reference episodes using a validated, fixed harbor scene kit. Terrain and buildings are authored Babylon geometry; the characters are original Blender GLBs with idle, walk, jump, carry and carry-walk animation. Movement uses Babylon's built-in ellipsoid collision system; dynamic rigid-body physics and Havok are not installed. Mechanism tilt is an explanatory animation, and balance releases a fictional safety catch. Details and OpenStax sources are available in the field notes.

Both reference fixtures remain authored. The main site now also generates 3D experiments and evidence-crate lessons from sources through the shared studio. Facial animation, voice acting, gamepad support, mobile-device performance qualification, character compression and lower-detail variants remain future work. Completion and hint records are not a claim of learning mastery.

The authored milestone was developed in isolated branch `codex/3d-first-light` on the shared foundation at `2eab4b7`. The subsequent user-authorized [unified integration](UNIFIED_GAMES.md) adds the main-site format selector, shared library and 3D generation pipeline while preserving point-and-click packages and saves. [Learning integration and episode bindings](WINDPOST_LEARNING.md) explain the authored fixture/runtime boundary. [Asset provenance and rebuild instructions](WINDPOST_ASSETS.md) describe the Blender source.
