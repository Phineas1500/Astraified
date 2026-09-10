# Astraified

Astraified is a source-to-game education project: bring explanatory material, then explore its ideas through a point-and-click mystery with characters, inventory puzzles, and working instruments.

The **adventure studio** now generates a focused lesson from your source without a subject whitelist. It chooses two or three learning goals, designs numerical experiments or evidence-arrangement activities for those goals, and builds a mystery around them. The activities are generated as data for a bounded runtime, so supported scope depends on what those interaction forms can faithfully teach.

Two authored cases remain available without an API key:

- **The Last Light at Bramble Bay:** six illustrated rooms, two investigation branches, working circuit repairs, a stranded ferry, and an optional interactive keepsake.
- **The Case of the Mixed-Up Messages:** the original Transformer reference, with dedicated token-position, attention, and causal-masking instruments. It remains a reference and a compatible episode format; new generations are not restricted to its three concepts.

Creating an episode requires server-side OpenAI API access. Generated adventures currently share the Bramble Bay room artwork and character assets. There is no promise of complete subject coverage, automatic factual perfection, or proven learning outcomes. The broader direction is documented in [SOURCE_TO_ADVENTURE.md](SOURCE_TO_ADVENTURE.md) and [POINT_AND_CLICK_DIRECTION.md](POINT_AND_CLICK_DIRECTION.md).

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

