import { z } from "zod";
import type { SourceRecord } from "../src/domain/types.js";
import { lessonMachineConfigSchema } from "../src/domain/lesson-machines.js";
import {
  compileGeneratedHarbor,
  harborStorySchema,
  validateGeneratedHarborConfig,
  type HarborStory,
} from "../src/windpost/generated.js";
import { SourceError } from "./errors.js";
import type {
  EpisodeProviderInput,
  GenerationResult,
} from "./episode-generation.js";
import {
  generalLearningPlanSchema,
  generalReviewSchema,
  validateQuotes,
  request,
  REFERENCES,
  MACHINE_INSTRUCTIONS,
  REVIEW_INSTRUCTIONS,
  storyMachineBriefs,
  type GeneralContentReview,
} from "./general-generation.js";
import { MODEL } from "./generation.js";
import {
  generationSentence,
  simpleHarborMachineSchema,
} from "./generation-simplicity.js";

export const harborPlanSchema = generalLearningPlanSchema
  .extend({
    objectives: generalLearningPlanSchema.shape.objectives.max(1),
  })
  .strict();
export type HarborPlan = z.infer<typeof harborPlanSchema>;
export const harborMechanicsSchema = z
  .object({ config: lessonMachineConfigSchema })
  .strict();
export type HarborMechanics = z.infer<typeof harborMechanicsSchema>;
const harborRepairSchema = z
  .object({ mechanics: harborMechanicsSchema, story: harborStorySchema })
  .strict();

export function validateHarborPlan(
  raw: unknown,
  sources: SourceRecord[],
): HarborPlan {
  const parsed = harborPlanSchema.safeParse(raw);
  if (!parsed.success)
    throw new SourceError(
      502,
      "The 3D learning plan did not match its required format.",
      "invalid_learning_plan",
    );
  const plan = parsed.data;
  if (!plan.supported)
    throw new SourceError(
      422,
      plan.reason ||
        "This material needs more explanation to support a physical learning activity.",
      "unsupported_episode_source",
    );
  if (plan.objectives.length !== 1)
    throw new SourceError(
      502,
      "A 3D lesson needs exactly one focused source-grounded objective.",
      "invalid_learning_plan",
    );
  validateQuotes(plan.objectives[0].evidence, sources);
  return plan;
}

export function validateHarborMechanics(
  raw: unknown,
  plan: HarborPlan,
  sources: SourceRecord[],
): HarborMechanics {
  try {
    const parsed = harborMechanicsSchema.parse(raw);
    const config = validateGeneratedHarborConfig(parsed.config, sources);
    if (config.kind !== plan.objectives[0].approach)
      throw new RangeError(
        "The apparatus must implement the planned learning interaction",
      );
    return { config };
  } catch (error) {
    throw new SourceError(
      502,
      `The generated 3D activity is invalid: ${error instanceof Error ? error.message : "unsupported apparatus"}`.slice(
        0,
        1600,
      ),
      "invalid_mechanics",
    );
  }
}

export function compileHarborStory(input: {
  raw: HarborStory;
  plan: HarborPlan;
  mechanics: HarborMechanics;
  sources: SourceRecord[];
  level: string;
  id: string;
  createdAt: string;
}) {
  try {
    const plan = validateHarborPlan(input.plan, input.sources);
    const mechanics = validateHarborMechanics(
      input.mechanics,
      plan,
      input.sources,
    );
    return compileGeneratedHarbor({
      ...input,
      objective: plan.objectives[0],
      config: mechanics.config,
      story: input.raw,
      model: MODEL,
    });
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError(
      502,
      `The 3D lesson could not be compiled: ${error instanceof Error ? error.message : "invalid fixture"}`.slice(
        0,
        1600,
      ),
      "invalid_episode",
    );
  }
}

