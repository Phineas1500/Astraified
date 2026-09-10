# Astraified

Astraified is a source-to-game education project: bring explanatory material, then explore its ideas through a point-and-click mystery with characters, inventory puzzles, and working instruments.

The app now has two adventure paths:

- **The Last Light at Bramble Bay** is the original authored case. Explore six illustrated rooms, follow two investigation branches, repair real circuit topologies, and bring a stranded ferry home. An optional favor unlocks an interactive keepsake.
- **The adventure studio** introduces source-generated episodes about **Transformer sequence position, attention, and causal masking**. It also includes **The Case of the Mixed-Up Messages**, an authored reference showing the same episode engine and instruments used by the generator.

Both authored cases play without an API key. Creating an episode requires server-side OpenAI API access. The generator currently uses three reviewed Transformer instruments and the existing Bramble Bay artwork; it does not yet turn arbitrary subjects into arbitrary games. The broader direction is documented in [SOURCE_TO_ADVENTURE.md](SOURCE_TO_ADVENTURE.md) and [POINT_AND_CLICK_DIRECTION.md](POINT_AND_CLICK_DIRECTION.md).

## Run locally

Use Node.js **26+** with npm. This project was developed with Node 26.7.0; the lockfile pins dependencies that require a recent Node runtime.

```sh
npm ci
cp .env.example .env
```

Set your key in `.env` to enable generation:

```dotenv
OPENAI_API_KEY=your_api_key_here
PORT=8787
```

Then start the app:

```sh
npm run dev
```

