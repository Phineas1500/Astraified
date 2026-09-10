import type {
  HarborPlan,
  HarborMechanics,
} from "../../server/harbor-generation";
import type { HarborStory } from "../../src/windpost/generated";
import type { SimulationConfig } from "../../src/domain/lesson-machines";
import { civicsMachine, civicsPlan, civicsSources } from "./general-episode";

export const harborText =
  "In a simple ohmic model, current equals voltage divided by resistance. With resistance fixed, increasing voltage increases current. To maintain the same current when resistance increases, increase the voltage proportionally. The model assumes constant resistance.";
export const harborSources = [
  { id: "source-1", title: "Test source: an ohmic model", text: harborText },
];
export function harborPlan(): HarborPlan {
  return {
    supported: true,
    reason: "",
    notes: [],
    objectives: [
      {
        id: "current-resistance",
        title: "Compare voltage and current",
        approach: "simulation",
        claim: "Current equals voltage divided by resistance.",
        boundaries:
          "A toy ohmic model with constant resistance and ideal components.",
        misconception:
          "The same voltage does not produce the same current through every resistance.",
        learnerAction:
          "Move a voltage token, read the current, and meet the same target through a changed resistance.",
        evidence: [
          {
            sourceId: "source-1",
            quote:
              "In a simple ohmic model, current equals voltage divided by resistance.",
          },
        ],
      },
    ],
  };
}
export function harborMechanics(): HarborMechanics {
  const config: SimulationConfig = {
    kind: "simulation",
    briefing: "Reach a current of 2 A, then compare a changed resistance.",
    modelNotes:
      "Ideal constant resistance; a numerical experiment, not an electrical wiring simulation.",
    controls: [
      {
        id: "voltage",
        label: "Voltage",
        kind: "choice",
        options: [
          { label: "0 V", value: 0 },
          { label: "4 V", value: 4 },
          { label: "6 V", value: 6 },
        ],
      },
    ],
    outputs: [
      {
        id: "current",
        label: "Current",
        unit: "A",
        derivativeWrt: null,
        expression: [
          { op: "ref", id: "voltage" },
          { op: "ref", id: "resistance" },
          { op: "div" },
        ],
      },
    ],
    plots: [],
    tasks: [false, true].map((transfer) => ({
      id: transfer ? "changed-resistance" : "first-resistance",
      title: transfer ? "A greater resistance" : "The first resistor",
      prompt: `Set the voltage to produce 2 A through ${transfer ? 3 : 2} ohms.`,
      constants: [{ id: "resistance", value: transfer ? 3 : 2 }],
      initialInputs: [{ id: "voltage", value: 0 }],
      referenceInputs: [{ id: "voltage", value: transfer ? 6 : 4 }],
      goal: [
        { op: "ref", id: "current" },
        { op: "literal", value: 2 },
        { op: "eq" },
      ],
      successFeedback:
        "The current is 2 A. Voltage divided by resistance matches the target.",
      failureFeedback: "Read the current and compare it with the 2 A target.",
      transfer,
    })),
  };
  return { config };
}
export function harborStory(): HarborStory {
  return {
    title: "The Current Delivery",
    subtitle: "A source fixture for the harbor pipeline",
    description: "Help the harbor compare two test arrangements.",
    briefing:
      "Moss and Bea have two tests to finish before the mail can leave.",
    ending: "The parcel arrived with the test notes.",
    stations: [0, 1].map((index) => ({
      title: index ? "Bea's comparison" : "Moss's test",
      itemLabel: "A sample token",
      intro: "Compare the model readings with the stated target.",
      retry: "Try another arrangement and observe the change.",
      success: "That completes the test.",
      hints: [
        "Read the stated target.",
        "Compare the available choices.",
        "Apply the relationship from the source.",
      ] as [string, string, string],
      discovery: {
        title: index ? "A changed case" : "The workshop note",
        text: "Compare the source relationship with the visible model readings.",
      },
    })) as HarborStory["stations"],
    flavor: {
      mossWelcome: "Would you help with our test notes?",
      mossReturn: "You brought the parcel!",
      mossEnding: "The mail made it home.",
      beaWelcome: "I have a changed case for you.",
      beaReturn: "Moss is waiting for the parcel.",
      beaEnding: "Thank you, courier.",
      postcardText: "Dear Bea, the kettle is on. — Moss",
      favorThanks: "A note from Moss! Thank you.",
    },
  };
}
export const harborEvidenceSources = civicsSources;
export const harborEvidencePlan = (): HarborPlan => ({
  ...civicsPlan(),
  objectives: [civicsPlan().objectives[0]],
});
export const harborEvidenceMechanics = (): HarborMechanics => ({
  config: civicsMachine(),
});