const KIT = `SUPPORTED 3D KIT: A third-person bird courier explores one small harbor. Two physical stations open a bridge then raise a parcel platform. The player meets Moss at the first station, Bea across the bridge at the second, collects a parcel and returns it to Moss. The lesson has EXACTLY ONE source-grounded objective and EXACTLY TWO cases: first transfer:false, second transfer:true. Both cases use the same simulation or both use evidence sorting. You generate subject-specific data and story for this kit, not JavaScript, new geometry, freeform construction, combat or bespoke animations.
SIMULATION: First control MUST be choice with EXACTLY THREE labelled numeric options, physically selected by carrying a sample token into one of three docks. There is EXACTLY ONE control: the three-choice sample. No second dial, number/toggle/fixed/hidden controls. Hold other factors constant within each case. All task inputs contain exactly these controls. Use 1–2 plainly labelled visible outputs, no plots, derivativeWrt:null (there is no continuous control). Enumerated settings must all evaluate finitely. Activation checks the actual computed goal, not whether controls match a password. Clearly display the target in each case prompt. The initial setting must fail, a meaningful changed setting must pass, and the transfer case must need a different solution. A single token suffices; never ask to carry or combine multiple tokens.
EVIDENCE: EXACTLY TWO rounds of exactly 3 short source-linked cards and exactly 2 labelled destination crates, with usable capacities and every card assigned once. E picks up and reads a card; the player carries it to a crate, places it, retrieves misplaced cards, then stamps/checks the complete arrangement. Use classification and comparison with two categories, not ordering into separate positions. Each accepted answer contains one slot ID per card in array order. Teach a source-supported distinction; don't use hidden answer labels or merely matching identical words. Use changed cards/context in the transfer case. Both rounds use their own explicit slot labels and card explanations. Never substitute the authored torque or velocity fixture for a source's actual concept.`;
const PLAN = `Select EXACTLY ONE focused learning objective for a short third-person learning adventure. ${REFERENCES}
This stage only selects the objective, claim, misconception, boundary and supporting exact quotation. Do not design apparatus, equations, specific cards, answer keys or narrative here; later stages do that. Be concise.
There is no subject whitelist. First choose the most approachable source-supported idea within the focus, then choose its interaction; do not select an advanced concept just because its formula is easy to model. Choose simulation when a simple source-supported relationship can be explored using only a three-choice sample and one or two visible gauges. Choose evidence for a basic distinction or comparison using 3 short cards and 2 categories. Either approach will have an introductory case and a changed application case. Prefer evidence for qualitative distinctions; do not force arithmetic onto them.
Return supported:false and objectives:[] only when the material lacks enough explanatory content for either interaction. When supported, return exactly one source-grounded objective. Keep learnerAction conceptual and brief. Return the strict plan object only.`;
const MECHANICS = `${MACHINE_INSTRUCTIONS}\nThe following 3D constraints replace all point-and-click control/count guidance above. ${KIT}\nReturn {config} for the one supplied objective. All controls must be physically usable with this kit. Both cases should be short and source-specific. The task prompt is also the permanent quest text and the character's instruction: keep it action-first, ideally 25–45 words, with the rule and one visible goal. The first case includes a tiny worked example, followed by a different action for the player. The second changes just one feature while retaining the same explanation; never add a second concept or a calculation to do mentally.`;
const STORY = `Write a compact, warm, witty original story for this third-person learning adventure. ${REFERENCES}\n${KIT}
Use supplied source-specific machine briefs without rewriting their formulas, prompts or answer keys. The compiler supplies route logic and uses the machine prompts/feedback as authoritative instructions. You write title, subtitle, description, briefing, ending, two station stories and flavor lines. Each station has title,itemLabel,intro,retry,success,three progressively useful hints,and one discovery {title,text}. Flavor contains mossWelcome,mossReturn,mossEnding,beaWelcome,beaReturn,beaEnding,postcardText,favorThanks. A misplaced postcard delivered to Bea is optional and never gates the lesson. Piper is the visible bird courier, Moss and Bea are fixed characters. No other required characters, inventory tools, rooms or actions. The fixed bridge and parcel lift are rewards for applying a model, not evidence that unrelated source concepts physically control these machines. Keep dialogue short (one or two sentences), have characters react naturally, and make the delivery matter. The three hints should first name a visible next action, then explain the relevant rule in plain language, then give a concrete worked next step. Use brief familiar labels; explain an essential technical term before asking the player to use it. Keep each spoken line under 25 words and discoveries under 70 words. Put precise source concepts and limits in discoveries and lesson prompts; keep technical validation and software language out of dialogue. Do not claim a new visual scene, generated art, graded freeform answers or measured learning mastery.`;
const REVIEW = `${REVIEW_INSTRUCTIONS}\n${KIT}\nReview the complete 3D source lesson, including physical usability of every control/card, truthful harbor metaphor, first case and changed transfer case. Confirm the prompts name visible targets; clues and labels support reasoning without guessing hidden settings. It is a model content review, not human approval.`;