- App: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- API health: [http://127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)

The Vite development server proxies `/api` to port 8787. If you change the API port, update `vite.config.ts` too. The key belongs only on the server; do not give it a `VITE_` prefix or add it to frontend code. `.env` and `.astraified/` are ignored by Git.

Generation uses the model ID `gpt-6-astra`, shared from `server/generation.ts`, through the Responses API with structured outputs. Adventure learning plans use medium reasoning effort; story generation, story repair, and the earlier experiment generator use low effort. Your API project must have access and credits. A health result of `configured: true` means a key is present; it does not establish that the key is valid or the model is accessible. See the [official model reference](https://developers.openai.com/api/docs/models/gpt-6-astra) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

## Play an adventure

On the cover, choose **Begin the case** to play _The Last Light at Bramble Bay_, or **Create an adventure** to enter the new studio. In the studio, open the authored Transformer reference or a completed generated case from **Cases worth opening**.

Click a character to talk or an object to investigate. Select an item in your bag, then click a room object to use it; select a second inventory item to combine them. **Inspect** reads the selected object. The map shows places to explore, the notebook records discoveries and sources, and **A little nudge** provides a hint based on the current case state. Hold **H**, or choose **Look around**, to reveal interactive objects. Keyboard users can Tab through objects and press Enter to interact. Escape closes a dialogue or instrument, or puts away a selected item. There is no timer.

In Bramble Bay, the portable lamp and signal panel respond to actual wire connectivity. The final console measures a different fault in the shared supply. In Transformer episodes, the instruments require controlled experiments:

| Instrument                   | What the player does                                                                                      | What the computation checks                                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token tape and position rail | Reorder token tiles, compare the same changed order with and without positions, then restore the dispatch | Token embeddings stay with token identity; adding a slot vector changes the input when a token moves. Repeated tokens share token embeddings.                         |
| Attention mixing bench       | Observe crossed leads, reconnect query/key scoring and value delivery, then change only one value         | Scaled dot products, stable softmax, and a weighted value mixture. A value-only change preserves matching weights while changing the delivered mixture.               |
| Causal shutters              | Catch a future-information leak, repair visibility, and repeat on a longer dispatch at a later position   | Future changes cannot affect the earlier output; permitted context must still affect it. Current and earlier inputs remain available in the shifted next-token setup. |

The vectors are small illustrative examples, not real semantic coordinates or a trained language model. These instruments cover selected Transformer computations, not the full architecture, training procedure, or every attention variant. Numerical details are available for inspection; puzzle success comes from replaying the experiments, rather than accepting a model-written “solved” flag.

## Generate a Transformer adventure

From the cover, choose **Create an adventure**, then supply one source, choose a focus and learner level, and select **Create my adventure**. The studio includes starter notes and a link to _Attention Is All You Need_.

| Input       | Current support                                                  |
| ----------- | ---------------------------------------------------------------- |
| Pasted text | At least 120 characters; focused explanatory material works best |
| Public URL  | Readable HTML, plain text, Markdown, or PDF; no sign-in pages    |
| File        | UTF-8 `.txt` or `.md`, or a text-based `.pdf`; maximum 10 MB     |

PDFs are limited to 60 pages. Generation uses at most **24,000 extracted characters**, retaining excerpts and page references where available. PDFs are read as text: scanned pages require OCR before upload, and embedded diagrams are not interpreted. A topic guides the focus, but **topic-only research is not implemented**. Multiple-source collections and additional document formats are future work.

The current generator expects material supporting all three reviewed families: sequence position, scaled dot-product attention, and causal masking. Unsupported or insufficient material returns an explanation rather than an unrelated case. A broad Transformer source may need a narrower excerpt so the relevant concepts fit within the extraction limit.

Generation proceeds through a source-grounded learning plan, a story draft, and package validation. The story can change the case title, characters' dialogue, objects, discoveries, room arrangement, dependencies, hints, and ending. The server supplies the reviewed numerical instruments and reference experiment evidence. Episodes reuse the six illustrated Bramble Bay room backgrounds and existing character/prop assets. New artwork, new mechanics, unrestricted subjects, and additional game genres are not generated by this pipeline yet.

The output is a validated **episode package**: source references, learning objectives, scenes, inventory items, discoveries, declarative rules, reviewed puzzles, hints, a completion condition, and a reference playthrough. The player interprets this data through a shared runtime. Generated content cannot introduce arbitrary executable game code.

## Checkpoints, cancellation, and saved cases

New adventure jobs use private local checkpoints under **`.astraified/jobs/`**. These contain extracted source excerpts, the focus and learner level, completed learning/story stages, validation results, generated packages, and reported usage. Raw uploaded files and API keys are not written into the checkpoint records. The jobs directory uses owner-only permissions and record files are written with owner read/write permissions. Checkpoints are local files, not an encrypted vault or a hosted account service.

After the server accepts a job, closing or refreshing the browser does not cancel it. The studio remembers the current job ID and reconnects to its progress. **Stop generation** aborts the active stage while preserving completed checkpoints. **Resume from saved work** continues from the latest completed stage after a cancellation, recoverable failure, or server restart. It restarts an unfinished model call; it does not resume token generation inside that call. Each learning/story stage permits at most three attempts, and package validation permits one model repair pass. Unsupported source material and exhausted repair attempts require a new job.

The browser separately stores generated episode packages, including source excerpts, in its adventure library. It retains up to **six episodes**, with a **3,000,000-character serialized JSON guard** (roughly 3 MB for ASCII text). Case progress and unfinished instrument experiments also live in `localStorage`, keyed to the episode edition. A save failure is reported in the UI; keep the page open if a newly generated case could not be saved. Clearing this site's browser data removes the library, progress, and remembered job ID; it does not remove `.astraified/jobs/`. There is no account sync or hosted sharing.

Generating a case **sends the extracted source text to OpenAI**. Requests use `store: false`; provider-side handling remains subject to the API account's applicable data policies. Ordinary gameplay makes no model calls.

The adventure job service allows one active job at a time and disables automatic API retries. Default per-call output budgets are **6,000 tokens for learning** and **24,000 for story or repair**. Default stage timeouts are **155 seconds for learning** and **420 seconds for story or repair**. A cancelled or timed-out request may already have incurred provider usage. The UI reports usage returned by provider responses, including incomplete responses when accounting is available; that counter is not a complete billing record for interrupted calls.

## Earlier experiments

The cover's **Earlier experiments** button preserves the original source studio, generated-mission library, and Babylon.js harbor. This is separate from the new adventure studio and uses the earlier three-station mission format.

Choose **Point & click** for a guided camera or **Explore in 3D** to orbit that harbor. Both modes use the same world, stations, progression, and experiments. The earlier 3D view uses drag-to-orbit and scroll-to-zoom controls; it is not a first-person walking game.

Visit the workshop, relay, and beacon in order. Circuit missions connect wires, test predictions, and investigate lamp-branch failures. Routing missions compare weighted path costs. Each includes a transfer question, with hints and assistance tracked separately from completion.

- **Circuits:** source material must support closed loops, series, and parallel circuits. The runtime models identical ideal resistive lamps and an ideal fixed-voltage source.
- **Routing:** source material must explain weighted graphs, path costs, and shortest paths. Puzzles use small connected undirected graphs with positive integer weights.

Earlier missions use the same source input formats and extraction limits, but generation is request-bound rather than checkpointed: material is held in server memory, and a timeout or client disconnect cancels the request. The older browser library keeps up to ten missions with a 2,000,000-character serialized JSON limit. Its 6,000-token generation budget and saved missions remain separate from the new episode pipeline.

## What is checked

Gameplay is deterministic. Circuit topology, routing costs, and Transformer arithmetic are computed by reviewed local code. Generated packages cannot award a puzzle pass through narrative rules; the episode runtime independently replays submitted numerical evidence.

New episode packages are checked for valid identifiers and references, bounded scenes and geometry, supported instruments, source attribution, consistent dependencies, and a reference route that completes through the same runtime. State exploration checks whether reachable choices can strand the required investigation. A proposed case that fails validation is repaired once or rejected. The earlier mission format has its own station-order, circuit, graph, and transfer-assessment validation.

Learning-plan evidence must reference known source records and contain matching quotations from their excerpts, allowing whitespace normalization. Source URLs come from ingestion, not model invention. Quotation checks establish that evidence exists in the source; they **do not prove** that every generated explanation is semantically supported or educationally sound. Human review and learner studies are still needed. Game completion is practice, not a validated measure of lasting mastery.

The API listens only on `127.0.0.1` and checks local request origins. Public source fetching validates and pins DNS addresses, rejects private/reserved networks, checks redirects, and limits response size and time. Missing keys, inaccessible models, exhausted quota, unreadable sources, and invalid generations return explicit errors. This is a **local development server**, not a production authentication or billing system. Public deployment still needs authentication, per-user quotas and job ownership, isolated document parsing, retention controls, and operational monitoring.

## Verify and build

```sh
npm test
npm run build
```

Tests cover authored adventure branch orders, inventory/evidence rules, save restoration, puzzle drafts, circuits, wiring, weighted routing, Transformer numerical invariants and forged-evidence rejection, reusable episode validation and reachability, generation job checkpoints/cancellation, source guards, PDF extraction, and local API boundaries. Tests use injected providers rather than paid model calls. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and the QA notes for recorded live verification and limitations.

`npm run build` typechecks the application and creates the frontend bundle in `dist/`. `npm run preview` serves that bundle on [http://127.0.0.1:4173](http://127.0.0.1:4173); use `npm run dev` for the complete local workflow with the API. A frontend bundle alone does not host generation. Localhost API tests require an environment that permits loopback listeners.

## Project map

- `src/AdventureApp.tsx`: Bramble Bay cover and authored case; entry points to both studios.
- `src/adventure/`: Bramble Bay episode, deterministic transitions, Phaser room layer, circuit apparatus, original characters/props, and interactive keepsake.
- `src/EpisodeStudio.tsx`: new source inputs, generation progress, resumable jobs, and generated episode library.
- `src/episodes/Player.tsx`, `types.ts`, `engine.ts`, `schema.ts`: reusable episode player, declarative package contract, state transitions, validation, and reachability checks.
- `src/episodes/TransformerPuzzle.tsx`: token rail, attention bench, causal shutters, and experiment drafts.
- `src/episodes/reference.ts`, `starter-source.ts`: authored Transformer case and starter material.
- `src/domain/transformers.ts`: bounded Transformer arithmetic, controlled experiments, fixture construction, and independent evidence verification.
- `server/episode-generation.ts`, `episode-jobs.ts`: source-grounded planning/story generation, compilation, checkpoint storage, cancellation/resume, and job routes.
- `server/sources.ts`: shared source fetching and text/PDF extraction.
- `src/App.tsx`, `src/components/`, `src/game/`: earlier source creator, three-station experiments, Babylon.js harbor, and camera controls.
- `src/domain/`, `server/generation.ts`: earlier mission packages, circuit/routing rules, browser library, constrained mission generation, and validation.
- `public/adventure/`: six original illustrated backgrounds shared by the current adventures. Prompts and provenance are in `ART_DIRECTION.md`.
- `public/models/`, `scripts/blender/build_harbor_props.py`: original Blender-exported harbor assets and reproducible generation script.
- `.astraified/jobs/`: ignored private local checkpoints; not repository content.
- `ASSETS.md`: asset provenance.
- `IMPLEMENTATION_STATUS.md`, `ADVENTURE_QA.md`, `EPISODE_QA.md`: verified behavior, recorded playthroughs, and remaining work.
- `SOURCE_TO_ADVENTURE.md`, `ASTRAIFIED_PLAN.md`: development direction; later phases are not implementation claims.

Blender is optional for running the app because exported assets are included. To rebuild the earlier harbor assets with Blender 4.5 or later:

```sh
blender --background --factory-startup --python scripts/blender/build_harbor_props.py
```
