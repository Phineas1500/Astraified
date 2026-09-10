import { describe, expect, it } from "vitest";
import {
  canonicalLessonMachineEvidence,
  evidenceTrial,
  evaluateSimulation,
  simulationInputs,
  simulationPlot,
  simulationTrial,
  validateLessonMachineConfig,
  verifyLessonMachineEvidence,
  type EvidenceConfig,
  type LessonMachineEvidence,
  type MachineExpression,
  type SimulationConfig,
} from "../src/domain/lesson-machines";

// These test-only models deliberately cover unrelated subjects; production has no derivative/ecology adapter.
function derivatives(): SimulationConfig {
  return {
    kind: "simulation",
    briefing: "Calibrate the moving cart's instantaneous speed sensor.",
    modelNotes:
      "The cart follows the illustrative law distance = time². This model is not a law for every cart.",
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
      {
        id: "estimate",
        label: "Speed sensor",
        kind: "number",
        min: 0,
        max: 30,
        step: 1,
        unit: "m/s",
      },
    ],
    outputs: [
      {
        id: "distance",
        label: "Distance",
        unit: "m",
        expression: [
          { op: "ref", id: "time" },
          { op: "literal", value: 2 },
          { op: "pow" },
        ],
        derivativeWrt: null,
      },
      {
        id: "speed",
        label: "Instantaneous speed",
        unit: "m/s",
        expression: [{ op: "ref", id: "distance" }],
        derivativeWrt: "time",
      },
      {
        id: "error",
        label: "Sensor error",
        unit: "m/s",
        expression: [
          { op: "ref", id: "estimate" },
          { op: "ref", id: "speed" },
          { op: "sub" },
          { op: "abs" },
        ],
        derivativeWrt: null,
      },
    ],
    plots: [{ inputId: "time", outputId: "distance", min: 0, max: 10 }],
    tasks: [2, 4].map((time, i) => ({
      id: `task${i}`,
      title: i === 0 ? "Repair the first reading" : "A later instant",
      prompt: `Set the speed sensor at time ${time}.`,
      constants: [{ id: "targetTime", value: time }],
      initialInputs: [
        { id: "time", value: time },
        { id: "estimate", value: 0 },
      ],
      referenceInputs: [
        { id: "time", value: time },
        { id: "estimate", value: time * 2 },
      ],
      goal: [
        { op: "ref", id: "error" },
        { op: "literal", value: 0 },
        { op: "eq" },
        { op: "ref", id: "time" },
        { op: "ref", id: "targetTime" },
        { op: "eq" },
        { op: "and" },
      ],
      successFeedback:
        "The sensor now agrees with the instantaneous rate, rather than the distance.",
      failureFeedback:
        "Compare the slope at this time with the sensor reading.",
      transfer: i > 0,
    })),
  };
}
function ecology(): SimulationConfig {
  return {
    kind: "simulation",
    briefing: "Restore a habitat's expected population growth.",
    modelNotes:
      "A simplified logistic model omits migration and seasonal variation.",
    controls: [
      {
        id: "population",
        label: "Population",
        kind: "number",
        min: 0,
        max: 200,
        step: 1,
        unit: "organisms",
      },
    ],
    outputs: [
      {
        id: "growth",
        label: "Expected growth",
        unit: "organisms/day",
        derivativeWrt: null,
        expression: [
          { op: "literal", value: 0.2 },
          { op: "ref", id: "population" },
          { op: "mul" },
          { op: "literal", value: 1 },
          { op: "ref", id: "population" },
          { op: "ref", id: "capacity" },
          { op: "div" },
          { op: "sub" },
          { op: "mul" },
        ],
      },
    ],
    plots: [],
    tasks: [100, 200].map((capacity, i) => ({
      id: `habitat${i}`,
      title: "The habitat",
      prompt: "Choose a population with growth above the target.",
      constants: [
        { id: "capacity", value: capacity },
        { id: "target", value: capacity * 0.04 },
      ],
      initialInputs: [{ id: "population", value: 0 }],
      referenceInputs: [{ id: "population", value: capacity / 2 }],
      goal: [
        { op: "ref", id: "growth" },
        { op: "ref", id: "target" },
        { op: "gte" },
      ],
      successFeedback: "The model supports recovery at this density.",
      failureFeedback:
        "Very low populations and overcrowding each constrain growth.",
      transfer: i > 0,
    })),
  };
}
function historicalEvidence(): EvidenceConfig {
  return {
    kind: "evidence",
    briefing: "Build a museum's source cabinet.",
    modelNotes:
      "Whether a source is primary depends on the historical question. A later account can be primary evidence of later memory.",
    rounds: ["strike", "election"].map((event, i) => ({
      id: `archive${i}`,
      title: `The ${event}`,
      prompt: `Sort evidence about what happened during the ${event}.`,
      cards: [
        {
          id: "letter",
          label: "Participant's letter",
          text: `A participant describes yesterday's ${event} in a contemporary letter.`,
          sourceIds: ["source1"],
          explanation:
            "Contemporary testimony is direct evidence of the writer's experience, though it can be biased.",
        },
        {
          id: "memoir",
          label: "Later memoir",
          text: `A participant recalls the ${event} forty years later.`,
          sourceIds: ["source1"],
          explanation:
            "This is firsthand recollection but also a later interpretation; both classifications can be defensible if the question is clear.",
        },
        {
          id: "survey",
          label: "Historical survey",
          text: `A historian synthesizes several records of the ${event}.`,
          sourceIds: ["source1"],
          explanation:
            "The historian interprets other records rather than witnessing the event.",
        },
      ],
      slots: [
        {
          id: "direct",
          label: "Firsthand evidence",
          description: "A participant or contemporary record",
          capacity: 3,
        },
        {
          id: "interpretation",
          label: "Later interpretation",
          description: "An account reconstructing the event",
          capacity: 3,
        },
      ],
      acceptedAssignments: [
        ["direct", "direct", "interpretation"],
        ["direct", "interpretation", "interpretation"],
      ],
      successFeedback:
        "Your cabinet distinguishes testimony from reconstruction while allowing the memoir's mixed role.",
      failureFeedback:
        "Consider who produced each source, when, and for what purpose.",
      transfer: i > 0,
    })),
  };
}
const copy = <T>(value: T): T => structuredClone(value);

