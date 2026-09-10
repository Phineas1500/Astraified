import type {
  GeneralLearningPlan,
  GeneralMechanics,
  GeneralStory,
} from "../../server/general-generation";
import type {
  EvidenceConfig,
  SimulationConfig,
} from "../../src/domain/lesson-machines";

export const calculusText =
  "The derivative gives the instantaneous rate of change of a function at a point. For position as a function of time, its derivative is instantaneous velocity. Multiplying a differentiable function by a constant multiplies its derivative by that same constant.";
export const calculusSources = [
  { id: "source-1", title: "Calculus teaching excerpt", text: calculusText },
];
export const calculusPlan = (): GeneralLearningPlan => ({
  supported: true,
  reason: "",
  notes: [],
  objectives: ["instantaneous-rate", "scaled-motion"].map((id, i) => ({
    id,
    title: i ? "Scale a motion model" : "Explore instantaneous rate",
    claim: calculusText.split(". ")[i ? 2 : 0],
    boundaries: "A smooth quadratic toy motion model with chosen units.",
    learnerAction: "Change time and compare position with velocity.",
    misconception: "Position and velocity are not the same quantity.",
    approach: "simulation",
    evidence: [
      { sourceId: "source-1", quote: calculusText.split(". ")[i ? 2 : 0] },
    ],
  })),
});
export function calculusMachine(): SimulationConfig {
  return {
    kind: "simulation",
    briefing: "Find a time when the cart meets the target velocity.",
    modelNotes:
      "Illustrative motion s = a t²; no forces or friction are simulated.",
    controls: [
      {
        id: "time",
        label: "Time",
        kind: "number",
        min: 0,
        max: 10,
        step: 1,
        unit: "s",
      },
    ],
    outputs: [
      {
        id: "position",
        label: "Position",
        unit: "m",
        expression: [
          { op: "ref", id: "coefficient" },
          { op: "ref", id: "time" },
          { op: "literal", value: 2 },
          { op: "pow" },
          { op: "mul" },
        ],
        derivativeWrt: null,
      },
      {
        id: "velocity",
        label: "Velocity",
        unit: "m/s",
        expression: [{ op: "ref", id: "position" }],
        derivativeWrt: "time",
      },
    ],
    plots: [{ inputId: "time", outputId: "position", min: 0, max: 10 }],
    tasks: [1, 2].map((coefficient, i) => ({
      id: i ? "transfer" : "first",
      title: i ? "A changed motion" : "First motion",
      prompt: i
        ? "Find a time with velocity at least 16 m/s."
        : "Find a time with velocity at least 6 m/s.",
      constants: [
        { id: "coefficient", value: coefficient },
        { id: "target", value: i ? 16 : 6 },
      ],
      initialInputs: [{ id: "time", value: 0 }],
      referenceInputs: [{ id: "time", value: i ? 4 : 3 }],
      goal: [
        { op: "ref", id: "velocity" },
        { op: "ref", id: "target" },
        { op: "gte" },
      ],
      successFeedback:
        "Velocity is the slope of this position curve, not its height.",
      failureFeedback: "Watch the velocity readout as you change time.",
      transfer: Boolean(i),
    })),
  };
}
export const calculusMechanics = (): GeneralMechanics => ({
  machines: calculusPlan().objectives.map((objective) => ({
    objectiveId: objective.id,
    config: calculusMachine(),
  })),
});

export const civicsText =
  "The legislative branch makes laws, the executive branch carries out laws, and the judicial branch interprets laws. Separation of powers assigns these functions to different branches of government.";
export const civicsSources = [
  { id: "source-1", title: "Civics teaching excerpt", text: civicsText },
];
export const civicsPlan = (): GeneralLearningPlan => ({
  supported: true,
  reason: "",
  notes: [],
  objectives: ["branch-functions", "separated-powers"].map((id, i) => ({
    id,
    title: i ? "Distinguish separated functions" : "Identify branch functions",
    claim: civicsText.split(". ")[i],
    boundaries:
      "A focused introductory account, not every constitutional power or legal interpretation.",
    learnerAction: "Sort fictional civic actions by their branch function.",
    misconception: "All functions do not belong to the same branch.",
    approach: "evidence",
    evidence: [{ sourceId: "source-1", quote: civicsText.split(". ")[i] }],
  })),
});
export function civicsMachine(): EvidenceConfig {
  return {
    kind: "evidence",
    briefing:
      "Organize a fictional town's records by the functions they illustrate.",
    modelNotes:
      "Fictional examples of the supplied introductory branch functions; not jurisdiction-specific legal advice.",
    rounds: [false, true].map((transfer) => ({
      id: transfer ? "new-records" : "first-records",
      title: transfer ? "New records" : "The first records",
      prompt: "Place each record under the branch function it illustrates.",
      cards: ["l", "e", "j"].map((id, i) => ({
        id,
        label: `Record ${i + 1}`,
        text: `${transfer ? "A second fictional town" : "A fictional town"} ${["makes a law", "carries out a law", "interprets a law"][i]}.`,
        sourceIds: ["source-1"],
        explanation: [
          "Making laws is legislative.",
          "Carrying out laws is executive.",
          "Interpreting laws is judicial.",
        ][i],
      })),
      slots: ["legislative", "executive", "judicial"].map((id) => ({
        id,
        label: id,
        description: `Records illustrating the ${id} function.`,
        capacity: 1,
      })),
      acceptedAssignments: [["legislative", "executive", "judicial"]],
      successFeedback:
        "Different functions are assigned to different branches.",
      failureFeedback:
        "Compare each action with the function described in the source.",
      transfer,
    })),
  };
}
export const civicsMechanics = (): GeneralMechanics => ({
  machines: civicsPlan().objectives.map((objective) => ({
    objectiveId: objective.id,
    config: civicsMachine(),
  })),
});

