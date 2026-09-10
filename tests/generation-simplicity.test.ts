import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import {
  generationSentence,
  simpleHarborMachineSchema,
  simpleLessonMachineSchema,
} from "../server/generation-simplicity";
import {
  evidenceConfigSchema,
  simulationConfigSchema,
  type EvidenceConfig,
  type SimulationConfig,
} from "../src/domain/lesson-machines";
import { calculusMachine, civicsMachine } from "./fixtures/general-episode";

function simpleHarborMachine(): SimulationConfig {
  const machine = calculusMachine();
  machine.controls = [
    {
      id: "time",
      label: "Time",
      kind: "choice",
      options: [0, 3, 4].map((value) => ({ label: `${value} seconds`, value })),
    },
  ];
  machine.outputs[1].derivativeWrt = null;
  machine.outputs[1].expression = [
    { op: "literal", value: 2 },
    { op: "ref", id: "coefficient" },
    { op: "mul" },
    { op: "ref", id: "time" },
    { op: "mul" },
  ];
  machine.plots = [];
  return machine;
}

function simpleEvidenceMachine(): EvidenceConfig {
  const machine = civicsMachine();
  machine.rounds.forEach((round) => {
    round.prompt = "Which records describe making a law?";
    round.slots = [
      {
        id: "legislative",
        label: "Makes laws",
        description: "Records that create a law.",
        capacity: 1,
      },
      {
        id: "other",
        label: "Uses laws",
        description: "Records that carry out or interpret a law.",
        capacity: 2,
      },
    ];
    round.acceptedAssignments = [["legislative", "other", "other"]];
  });
  return machine;
}