describe("subject-independent machine validation", () => {
  it("accepts generated calculus, ecology, and historical-source models through the same schema", () => {
    for (const config of [derivatives(), ecology(), historicalEvidence()]) {
      const parsed = validateLessonMachineConfig(config);
      expect(parsed).toEqual(config);
      expect(
        verifyLessonMachineEvidence(
          parsed,
          canonicalLessonMachineEvidence(parsed),
        ),
      ).toBe(true);
    }
  });
  it("rejects generated code and unknown expression operations", () => {
    const config = derivatives() as unknown as Record<string, unknown>;
    config.script = "return true";
    expect(() => validateLessonMachineConfig(config)).toThrow();
    const malformed = derivatives();
    malformed.outputs[0].expression = [
      { op: "eval", source: "globalThis" },
    ] as never;
    expect(() => validateLessonMachineConfig(malformed)).toThrow();
  });
  it("rejects forward/circular references, stack underflow, unused stack operands, and excessive programs", () => {
    const cases: MachineExpression[] = [
      [{ op: "ref", id: "speed" }],
      [{ op: "add" }],
      [
        { op: "literal", value: 1 },
        { op: "literal", value: 2 },
      ],
      Array.from({ length: 97 }, () => ({ op: "literal" as const, value: 1 })),
    ];
    for (const expression of cases) {
      const config = derivatives();
      config.outputs[0].expression = expression;
      expect(() => validateLessonMachineConfig(config)).toThrow();
    }
  });
  it("rejects duplicate/prototype identifiers and invalid numeric-control steps", () => {
    const duplicate = derivatives();
    duplicate.outputs[0].id = "time";
    expect(() => validateLessonMachineConfig(duplicate)).toThrow(/unique/);
    const reserved = derivatives();
    reserved.controls[0].id = "constructor";
    expect(() => validateLessonMachineConfig(reserved)).toThrow();
    const config = derivatives();
    if (config.controls[0].kind === "number") config.controls[0].step = 3;
    expect(() => validateLessonMachineConfig(config)).toThrow(/steps/);
  });
  it("rejects unsatisfied reference interventions and initially solved tasks", () => {
    const impossible = derivatives();
    impossible.tasks[0].referenceInputs[1].value = 3;
    expect(() => validateLessonMachineConfig(impossible)).toThrow(
      /reference intervention/,
    );
    const trivial = derivatives();
    trivial.tasks[0].initialInputs = copy(trivial.tasks[0].referenceInputs);
    expect(() => validateLessonMachineConfig(trivial)).toThrow(
      /already succeed/,
    );
  });
  it("rejects goals disconnected from the model and interventions that change no readouts", () => {
    const disconnected = ecology();
    disconnected.tasks[0].goal = [
      { op: "ref", id: "population" },
      { op: "literal", value: 10 },
      { op: "gt" },
    ];
    expect(() => validateLessonMachineConfig(disconnected)).toThrow(
      /model output/,
    );
    const unchanged = ecology();
    unchanged.outputs[0].expression = [{ op: "literal", value: 1 }];
    unchanged.tasks.forEach((task) => {
      task.goal = [
        { op: "ref", id: "population" },
        { op: "literal", value: 10 },
        { op: "gt" },
        { op: "ref", id: "growth" },
        { op: "and" },
      ];
    });
    expect(() => validateLessonMachineConfig(unchanged)).toThrow(
      /observable output/,
    );
  });
  it("requires a materially different transfer context, not a different title", () => {
    const config = derivatives();
    config.tasks[1] = {
      ...copy(config.tasks[0]),
      id: "transfer",
      title: "A new title",
      transfer: true,
    };
    expect(() => validateLessonMachineConfig(config)).toThrow(
      /changed model constants/,
    );
    const evidence = historicalEvidence();
    evidence.rounds[1].cards = copy(evidence.rounds[0].cards);
    expect(() => validateLessonMachineConfig(evidence)).toThrow(/new evidence/);
  });
  it("validates tiny scientific controls without admitting out-of-range witnesses or collapsing readouts", () => {
    const tiny: SimulationConfig = {
      kind: "simulation",
      briefing: "Adjust a very small experimental quantity.",
      modelNotes: "An illustrative unit-scale model.",
      controls: [
        {
          id: "quantity",
          label: "Quantity",
          kind: "number",
          min: 0,
          max: 1e-12,
          step: 1e-13,
          unit: "m",
        },
      ],
      outputs: [
        {
          id: "reading",
          label: "Measured quantity",
          unit: "m",
          expression: [{ op: "ref", id: "quantity" }],
          derivativeWrt: null,
        },
      ],
      plots: [],
      tasks: [1e-13, 3e-13].map((threshold, i) => ({
        id: `tiny${i}`,
        title: "A tiny change",
        prompt: "Raise the reading above the target.",
        constants: [{ id: "threshold", value: threshold }],
        initialInputs: [{ id: "quantity", value: 0 }],
        referenceInputs: [{ id: "quantity", value: i === 0 ? 2e-13 : 4e-13 }],
        goal: [
          { op: "ref", id: "reading" },
          { op: "ref", id: "threshold" },
          { op: "gt" },
        ],
        successFeedback: "The reading exceeds the target.",
        failureFeedback: "Raise the quantity.",
        transfer: i > 0,
      })),
    };
    const valid = validateLessonMachineConfig(tiny);
    expect(
      verifyLessonMachineEvidence(valid, canonicalLessonMachineEvidence(valid)),
    ).toBe(true);
    const outOfRange = copy(tiny);
    outOfRange.outputs[0].expression.push(
      { op: "literal", value: 1e9 },
      { op: "mul" },
    );
    outOfRange.tasks.forEach((task, i) => {
      task.constants[0].value = i + 1;
      task.initialInputs[0].value = -9e-9;
      task.referenceInputs[0].value = 9e-9;
    });
    expect(() => validateLessonMachineConfig(outOfRange)).toThrow(
      /outside its range/,
    );
    for (const quantity of [-9e-9, 9e-9, -1e-13, 1.1e-12, -1e-30, 1e-30]) {
      expect(() => evaluateSimulation(tiny, "tiny0", { quantity })).toThrow();
    }
    const evidence = canonicalLessonMachineEvidence(valid);
    if (evidence.kind === "simulation")
      evidence.trials[1].outputs.reading = 9e-13;
    expect(verifyLessonMachineEvidence(valid, evidence)).toBe(false);
  });
  it("rejects nonfinite references and model domain failures", () => {
    const config = derivatives();
    config.tasks[0].referenceInputs[0].value = Infinity;
    expect(() => validateLessonMachineConfig(config)).toThrow();
    const division = ecology();
    division.tasks[0].constants[0].value = 0;
    expect(() => validateLessonMachineConfig(division)).toThrow(
      /Division by zero/,
    );
    const overflow = ecology();
    overflow.outputs[0].expression = [
      { op: "literal", value: 999 },
      { op: "exp" },
    ];
    expect(() => validateLessonMachineConfig(overflow)).toThrow(
      /undefined or excessively large/,
    );
  });
});

