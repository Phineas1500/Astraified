import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  compileGeneratedHarbor,
  harborStorySchema,
  validateGeneratedHarborConfig,
} from "../src/windpost/generated";
import {
  experimentReadoutRanges,
  stationMachine,
  stationRound,
  validateEpisodeFixture,
  type EpisodeFixture,
  type SiteId,
} from "../src/windpost/episodes";
import {
  carriedEvidence,
  evidenceItem,
  initialProgress,
  isSimulationTrial,
  learningEvidence,
  learningStatus,
  reduceEpisode,
  stationReading,
  validateProgress,
  type EpisodeAction,
  type EpisodeProgress,
} from "../src/windpost/runtime";
import {
  loadProgress,
  saveProgress,
  type ProgressStorage,
} from "../src/windpost/saves";
import {
  GENERATED_EVIDENCE_INPUT,
  GENERATED_EXPERIMENT_INPUT,
} from "./fixtures/generated-harbor";
import {
  validateLessonMachineConfig,
  type SimulationConfig,
} from "../src/domain/lesson-machines";

const experiment = compileGeneratedHarbor(GENERATED_EXPERIMENT_INPUT);
const evidence = compileGeneratedHarbor(GENERATED_EVIDENCE_INPUT);
const act = (
  ep: EpisodeFixture,
  state: EpisodeProgress,
  ...actions: EpisodeAction[]
) => actions.reduce((value, action) => reduceEpisode(ep, value, action), state);
function arrange(
  ep: EpisodeFixture,
  state: EpisodeProgress,
  site: SiteId,
  assignment: string[],
) {
  for (const [index, card] of stationRound(ep, site).cards.entries())
    state = act(
      ep,
      state,
      { type: "pickup-card", mechanism: site, cardId: card.id },
      { type: "place-card", mechanism: site, slotId: assignment[index] },
    );
  return state;
}
function firstEvidence() {
  return act(
    evidence,
    arrange(
      evidence,
      act(evidence, initialProgress(evidence), { type: "talk-moss" }),
      "bridge",
      ["observed", "interpreted", "observed"],
    ),
    { type: "activate", mechanism: "bridge" },
  );
}
class MemoryStorage implements ProgressStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe("Source-generated harbor compiler", () => {
  it("emits a provider-compatible homogeneous array schema with bounded station/hint counts", () => {
    expect(() =>
      zodTextFormat(harborStorySchema, "harbor_story"),
    ).not.toThrow();
    const format = zodTextFormat(harborStorySchema, "harbor_story");
    const schema = format.schema as {
      properties: {
        stations: { items: { properties: { hints: { items: unknown } } } };
      };
    };
    expect(Array.isArray(schema.properties.stations.items)).toBe(false);
    expect(
      Array.isArray(schema.properties.stations.items.properties.hints.items),
    ).toBe(false);
    expect(
      harborStorySchema.safeParse({
        ...GENERATED_EVIDENCE_INPUT.story,
        stations: [],
      }).success,
    ).toBe(false);
    expect(
      harborStorySchema.safeParse({
        ...GENERATED_EVIDENCE_INPUT.story,
        stations: GENERATED_EVIDENCE_INPUT.story.stations.map((entry) => ({
          ...entry,
          hints: ["Only one"],
        })),
      }).success,
    ).toBe(false);
  });

  it("preserves the actual source model and content, with no authored-topic substitution", () => {
    for (const [input, ep, kind] of [
      [GENERATED_EXPERIMENT_INPUT, experiment, "experiment"],
      [GENERATED_EVIDENCE_INPUT, evidence, "evidence-crates"],
    ] as const) {
      expect(ep.generated).toBe(true);
      expect(ep.generation?.model).toBe("synthetic-test-fixture");
      expect(ep.generation?.review).toBeUndefined();
      expect(ep.sources).toEqual(input.sources);
      expect(stationMachine(ep, "bridge")).toEqual(input.config);
      expect(ep.scene.stations.bridge.kind).toBe(kind);
      const config = stationMachine(ep, "bridge");
      expect(ep.story.goals.bridge).toBe(
        config.kind === "simulation"
          ? config.tasks[0].prompt
          : config.rounds[0].prompt,
      );
      expect(JSON.stringify(ep)).not.toContain("4 kg");
      expect(JSON.stringify(ep)).not.toContain("s(t)=");
    }
    expect(experimentReadoutRanges(experiment, "bridge")).toEqual({
      brightness: { min: 2, max: 6 },
    });
    expect(experimentReadoutRanges(experiment, "lift")).toEqual({
      brightness: { min: 3, max: 9 },
    });
    const objectiveWithPlanFields = {
      ...GENERATED_EXPERIMENT_INPUT.objective,
      learnerAction: "Select a count",
      approach: "experiment",
    };
    expect(() =>
      compileGeneratedHarbor({
        ...GENERATED_EXPERIMENT_INPUT,
        objective: objectiveWithPlanFields,
      }),
    ).not.toThrow();
    expect(
      compileGeneratedHarbor({
        ...GENERATED_EXPERIMENT_INPUT,
        objective: objectiveWithPlanFields,
      }).objectives[0],
    ).not.toHaveProperty("learnerAction");
  });

  it("rejects unsupported controls, oversized evidence, unknown sources and bad transfer without falling back", () => {
    const numeric = structuredClone(
      GENERATED_EXPERIMENT_INPUT.config,
    ) as SimulationConfig;
    numeric.controls[0] = {
      id: "lanterns",
      label: "Lanterns",
      kind: "number",
      min: 1,
      max: 3,
      step: 1,
      unit: "count",
    };
    expect(() =>
      validateGeneratedHarborConfig(
        numeric,
        GENERATED_EXPERIMENT_INPUT.sources,
      ),
    ).toThrow(/three-choice/);
    const missingSource = structuredClone(GENERATED_EVIDENCE_INPUT.config);
    if (missingSource.kind !== "evidence") throw new Error("Expected evidence");
    missingSource.rounds[1].cards[0].sourceIds = ["invented"];
    expect(() =>
      validateGeneratedHarborConfig(
        missingSource,
        GENERATED_EVIDENCE_INPUT.sources,
      ),
    ).toThrow(/unknown supplied source/);
    const duplicate = structuredClone(GENERATED_EVIDENCE_INPUT.config);
    if (duplicate.kind !== "evidence") throw new Error("Expected evidence");
    duplicate.rounds[1].cards = structuredClone(duplicate.rounds[0].cards);
    expect(() =>
      validateGeneratedHarborConfig(
        duplicate,
        GENERATED_EVIDENCE_INPUT.sources,
      ),
    ).toThrow(/transfer round/);
    expect(() =>
      compileGeneratedHarbor({
        ...GENERATED_EXPERIMENT_INPUT,
        config: numeric,
      }),
    ).toThrow();
  });

  it("exhaustively rejects a singularity only reached by combining token and dial choices", () => {
    const config: SimulationConfig = {
      kind: "simulation",
      briefing: "Synthetic finite-control validation model.",
      modelNotes:
        "This intentionally invalid model has a hidden division by zero at x=y=2.",
      controls: [
        {
          id: "x",
          label: "Token",
          kind: "choice",
          options: [1, 2, 3].map((value) => ({ label: String(value), value })),
        },
        {
          id: "y",
          label: "Dial",
          kind: "choice",
          options: [1, 2, 3].map((value) => ({ label: String(value), value })),
        },
      ],
      outputs: [
        {
          id: "reading",
          label: "Reading",
          unit: "score",
          expression: [
            { op: "literal", value: 1 },
            { op: "ref", id: "x" },
            { op: "literal", value: 2 },
            { op: "sub" },
            { op: "literal", value: 2 },
            { op: "pow" },
            { op: "ref", id: "y" },
            { op: "literal", value: 2 },
            { op: "sub" },
            { op: "literal", value: 2 },
            { op: "pow" },
            { op: "add" },
            { op: "div" },
            { op: "ref", id: "x" },
            { op: "literal", value: 10 },
            { op: "div" },
            { op: "add" },
          ],
          derivativeWrt: null,
        },
      ],
      plots: [],
      tasks: [false, true].map((transfer) => ({
        id: transfer ? "transfer" : "first",
        title: "Synthetic case",
        prompt: "Reach the required reading.",
        constants: [{ id: "threshold", value: transfer ? 1.1 : 1.2 }],
        initialInputs: [
          { id: "x", value: 1 },
          { id: "y", value: 1 },
        ],
        referenceInputs: [
          { id: "x", value: transfer ? 1 : 2 },
          { id: "y", value: transfer ? 2 : 1 },
        ],
        goal: [
          { op: "ref", id: "reading" },
          { op: "ref", id: "threshold" },
          { op: "eq" },
        ],
        successFeedback: "Reached the threshold.",
        failureFeedback: "Try another input.",
        transfer,
      })),
    };
    expect(() =>
      validateGeneratedHarborConfig(config, GENERATED_EXPERIMENT_INPUT.sources),
    ).toThrow(/zero/);
  });

  it("accepts eight dial choices and rejects a ninth before compilation", () => {
    const input = structuredClone(GENERATED_EXPERIMENT_INPUT),
      config = input.config as SimulationConfig;
    const options = Array.from({ length: 8 }, (_, index) => ({
      label: String(index + 1),
      value: index + 1,
    }));
    config.controls.push({
      id: "multiplier",
      label: "Multiplier",
      kind: "choice",
      options,
    });
    config.outputs[0].expression.push(
      { op: "ref", id: "multiplier" },
      { op: "mul" },
    );
    for (const task of config.tasks) {
      task.initialInputs.push({ id: "multiplier", value: 1 });
      task.referenceInputs.push({ id: "multiplier", value: 1 });
    }
    expect(() =>
      validateGeneratedHarborConfig(config, input.sources),
    ).not.toThrow();
    expect(
      compileGeneratedHarbor(input).scene.stations.bridge.prediction?.values,
    ).toHaveLength(8);
    options.push({ label: "9", value: 9 });
    expect(() =>
      validateGeneratedHarborConfig(config, input.sources),
    ).toThrow();
    expect(() => compileGeneratedHarbor(input)).toThrow();
  });

  it("rejects changed constants when the first reference still solves the transfer case", () => {
    const input = structuredClone(GENERATED_EXPERIMENT_INPUT),
      config = input.config as SimulationConfig;
    config.tasks[1].constants.find(
      (constant) => constant.id === "target",
    )!.value = 6;
    config.tasks[1].referenceInputs[0].value = 2;
    expect(() => validateLessonMachineConfig(config)).not.toThrow();
    expect(() => validateGeneratedHarborConfig(config, input.sources)).toThrow(
      /changed solution.*first task's reference inputs/,
    );
    expect(() => compileGeneratedHarbor(input)).toThrow(
      /Revise the second case/,
    );
    const fixture = structuredClone(experiment);
    fixture.puzzles[0].config = config;
    expect(() => validateEpisodeFixture(fixture)).toThrow(/changed solution/);
    expect(() =>
      validateGeneratedHarborConfig(
        GENERATED_EXPERIMENT_INPUT.config,
        input.sources,
      ),
    ).not.toThrow();
    expect(() =>
      validateGeneratedHarborConfig(
        GENERATED_EVIDENCE_INPUT.config,
        GENERATED_EVIDENCE_INPUT.sources,
      ),
    ).not.toThrow();
  });
});

