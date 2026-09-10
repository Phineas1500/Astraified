# Astraified

Astraified is a source-to-game education project. The current showcase is **The Last Light at Bramble Bay**, an original illustrated point-and-click adventure about a stranded ferry, a suspicious repair, and a very certain robot.

Explore six rooms, talk to four characters and a crab companion, collect and combine objects, follow two investigation branches, and use electrical ideas to bring the ferry home. An optional favor unlocks an interactive keepsake. The case plays without an API key; progress and unfinished apparatus save locally.

This is the first authored case for the new adventure format. **Source studio** preserves the earlier source uploader, generated-mission library, and circuit/routing experiments. Generating new point-and-click episodes from arbitrary source material is the next milestone; the existing generator does not yet produce Bramble Bay-style cases. The agreed direction is in `POINT_AND_CLICK_DIRECTION.md`.

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

The Vite development server proxies `/api` to port 8787. If you change the API port, update `vite.config.ts` too. The key belongs only on the server; do not give it a `VITE_` prefix or add it to frontend code. `.env` is ignored by Git.

Generation uses the fixed model ID `gpt-6-astra` in `server/generation.ts`, through the Responses API with structured outputs. The model ID, low reasoning effort, and structured-output integration were checked against the [official model reference](https://developers.openai.com/api/docs/models/gpt-6-astra) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). Your API project must have access and credits. A health result of `configured: true` means a key is present; it does not establish that the key is valid or the model is accessible.

## Play and create

Choose **Begin the case**. Click a character to talk or an object to investigate. Select an item in your bag, then click a room object to use it; select a second inventory item to combine them. **Inspect** reads the selected object. The map permits free travel, the notebook records discoveries and sources, and **A little nudge** provides a state-aware hint. Hold **H**, or choose **Look around**, to reveal interactive objects. Keyboard users can Tab through objects and press Enter to interact. Escape closes dialogue or puts away a selected item. There is no timer.

The portable lamp and signal panel respond to actual wire connectivity. The final console measures a different fault in the shared supply. Required learning is expressed through actions and observable results rather than multiple-choice gates. The optional keepsake has a bell, a miniature ferry, and a secret interaction with Button.

The rest of this section describes the **earlier experiments available in Source studio**:

Choose **Point & click** for a guided camera or **Explore in 3D** to orbit the harbor. Both modes use the same world, stations, progression, and experiments. The 3D mode currently uses drag-to-orbit and scroll-to-zoom controls; it is not a first-person walking game.

Visit the workshop, relay, and beacon in order. In the circuit workbench, click two terminals to connect a wire, make a prediction, and test. Open a lamp branch to investigate failures. In routing missions, choose adjacent nodes and compare total route costs. Complete each experiment and its transfer question to continue. Hints and assistance are tracked separately from completion.

To create a mission, supply one of:

| Input | Current support |
| --- | --- |
| Pasted text | At least 120 characters; focused explanatory material works best |
| Public URL | Readable HTML, plain text, Markdown, or PDF; no sign-in pages |
| File | UTF-8 `.txt` or `.md`, or a text-based `.pdf`; maximum 10 MB |

PDFs are limited to 60 pages. The generation context is capped at 24,000 extracted characters, with excerpts retained for source references. PDFs are read as text: scanned pages require OCR before upload, and embedded diagrams are not interpreted. A topic can guide the focus, but **topic-only research is not implemented**.

Supported learning material is deliberately bounded:

- **Circuits:** a source must support closed loops, series, and parallel circuits. The runtime models identical ideal resistive lamps and an ideal fixed-voltage source.
- **Routing:** a source must explain weighted graphs, path costs, and shortest paths. Generated puzzles use small connected undirected graphs with positive integer weights.

Unsupported or insufficient material returns an explanation instead of an unrelated game. New missions reuse the harbor scene and mechanics; generation changes the story, explanations, objectives, hints, and puzzle parameters. It does not yet generate arbitrary game code, unique worlds, new art, or new genres.

## What is checked

Gameplay is deterministic. Circuit topology and electrical results are computed locally, and routing solutions use weighted path costs. The server attaches transfer assessments from the same reviewed rules instead of asking the model to invent their answers.

Generated packages are checked for complete station order, supported mechanics, numeric bounds, valid graphs, known source IDs, and exact quotations from supplied excerpts. Source URLs are attached by the ingestion code, not invented by the model.

Exact quotation checks establish that evidence exists in the source. They do **not** prove that every generated explanation is semantically supported or educationally sound. The current package needs human review for those judgments, and learner studies are still needed to establish learning and retention. Game completion is not a validated measure of mastery.

## Data and generation limits

Files and extracted material are held in server memory during a request; the app server does not persist uploads or generated missions to a database. Generating a mission **sends the extracted source text to OpenAI**. Requests use `store: false`; provider-side handling remains subject to the API account's applicable data policies.

When you play a mission, its package—including source excerpts—and progress are saved in this browser's `localStorage`. The adventure selector keeps up to 10 recent generated missions, within a 2 MB library limit, alongside the original mission. There is no account sync or hosted sharing. Clearing this site's browser data removes those local saves. Ordinary gameplay makes no model calls.

The server allows one generation at a time, disables automatic API retries, caps output at 6,000 tokens, and cancels requests on timeout or client disconnect. A cancelled request may already have incurred provider usage. Missing keys, unavailable models, exhausted quota, unreadable sources, and invalid generations return specific errors.

The API listens only on `127.0.0.1` and rejects cross-origin generation requests. Public source fetching validates and pins DNS addresses, rejects private/reserved networks, checks redirects, and limits response size and time. This is a **local development server**, not a production authentication or billing system. Public deployment still needs authentication, per-user quotas, durable jobs, isolated document parsing, and operational monitoring.

## Verify and build

```sh
npm test
npm run build
```

The tests cover the adventure's alternate branch orders, inventory and evidence rules, recoverable exploratory actions, save and puzzle-draft validation, circuits, wiring, weighted routing, source guards, PDF extraction, generation validation, and local API boundaries. They do not make paid model calls. Localhost API tests require an environment that permits loopback listeners.

`npm run build` typechecks the application and creates the frontend bundle in `dist/`. `npm run preview` serves that bundle on [http://127.0.0.1:4173](http://127.0.0.1:4173); use `npm run dev` for the complete local workflow with the API. A frontend bundle alone does not host generation.

## Project map

- `src/AdventureApp.tsx`: current adventure shell, inventory, dialogue, map, notebook, and ending.
- `src/adventure/`: typed episode, deterministic transitions, Phaser room layer, apparatus, original character/prop graphics, local drafts, and the interactive keepsake.
- `src/App.tsx`, `src/components/`: earlier experiment flow and source creator.
- `src/game/`: Babylon.js harbor, camera controls, and interactive workbenches.
- `src/domain/`: shared package types, reference mission, deterministic rules, and save validation.
- `server/`: source extraction, constrained generation, validation, and API endpoints.
- `public/models/`: original Blender-exported harbor assets and their manifest.
- `public/adventure/`: six original illustrated room backgrounds. Exact image-generation prompts and provenance are in `ART_DIRECTION.md`.
- `ASSETS.md`: cover-art brief and playable-world asset provenance.
- `IMPLEMENTATION_STATUS.md`: current verified behavior and remaining work.
- `ADVENTURE_QA.md`: recorded playthrough and responsive validation of the new case.
- `scripts/blender/build_harbor_props.py`: reproducible headless asset generation.
- `ASTRAIFIED_PLAN.md`: the broader research and development plan; later phases are not claims about this implementation.

Blender is optional for running the app because the exported assets are included. To rebuild them with Blender 4.5 or later:

```sh
blender --background --factory-startup --python scripts/blender/build_harbor_props.py
```