Generation uses the model ID `gpt-6-astra`, shared from `server/generation.ts`, through the Responses API with structured outputs. The default pipeline uses medium reasoning for learning plans, activity design, and content review, and low reasoning for story generation. Stage settings are defined in `GENERAL_GENERATION_SETTINGS` in `server/general-generation.ts`. Your API project must have access and credits. A health result of `configured: true` means a key is present; it does not establish that the key is valid or the model is accessible. See the [official model reference](https://developers.openai.com/api/docs/models/gpt-6-astra) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

## Play an adventure

On the cover, choose **Begin the case** to play _The Last Light at Bramble Bay_, or **Create an adventure** to enter the studio. Open a completed generated case or the authored Transformer reference from **Cases worth opening**.

Click a character to talk or an object to investigate. Select an item in your bag, then click a room object to use it; select a second inventory item to combine them. **Inspect** reads the selected object. The map shows places to explore, the notebook records discoveries and sources, and **A little nudge** provides a hint based on the current case state. Hold **H**, or choose **Look around**, to reveal interactive objects. Keyboard users can Tab through objects and press Enter to interact. Escape closes a dialogue or instrument, or puts away a selected item. There is no timer.

Generated lessons use two kinds of activity:

| Activity             | What the player does                                                                                                             | What the runtime checks                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation           | Take a baseline reading, adjust numerical controls, choices, or toggles, and observe computed outputs and an optional curve plot | Source-specific equations and goal conditions execute locally. Every task starts unsolved and needs an intervention that changes an output. Selected outputs can use automatic differentiation. |
| Evidence arrangement | Inspect several source-linked artifacts and place them into ordered positions or meaningful categories                           | Complete assignments are checked against the generated accepted arrangements and slot capacities. A round can allow more than one defensible answer. Feedback explains the relationship.        |

Each activity contains two to four tasks or rounds, ending with a changed transfer case. The runtime replays the recorded readings or arrangements before accepting completion. It does not grade freeform explanations or ask a model to approve a player's answer during gameplay. A successful simulation proves agreement with the supplied model; a successful arrangement matches its configured answer set. Neither establishes that the model or answer key is educationally correct.

## Generate an adventure from your source

From the cover, choose **Create an adventure**, then supply one source, optionally describe a focus, select a learner level, and choose **Create my adventure**. The studio includes example links for derivatives, the US Constitution, and Transformers, plus Transformer starter notes. These are starting points, not a list of permitted subjects.

| Input       | Current support                                                  |
| ----------- | ---------------------------------------------------------------- |
| Pasted text | At least 120 characters; focused explanatory material works best |
| Public URL  | Readable HTML, plain text, Markdown, or PDF; no sign-in pages    |
| File        | UTF-8 `.txt` or `.md`, or a text-based `.pdf`; maximum 10 MB     |

PDFs are limited to 60 pages. Generation uses at most **24,000 extracted characters**, retaining excerpts and page references where available. Ingestion is text-only: scanned pages require OCR before upload, and embedded diagrams are not interpreted. HTML extraction preserves common MathML fractions, powers, roots and limit notation; it prefers original TeX annotations when present. A topic guides the focus, but **topic-only research is not implemented**. Multiple-source collections and additional document formats are future work.

The default `general-v1` pipeline has no fixed subject list. It selects **two focused learning goals by default, or three when needed**, grounded in quotations from the supplied text. A chapter on an unfamiliar subject can be considered without adding a hand-authored topic adapter. Material can still be rejected when it is insufficient, incoherent, contradictory, or cannot support two honest activities using the current primitives. A whole course needs several focused adventures.

Generation proceeds through these stages:

1. **Learning:** identify source-backed goals, assumptions, misconceptions, and meaningful learner actions.
2. **Mechanics:** generate the actual simulation equations, controls, examples, goal conditions, or evidence cards and accepted arrangements. These are source-specific configurations, not a fixed set of topic fixtures.
3. **Story:** write a compact narrative blueprint with a mystery, characters' dialogue, inventory objects, clues, activity hooks and ending. A deterministic compiler connects these through a shared quest structure with two early leads, inventory combination, a final action and an optional favor.
4. **Validation:** check the activity configurations and reference solutions, then compile the episode and verify its playable state graph.
5. **Content review:** make a separate model call to review source support, factual and mathematical claims, units, answer keys, metaphor limits, feedback, and transfer cases. Blocking findings prevent release unless the single repair allowance resolves them and the checks pass again.

This review is performed by the same configured model in a separate call; it is not independent human certification. Its summary is included with a completed generated episode. Exact quotations, deterministic checks, and model review address different failure modes, and none guarantees universal quality or learning effectiveness.

The output is an **episode package**: source references, two or three learning objectives, scenes, inventory items, discoveries, declarative rules, generated activity configurations, hints, a completion condition, and a reference playthrough. The player interprets this data through shared code. Generated expressions use a limited arithmetic/logic language rather than executable JavaScript.

Current bounds matter: simulations support up to six controls, eight outputs, and one plot; expressions support bounded arithmetic, comparisons, conditionals, common mathematical functions, and supported first derivatives. Evidence activities arrange three to ten cards into two to eight slots, with explicit accepted alternatives. These primitives can represent many quantitative and interpretive lessons, but not arbitrary laboratory equipment, every mathematical structure, or open-ended essay assessment. The model should explain illustrative assumptions and avoid presenting contested interpretations as uniquely correct answers.

Episodes reuse the six illustrated Bramble Bay room backgrounds, existing character/prop assets and bounded quest structures. Source-specific activities and narrative are generated; code supplies reliable interaction rules and spatial placement. Unique artwork, arbitrary executable mechanics, unrestricted world simulation, and new game genres are not generated by this pipeline yet.

## Checkpoints, cancellation, and saved cases

New adventure jobs use private local checkpoints under **`.astraified/jobs/`**. These contain extracted source excerpts, the focus and learner level, completed learning, mechanics, story, and content-review stages, validation results, generated packages, and reported usage. Raw uploaded files and API keys are not written into the checkpoint records. The jobs directory uses owner-only permissions and record files are written with owner read/write permissions. Checkpoints are local files, not an encrypted vault or a hosted account service.

After the server accepts a job, closing or refreshing the browser does not cancel it. The studio remembers the current job ID and reconnects to its progress. **Stop generation** aborts the active stage while preserving completed checkpoints. **Resume from saved work** continues from the latest completed stage after a cancellation, recoverable failure, or server restart. It restarts an unfinished model call; it does not resume token generation inside that call. The resumable learning, mechanics, story, and review stages each permit at most three attempts. There is **one total model repair allowance per job**, shared across invalid mechanics, story/playability failures, and blocking content-review findings. Using it to repair mechanics leaves no second repair for a later story or review failure. Unsupported source material and unresolved content or validation failures require a new job.

The browser separately stores generated episode packages, including source excerpts, in its adventure library. It retains up to **six episodes**, with a **3,000,000-character serialized JSON guard** (roughly 3 MB for ASCII text). Case progress and unfinished instrument experiments also live in `localStorage`, keyed to the episode edition. A save failure is reported in the UI; keep the page open if a newly generated case could not be saved. Clearing this site's browser data removes the library, progress, and remembered job ID; it does not remove `.astraified/jobs/`. There is no account sync or hosted sharing.

Generating a case **sends the extracted source text to OpenAI**. Requests use `store: false`; provider-side handling remains subject to the API account's applicable data policies. After a case is loaded, ordinary gameplay runs locally without model or grading requests. Opening a source link still uses the network; this is not an installable offline app or service-worker cache.

The adventure job service allows one active job at a time and disables automatic API retries. Defaults for the generalized pipeline are:

| Model call                               | Reasoning effort | Maximum output tokens | Timeout     |
| ---------------------------------------- | ---------------- | --------------------- | ----------- |
| Learning plan                            | Medium           | 7,000                 | 180 seconds |
| Mechanics generation or mechanics repair | Medium           | 18,000                | 420 seconds |
| Story blueprint                          | Low              | 12,000                | 420 seconds |
| Content review                           | Medium           | 6,000                 | 180 seconds |
| Combined mechanics/story repair          | Low              | 36,000                | 420 seconds |

The budgets are per call, not a total-job spending cap. A cancelled or timed-out request may already have incurred provider usage. The UI reports usage returned by provider responses, including incomplete responses when accounting is available; that counter is not a complete billing record for interrupted calls.

Existing checkpointed Transformer jobs retain their legacy pipeline and can still resume when eligible. Existing generated Transformer packages and their progress remain compatible with the player. The generalized default does not replace their stored instruments or silently reinterpret them as new activities.

## Authored Transformer reference

_The Case of the Mixed-Up Messages_ remains in the studio alongside generated cases. Its dedicated, authored instruments are useful demonstrations of the original adventure engine:

| Instrument                   | Player investigation                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Token tape and position rail | Compare the same rearranged token sequence with and without positional vectors, including repeated tokens.                            |
| Attention mixing bench       | Repair query/key scoring and weighted value delivery, then change only one value and observe that the matching weights stay fixed.    |
| Causal shutters              | Catch a future-information leak, preserve current and earlier inputs, and repeat on a longer dispatch at a later prediction position. |

The small vectors are illustrative, not real semantic coordinates or a trained language model. The instruments demonstrate selected computations, not the full Transformer architecture or training process. New source generation uses the general simulation/evidence pipeline instead of requiring these three instruments. In the separate Bramble Bay case, portable lamps and signal panels still respond to actual wire connectivity.

## Earlier experiments

The cover's **Earlier experiments** button preserves the original source studio, generated-mission library, and Babylon.js harbor. This is separate from the new adventure studio and uses the earlier three-station mission format.

Choose **Point & click** for a guided camera or **Explore in 3D** to orbit that harbor. Both modes use the same world, stations, progression, and experiments. The earlier 3D view uses drag-to-orbit and scroll-to-zoom controls; it is not a first-person walking game.

Visit the workshop, relay, and beacon in order. Circuit missions connect wires, test predictions, and investigate lamp-branch failures. Routing missions compare weighted path costs. Each includes a transfer question, with hints and assistance tracked separately from completion.

- **Circuits:** source material must support closed loops, series, and parallel circuits. The runtime models identical ideal resistive lamps and an ideal fixed-voltage source.
- **Routing:** source material must explain weighted graphs, path costs, and shortest paths. Puzzles use small connected undirected graphs with positive integer weights.

Earlier missions use the same source input formats and extraction limits, but generation is request-bound rather than checkpointed: material is held in server memory, and a timeout or client disconnect cancels the request. The older browser library keeps up to ten missions with a 2,000,000-character serialized JSON limit. Its 6,000-token generation budget and saved missions remain separate from the new episode pipeline.

## What is checked

Gameplay is deterministic. The simulation interpreter evaluates generated equations and their supported derivatives within numerical bounds; evidence activities check source-linked artifact assignments against their configured alternatives. Existing circuit, routing, and Transformer rules remain available. Generated packages cannot award a puzzle pass through narrative rules; the episode runtime independently replays submitted readings and arrangements.

New activity configurations are checked for expression/reference validity, finite results, valid controls, nontrivial initial tasks, passing reference interventions or arrangements, and changed transfer cases. Episode packages are then checked for valid identifiers and references, bounded scenes and geometry, source attribution, consistent dependencies, and a reference route that completes through the same runtime. State exploration checks whether reachable choices can strand the required investigation. These mechanical checks establish consistency and a playable route; they do not establish that generated equations or classifications faithfully teach the source. The separate model content review addresses that question and can still miss errors. The earlier mission format retains its own station-order, circuit, graph, and transfer-assessment validation.

Learning-plan evidence must reference known source records and contain matching quotations from their excerpts, allowing whitespace normalization. Source URLs come from ingestion, not model invention. Quotation checks establish that evidence exists in the source; they **do not prove** that every generated explanation is semantically supported or educationally sound. Human review and learner studies are still needed. Game completion is practice, not a validated measure of lasting mastery.

The API listens only on `127.0.0.1` and checks local request origins. Public source fetching validates and pins DNS addresses, rejects private/reserved networks, checks redirects, and limits response size and time. Missing keys, inaccessible models, exhausted quota, unreadable sources, and invalid generations return explicit errors. This is a **local development server**, not a production authentication or billing system. Public deployment still needs authentication, per-user quotas and job ownership, isolated document parsing, retention controls, and operational monitoring.

## Verify and build

```sh
npm test
npm run build
```

Tests cover the bounded simulation interpreter and differentiation, generated evidence arrangements, initial/transfer cases, forged-evidence rejection, general learning/mechanics/story compilation, content-review gates, repair limits, reusable episode validation and reachability, checkpoint cancellation/resume and legacy compatibility, source guards, PDF extraction, and local API boundaries. Authored adventure, circuit, wiring, routing, Transformer, save-restoration, and puzzle-draft tests remain in place. Tests use injected providers rather than paid model calls. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [GENERALIZATION_QA.md](GENERALIZATION_QA.md), and the earlier QA notes for recorded live verification and limitations.

`npm run build` typechecks the application and creates the frontend bundle in `dist/`. `npm run preview` serves that bundle on [http://127.0.0.1:4173](http://127.0.0.1:4173); use `npm run dev` for the complete local workflow with the API. A frontend bundle alone does not host generation. Localhost API tests require an environment that permits loopback listeners.

## Project map

- `src/AdventureApp.tsx`: Bramble Bay cover and authored case; entry points to both studios.
- `src/adventure/`: Bramble Bay episode, deterministic transitions, Phaser room layer, circuit apparatus, original characters/props, and interactive keepsake.
- `src/EpisodeStudio.tsx`: new source inputs, generation progress, resumable jobs, and generated episode library.
- `src/episodes/Player.tsx`, `types.ts`, `engine.ts`, `schema.ts`: reusable episode player, declarative package contract, state transitions, validation, and reachability checks.
- `src/episodes/Puzzle.tsx`, `puzzle-adapters.ts`: dispatch and validation for generated activities and existing Transformer instruments.
- `src/episodes/LessonMachine.tsx`, `lesson-machine.css`: generated simulation controls, plots, evidence arrangements, feedback, and saved experiment drafts.
- `src/domain/lesson-machines.ts`: bounded expression interpreter, automatic differentiation, configuration checks, and independent reading/arrangement verification.
- `src/episodes/TransformerPuzzle.tsx`: retained authored token rail, attention bench, causal shutters, and experiment drafts.
- `src/episodes/reference.ts`, `starter-source.ts`: authored Transformer case and starter material.
- `src/domain/transformers.ts`: bounded Transformer arithmetic, controlled experiments, fixture construction, and independent evidence verification.
- `server/model-client.ts`: matched SDK and HTTP deadlines with cancellation and per-call connection cleanup.
- `server/general-generation.ts`: default source-grounded learning plans, generated activity configurations, story compilation, separate content review, and model-call budgets.
- `server/story-blueprint.ts`: compact narrative schema and deterministic point-and-click quest compilation.
- `server/episode-jobs.ts`: generalized and legacy pipeline orchestration, private checkpoints, cancellation/resume, repair accounting, and job routes.
- `server/episode-generation.ts`: retained Transformer generation path and shared structured story/provider contracts.
- `server/sources.ts`, `math-text.ts`: shared source fetching, text/PDF extraction and mathematical HTML preservation.
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