describe("General experiment progression", () => {
  it("requires a carried token placement even when an unplaced dial configuration already meets the goal", () => {
    const input = structuredClone(GENERATED_EXPERIMENT_INPUT),
      config = input.config as SimulationConfig;
    config.controls.push({
      id: "multiplier",
      label: "Score multiplier",
      kind: "choice",
      options: [
        { label: "Normal", value: 1 },
        { label: "Double", value: 2 },
      ],
    });
    config.outputs[0].expression.push(
      { op: "ref", id: "multiplier" },
      { op: "mul" },
    );
    config.tasks.forEach((task) => {
      task.initialInputs.push({ id: "multiplier", value: 1 });
      task.referenceInputs.push({ id: "multiplier", value: 1 });
    });
    const ep = compileGeneratedHarbor(input);
    let state = act(
      ep,
      initialProgress(ep),
      { type: "talk-moss" },
      { type: "adjust", mechanism: "bridge" },
    );
    expect(stationReading(ep, state, "bridge").passed).toBe(true);
    const blocked = reduceEpisode(ep, state, {
      type: "activate",
      mechanism: "bridge",
    });
    expect(blocked.bridgeOpen).toBe(false);
    expect(blocked.trials).toHaveLength(0);
    state = act(
      ep,
      blocked,
      { type: "pickup", item: "bridge-weight" },
      { type: "place", mechanism: "bridge", slot: 1 },
      { type: "activate", mechanism: "bridge" },
    );
    expect(state.bridgeOpen).toBe(true);
    expect(state.trials).toHaveLength(1);
    expect(state.observations.bridge?.passed).toBe(false);
  });

  it("completes the supplied changed-case experiment with first-attempt proof", () => {
    let state = initialProgress(experiment);
    for (const [site, slot] of [
      ["bridge", 2],
      ["lift", 3],
    ] as const)
      state = act(
        experiment,
        state,
        { type: site === "bridge" ? "talk-moss" : "talk-bea" },
        {
          type: "pickup",
          item: site === "bridge" ? "bridge-weight" : "lift-weight",
        },
        { type: "place", mechanism: site, slot },
        { type: "activate", mechanism: site },
      );
    state = act(
      experiment,
      state,
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    expect(state.delivered).toBe(true);
    expect(state.trials.every((trial) => trial.evidence.passed)).toBe(true);
    expect(learningStatus(experiment, state).verified).toBe(true);
    expect(learningEvidence(experiment, state).kind).toBe("simulation");
    expect(
      validateProgress(experiment, {
        ...state,
        observations: { bridge: null, lift: null },
      }),
    ).toBeNull();
  });
});

describe("Physical evidence cards and honest records", () => {
  it("captures the real unassigned layout and enforces one carried card, bin capacity and source identity", () => {
    let state = act(
      evidence,
      initialProgress(evidence),
      { type: "talk-moss" },
      { type: "pickup-card", mechanism: "bridge", cardId: "birds" },
    );
    expect(carriedEvidence(state)).toEqual({ site: "bridge", cardId: "birds" });
    expect(state.carrying).toBe(evidenceItem("bridge", "birds"));
    const observation = state.observations.bridge!;
    expect(isSimulationTrial(observation)).toBe(false);
    if (isSimulationTrial(observation))
      throw new Error("Expected evidence observation");
    expect(observation.assignment).toEqual([null, null, null]);
    expect(state.trials).toEqual([]);
    expect(stationReading(evidence, state, "bridge")).toMatchObject({
      kind: "evidence",
      outputs: {},
      inputs: {},
      assignment: [null, null, null],
    });
    expect(
      reduceEpisode(evidence, state, {
        type: "pickup-card",
        mechanism: "bridge",
        cardId: "wind",
      }),
    ).toBe(state);
    expect(
      reduceEpisode(evidence, state, {
        type: "place-card",
        mechanism: "lift",
        slotId: "observed",
      }),
    ).toBe(state);
    state = act(
      evidence,
      state,
      { type: "place-card", mechanism: "bridge", slotId: "observed" },
      { type: "pickup-card", mechanism: "bridge", cardId: "tide" },
      { type: "place-card", mechanism: "bridge", slotId: "observed" },
      { type: "pickup-card", mechanism: "bridge", cardId: "wind" },
    );
    expect(
      reduceEpisode(evidence, state, {
        type: "place-card",
        mechanism: "bridge",
        slotId: "observed",
      }),
    ).toBe(state);
    const storage = new MemoryStorage();
    saveProgress(evidence, state, storage);
    expect(loadProgress(evidence, storage)).toEqual(state);
    const dropped = reduceEpisode(evidence, state, { type: "drop" });
    expect(dropped.assignments.bridge).toEqual(["observed", null, "observed"]);
    state = act(
      evidence,
      dropped,
      { type: "pickup-card", mechanism: "bridge", cardId: "wind" },
      { type: "place-card", mechanism: "bridge", slotId: "interpreted" },
      { type: "activate", mechanism: "bridge" },
    );
    expect(state.bridgeOpen).toBe(true);
    expect(state.observations.bridge).toBe(observation);
    expect(
      reduceEpisode(evidence, state, {
        type: "retrieve-card",
        mechanism: "bridge",
        cardId: "birds",
      }),
    ).toBe(state);
  });

  it("supports a wrong transfer arrangement, physical recovery, final delivery and replay verification", () => {
    let state = act(evidence, firstEvidence(), { type: "talk-bea" });
    state = arrange(evidence, state, "lift", [
      "observed",
      "interpreted",
      "observed",
    ]);
    state = reduceEpisode(evidence, state, {
      type: "activate",
      mechanism: "lift",
    });
    expect(state.liftRaised).toBe(false);
    state = act(
      evidence,
      state,
      { type: "retrieve-card", mechanism: "lift", cardId: "storm" },
      { type: "drop" },
      { type: "retrieve-card", mechanism: "lift", cardId: "shells" },
      { type: "place-card", mechanism: "lift", slotId: "observed" },
      { type: "pickup-card", mechanism: "lift", cardId: "storm" },
      { type: "place-card", mechanism: "lift", slotId: "interpreted" },
      { type: "activate", mechanism: "lift" },
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    expect(state.delivered).toBe(true);
    expect(state.trials.map((trial) => trial.evidence.passed)).toEqual([
      true,
      false,
      true,
    ]);
    expect(learningStatus(evidence, state)).toMatchObject({
      verified: true,
      baselineCount: 2,
      completedCases: 2,
    });
    const exported = learningEvidence(evidence, state);
    expect(exported.kind).toBe("evidence");
    if (exported.kind !== "evidence")
      throw new Error("Expected evidence proof");
    expect(exported.trials.map((trial) => trial.roundId)).toEqual([
      "morning-records",
      "morning-records",
      "evening-records",
      "evening-records",
      "evening-records",
    ]);
    exported.trials[0].assignment[0] = "observed";
    expect(learningStatus(evidence, state).verified).toBe(true);
    const reversed = { ...state, trials: [...state.trials].reverse() };
    expect(learningStatus(evidence, reversed).verified).toBe(false);
    const storage = new MemoryStorage();
    saveProgress(evidence, state, storage);
    expect(loadProgress(evidence, storage)).toEqual(state);
  });

  it("keeps first-attempt evidence valid and earlier success through long later histories", () => {
    let state = act(evidence, firstEvidence(), { type: "talk-bea" });
    for (let index = 0; index < 240; index++)
      state = reduceEpisode(evidence, state, {
        type: "activate",
        mechanism: "lift",
      });
    state = arrange(evidence, state, "lift", [
      "interpreted",
      "observed",
      "observed",
    ]);
    state = reduceEpisode(evidence, state, {
      type: "activate",
      mechanism: "lift",
    });
    expect(state.trials[0].mechanism).toBe("bridge");
    expect(state.trials[0].evidence.passed).toBe(true);
    expect(learningEvidence(evidence, state).trials.length).toBeLessThanOrEqual(
      200,
    );
    expect(learningStatus(evidence, state).verified).toBe(true);
    const fresh = act(
      evidence,
      arrange(
        evidence,
        act(evidence, firstEvidence(), { type: "talk-bea" }),
        "lift",
        ["interpreted", "observed", "observed"],
      ),
      { type: "activate", mechanism: "lift" },
    );
    expect(fresh.trials).toHaveLength(2);
    expect(learningStatus(evidence, fresh).verified).toBe(true);
  });

  it("rejects forged assignments, capacities, carry states, trial outcomes and missing baselines", () => {
    const opened = firstEvidence();
    const bad: unknown[] = [
      { ...opened, bridgeSlot: 1 },
      {
        ...opened,
        assignments: {
          ...opened.assignments,
          bridge: ["observed", "observed", "observed"],
        },
      },
      { ...opened, carrying: evidenceItem("bridge", "birds") },
      { ...opened, inputs: { bridge: { invented: 3 }, lift: {} } },
      { ...opened, observations: { bridge: null, lift: null } },
      {
        ...opened,
        trials: opened.trials.map((trial) => ({
          ...trial,
          evidence: { ...trial.evidence, passed: false },
        })),
      },
      {
        ...opened,
        assignments: {
          bridge: ["invented", null, null],
          lift: [null, null, null],
        },
      },
    ];
    const storage = new MemoryStorage();
    for (const state of bad) {
      expect(validateProgress(evidence, state)).toBeNull();
      expect(() =>
        saveProgress(evidence, state as EpisodeProgress, storage),
      ).toThrow(RangeError);
    }
    const initial = initialProgress(evidence);
    expect(
      reduceEpisode(evidence, initial, {
        type: "pickup-card",
        mechanism: "bridge",
        cardId: "birds",
      }),
    ).toBe(initial);
    expect(
      reduceEpisode(evidence, act(evidence, initial, { type: "talk-moss" }), {
        type: "pickup",
        item: "bridge-weight",
      }).carrying,
    ).toBeNull();
  });
});