describe("safe expression models and automatic derivatives", () => {
  it("keeps ordinary and derivative memo entries distinct for a control named value", () => {
    const config = JSON.parse(
      JSON.stringify(derivatives()).replaceAll('"time"', '"value"'),
    ) as SimulationConfig;
    const valid = validateLessonMachineConfig(config) as SimulationConfig;
    expect(
      evaluateSimulation(valid, "task0", { value: 1, estimate: 0 }).outputs
        .speed,
    ).toBe(2);
    expect(
      evaluateSimulation(valid, "task0", { value: 2, estimate: 0 }).outputs
        .speed,
    ).toBe(4);
  });
  it("rejects differentiated discontinuous dependencies even when their point derivative is zero", () => {
    const config = derivatives();
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "literal", value: 2 },
      { op: "pow" },
      { op: "literal", value: 0 },
      { op: "gt" },
      { op: "literal", value: 1 },
      { op: "literal", value: 0 },
      { op: "if" },
    ];
    expect(() => validateLessonMachineConfig(config)).toThrow(
      /smooth arithmetic/,
    );
    expect(() =>
      evaluateSimulation(config, "task0", { time: 0, estimate: 0 }),
    ).toThrow(/smooth arithmetic/);
    for (const op of [
      "not",
      "and",
      "or",
      "lt",
      "lte",
      "gt",
      "gte",
      "eq",
    ] as const) {
      const model = derivatives();
      model.outputs[0].expression =
        op === "not"
          ? [{ op: "ref", id: "time" }, { op }]
          : [{ op: "ref", id: "time" }, { op: "literal", value: 1 }, { op }];
      expect(() => validateLessonMachineConfig(model)).toThrow(
        /smooth arithmetic/,
      );
    }
  });
  it("computes an automatic derivative through earlier outputs with the chain rule", () => {
    const config = derivatives();
    expect(
      evaluateSimulation(config, "task0", { time: 3, estimate: 0 }).outputs,
    ).toEqual({ distance: 9, speed: 6, error: 6 });
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "literal", value: 2 },
      { op: "mul" },
      { op: "sin" },
      { op: "exp" },
    ];
    const at = evaluateSimulation(config, "task0", { time: 1, estimate: 0 });
    expect(at.outputs.speed).toBeCloseTo(
      Math.exp(Math.sin(2)) * Math.cos(2) * 2,
      12,
    );
  });
  it("differentiates a variable exponent and a negative-base integer power correctly", () => {
    const config = derivatives();
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "ref", id: "time" },
      { op: "pow" },
    ];
    expect(
      evaluateSimulation(config, "task0", { time: 2, estimate: 0 }).outputs
        .speed,
    ).toBeCloseTo(4 * (Math.log(2) + 1), 12);
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "neg" },
      { op: "literal", value: 3 },
      { op: "pow" },
    ];
    expect(
      evaluateSimulation(config, "task0", { time: 2, estimate: 0 }).outputs
        .speed,
    ).toBe(-12);
  });
  it("supports smooth log, sqrt, cos, quotient, and bounded conditional operations", () => {
    const config = derivatives();
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "literal", value: 1 },
      { op: "add" },
      { op: "log" },
      { op: "literal", value: 2 },
      { op: "div" },
    ];
    expect(
      evaluateSimulation(config, "task0", { time: 3, estimate: 0 }).outputs
        .speed,
    ).toBeCloseTo(0.125, 12);
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "sqrt" },
      { op: "cos" },
    ];
    expect(
      evaluateSimulation(config, "task0", { time: 4, estimate: 0 }).outputs
        .speed,
    ).toBeCloseTo(-Math.sin(2) / 4, 12);
    config.outputs[0].expression = [
      { op: "ref", id: "time" },
      { op: "literal", value: 2 },
      { op: "gt" },
      { op: "ref", id: "time" },
      { op: "literal", value: 3 },
      { op: "mul" },
      { op: "ref", id: "time" },
      { op: "if" },
    ];
    expect(() =>
      evaluateSimulation(config, "task0", { time: 3, estimate: 0 }),
    ).toThrow(/smooth arithmetic/);
    config.outputs[1].derivativeWrt = null;
    expect(
      evaluateSimulation(config, "task0", { time: 3, estimate: 0 }).outputs
        .distance,
    ).toBe(9);
    expect(
      evaluateSimulation(config, "task0", { time: 1, estimate: 0 }).outputs
        .distance,
    ).toBe(1);
  });
  it("rejects square-root and fractional-power singularities despite a zero inner derivative", () => {
    const square: MachineExpression = [
      { op: "ref", id: "time" },
      { op: "literal", value: 2 },
      { op: "pow" },
    ];
    for (const suffix of [
      [{ op: "sqrt" }],
      [{ op: "literal", value: 0.5 }, { op: "pow" }],
    ] as MachineExpression[]) {
      const model = derivatives();
      model.outputs[0].expression = [...square, ...suffix];
      expect(() =>
        evaluateSimulation(model, "task0", { time: 0, estimate: 0 }),
      ).toThrow(/differentiable domain/);
      expect(
        evaluateSimulation(model, "task0", { time: 2, estimate: 0 }).outputs
          .speed,
      ).toBeCloseTo(1, 12);
    }
  });
  it("rejects undefined corner derivatives and unsupported higher derivatives explicitly", () => {
    const config = derivatives();
    config.outputs[0].expression = [{ op: "ref", id: "time" }, { op: "abs" }];
    expect(() =>
      evaluateSimulation(config, "task0", { time: 0, estimate: 0 }),
    ).toThrow(/undefined/);
    const higher = derivatives();
    higher.outputs.push({
      id: "acceleration",
      label: "Acceleration",
      unit: "m/s²",
      derivativeWrt: "time",
      expression: [{ op: "ref", id: "speed" }],
    });
    expect(() => validateLessonMachineConfig(higher)).toThrow(
      /Higher derivatives/,
    );
  });
  it("enforces numerical input bounds and steps on actual observations", () => {
    const config = derivatives();
    for (const inputs of [
      { time: 1.5, estimate: 0 },
      { time: 11, estimate: 0 },
      { time: NaN, estimate: 0 },
      { time: 2 },
      { time: 2, estimate: 0, extra: 1 },
    ]) {
      expect(() =>
        simulationTrial(config, "task0", inputs as Record<string, number>),
      ).toThrow();
    }
  });
  it("plots a generated model without converting singularities to zero", () => {
    const config = derivatives();
    const points = simulationPlot(
      config,
      "task0",
      simulationInputs(config, "task0"),
    );
    expect(points).toHaveLength(61);
    expect(points[30]).toEqual({ input: 5, output: 25 });
    config.outputs[0].expression = [
      { op: "literal", value: 1 },
      { op: "ref", id: "time" },
      { op: "literal", value: 5 },
      { op: "sub" },
      { op: "div" },
    ];
    const singular = simulationPlot(config, "task0", { time: 2, estimate: 0 });
    expect(singular[30]).toEqual({ input: 5, output: null });
    expect(singular[0].output).toBeCloseTo(-0.2, 12);
  });
  it("executes generated toggles and choices as data rather than subject adapters", () => {
    const config = ecology();
    config.controls = [
      {
        id: "population",
        label: "Population",
        kind: "choice",
        options: [
          { label: "Vacant", value: 0 },
          { label: "Small colony", value: 50 },
          { label: "Large colony", value: 100 },
        ],
      },
      {
        id: "gate",
        label: "Habitat gate",
        kind: "toggle",
        offLabel: "Closed",
        onLabel: "Open",
      },
    ];
    config.outputs[0].expression.push({ op: "ref", id: "gate" }, { op: "mul" });
    config.tasks.forEach((task) => {
      task.initialInputs.push({ id: "gate", value: 0 });
      task.referenceInputs.push({ id: "gate", value: 1 });
    });
    const parsed = validateLessonMachineConfig(config);
    expect(
      verifyLessonMachineEvidence(
        parsed,
        canonicalLessonMachineEvidence(parsed),
      ),
    ).toBe(true);
    expect(() =>
      evaluateSimulation(config, "habitat0", { population: 60, gate: 1 }),
    ).toThrow(/no such option/);
    expect(() =>
      evaluateSimulation(config, "habitat0", { population: 50, gate: 2 }),
    ).toThrow(/zero or one/);
  });
});

