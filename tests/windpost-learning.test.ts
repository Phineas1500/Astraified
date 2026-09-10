import { describe, expect, it } from "vitest";
import {
  evaluateSimulation,
  validateLessonMachineConfig,
  verifyLessonMachineEvidence,
} from "../src/domain/lesson-machines";
import {
  WINDPOST_MACHINE,
  learningEvidence,
  learningStatus,
  socketInputs,
} from "../src/windpost/learning";
import {
  DISCOVERIES,
  HISTORY_LIMIT,
  WINDPOST_SOURCES,
  balance,
  deserialize,
  dialogueFor,
  discoveryReply,
  initialState,
  reduceGame,
  serialize,
  type GameAction,
  type WindpostState,
} from "../src/windpost/model";

const act = (state: WindpostState, ...actions: GameAction[]) =>
  actions.reduce(reduceGame, state);
const bridge = (state = initialState()) =>
  act(
    state,
    { type: "talk-moss" },
    { type: "pickup", item: "bridge-weight" },
    { type: "place", mechanism: "bridge", slot: 2 },
    { type: "activate", mechanism: "bridge" },
  );
const lift = (state = bridge()) =>
  act(
    state,
    { type: "talk-bea" },
    { type: "pickup", item: "lift-weight" },
    { type: "place", mechanism: "lift", slot: 3 },
    { type: "activate", mechanism: "lift" },
  );
const envelope = (state: unknown, version = 2) =>
  JSON.stringify({ version, state });
const legacy = (state: WindpostState) => {
  const { observations, discoveries, postcardReturned, ...oldState } = state;
  return envelope(oldState, 1);
};