export interface HarborProvider {
  plan(input: EpisodeProviderInput): Promise<GenerationResult<HarborPlan>>;
  mechanics(
    input: EpisodeProviderInput & { plan: HarborPlan },
  ): Promise<GenerationResult<HarborMechanics>>;
  story(
    input: EpisodeProviderInput & {
      plan: HarborPlan;
      mechanics: HarborMechanics;
    },
  ): Promise<GenerationResult<HarborStory>>;
  review(
    input: EpisodeProviderInput & {
      plan: HarborPlan;
      mechanics: HarborMechanics;
      story: HarborStory;
    },
  ): Promise<GenerationResult<GeneralContentReview>>;
  repairMechanics(
    input: EpisodeProviderInput & {
      plan: HarborPlan;
      draft: unknown;
      issues: string;
    },
  ): Promise<GenerationResult<HarborMechanics>>;
  repairBundle(
    input: EpisodeProviderInput & {
      plan: HarborPlan;
      mechanics: HarborMechanics;
      story: HarborStory;
      issues: string;
    },
  ): Promise<GenerationResult<z.infer<typeof harborRepairSchema>>>;
}
const facts = (input: EpisodeProviderInput) => ({
  topic: input.topic,
  level: input.level,
  untrustedSourceRecords: input.sources,
});
// These narrower authoring limits do not change the persisted fixture contract.
const simpleMechanicsSchema = harborMechanicsSchema.extend({
  config: simpleHarborMachineSchema,
});
const copy = z.string().min(1);
const briefLine = generationSentence(240);
const simpleStationSchema = harborStorySchema.shape.stations.element.extend({
  title: copy.max(60),
  itemLabel: copy.max(60),
  intro: briefLine,
  retry: briefLine,
  success: briefLine,
  hints: z.array(briefLine).length(3),
  discovery: z
    .object({ title: copy.max(80), text: generationSentence(500) })
    .strict(),
});
const simpleStorySchema = harborStorySchema.extend({
  title: copy.max(80),
  subtitle: copy.max(120),
  description: generationSentence(400),
  briefing: generationSentence(400),
  ending: generationSentence(400),
  stations: z.array(simpleStationSchema).length(2),
  flavor: z
    .object({
      mossWelcome: briefLine,
      mossReturn: briefLine,
      mossEnding: briefLine,
      beaWelcome: briefLine,
      beaReturn: briefLine,
      beaEnding: briefLine,
      postcardText: briefLine,
      favorThanks: briefLine,
    })
    .strict(),
});
const simpleRepairSchema = harborRepairSchema.extend({
  mechanics: simpleMechanicsSchema,
  story: simpleStorySchema,
});
export const defaultHarborProvider: HarborProvider = {
  plan: (input) =>
    request(
      input,
      harborPlanSchema,
      "astraified_harbor_plan",
      PLAN,
      facts(input),
      "learning",
      10000,
      "low",
    ),
  mechanics: (input) =>
    request(
      input,
      simpleMechanicsSchema,
      "astraified_harbor_mechanics",
      MECHANICS,
      { ...facts(input), learningPlan: input.plan },
      "mechanics",
    ),
  story: (input) =>
    request(
      input,
      simpleStorySchema,
      "astraified_harbor_story",
      STORY,
      {
        ...facts(input),
        learningPlan: input.plan,
        machineBriefs: storyMachineBriefs({
          machines: [
            {
              objectiveId: input.plan.objectives[0].id,
              config: input.mechanics.config,
            },
          ],
        }),
      },
      "story",
    ),
  review: (input) =>
    request(
      input,
      generalReviewSchema,
      "astraified_harbor_review",
      REVIEW,
      {
        ...facts(input),
        learningPlan: input.plan,
        mechanics: input.mechanics,
        story: input.story,
      },
      "review",
    ),
  repairMechanics: (input) =>
    request(
      input,
      simpleMechanicsSchema,
      "astraified_harbor_mechanics_repair",
      `${MECHANICS}\nRepair these explicit validation findings. Return the complete corrected config. This is the single allowed repair pass.`,
      {
        ...facts(input),
        learningPlan: input.plan,
        draft: input.draft,
        issues: input.issues,
      },
      "mechanics",
    ),
  repairBundle: (input) =>
    request(
      input,
      simpleRepairSchema,
      "astraified_harbor_bundle_repair",
      `${MECHANICS}\n${STORY}\nRepair the complete mechanics and story together using the explicit findings. Preserve the objective and source evidence. Return {mechanics:{config},story}; all checks and content review run again. This is the single allowed repair pass.`,
      {
        ...facts(input),
        learningPlan: input.plan,
        mechanics: input.mechanics,
        story: input.story,
        issues: input.issues,
      },
      "story",
      24000,
    ),
};
