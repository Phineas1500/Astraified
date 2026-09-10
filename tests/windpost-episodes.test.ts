import { describe, expect, it } from "vitest";
import {
  evaluateSimulation,
  simulationTrial,
  validateLessonMachineConfig,
} from "../src/domain/lesson-machines";
import {
  EPISODES,
  MINUTE_MAIL_EPISODE,
  WINDPOST_EPISODE,
  stationConfig,
  validateEpisodeFixture,
  type EpisodeFixture,
  type SiteId,
  type Slot,
} from "../src/windpost/episodes";
import {
  HISTORY_LIMIT,
  isSimulationTrial,
  initialProgress,
  learningEvidence,
  learningStatus,
  motionSample,
  reduceEpisode,
  stationReading,
  validateProgress,
  type EpisodeAction,
  type EpisodeProgress,
  type RecordedTrial,
} from "../src/windpost/runtime";
const simulation = (trial: RecordedTrial | null | undefined) => {
  if (!trial || !isSimulationTrial(trial))
    throw new Error("Expected simulation trial");
  return trial;
};
import {
  clearProgress,
  loadProgress,
  progressKey,
  saveProgress,
  type ProgressStorage,
} from "../src/windpost/saves";
import {
  SAVE_KEY,
  initialState,
  reduceGame,
  serialize,
} from "../src/windpost/model";