export function generalStory(
  ids = ["instantaneous-rate", "scaled-motion"],
): GeneralStory {
  const condition = (
    kind: "flag" | "item" | "puzzle",
    id: string,
    expected = true,
  ) => ({ kind, id, expected });
  const spot = (
    id: string,
    x: number,
  ): GeneralStory["scenes"][number]["hotspots"][number] => ({
    id,
    label: id,
    x,
    y: 40,
    w: 15,
    h: 20,
    kind: "object",
    portrait: null,
    icon: "machine",
    visibleIf: [],
  });
  const rule = (
    id: string,
    target: string,
    effects: GeneralStory["rules"][number]["effects"] = [],
    when: GeneralStory["rules"][number]["when"] = [],
    verb: "interact" | "inspect" = "interact",
  ): GeneralStory["rules"][number] => ({
    id,
    trigger: { verb, target, item: null },
    when,
    effects,
    dialogue: {
      speaker: "Keeper",
      portrait: "tock",
      lines: ["The next observation is yours."],
    },
  });
  const step = (
    type: GeneralStory["referenceSolution"][number]["type"],
    value?: string,
  ): GeneralStory["referenceSolution"][number] => ({
    type,
    target: type === "interact" ? value! : null,
    item: null,
    scene: type === "move" ? value! : null,
    puzzle: type === "submitPuzzle" ? value! : null,
  });
  return {
    title: "The Unfinished Festival",
    subtitle: "A generated test adventure",
    description: "Repair the festival with careful reasoning.",
    briefing: "The keeper needs two investigations completed.",
    ending: "The festival can begin.",
    startScene: "arrival",
    scenes: [
      {
        id: "arrival",
        name: "Arrival",
        description: "A harbor entrance.",
        background: "jetty",
        exits: ["workshop", "final"],
        hotspots: [spot("keeper", 10), spot("key-spot", 45)],
      },
      {
        id: "workshop",
        name: "Workshop",
        description: "The first experiment.",
        background: "workshop",
        exits: ["arrival", "archive"],
        hotspots: [spot("first-machine", 10), spot("tape-spot", 45)],
      },
      {
        id: "archive",
        name: "Archive",
        description: "The second investigation.",
        background: "storeroom",
        exits: ["workshop", "final"],
        hotspots: [spot("second-machine", 10), spot("seal-spot", 45)],
      },
      {
        id: "final",
        name: "Festival",
        description: "The final action.",
        background: "lantern",
        exits: ["archive", "arrival"],
        hotspots: [spot("send", 10), spot("notice", 45)],
      },
    ],
    items: ["key", "tape", "seal"].map((id) => ({
      id,
      name: id,
      description: "A fictional festival object.",
      icon: "key",
    })),
    discoveries: [...ids, null].map((id, i) => ({
      id: `note-${i}`,
      title: "Investigation notes",
      text: "A record of the festival investigation.",
      objective: id,
    })),
    puzzles: ids.map((id) => ({
      id,
      title: `Investigate ${id}`,
      instructions: "Use the instrument to investigate and compare its cases.",
    })),
    rules: [
      rule("talk", "keeper"),
      ...["key", "tape", "seal"].map((id) =>
        rule(
          `take-${id}`,
          `${id}-spot`,
          [{ type: "grantItem", id, value: true }],
          [condition("item", id, false)],
        ),
      ),
      rule("first", "first-machine", [
        { type: "openPuzzle", id: ids[0], value: true },
      ]),
      rule("second", "second-machine", [
        { type: "openPuzzle", id: ids[1], value: true },
      ]),
      rule(
        "finish",
        "send",
        [{ type: "setFlag", id: "finished", value: true }],
        ids.map((id) => condition("puzzle", id)),
      ),
      rule("notice", "notice"),
      rule("inspect-key", "key", [], [], "inspect"),
      rule("inspect-tape", "tape", [], [], "inspect"),
    ],
    hints: [
      {
        when: [condition("puzzle", ids[0], false)],
        text: "Visit the workshop.",
      },
      {
        when: [condition("puzzle", ids[1], false)],
        text: "Visit the archive.",
      },
      { when: [], text: "Go to the festival." },
    ],
    completion: [condition("flag", "finished")],
    referenceSolution: [
      step("start"),
      step("move", "workshop"),
      step("interact", "first-machine"),
      step("submitPuzzle", ids[0]),
      step("move", "archive"),
      step("interact", "second-machine"),
      step("submitPuzzle", ids[1]),
      step("move", "final"),
      step("interact", "send"),
    ],
  };
}
