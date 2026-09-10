import type {
  SimulationConfig,
  EvidenceConfig,
} from "../../src/domain/lesson-machines";
import type {
  GeneratedHarborInput,
  HarborStory,
} from "../../src/windpost/generated";

/** Synthetic source documents for deterministic compiler/runtime/browser tests, never production fallbacks. */
const story: HarborStory = {
  title: "The Field Survey",
  subtitle: "Read, arrange, and reopen the route.",
  description: "A synthetic source-based test episode.",
  briefing:
    "Moss and Bea need the field records checked before the parcel can travel.",
  ending: "The records are checked and the parcel is home.",
  stations: [
    {
      title: "Workshop record station",
      itemLabel: "Survey token",
      intro: "Read the source before choosing a setting.",
      retry: "Compare the result with the source again.",
      success: "The first records are ready.",
      hints: [
        "Inspect the source and the current result.",
        "Compare each observation with the stated rule.",
        "Use the rule for this specific case.",
      ],
      discovery: {
        title: "Workshop field sheet",
        text: "The field sheet distinguishes what was recorded from an explanation of its cause.",
      },
    },
    {
      title: "Far-shore record station",
      itemLabel: "Survey token",
      intro: "Apply the rule to this changed case.",
      retry: "This case has changed; inspect its records.",
      success: "The second records are ready.",
      hints: [
        "Read the new case before repeating a choice.",
        "Apply the same rule to its changed facts.",
        "Check each setting or card against this case's source.",
      ],
      discovery: {
        title: "Far-shore field sheet",
        text: "A new field sheet supplies a changed case for the same rule.",
      },
    },
  ],
  flavor: {
    mossWelcome: "Courier, could you check these records before crossing?",
    mossReturn: "You brought the parcel home!",
    mossEnding: "The survey and delivery are complete.",
    beaWelcome: "Welcome. I have the next set of records.",
    beaReturn: "Moss is waiting across the canal.",
    beaEnding: "Both stations are checked. Thank you.",
    postcardText: "Bea, the kettle is on. —Moss",
    favorThanks: "Moss's note! Thank you; keep the card for your collection.",
  },
};

const simulation: SimulationConfig = {
  kind: "simulation",
  briefing:
    "Use the supplied exhibition model to select the number of lanterns.",
  modelNotes:
    "Synthetic source model: brightness score = lantern count × score per lantern. This is a game-planning score, not measured photometry.",
  controls: [
    {
      id: "lanterns",
      label: "Lantern count",
      kind: "choice",
      options: [
        { label: "One lantern", value: 1 },
        { label: "Two lanterns", value: 2 },
        { label: "Three lanterns", value: 3 },
      ],
    },
  ],
  outputs: [
    {
      id: "brightness",
      label: "Brightness score",
      unit: "points",
      expression: [
        { op: "ref", id: "lanterns" },
        { op: "ref", id: "gain" },
        { op: "mul" },
      ],
      derivativeWrt: null,
    },
  ],
  plots: [],
  tasks: [
    {
      id: "first-room",
      title: "First exhibition room",
      prompt:
        "Each lantern contributes 2 score points. Select a count that gives exactly 4 points.",
      constants: [
        { id: "gain", value: 2 },
        { id: "target", value: 4 },
      ],
      initialInputs: [{ id: "lanterns", value: 1 }],
      referenceInputs: [{ id: "lanterns", value: 2 }],
      goal: [
        { op: "ref", id: "brightness" },
        { op: "ref", id: "target" },
        { op: "eq" },
      ],
      successFeedback: "The score matches the first room's plan.",
      failureFeedback: "Recheck the score per lantern and the target.",
      transfer: false,
    },
    {
      id: "second-room",
      title: "Changed exhibition room",
      prompt:
        "Each lantern now contributes 3 score points. Select a count that gives exactly 9 points.",
      constants: [
        { id: "gain", value: 3 },
        { id: "target", value: 9 },
      ],
      initialInputs: [{ id: "lanterns", value: 1 }],
      referenceInputs: [{ id: "lanterns", value: 3 }],
      goal: [
        { op: "ref", id: "brightness" },
        { op: "ref", id: "target" },
        { op: "eq" },
      ],
      successFeedback: "The score matches the changed room's plan.",
      failureFeedback:
        "This room has a different score per lantern and target.",
      transfer: true,
    },
  ],
};
export const GENERATED_EXPERIMENT_INPUT: GeneratedHarborInput = {
  id: "test-exhibition",
  createdAt: "2026-09-10T12:00:00.000Z",
  level: "introductory",
  model: "synthetic-test-fixture",
  sources: [
    {
      id: "exhibition-plan",
      title: "Synthetic exhibition plan",
      text: "Brightness score equals lantern count multiplied by points per lantern. The first room uses 2 points per lantern and needs 4 points. The second room uses 3 points per lantern and needs 9 points.",
    },
  ],
  objective: {
    id: "apply-score-model",
    title: "Apply a supplied quantitative model to changed cases",
    claim: "A total score follows the source-defined multiplication rule.",
    boundaries: "This synthetic scoring model is not physical photometry.",
    misconception: "Repeating a count can miss a changed target.",
    evidence: [
      {
        sourceId: "exhibition-plan",
        quote:
          "Brightness score equals lantern count multiplied by points per lantern.",
      },
    ],
  },
  config: simulation,
  story: {
    ...story,
    title: "Exhibition Lights",
    stations: story.stations.map((entry, index) => ({
      ...entry,
      title: index === 0 ? "Workshop light plan" : "Far-shore light plan",
      discovery: {
        title: index === 0 ? "Workshop light plan" : "Far-shore light plan",
        text: "The exhibition plan defines a score per lantern and a target for each room.",
      },
    })) as HarborStory["stations"],
  },
};