const act = (
  ep: EpisodeFixture,
  state: EpisodeProgress,
  ...actions: EpisodeAction[]
) => actions.reduce((value, action) => reduceEpisode(ep, value, action), state);
function predict(
  ep: EpisodeFixture,
  state: EpisodeProgress,
  site: SiteId,
  value: number,
) {
  const binding = ep.scene.stations[site].prediction!;
  for (let index = 0; index < binding.values.length; index++) {
    if (state.inputs[site][binding.inputId] === value) return state;
    state = reduceEpisode(ep, state, { type: "adjust", mechanism: site });
  }
  throw new Error("Prediction was unreachable");
}
function solve(
  ep: EpisodeFixture,
  state: EpisodeProgress,
  site: SiteId,
  slot: Slot,
  estimate?: number,
) {
  state = act(
    ep,
    state,
    { type: site === "bridge" ? "talk-moss" : "talk-bea" },
    {
      type: "pickup",
      item: site === "bridge" ? "bridge-weight" : "lift-weight",
    },
    { type: "place", mechanism: site, slot },
  );
  if (estimate !== undefined) state = predict(ep, state, site, estimate);
  return reduceEpisode(ep, state, { type: "activate", mechanism: site });
}
function complete(ep: EpisodeFixture) {
  let state = solve(
    ep,
    initialProgress(ep),
    "bridge",
    2,
    ep.id === "minute-mail" ? 2 : undefined,
  );
  state = solve(ep, state, "lift", 3, ep.id === "minute-mail" ? -6 : undefined);
  return act(
    ep,
    state,
    { type: "pickup", item: "parcel" },
    { type: "deliver" },
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

describe("Reusable harbor episode fixtures", () => {
  it("rejects timing units that disagree with the physical instrument", () => {
    const prediction = structuredClone(MINUTE_MAIL_EPISODE);
    prediction.scene.stations.bridge.prediction!.unit = "km/h";
    expect(() => validateEpisodeFixture(prediction)).toThrow(
      /seconds and meters/,
    );
    const clock = structuredClone(MINUTE_MAIL_EPISODE);
    const config = stationConfig(clock, "bridge");
    const control = config.controls.find((entry) => entry.id === "time")!;
    if (control.kind !== "number") throw new Error("Expected clock");
    control.unit = "min";
    expect(() => validateEpisodeFixture(clock)).toThrow(/seconds and meters/);
  });
  it("accepts one objective with two ordered cases for both authored lessons", () => {
    expect(EPISODES.map((ep) => ep.id)).toEqual(["windpost", "minute-mail"]);
    for (const ep of EPISODES) {
      expect(ep.objectives).toHaveLength(1);
      expect(stationConfig(ep, "bridge").tasks).toHaveLength(2);
      expect(validateEpisodeFixture(ep)).toEqual(ep);
      expect(Object.isFrozen(ep.scene.stations.bridge)).toBe(true);
      expect(stationReading(ep, initialProgress(ep), "bridge").passed).toBe(
        false,
      );
    }
  });

  it("rejects missing task/control/source coverage and unsupported physical values", () => {
    const variants: ((ep: EpisodeFixture) => void)[] = [
      (ep) => {
        ep.scene.stations.lift.taskId = "bridge";
      },
      (ep) => {
        ep.scene.stations.bridge.puzzleId = "missing";
      },
      (ep) => {
        ep.objectives[0].sourceIds = ["missing"];
      },
      (ep) => {
        ep.scene.stations.bridge.socketValues = [1, 2, 4];
      },
      (ep) => {
        ep.scene.stations.bridge.readouts[0].unit = "kg";
      },
      (ep) => {
        ep.scene.stations.bridge.prediction!.values = [0, 2, 6];
      },
      (ep) => {
        ep.scene.stations.bridge.fixedInputs = { time: 1 };
      },
      (ep) => {
        const config = stationConfig(ep, "bridge");
        config.controls.push({
          id: "unbound",
          label: "Unbound dial",
          kind: "number",
          min: 0,
          max: 1,
          step: 1,
          unit: "x",
        });
        for (const task of config.tasks) {
          task.initialInputs.push({ id: "unbound", value: 0 });
          task.referenceInputs.push({ id: "unbound", value: 0 });
        }
      },
    ];
    for (const mutate of variants) {
      const copy = structuredClone(MINUTE_MAIL_EPISODE);
      mutate(copy);
      expect(() => validateEpisodeFixture(copy)).toThrow();
    }
  });

  it("rejects a valid simulation whose readings no longer fit the timing prefab", () => {
    const renamed = structuredClone(MINUTE_MAIL_EPISODE);
    const config = stationConfig(renamed, "bridge");
    for (const output of config.outputs) {
      if (output.id === "positionBefore") output.id = "earlier";
      for (const token of output.expression)
        if (token.op === "ref" && token.id === "positionBefore")
          token.id = "earlier";
    }
    expect(() => validateLessonMachineConfig(config)).not.toThrow();
    expect(() => validateEpisodeFixture(renamed)).toThrow(/positionBefore/);
    const changed = structuredClone(WINDPOST_EPISODE);
    for (const output of stationConfig(changed, "bridge").outputs)
      output.expression.push({ op: "literal", value: 2 }, { op: "mul" });
    expect(() =>
      validateLessonMachineConfig(stationConfig(changed, "bridge")),
    ).not.toThrow();
    expect(() => validateEpisodeFixture(changed)).toThrow(/visible beam/);
  });

  it("rejects direct and transitive prediction dependence in a replay trajectory", () => {
    for (const indirect of [false, true]) {
      const episode = structuredClone(MINUTE_MAIL_EPISODE);
      const config = stationConfig(episode, "bridge");
      // Zero at initial and reference predictions, so ordinary author witnesses still pass.
      const offset = [
        { op: "ref", id: "estimate" },
        { op: "ref", id: "estimate" },
        { op: "literal", value: 2 },
        { op: "sub" },
        { op: "mul" },
        { op: "ref", id: "estimate" },
        { op: "literal", value: 6 },
        { op: "add" },
        { op: "mul" },
        { op: "literal", value: 0.001 },
        { op: "mul" },
      ] satisfies (typeof config.outputs)[number]["expression"];
      const position = config.outputs.find(
        (output) => output.id === "position",
      )!;
      if (indirect) {
        config.outputs.unshift({
          id: "offset",
          label: "Offset",
          unit: "m",
          expression: offset,
          derivativeWrt: null,
        });
        position.expression.push({ op: "ref", id: "offset" }, { op: "add" });
      } else position.expression.push(...offset, { op: "add" });
      expect(() => validateLessonMachineConfig(config)).not.toThrow();
      expect(() => validateEpisodeFixture(episode)).toThrow(
        /replay trajectory/,
      );
    }
  });
});

describe("One quest runtime for both learning episodes", () => {
  it("completes both full quests on correct first attempts, with actual observations and no optional gates", () => {
    for (const ep of EPISODES) {
      const state = complete(ep);
      expect(state.delivered).toBe(true);
      expect(state.carrying).toBeNull();
      expect(state.trials).toHaveLength(2);
      expect(state.trials.every((trial) => trial.evidence.passed)).toBe(true);
      expect(state.postcards).toEqual([]);
      expect(state.discoveries).toEqual([]);
      expect(learningEvidence(ep, state).trials).toHaveLength(4);
      expect(learningStatus(ep, state)).toMatchObject({
        verified: true,
        baselineCount: 2,
        completedCases: 2,
      });
      expect(validateProgress(ep, state)).toEqual(state);
      expect(
        reduceEpisode(ep, state, { type: "retrieve", mechanism: "bridge" }),
      ).toBe(state);
    }
  });

  it("records the actual default window before an adjust-first intervention, once only", () => {
    const ep = MINUTE_MAIL_EPISODE;
    let state = act(
      ep,
      initialProgress(ep),
      { type: "talk-moss" },
      { type: "adjust", mechanism: "bridge" },
    );
    expect(state.inputs.bridge).toEqual({ time: 2, interval: 1, estimate: 2 });
    expect(simulation(state.observations.bridge).inputs).toEqual({
      time: 2,
      interval: 1,
      estimate: 0,
    });
    expect(simulation(state.observations.bridge).outputs.average).toBe(1);
    expect(state.trials).toHaveLength(0);
    const observed = state.observations.bridge;
    state = act(
      ep,
      state,
      { type: "pickup", item: "bridge-weight" },
      { type: "drop" },
      { type: "pickup", item: "bridge-weight" },
      { type: "place", mechanism: "bridge", slot: 2 },
      { type: "activate", mechanism: "bridge" },
    );
    expect(state.observations.bridge).toBe(observed);
    expect(state.bridgeOpen).toBe(true);
    expect(state.trials).toHaveLength(1);
  });

  it("uses signed backward position differences and an actual automatic derivative", () => {
    const ep = MINUTE_MAIL_EPISODE;
    const config = stationConfig(ep, "bridge");
    expect(
      evaluateSimulation(config, "bridge", {
        time: 2,
        interval: 0.1,
        estimate: 2,
      }),
    ).toMatchObject({ passed: true });
    const a = evaluateSimulation(config, "bridge", {
      time: 2,
      interval: 0.1,
      estimate: 2,
    }).outputs;
    expect(a.position).toBe(0);
    expect(a.positionBefore).toBeCloseTo(-0.19, 12);
    expect(a.average).toBeCloseTo(1.9, 12);
    expect(a.instantaneous).toBe(2);
    const b = evaluateSimulation(config, "lift", {
      time: 1,
      interval: 0.01,
      estimate: -6,
    }).outputs;
    expect(b.position).toBe(21);
    expect(b.positionBefore).toBeCloseTo(21.0597, 12);
    expect(b.average).toBeCloseTo(-5.97, 10);
    expect(b.instantaneous).toBe(-6);
    expect(b.average).not.toBe(b.instantaneous);
    expect(motionSample(ep, "bridge", 1)).toEqual({
      time: 1,
      position: -1,
      velocity: 0,
    });
    expect(motionSample(ep, "lift", 1)).toEqual({
      time: 1,
      position: 21,
      velocity: -6,
    });
    for (const time of [-1, 3, NaN, Infinity])
      expect(() => motionSample(ep, "lift", time)).toThrow(RangeError);
  });

  it("rejects the earlier window for the changed return case even with the correct signed prediction", () => {
    const ep = MINUTE_MAIL_EPISODE;
    let state = solve(ep, initialProgress(ep), "bridge", 2, 2);
    state = solve(ep, state, "lift", 2, 2);
    expect(state.liftRaised).toBe(false);
    state = predict(ep, state, "lift", -6);
    state = reduceEpisode(ep, state, { type: "activate", mechanism: "lift" });
    expect(state.liftRaised).toBe(false);
    expect(
      simulation(state.trials.at(-1)?.evidence).outputs.average,
    ).toBeCloseTo(-5.7, 12);
    state = act(
      ep,
      state,
      { type: "retrieve", mechanism: "lift" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
    );
    expect(state.liftRaised).toBe(true);
    expect(learningStatus(ep, state).verified).toBe(true);
  });

  it("retains baseline and successful evidence after bounded later failures", () => {
    const ep = MINUTE_MAIL_EPISODE;
    let state = solve(ep, initialProgress(ep), "bridge", 2, 2);
    state = act(
      ep,
      state,
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 2 },
    );
    for (let index = 0; index < 1000; index++)
      state = reduceEpisode(ep, state, { type: "activate", mechanism: "lift" });
    expect(state.trials).toHaveLength(HISTORY_LIMIT);
    expect(state.trials[0].evidence.passed).toBe(true);
    state = predict(ep, state, "lift", -6);
    state = act(
      ep,
      state,
      { type: "retrieve", mechanism: "lift" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
    );
    expect(learningEvidence(ep, state).trials.length).toBeLessThanOrEqual(200);
    expect(learningStatus(ep, state).verified).toBe(true);
    const storage = new MemoryStorage();
    saveProgress(ep, state, storage);
    expect(loadProgress(ep, storage)).toEqual(state);
  });

  it("preserves chronological evidence and rejects stale episodes and forged fixed clocks", () => {
    const ep = MINUTE_MAIL_EPISODE,
      state = complete(ep);
    const reversed = { ...state, trials: [...state.trials].reverse() };
    expect(
      learningEvidence(ep, reversed).trials.map(
        (trial) => simulation(trial).taskId,
      ),
    ).toEqual(["lift", "lift", "bridge", "bridge"]);
    expect(learningStatus(ep, reversed).verified).toBe(false);
    expect(() =>
      reduceEpisode(WINDPOST_EPISODE, state, { type: "hint" }),
    ).toThrow(/different episode/);
    const forged = structuredClone(state);
    forged.inputs.bridge.time = 1;
    forged.trials[0].evidence = simulationTrial(
      stationConfig(ep, "bridge"),
      "bridge",
      { time: 1, interval: 0.1, estimate: 0 },
    );
    expect(validateProgress(ep, forged)).toBeNull();
    expect(learningStatus(ep, forged).verified).toBe(false);
  });
});

describe("Isolated episode saves and honest legacy migration", () => {
  it("stores, loads and resets each episode independently", () => {
    const storage = new MemoryStorage();
    const wind = complete(WINDPOST_EPISODE),
      motion = complete(MINUTE_MAIL_EPISODE);
    saveProgress(WINDPOST_EPISODE, wind, storage);
    saveProgress(MINUTE_MAIL_EPISODE, motion, storage);
    expect(progressKey(WINDPOST_EPISODE)).not.toBe(
      progressKey(MINUTE_MAIL_EPISODE),
    );
    expect(loadProgress(WINDPOST_EPISODE, storage)).toEqual(wind);
    expect(loadProgress(MINUTE_MAIL_EPISODE, storage)).toEqual(motion);
    storage.setItem(SAVE_KEY, serialize(initialState()));
    clearProgress(MINUTE_MAIL_EPISODE, storage);
    expect(loadProgress(MINUTE_MAIL_EPISODE, storage)).toEqual(
      initialProgress(MINUTE_MAIL_EPISODE),
    );
    expect(loadProgress(WINDPOST_EPISODE, storage)).toEqual(wind);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    clearProgress(WINDPOST_EPISODE, storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("migrates v2 carry/solve evidence, writes the framework key and leaves the old key", () => {
    let old = initialState();
    for (const action of [
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
      { type: "place", mechanism: "bridge", slot: 2 },
      { type: "activate", mechanism: "bridge" },
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
    ] as const)
      old = reduceGame(old, action);
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, serialize(old));
    const migrated = loadProgress(WINDPOST_EPISODE, storage);
    expect(migrated.bridgeOpen).toBe(true);
    expect(migrated.carrying).toBe("lift-weight");
    expect(migrated.observations).toEqual(old.observations);
    expect(migrated.trials[0].evidence.passed).toBe(true);
    expect(storage.getItem(progressKey(WINDPOST_EPISODE))).not.toBeNull();
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(loadProgress(MINUTE_MAIL_EPISODE, storage)).toEqual(
      initialProgress(MINUTE_MAIL_EPISODE),
    );
  });

  it("preserves completed v1 history without manufacturing observed baselines", () => {
    let old = initialState();
    for (const action of [
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
      { type: "place", mechanism: "bridge", slot: 2 },
      { type: "activate", mechanism: "bridge" },
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    ] as const)
      old = reduceGame(old, action);
    const { observations, discoveries, postcardReturned, ...v1 } = old;
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: v1 }));
    const migrated = loadProgress(WINDPOST_EPISODE, storage);
    expect(migrated.delivered).toBe(true);
    expect(migrated.observations).toEqual({ bridge: null, lift: null });
    expect(learningStatus(WINDPOST_EPISODE, migrated)).toMatchObject({
      verified: false,
      status: "historical-progress",
      completedCases: 2,
    });
    expect(loadProgress(WINDPOST_EPISODE, storage)).toEqual(migrated);
  });

  it("rejects malformed, wrong-revision, and tampered saves without trusting completion flags", () => {
    const ep = MINUTE_MAIL_EPISODE,
      state = complete(ep),
      storage = new MemoryStorage();
    const corruptions: unknown[] = [
      { ...state, episodeId: "windpost" },
      { ...state, revision: 2 },
      { ...state, trials: [] },
      { ...state, carrying: "lift-weight" },
      { ...state, hints: 0.5 },
      { ...state, inputs: { bridge: [], lift: state.inputs.lift } },
      {
        ...state,
        inputs: {
          ...state.inputs,
          bridge: { ...state.inputs.bridge, uncontrolled: 1 },
        },
      },
      {
        ...state,
        observations: {
          ...state.observations,
          bridge: { ...state.observations.bridge!, outputs: { average: 0 } },
        },
      },
      {
        ...state,
        trials: state.trials.map((trial) => ({
          ...trial,
          evidence: {
            ...trial.evidence,
            outputs: { ...simulation(trial.evidence).outputs, average: 100 },
          },
        })),
      },
    ];
    for (const corrupted of corruptions) {
      storage.setItem(
        progressKey(ep),
        JSON.stringify({ version: 1, state: corrupted }),
      );
      expect(loadProgress(ep, storage)).toEqual(initialProgress(ep));
      expect(() =>
        saveProgress(ep, corrupted as EpisodeProgress, storage),
      ).toThrow(RangeError);
    }
    expect(loadProgress(ep, undefined as never)).toEqual(initialProgress(ep));
  });
});