describe("evidence boards and recomputed completion", () => {
  it("accepts multiple defensible arrangements and preserves source explanations", () => {
    const config = historicalEvidence();
    for (const round of config.rounds)
      for (const answer of round.acceptedAssignments)
        expect(evidenceTrial(config, round.id, answer).passed).toBe(true);
    const witness = canonicalLessonMachineEvidence(config);
    expect(witness.kind).toBe("evidence");
    if (witness.kind === "evidence")
      witness.trials[1] = evidenceTrial(
        config,
        "archive0",
        config.rounds[0].acceptedAssignments[1],
      );
    expect(verifyLessonMachineEvidence(config, witness)).toBe(true);
    expect(config.rounds[0].cards[1].sourceIds).toEqual(["source1"]);
  });
  it("enforces slot capacity, known slots, complete accepted arrangements, and at least two roles", () => {
    const config = historicalEvidence();
    config.rounds[0].slots[0].capacity = 1;
    expect(() => validateLessonMachineConfig(config)).toThrow(
      /remaining space/,
    );
    expect(() =>
      evidenceTrial(historicalEvidence(), "archive0", [
        "direct",
        "invented",
        "interpretation",
      ]),
    ).toThrow(/Unknown/);
    const incomplete = historicalEvidence();
    incomplete.rounds[0].acceptedAssignments = [["direct", "interpretation"]];
    expect(() => validateLessonMachineConfig(incomplete)).toThrow();
    const trivial = historicalEvidence();
    trivial.rounds[0].acceptedAssignments = [["direct", "direct", "direct"]];
    expect(() => validateLessonMachineConfig(trivial)).toThrow(/two roles/);
  });
  it("supports ordered causal chains through one-card-capacity slots", () => {
    const config = historicalEvidence();
    config.rounds.forEach((round) => {
      round.slots = ["cause", "mechanism", "effect"].map((id) => ({
        id,
        label: id,
        description: id,
        capacity: 1,
      }));
      round.acceptedAssignments = [["cause", "mechanism", "effect"]];
    });
    const valid = validateLessonMachineConfig(config);
    expect(
      verifyLessonMachineEvidence(valid, canonicalLessonMachineEvidence(valid)),
    ).toBe(true);
    expect(() =>
      evidenceTrial(config, "archive0", ["cause", "cause", "effect"]),
    ).toThrow(/remaining space/);
  });
  it("rejects forged successes or readouts, omitted baseline, missing transfer, and reordered stages", () => {
    const config = derivatives();
    const witness = canonicalLessonMachineEvidence(config);
    if (witness.kind !== "simulation") throw new Error("Wrong fixture");
    const forged = copy(witness);
    forged.trials[1].outputs.speed = 999;
    expect(verifyLessonMachineEvidence(config, forged)).toBe(false);
    const passFlag = copy(witness);
    passFlag.trials[0].passed = true;
    expect(verifyLessonMachineEvidence(config, passFlag)).toBe(false);
    const noBaseline = copy(witness);
    noBaseline.trials.splice(0, 1);
    expect(verifyLessonMachineEvidence(config, noBaseline)).toBe(false);
    const noTransfer = copy(witness);
    noTransfer.trials.splice(2);
    expect(verifyLessonMachineEvidence(config, noTransfer)).toBe(false);
    const reorder = copy(witness);
    reorder.trials.reverse();
    expect(verifyLessonMachineEvidence(config, reorder)).toBe(false);
  });
  it("rejects passing once then leaving a task unsolved", () => {
    const config = derivatives();
    const witness = canonicalLessonMachineEvidence(config);
    if (witness.kind !== "simulation") throw new Error("Wrong fixture");
    witness.trials.push(
      simulationTrial(config, "task1", { time: 4, estimate: 0 }),
    );
    expect(verifyLessonMachineEvidence(config, witness)).toBe(false);
  });
  it("rejects unknown stages, unrecognized fields, and excessive evidence", () => {
    const config = historicalEvidence();
    const witness = canonicalLessonMachineEvidence(config);
    const unknown = copy(witness);
    if (unknown.kind === "evidence") unknown.trials[0].roundId = "other";
    expect(verifyLessonMachineEvidence(config, unknown)).toBe(false);
    expect(
      verifyLessonMachineEvidence(config, { ...witness, solved: true }),
    ).toBe(false);
    const excessive: LessonMachineEvidence = {
      kind: "evidence",
      trials: Array(201).fill({
        roundId: "archive0",
        assignment: [null, null, null],
        passed: false,
      }),
    };
    expect(verifyLessonMachineEvidence(config, excessive)).toBe(false);
  });
});