describe("Windpost's shared learning machine and physical binding", () => {
  it("validates the authored two-case fixture and binds only physical socket values", () => {
    expect(validateLessonMachineConfig(WINDPOST_MACHINE)).toEqual(
      WINDPOST_MACHINE,
    );
    expect(Object.isFrozen(WINDPOST_MACHINE)).toBe(true);
    expect(Object.isFrozen(WINDPOST_MACHINE.tasks[0].constants)).toBe(true);
    expect(WINDPOST_MACHINE.tasks.map((task) => task.transfer)).toEqual([
      false,
      true,
    ]);
    for (const mechanism of ["bridge", "lift"] as const) {
      for (const slot of [null, 1, 2, 3] as const) {
        const physical = balance(mechanism, slot);
        const shared = evaluateSimulation(
          WINDPOST_MACHINE,
          mechanism,
          socketInputs(slot),
        );
        expect(shared.outputs).toEqual({
          leftTorque: physical.leftTorqueNm,
          rightTorque: physical.rightTorqueNm,
        });
        expect(shared.passed).toBe(physical.balanced);
      }
    }
    expect(balance("bridge", 2).leftTorqueNm).toBeCloseTo(4 * 9.81);
    expect(balance("lift", 3).leftTorqueNm).toBeCloseTo(6 * 9.81);
    expect(socketInputs(null)).toEqual({ distance: 0 });
    for (const value of [0, -1, 4, 1.5, NaN, Infinity, undefined, "2"])
      expect(() => socketInputs(value as never)).toThrow(RangeError);
  });

  it("verifies correct first attempts using real starting observations, without requiring mistakes", () => {
    const state = lift();
    expect(state.trials).toHaveLength(2);
    expect(state.trials.every((trial) => trial.balanced)).toBe(true);
    const evidence = learningEvidence(state);
    expect(evidence.trials.map((trial) => trial.taskId)).toEqual([
      "bridge",
      "bridge",
      "lift",
      "lift",
    ]);
    expect(evidence.trials.map((trial) => trial.inputs.distance)).toEqual([
      0, 2, 0, 3,
    ]);
    expect(evidence.trials.map((trial) => trial.passed)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    expect(verifyLessonMachineEvidence(WINDPOST_MACHINE, evidence)).toBe(true);
    expect(learningStatus(state)).toEqual({
      status: "verified",
      verified: true,
      baselineCount: 2,
      completedCases: 2,
      missingBaselines: [],
    });
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it("records one empty-beam observation on actual pickup and preserves it through drop and retry", () => {
    const untouched = initialState();
    const greeted = reduceGame(untouched, { type: "talk-moss" });
    expect(learningStatus(greeted).status).toBe("not-started");
    expect(greeted.observations.bridge).toBeNull();
    const carried = reduceGame(greeted, {
      type: "pickup",
      item: "bridge-weight",
    });
    expect(carried.observations.bridge).toEqual({
      taskId: "bridge",
      inputs: { distance: 0 },
      outputs: { leftTorque: 39.24, rightTorque: 0 },
      passed: false,
    });
    expect(carried.trials).toHaveLength(0);
    expect(carried.observations.lift).toBeNull();
    expect(greeted.observations.bridge).toBeNull();
    const carriedAgain = act(
      carried,
      { type: "drop" },
      { type: "pickup", item: "bridge-weight" },
    );
    expect(carriedAgain.observations.bridge).toBe(carried.observations.bridge);
    expect(learningEvidence(carriedAgain).trials).toHaveLength(1);
    expect(learningStatus(carriedAgain).verified).toBe(false);
  });

  it("distinguishes an actual empty crank attempt from its first observation", () => {
    const fresh = initialState();
    expect(reduceGame(fresh, { type: "activate", mechanism: "bridge" })).toBe(
      fresh,
    );
    const attempted = act(
      fresh,
      { type: "talk-moss" },
      { type: "activate", mechanism: "bridge" },
    );
    expect(attempted.trials).toHaveLength(1);
    expect(attempted.trials[0]).toMatchObject({ slot: null, balanced: false });
    expect(learningEvidence(attempted).trials).toHaveLength(2);
    const picked = reduceGame(attempted, {
      type: "pickup",
      item: "bridge-weight",
    });
    expect(picked.observations).toBe(attempted.observations);
    expect(picked.trials).toBe(attempted.trials);
  });

  it("requires a changed arm for the heavier case and replays the learner's failed intervention", () => {
    let state = act(
      bridge(),
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 2 },
      { type: "activate", mechanism: "lift" },
    );
    expect(state.liftRaised).toBe(false);
    expect(state.observations.lift?.outputs).toEqual({
      leftTorque: 58.86,
      rightTorque: 0,
    });
    expect(learningStatus(state).verified).toBe(false);
    state = act(
      state,
      { type: "retrieve", mechanism: "lift" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
    );
    expect(
      learningEvidence(state).trials.map((trial) => trial.inputs.distance),
    ).toEqual([0, 2, 0, 2, 3]);
    expect(learningStatus(state).verified).toBe(true);
  });

  it("does not repair altered readings, outcomes, or chronology before verification", () => {
    const state = lift();
    const corruptions: WindpostState[] = [
      { ...state, trials: [...state.trials].reverse() },
      {
        ...state,
        trials: state.trials.map((trial) => ({ ...trial, balanced: false })),
      },
      {
        ...state,
        trials: state.trials.map((trial) => ({ ...trial, leftTorqueNm: 1 })),
      },
      {
        ...state,
        observations: {
          ...state.observations,
          bridge: {
            ...state.observations.bridge!,
            outputs: { leftTorque: 0, rightTorque: 0 },
          },
        },
      },
      {
        ...state,
        observations: {
          ...state.observations,
          bridge: { ...state.observations.bridge!, inputs: { distance: 1 } },
        },
      },
      { ...state, observations: { ...state.observations, bridge: null } },
    ];
    for (const corrupted of corruptions)
      expect(learningStatus(corrupted).verified).toBe(false);
    expect(
      learningEvidence(corruptions[0]).trials.map((trial) => trial.taskId),
    ).toEqual(["lift", "lift", "bridge", "bridge"]);
    const evidence = learningEvidence(state);
    evidence.trials[0].outputs.leftTorque = 10;
    evidence.trials[1].inputs.distance = 1;
    expect(learningStatus(state).verified).toBe(true);
  });

  it("pins both observations and earlier successful attempts after a thousand later failures", () => {
    let state = act(
      bridge(),
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 2 },
    );
    const observations = state.observations;
    const success = state.trials[0];
    for (let index = 0; index < 1000; index++)
      state = reduceGame(state, { type: "activate", mechanism: "lift" });
    expect(state.trials).toHaveLength(HISTORY_LIMIT);
    expect(state.trials[0]).toEqual(success);
    expect(state.observations).toEqual(observations);
    state = act(
      deserialize(serialize(state)),
      { type: "retrieve", mechanism: "lift" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
    );
    const reloaded = deserialize(serialize(state));
    expect(reloaded).toEqual(state);
    expect(learningEvidence(reloaded).trials.length).toBeLessThanOrEqual(200);
    expect(learningStatus(reloaded).verified).toBe(true);
  });
});

describe("Windpost evidence persistence and old-save migration", () => {
  it("writes v2 and rejects malformed observed readings or impossible discovery/favor states", () => {
    const state = lift();
    expect(JSON.parse(serialize(state)).version).toBe(2);
    const baseline = state.observations.bridge!;
    const badObservations: unknown[] = [
      undefined,
      null,
      [],
      { ...baseline, taskId: "lift" },
      { ...baseline, passed: 0 },
      { ...baseline, passed: true },
      { ...baseline, inputs: { distance: 0.5 } },
      { ...baseline, inputs: { distance: 0, extra: 1 } },
      { ...baseline, outputs: { leftTorque: NaN, rightTorque: 0 } },
      { ...baseline, outputs: { leftTorque: 39.24, rightTorque: 1 } },
      { ...baseline, outputs: { leftTorque: 39.24 } },
      { ...baseline, extra: true },
    ];
    for (const bad of badObservations) {
      // null intentionally means unavailable history; it can never verify a completed case.
      if (bad === null) continue;
      const corrupted = {
        ...state,
        observations: { ...state.observations, bridge: bad },
      };
      expect(deserialize(envelope(corrupted))).toEqual(initialState());
      expect(() => serialize(corrupted as WindpostState)).toThrow(RangeError);
    }
    const corruptions: unknown[] = [
      { ...state, observations: null },
      { ...state, discoveries: ["invented"] },
      { ...state, discoveries: ["workshop-sketch", "workshop-sketch"] },
      { ...state, discoveries: null },
      { ...state, postcardReturned: 1 },
      { ...state, postcardReturned: true },
      { ...initialState(), discoveries: ["cargo-manifest"] },
      { ...initialState(), observations: state.observations },
    ];
    for (const bad of corruptions)
      expect(deserialize(envelope(bad))).toEqual(initialState());
  });

  it("preserves completed v1 quest progress but never invents historical observations", () => {
    const complete = act(
      lift(),
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    const migrated = deserialize(legacy(complete));
    expect(migrated.delivered).toBe(true);
    expect(migrated.bridgeOpen && migrated.liftRaised).toBe(true);
    expect(migrated.trials).toEqual(complete.trials);
    expect(migrated.observations).toEqual({ bridge: null, lift: null });
    expect(migrated.discoveries).toEqual([]);
    expect(migrated.postcardReturned).toBe(false);
    expect(learningEvidence(migrated).trials).toEqual([]);
    expect(learningStatus(migrated)).toMatchObject({
      verified: false,
      status: "historical-progress",
      baselineCount: 0,
      completedCases: 2,
      missingBaselines: ["bridge", "lift"],
    });
    expect(deserialize(serialize(migrated))).toEqual(migrated);
    // A v1 envelope cannot smuggle new-version observations into old history.
    expect(deserialize(envelope(complete, 1)).observations).toEqual({
      bridge: null,
      lift: null,
    });
  });

  it("migrates held and already-placed weights without retroactive observations or progression locks", () => {
    const held = act(
      initialState(),
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
    );
    const loadedHeld = deserialize(legacy(held));
    expect(loadedHeld.carrying).toBe("bridge-weight");
    expect(loadedHeld.observations.bridge).toBeNull();
    const emptyAttempt = reduceGame(loadedHeld, {
      type: "activate",
      mechanism: "bridge",
    });
    expect(emptyAttempt.observations.bridge).toBeNull();
    const placed = reduceGame(held, {
      type: "place",
      mechanism: "bridge",
      slot: 2,
    });
    const loadedPlaced = deserialize(legacy(placed));
    expect(loadedPlaced.bridgeSlot).toBe(2);
    const opened = reduceGame(loadedPlaced, {
      type: "activate",
      mechanism: "bridge",
    });
    expect(opened.bridgeOpen).toBe(true);
    expect(opened.observations.bridge).toBeNull();
    const complete = act(
      lift(opened),
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    expect(complete.delivered).toBe(true);
    expect(learningStatus(complete).verified).toBe(false);
    expect(learningStatus(complete).missingBaselines).toEqual(["bridge"]);
  });

  it("does not reinterpret old empty crank attempts as observed baselines", () => {
    const attempted = act(
      initialState(),
      { type: "talk-moss" },
      { type: "activate", mechanism: "bridge" },
    );
    const migrated = deserialize(legacy(attempted));
    const completed = lift(bridge(migrated));
    expect(completed.observations.bridge).toBeNull();
    expect(completed.trials[0].slot).toBeNull();
    expect(learningStatus(completed).verified).toBe(false);
  });
});

describe("Optional discoveries and the postcard favor", () => {
  it("keeps source-linked discoveries and the once-only favor independent of delivery", () => {
    const fresh = initialState();
    expect(reduceGame(fresh, { type: "return-postcard" })).toBe(fresh);
    expect(reduceGame(fresh, { type: "discover", id: "cargo-manifest" })).toBe(
      fresh,
    );
    const sketch = reduceGame(fresh, {
      type: "discover",
      id: "workshop-sketch",
    });
    expect(sketch.metMoss).toBe(false);
    expect(sketch.observations.bridge).toBeNull();
    expect(sketch.trials).toEqual([]);
    expect(
      reduceGame(sketch, { type: "discover", id: "workshop-sketch" }),
    ).toBe(sketch);
    expect(discoveryReply("moss", sketch)).toContain("sketch");
    let state = act(
      bridge(sketch),
      { type: "discover", id: "cargo-manifest" },
      { type: "postcard", id: "workshop" },
    );
    expect(reduceGame(state, { type: "return-postcard" })).toBe(state);
    state = act(state, { type: "talk-bea" }, { type: "return-postcard" });
    expect(state.postcardReturned).toBe(true);
    expect(state.postcards).toEqual(["workshop"]);
    expect(reduceGame(state, { type: "return-postcard" })).toBe(state);
    expect(discoveryReply("bea", state)).toContain("6 kg");
    expect(dialogueFor("bea", state).line).toContain("Moss's note");
    for (const discovery of Object.values(DISCOVERIES)) {
      expect(discovery.sourceIndices.length).toBeGreaterThan(0);
      for (const index of discovery.sourceIndices)
        expect(WINDPOST_SOURCES[index]).toBeDefined();
    }
    state = act(
      lift(state),
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    expect(state.delivered).toBe(true);
    expect(learningStatus(state).verified).toBe(true);
    expect(deserialize(serialize(state))).toEqual(state);
    const plain = act(
      lift(),
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    expect(plain.delivered).toBe(true);
    expect(plain.discoveries).toEqual([]);
    expect(plain.postcardReturned).toBe(false);
  });
});