describe("generation-only simplicity limits", () => {
  it("accepts a single numeric point-and-click control with two readings and a transfer task", () => {
    const machine = calculusMachine();
    expect(simpleLessonMachineSchema.parse(machine)).toEqual(machine);
    expect(simpleHarborMachineSchema.safeParse(machine).success).toBe(false);
  });

  it("accepts a three-setting harbor experiment and a three-card, two-slot classification", () => {
    const simulation = simpleHarborMachine();
    const evidence = simpleEvidenceMachine();
    for (const schema of [
      simpleLessonMachineSchema,
      simpleHarborMachineSchema,
    ]) {
      expect(schema.parse(simulation)).toEqual(simulation);
      expect(schema.parse(evidence)).toEqual(evidence);
    }
  });

  it("rejects multiple controls and excess output readings only at generation time", () => {
    const multiControl = calculusMachine();
    multiControl.controls.push({
      id: "switch",
      label: "Switch",
      kind: "toggle",
      offLabel: "Off",
      onLabel: "On",
    });
    multiControl.tasks.forEach((task) => {
      task.initialInputs.push({ id: "switch", value: 0 });
      task.referenceInputs.push({ id: "switch", value: 0 });
    });
    const extraOutput = calculusMachine();
    extraOutput.outputs.push({ ...extraOutput.outputs[0], id: "distance" });
    for (const machine of [multiControl, extraOutput]) {
      expect(simulationConfigSchema.safeParse(machine).success).toBe(true);
      expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(false);
    }
  });

  it("requires exactly two tasks or rounds", () => {
    const simulation = calculusMachine();
    simulation.tasks.push({ ...simulation.tasks[1], id: "third-task" });
    const evidence = simpleEvidenceMachine();
    evidence.rounds.push({ ...evidence.rounds[1], id: "third-round" });
    expect(simulationConfigSchema.safeParse(simulation).success).toBe(true);
    expect(evidenceConfigSchema.safeParse(evidence).success).toBe(true);
    expect(simpleLessonMachineSchema.safeParse(simulation).success).toBe(false);
    expect(simpleLessonMachineSchema.safeParse(evidence).success).toBe(false);
  });

  it("allows at most three choices generally and exactly three in the harbor", () => {
    const machine = simpleHarborMachine();
    const control = machine.controls[0];
    if (control.kind !== "choice") throw new Error("Expected a choice control");
    control.options.pop();
    expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(true);
    expect(simpleHarborMachineSchema.safeParse(machine).success).toBe(false);
    control.options.push(
      { label: "4 seconds", value: 4 },
      { label: "5 seconds", value: 5 },
    );
    expect(simulationConfigSchema.safeParse(machine).success).toBe(true);
    expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(false);
  });

  it("excludes plots and derivative readouts from the harbor only", () => {
    const plot = simpleHarborMachine();
    plot.plots = [{ inputId: "time", outputId: "position", min: 0, max: 4 }];
    const derivative = simpleHarborMachine();
    derivative.outputs[1].derivativeWrt = "time";
    for (const machine of [plot, derivative]) {
      expect(simulationConfigSchema.safeParse(machine).success).toBe(true);
      expect(simpleHarborMachineSchema.safeParse(machine).success).toBe(false);
    }
  });

  it("rejects larger card sets and extra categories while preserving existing runtime fixtures", () => {
    const oldEvidence = civicsMachine();
    const largeSet = simpleEvidenceMachine();
    largeSet.rounds[0].cards.push({
      ...largeSet.rounds[0].cards[0],
      id: "fourth",
    });
    largeSet.rounds[0].acceptedAssignments[0].push("legislative");
    for (const machine of [oldEvidence, largeSet]) {
      expect(evidenceConfigSchema.safeParse(machine).success).toBe(true);
      expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(false);
      expect(simpleHarborMachineSchema.safeParse(machine).success).toBe(false);
    }
  });

  it.each([
    ["briefing", 400],
    ["modelNotes", 1000],
  ] as const)(
    "bounds %s without discarding useful model limitations",
    (field, limit) => {
      for (const machine of [calculusMachine(), simpleEvidenceMachine()]) {
        machine[field] = `${"a".repeat(limit - 1)}.`;
        expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(true);
        machine[field] = `a${machine[field]}`;
        expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(
          false,
        );
      }
    },
  );

  it.each([
    ["title", 60],
    ["prompt", 360],
    ["successFeedback", 240],
    ["failureFeedback", 240],
  ] as const)("bounds task and round %s", (field, limit) => {
    const simulation = calculusMachine();
    const evidence = simpleEvidenceMachine();
    for (const [machine, step] of [
      [simulation, simulation.tasks[0]],
      [evidence, evidence.rounds[0]],
    ] as const) {
      step[field] =
        field === "title" ? "a".repeat(limit) : `${"a".repeat(limit - 1)}.`;
      expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(true);
      step[field] = `a${step[field]}`;
      expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(false);
    }
  });

  it.each([
    ["label", 60],
    ["text", 220],
    ["explanation", 260],
  ] as const)("bounds card %s", (field, limit) => {
    const machine = simpleEvidenceMachine();
    machine.rounds[0].cards[0][field] =
      field === "label" ? "a".repeat(limit) : `${"a".repeat(limit - 1)}.`;
    expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(true);
    machine.rounds[0].cards[0][field] = `a${machine.rounds[0].cards[0][field]}`;
    expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(false);
  });

  it("bounds slot descriptions, output/control labels, and preserves the stricter unit limit", () => {
    const evidence = simpleEvidenceMachine();
    evidence.rounds[0].slots[0].description = "a".repeat(181);
    expect(simpleLessonMachineSchema.safeParse(evidence).success).toBe(false);
    const simulation = calculusMachine();
    simulation.outputs[0].label = "a".repeat(61);
    expect(simpleLessonMachineSchema.safeParse(simulation).success).toBe(false);
    simulation.outputs[0].label = "Position";
    simulation.controls[0].label = "a".repeat(61);
    expect(simpleLessonMachineSchema.safeParse(simulation).success).toBe(false);
    simulation.controls[0].label = "Time";
    simulation.outputs[0].unit = "a".repeat(41);
    expect(simpleLessonMachineSchema.safeParse(simulation).success).toBe(false);
  });

  it("retains strict nested object fields", () => {
    const machine = simpleHarborMachine();
    expect(
      simpleHarborMachineSchema.safeParse({ ...machine, extra: true }).success,
    ).toBe(false);
    expect(
      simpleHarborMachineSchema.safeParse({
        ...machine,
        controls: [{ ...machine.controls[0], extra: true }],
      }).success,
    ).toBe(false);
  });

  it("rejects a boundary-sized clipped briefing without changing existing runtime acceptance", () => {
    const fragment = "carry it to a";
    const machine = simpleHarborMachine();
    machine.briefing = `${"a".repeat(400 - fragment.length - 1)} ${fragment}`;
    expect(machine.briefing).toHaveLength(400);
    expect(simulationConfigSchema.safeParse(machine).success).toBe(true);
    expect(simpleHarborMachineSchema.safeParse(machine).success).toBe(false);
  });

  it.each([
    "Carry it to the dock.",
    "Moss says, “Carry it to the dock.”",
    'Moss says, "Carry it to the dock."',
    "Carry it to the dock. (Choose the left one.)",
    "Carry it to the dock.\nThen observe the gauge.\n",
    "Did the gauge rise?\n",
    "Try again! ",
  ])(
    "accepts complete sentence endings without clipping or normalizing text: %s",
    (value) => {
      expect(generationSentence(240).parse(value)).toBe(value);
    },
  );

  it("requires complete endings throughout teaching prose while allowing ordinary labels", () => {
    const simulation = simpleHarborMachine();
    const evidence = simpleEvidenceMachine();
    const fragment = "Carry it to a";
    const cases = [
      { ...simulation, modelNotes: fragment },
      { ...evidence, briefing: fragment },
      { ...evidence, modelNotes: fragment },
      ...(["prompt", "successFeedback", "failureFeedback"] as const).map(
        (field) => ({
          ...simulation,
          tasks: simulation.tasks.map((task) => ({
            ...task,
            [field]: fragment,
          })),
        }),
      ),
      ...(["prompt", "successFeedback", "failureFeedback"] as const).map(
        (field) => ({
          ...evidence,
          rounds: evidence.rounds.map((round) => ({
            ...round,
            [field]: fragment,
          })),
        }),
      ),
      ...(["text", "explanation"] as const).map((field) => ({
        ...evidence,
        rounds: evidence.rounds.map((round) => ({
          ...round,
          cards: round.cards.map((card) => ({ ...card, [field]: fragment })),
        })),
      })),
      {
        ...evidence,
        rounds: evidence.rounds.map((round) => ({
          ...round,
          slots: round.slots.map((slot) => ({
            ...slot,
            description: fragment,
          })),
        })),
      },
    ];
    for (const machine of cases)
      expect(simpleLessonMachineSchema.safeParse(machine).success).toBe(false);
    expect(simpleLessonMachineSchema.safeParse(simulation).success).toBe(true);
    expect(simpleLessonMachineSchema.safeParse(evidence).success).toBe(true);
  });

  it("exposes sentence completeness in the provider JSON schema", () => {
    const format = zodTextFormat(
      z.object({ briefing: generationSentence(400) }).strict(),
      "complete_sentence",
    );
    const schema = format.schema as {
      properties: {
        briefing: { pattern: string; description: string; maxLength: number };
      };
    };
    const briefing = schema.properties.briefing;
    expect(briefing.maxLength).toBe(400);
    expect(briefing.description).toContain("COMPLETE short sentences");
    expect(briefing.description).toContain("never truncate");
    expect(new RegExp(briefing.pattern).test("Carry it to a")).toBe(false);
    expect(new RegExp(briefing.pattern).test("Carry it to the dock.\n")).toBe(
      true,
    );
  });

  it("serializes both generation schemas as strict OpenAI structured outputs", () => {
    for (const schema of [
      simpleLessonMachineSchema,
      simpleHarborMachineSchema,
    ]) {
      const format = zodTextFormat(
        z.object({ config: schema }).strict(),
        "simple_machine",
      );
      expect(format.type).toBe("json_schema");
      expect(format.strict).toBe(true);
      const visit = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        const value = node as Record<string, unknown>;
        if (value.type === "object") {
          expect(value.additionalProperties).toBe(false);
          expect(new Set(value.required as string[])).toEqual(
            new Set(Object.keys(value.properties as Record<string, unknown>)),
          );
        }
        Object.values(value).forEach(visit);
      };
      visit(format.schema);
    }
  });
});
