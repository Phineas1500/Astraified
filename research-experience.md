# Astraified: product precedents and experience design

Research date: 2026-09-10. This is a planning note, not an implementation or an evaluation of a working Astraified build. Product capabilities below were checked against official pages; marketing descriptions do not establish output quality or learning effectiveness.

Confirmed preferences: high-school/college learners, an impressive demo first, and Astra access through both Codex and API credits. Platform choice is delegated; the recommended delivery is a browser game. These decisions supersede earlier open questions about audience, demo priority, platform, and model access.

## What adjacent products demonstrate

| Precedent | Verified capability or design principle | Boundary and implication for Astraified |
| --- | --- | --- |
| [NotebookLM learning features](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/) | Google documents source-grounded flashcards and quizzes, adjustable difficulty, cited explanations, and a Learning Guide that asks open questions. | Source transformation and source citations are an established baseline. This page does not demonstrate generated educational games or prove transfer of learning. Astraified should make the source concept govern meaningful player actions. |
| [Rosebud 3D game maker](https://rosebud.ai/3d-game-maker) | Its official page describes prompt-generated WebGL games built with Three.js, editable JavaScript, assets, dialogue, and browser sharing. The FAQ recommends building iteratively and offers starting templates. | These are vendor capability claims, not our independent quality assessment. Its educational FAQ discusses explaining code and teaching-assistant characters; it does not establish automatic curriculum alignment, correct simulations, or measured learning. A text-to-game prompt alone is not a defensible distinction for Astraified. |
| [GDevelop AI agent](https://gdevelop.io/blog/make-games-with-ai-agent-gdevelop-automated-prompt) | The agent reads project context and can create or change objects, events, behaviors, and scene positions. | GDevelop explicitly says complex systems need multiple steps and refinement, and describes an assistant rather than instant whole-game creation. Astraified should plan for build/play/fix loops and visible generation progress. |
| [PhET research](https://phet.colorado.edu/en/research) | PhET studies simulation design and use, with four to six think-aloud learner interviews per simulation. Its research covers implicit scaffolding, productive exploration, and dynamic feedback. | Research supporting PhET does not automatically validate a newly generated game. Use understandable controls, interpretable consequences, and learner observation. The page also acknowledges that an engaging simulation alone does not guarantee students will voluntarily use it. |
| [The Evolution of Trust](https://ncase.me/trust/words.html) | Nicky Case's interactive guide lets the player act within and experiment with a simplified game-theory model. | Strong precedent for explaining a concept through its rules. Its compact model and guided sequence are the lesson; decorative missions would not reproduce that benefit. This is a design reference, not proof of efficacy for Astraified. |
| [Outer Wilds development notes](https://www.mobiusdigitalgames.com/news/archives/04-2016) | Mobius identifies curiosity-driven exploration as a design pillar and describes the difficulty of testing knowledge-dependent exploration across a world. | Borrow discoverable questions, evidence connections, and satisfying understanding-driven reveals. Do not treat the scale and polish of a handcrafted commercial game as a realistic per-upload generation promise. |
| [Zachtronics education guidance](https://www.zachtronics.com/zachademics/) | Zachtronics makes problem-solving games available to qualifying educational organizations and explicitly says students may need introduction and human scaffolding. | Real game depth can coexist with learning, but onboarding is part of the product. Use graduated puzzles, examples, hints, and explanations rather than assuming challenge creates understanding. |

## Product opportunity

The proposed distinction is a source-traceable learning game in which the concept changes what the player can predict, build, diagnose, or decide. The product needs both an entertaining mission and evidence that the learner can use the idea outside that mission. The sources above establish adjacent capabilities and useful design precedents; they do not establish that this market position is unique across every competitor.

Keep three things independently reviewable:

1. **What will be learned:** source passages, prerequisites, a small set of observable objectives, common misconceptions, and explicit model simplifications.
2. **Why this game teaches it:** an objective-to-mechanic map describing what the player must understand to progress.
3. **How learning will be checked:** a new situation with different surface details, plus a later retrieval opportunity if the user opts into one.

An arbitrary source should not be silently squeezed into any chosen genre. Recommend suitable genres, explain the fit in one sentence, and allow a preference override where a sound design exists. If the source is insufficient or contradictory, show that before generation. Purely factual reference material may need a classification, inference, or decision task before it supports a substantial game.

## Genre fit matrix

These are design recommendations, not empirically established rankings.

| Experience | Particularly good fits | Player verbs that can embody learning | Main design risk | Suggested order |
| --- | --- | --- | --- | --- |
| Point-and-click mystery | Diagnosis, evidence evaluation, causal explanations, historical inquiry, interconnected procedures | Inspect, compare, hypothesize, test, combine, explain | Arbitrary inventory puzzles; progressing by clicking every object | First polished format |
| Construction / systems puzzle | Circuits, algorithms, logic, resource flows, chemistry models | Build, simulate, debug, optimize | Correct-looking but scientifically wrong rules; difficulty spikes | First reusable mechanic family |
| 3D exploration / laboratory | Spatial relationships, forces, geometry, systems with visible physical consequences | Navigate, manipulate, measure, predict, inspect from another view | Navigation skill and visual spectacle overwhelming the concept | Second format sharing verified models |
| Management / strategy | Ecology, economics, queues, networks, tradeoffs and feedback loops | Allocate, plan, observe delay, compare policies | Oversimplified causal or value assumptions presented as facts | After simulation infrastructure |
| Dialogue / role-play | Language, negotiation, argumentation, source interpretation, interpersonal procedures | Ask, justify, listen, revise, choose evidence | Fluent NPC responses mistaken for knowledge or defensible evaluation | After bounded dialogue and rubric validation |
| Action / platforming | Timing, trajectories, coordination, selected spatial transformations | Aim, time, redirect, predict motion | Reflex skill masks conceptual understanding; quiz doors become the entire lesson | Selectively, when action is intrinsically relevant |

2D and 3D should share the source grounding, lesson graph, simulation rules, and assessment rubric where appropriate. They should differ in useful affordances, not only camera position. Genre selection is a preference and task-fit decision; it should not claim to diagnose a learner's fixed learning style.

## Original flagship mission: The Night the Lighthouse Went Dark

**Proposal:** a 15-minute point-and-click mission in a cozy, wind-battered harbor observatory. The user has confirmed high-school/college learners and an impressive demo first. This example introduces a high-school concept; later source sets can raise the depth. Input is a short source about ideal DC circuits. Its three objectives are to identify complete paths, predict the effect of adding an identical series lamp, and build independent parallel branches. It does not attempt an entire electricity chapter.

Candidate source: [OpenStax College Physics 2e, resistors in series and parallel](https://openstax.org/books/college-physics-2e/pages/21-1-resistors-in-series-and-parallel), verified by the coordinating research task. The final lesson should cite specific selected passages, not imply that a 15-minute mission covers the entire section.

**Story:** a harbor's festival beacon fails just before a returning research boat arrives. The player is the observatory's apprentice, assisted by a well-meaning repair robot that has connected everything into one long chain. Explore the dock, workshop, relay room, and beacon chamber. An original cast, environmental humor, a compact inventory, and visibly restored rooms provide the pleasure of a small adventure.

Club Penguin missions are the user's reference for accessible adventure structure. This note has not independently reconstructed those games. The proposed mission uses that general user preference for approachable exploration, characters, and item interactions, with original worldbuilding and puzzles whose causal rules are the curriculum.

**Scope:** four scenes, two short-speaking NPCs, three conceptual puzzles, one optional discovery, and one final assessment. Keep dialogue concise. Progress changes light, sound, and character reactions, so solutions feel consequential.

| Minutes | What the player does | What the behavior reveals |
| --- | --- | --- |
| 0–2 | Arrives during the blackout; makes one prediction about a small circuit and repairs a guided bench example. | Establishes baseline understanding and demonstrates controls. The first repair is an example, not evidence of independent mastery. |
| 2–5 | Inspects the workshop circuit, traces its connected path, and replaces a broken connection using a tester. | Recognizes that a complete conductive loop is required. The tester provides interpretable feedback rather than revealing a magic item combination. |
| 5–9 | At the relay room, predicts and tests what adding a second identical lamp to a series circuit does. A comparison setup makes the effect visible. | Connects circuit structure to an observable outcome instead of memorizing a label. The prediction is recorded before experimentation. |
| 9–12 | Rebuilds the beacon circuit so its two lamps operate on independent branches. Tests whether disconnecting one lamp leaves the other functioning. | Uses parallel structure to meet a meaningful design requirement. The environment's state follows the simulated circuit. |
| 12–15 | Solves a fresh circuit in a different visual arrangement, predicts a failure, and gives a short explanation using a diagram or sentence. Watches the beacon illuminate the harbor. | Checks near transfer with reduced story and hint cues. A polished reveal rewards understanding without substituting for the check. |

**Model constraints:** use a reviewed, deterministic ideal DC model, identical resistive lamps, and a constant-voltage ideal supply. Brightness represents electrical power in that model. Name these assumptions in the learning notebook. Do not extend the claim about branch independence to every real power system. Do not let dialogue generation determine voltage, brightness, or whether an answer is correct.

**Hints:** a nudge toward the relevant observation; a comparison to make; then a partially worked example. Track hints separately from unaided success. Wrong actions are reversible and reveal consequences. Avoid death, time pressure, or destructive resets for ordinary learning errors.

**Source experience:** the notebook links each concept to the relevant source page and distinguishes the fictional story from the explanatory model. Narrative descriptions can be colorful; factual claims still require source support.

**Transfer check:** present a new component layout and ask which lamp will remain on after an open branch, why, and how to change the circuit to meet a requirement. Include a changed connection order so memorizing the original positions is insufficient. Score prediction, causal explanation, and construction separately. A successful repair after repeated trial and error is useful progress but is not conclusive evidence of learning. A delayed check can use another context, without claiming the initial mission proved long-term retention.

## 3D version of the same lesson

Build a compact walkable observatory courtyard and beacon tower, with three interaction stations. The player physically traces cables, inspects connectors, manipulates circuit modules on a workbench, and sees branches light independently. A diagram overlay connects the spatial installation to a conventional schematic. The final reveal sweeps the lighthouse beam across the water as the arriving research boat signals back.

This version earns its 3D presentation through spatial inspection and a shared physical consequence. It keeps the identical reviewed circuit model and learning objectives, but adds a comparison between actual-looking placement and abstract diagrams. Do not turn the learner into an electron traveling down one path: that metaphor risks implying misleading sequential current behavior.

Offer click-to-move or station transitions, keyboard-accessible controls, captions, readable text, reduced camera motion, and a 2D schematic interaction view. Keep the default environment small enough that finding the next station is not the puzzle. No combat, jumping precision, open world, or elaborate character animation is required for this first 3D example.

## What would make the generated game feel impressive

Prioritize a coherent artistic direction and responsive interactions over size: consistent character proportions, deliberate composition, atmospheric lighting, layered ambience, subtle animation, readable hotspots, short character reactions, and one memorable change to the world. Point-and-click can use illustrated backgrounds or Blender-rendered sets with interactive layers. The same authored or generated set can later support a lightweight 3D edition.

A tiny adventure should feel finished. Its opening should establish curiosity quickly; its puzzles should each introduce or deepen an idea; its ending should pay off the mission. The system should play through generated branches, verify that the intended conceptual action causes success, and separately observe actual learners to find confusion that automated play misses.

## Questions worth resolving before implementation

- Within the confirmed high-school/college audience, what prior knowledge can the first mission assume?
- Is the first buyer or creator the learner, an educator, or a parent? This changes source review, editing, and reporting requirements.
- What real source and concept should serve as the first benchmark? A short bounded chapter is easier to evaluate than a full course.
- Given the confirmed demo-first goal, which parts of source-to-game generation must be visibly demonstrated in the first review? A polished mission and a visibly editable learning blueprint can make the product promise concrete before broad self-service generation.
- Should generation optimize for a playable draft in minutes or a more polished result after a longer production job? Keep preview quality separate from final quality.
- How much should creators edit before sharing: objectives, scientific assumptions, story, art, dialogue, puzzles, assessment, or all of them?
- What would persuade us that it worked: completion, voluntary replay, explanation quality, novel problem performance, delayed retention, or a comparison against ordinary study materials? Choose learning and enjoyment criteria independently.

The recommended browser demo should use keyboard and pointer interaction on laptops first. Test a modest laptop as well as the development machine before expanding 3D scope; phone optimization can follow the first review.

## Testing generality after the flagship

These original proposals are later benchmarks, not additional scope for the first demo. Each should begin from an actual supplied source and no more than three objectives.

| Source topic | Candidate game | Concept embedded in the rules | New-situation assessment |
| --- | --- | --- | --- |
| Conditional probability and base rates | A museum's artifact-authentication mystery | Inspect population counts and test reliability; allocate limited tests; compare competing explanations using numerical evidence | Apply the same reasoning to a new population with a different base rate and visual layout |
| Ecological feedback and carrying capacity | A compact island restoration strategy mission | Change one intervention, observe explicitly modeled delayed consequences, compare predicted and actual trajectories | Explain which conclusions depend on the simplified model and predict a new initial condition |
| Queues, throughput, and bottlenecks in computer science | A spaceport parcel-routing workshop | Build routes and service stations; test workloads; observe congestion rather than answering definition questions | Diagnose a differently arranged network with a changed arrival pattern |

The shared platform should preserve sources, objectives, action evidence, and assessment logic across these examples. It should not claim that one generic circuit simulator can express their semantics. Separate reviewed model families or validated scenario rules are necessary.