const slots = [
  {
    id: "observed",
    label: "Recorded observation",
    description: "A directly recorded count or condition.",
    capacity: 2,
  },
  {
    id: "interpreted",
    label: "Interpretation",
    description: "A proposed explanation of a cause.",
    capacity: 1,
  },
];
const evidence: EvidenceConfig = {
  kind: "evidence",
  briefing: "Carry each source-linked record to the bin that matches its role.",
  modelNotes:
    "This synthetic field document distinguishes recorded observations from causal interpretations. Sorting concerns the statements' roles, not whether a proposed explanation is ultimately true.",
  rounds: [
    {
      id: "morning-records",
      title: "Morning records",
      prompt:
        "Sort the morning statements into observations and interpretations.",
      cards: [
        {
          id: "birds",
          label: "Eight birds",
          text: "Mira counted eight birds beside the water.",
          sourceIds: ["field-log"],
          explanation: "The count is recorded directly.",
        },
        {
          id: "wind",
          label: "A proposed cause",
          text: "The birds chose the bay because it was sheltered from wind.",
          sourceIds: ["field-log"],
          explanation: "This proposes why the birds were there.",
        },
        {
          id: "tide",
          label: "Falling tide",
          text: "The tide marker was lower at noon than at nine.",
          sourceIds: ["field-log"],
          explanation: "This records the marker's observed positions.",
        },
      ],
      slots,
      acceptedAssignments: [["observed", "interpreted", "observed"]],
      successFeedback: "The morning records are sorted by their roles.",
      failureFeedback:
        "Separate recorded conditions from explanations of why they happened.",
      transfer: false,
    },
    {
      id: "evening-records",
      title: "Evening records",
      prompt: "Apply the same distinction to these new evening statements.",
      cards: [
        {
          id: "storm",
          label: "Another proposed cause",
          text: "The storm must have carried the shells onto the sand.",
          sourceIds: ["field-log"],
          explanation: "This proposes a cause for the shells' location.",
        },
        {
          id: "shells",
          label: "Two shells",
          text: "Joon found two shells on the marked square.",
          sourceIds: ["field-log"],
          explanation: "This directly records the shells and their count.",
        },
        {
          id: "sand",
          label: "Wet sand",
          text: "The sand inside the marked square was wet.",
          sourceIds: ["field-log"],
          explanation: "This records a condition of the sand.",
        },
      ],
      slots,
      acceptedAssignments: [["interpreted", "observed", "observed"]],
      successFeedback: "The changed records are sorted correctly.",
      failureFeedback:
        "A proposed cause is still an interpretation even when it sounds plausible.",
      transfer: true,
    },
  ],
};
export const GENERATED_EVIDENCE_INPUT: GeneratedHarborInput = {
  id: "test-field-records",
  createdAt: "2026-09-10T12:00:00.000Z",
  level: "introductory",
  model: "synthetic-test-fixture",
  sources: [
    {
      id: "field-log",
      title: "Synthetic field-log teaching document",
      text: "An observation records a count or condition. An interpretation proposes an explanation of a cause. Mira counted eight birds beside the water. The birds chose the bay because it was sheltered from wind. The tide marker was lower at noon than at nine. The storm must have carried the shells onto the sand. Joon found two shells on the marked square. The sand inside the marked square was wet.",
    },
  ],
  objective: {
    id: "observation-and-interpretation",
    title: "Distinguish observations from interpretations",
    claim:
      "Counts and recorded conditions have a different role from proposed causal explanations.",
    boundaries:
      "The task classifies the role of a statement; it does not establish whether a causal explanation is true.",
    misconception:
      "A plausible explanation is not automatically a directly recorded observation.",
    evidence: [
      {
        sourceId: "field-log",
        quote:
          "An observation records a count or condition. An interpretation proposes an explanation of a cause.",
      },
    ],
  },
  config: evidence,
  story,
};
