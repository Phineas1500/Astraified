# Astraified: learning and game design evidence

Research checked 2026-09-10. These studies inform design; they do not establish that an automatically generated Astraified game will teach effectively. Mechanics and release criteria below are proposals to test.

## Eight sources and their implications

1. **Intrinsic integration: make understanding useful to play.** Habgood & Ainsworth (2011), *Motivating children to learn effectively*. Two studies used versions of the same mathematics adventure: 58 children in the fixed-time learning study and 16 in the free-choice study. The integrated version produced greater learning and more voluntary play. Its mathematical relationships were part of the combat system rather than questions between levels. The small samples and specific age/domain limit generalization. The authors explicitly discuss the danger that knowledge remains tied to the game context. [University-hosted author manuscript](https://tecfa.unige.ch/tecfa/teaching/BSEP/articles/Habgood_Ainsworth_2011.pdf).

2. **Spacing, examples, explanation, and concrete-to-abstract links.** The US Institute of Education Sciences practice guide (2007) rates delayed review, alternating worked examples with problems, and connecting concrete and abstract representations as moderate evidence; repeated quiz exposure and deep explanatory questions as strong evidence. Its evidence ratings are dated, and it is a synthesis rather than an experiment on games. A single long session cannot implement spacing across days. [Official IES guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/1).

3. **Retrieval can support conceptual learning.** Karpicke & Blunt (2011) found benefits from retrieval practice with science texts, including questions requiring comprehension and inference, compared with elaborative concept mapping under their study conditions. This supports asking learners to reconstruct or predict without simply copying visible answers; it does not imply that every quiz format outperforms every explanation or diagram. [Original paper abstract, PubMed](https://pubmed.ncbi.nlm.nih.gov/21252317/); [university-hosted paper](https://ctl.yale.edu/sites/default/files/files/KarpickeBlunt2011.pdf).

4. **Fade scaffolding while asking for underlying principles.** Atkinson, Renkl & Merrill (2003) studied worked examples in probability. Across two experiments, combining removal of worked steps with self-explanation prompts improved near and far transfer without extra learning time. Fading alone did not reliably improve far transfer. Their transfer tasks remain within the studied problem domain; this is not proof of broad general reasoning gains. [Author institution record and abstract](https://experts.azregents.edu/en/publications/transitioning-from-studying-examples-to-solving-problems-effects-/).

5. **Feedback should help the next attempt.** Shute (2008), *Focus on Formative Feedback*, reviews feedback evidence and recommends task-specific, manageable explanations of what happened and how to improve. Feedback timing has mixed effects depending on task and learner: “immediate is always best” is too strong. In Astraified, immediate world consequences can coexist with short explanations after an attempt and optional diagnostic hints. This is a research synthesis, not a guarantee for an AI tutor. [Author-hosted full paper](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf).

6. **In-game assessment needs external validation.** Shute, Ventura & Kim (2013), *Assessment and Learning of Qualitative Physics in Newton’s Playground*, studied 167 eighth- and ninth-grade students playing about four hours over 1.5 weeks. They reported pre/post physics gains and relations between gameplay indicators and learning. This is useful evidence for testing embedded measures against independent assessments; a pre/post association alone does not establish causal superiority over other teaching. [Author-hosted full paper](https://myweb.fsu.edu/vshute/pdf/JER.pdf).

7. **Immersion can impose learning costs.** Makransky, Terkildsen & Mayer (2019) compared desktop and headset versions of a science simulation with 52 university students. The VR condition yielded higher presence, lower learning, and higher measured cognitive load. This is one specific implementation, not evidence that 3D or VR is generally worse. [Original study](https://www.sciencedirect.com/science/article/pii/S0959475217303274).

8. **Immersion can also help when integrated into instruction.** Makransky & Mayer (2022) studied 102 middle-school students viewing a Greenland field trip by headset or 2D video within a six-lesson climate unit. The headset group showed higher enjoyment and immediate/delayed retention. The outcome applies to this combined learning experience and does not isolate benefits from a standalone generated game. Together with the previous study, it argues for testing the actual design rather than assuming better graphics produce better learning. [Open-access original study](https://link.springer.com/article/10.1007/s10648-022-09675-4).

## Proposed design contract

For every learning objective, create: source evidence; prerequisites; a misconception to detect; a player action requiring the concept; a visible consequence; a hint/explanation; an independent transfer task. Review this before creating assets.

The core game loop should be **observe → predict or plan → act → inspect the consequence → explain or revise → apply elsewhere**. Explanations can be short and placed at mission transitions; constant quiz interruptions would undermine the intended experience.

Examples:

| Game format | Concept and action | Evidence of learning |
| --- | --- | --- |
| Point-and-click mission | Restore a station’s power by tracing an open circuit, measuring it, and choosing a repair. Collect tools and evidence; NPC dialogue reveals constraints. | Player diagnoses a different circuit without the earlier hint, then explains why current cannot flow. |
| 3D exploration/puzzle | Use forces, levers, and counterweights to move equipment through a damaged observatory. | Predict before simulation; solve a new geometry; explain torque using a simple diagram outside the world. |
| Systems management | Maintain a terrarium by changing light, water, producers, or consumers and observing delayed effects. | Distinguish confounded from controlled experiments and transfer reasoning to a different ecosystem. |
| Historical investigation | Compare accounts, provenance, chronology, and corroborating evidence to reconstruct an event. | Defend a claim with evidence and identify uncertainty in a new set of sources. Avoid inventing a single correct interpretation where sources disagree. |

Not every subject needs every format. Let the learner choose, while explaining why particular mechanics fit the objective. Keep navigation or dexterity difficulty separately adjustable from conceptual difficulty. Build a satisfying game with curiosity, coherent rules, meaningful choices, and responsive feedback; measure its appeal rather than declaring it fun.

## Proposed evaluation and release gates

1. **Grounding:** human review of important claims, causal rules, diagrams, and assessment rubrics against source spans/pages. Flag uncertain or conflicting source claims. Generated fiction must not silently become factual instruction.
2. **Playability:** verify reachable goals, solvable puzzle dependencies, save/retry behavior, clear affordances, and absence of dead ends. Agent playthroughs can detect defects but cannot validate human learning or enjoyment.
3. **Usability/fun pilot:** target-age players think aloud; capture confusion, unnecessary travel, perceived agency, completion, and voluntary replay/continuation. Treat an initial 5–8-player round as usability discovery, not efficacy evidence.
4. **Learning pilot:** pretest; immediate posttest with new items; an unhinted transfer task in a different context; delayed retention after roughly 1–2 weeks. Those timings are practical proposed pilot settings, not universal scientific constants.
5. **Fair comparison:** use an active, time-matched alternative such as a clear explanation plus practice with feedback. Record time, prior knowledge, game familiarity, hints, and retries. Design the main outcome and analysis before testing; determine sample size from pilot variance and a meaningful effect rather than announcing a convenient number as adequate.
6. **Keep measures separate:** engagement, source fidelity, game completion, immediate task performance, and durable understanding are different outcomes. Do not label a skill mastered from one successful action, especially after hints or repeated guesses. Validate any mastery model against held-out tasks and learners before using it for consequential decisions.

The first audience’s age, prior knowledge, subject, and expected session length are essential choices because they determine reading demands, scaffolding, mechanics, and credible assessment.
