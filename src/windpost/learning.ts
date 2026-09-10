import {
  evaluateSimulation,
  simulationTrial,
  validateLessonMachineConfig,
  verifyLessonMachineEvidence,
  type SimulationConfig,
  type SimulationTrial,
} from "../domain/lesson-machines";
import type { MechanismId, Slot, WindpostState } from "./model";

export const G = 9.81;
export const COUNTERWEIGHT_KG = 2;
export const MECHANISMS = {
  bridge: { title: "Canal bridge", fixedMassKg: 4, fixedArmM: 1 },
  lift: { title: "Parcel lift", fixedMassKg: 6, fixedArmM: 1 },
} as const;
const MECHANISM_IDS: readonly MechanismId[] = ["bridge", "lift"];

const authoredMachine: SimulationConfig = {
  kind: "simulation",
  briefing:
    "Open a courier route by balancing two machines. Observe each unloaded beam, carry its 2 kg counterweight to a marked socket, and operate the mechanism.",
  modelNotes:
    "Horizontal, massless beams with hanging loads; g = 9.81 m/s² on both sides. Torque is mass × g × perpendicular arm in N·m. The pivot supports the beam. Equal torques release a fictional catch; the crank supplies motion. The lift changes the fixed load from 4 kg to 6 kg.",
  controls: [
    {
      id: "distance",
      label: "Counterweight arm",
      kind: "choice",
      options: [
        { label: "No attached counterweight", value: 0 },
        { label: "1 m socket", value: 1 },
        { label: "2 m socket", value: 2 },
        { label: "3 m socket", value: 3 },
      ],
    },
  ],
  outputs: [
    {
      id: "leftTorque",
      label: "Fixed load torque",
      unit: "N·m",
      expression: [
        { op: "ref", id: "fixedMass" },
        { op: "ref", id: "gravity" },
        { op: "mul" },
        { op: "ref", id: "fixedArm" },
        { op: "mul" },
      ],
      derivativeWrt: null,
    },
    {
      id: "rightTorque",
      label: "Counterweight torque",
      unit: "N·m",
      expression: [
        { op: "ref", id: "counterMass" },
        { op: "ref", id: "gravity" },
        { op: "mul" },
        { op: "ref", id: "distance" },
        { op: "mul" },
      ],
      derivativeWrt: null,
    },
  ],
  plots: [],
  tasks: MECHANISM_IDS.map((id) => ({
    id,
    title: MECHANISMS[id].title,
    prompt:
      id === "bridge"
        ? "Balance the 4 kg load at 1 m using the 2 kg counterweight, then try the bridge crank."
        : "The lift carries 6 kg at 1 m. Find the arm needed by another 2 kg counterweight, then try its lever.",
    constants: [
      { id: "fixedMass", value: MECHANISMS[id].fixedMassKg },
      { id: "fixedArm", value: MECHANISMS[id].fixedArmM },
      { id: "counterMass", value: COUNTERWEIGHT_KG },
      { id: "gravity", value: G },
    ],
    initialInputs: [{ id: "distance", value: 0 }],
    // Author validation only. Player evidence is assembled exclusively from observed events.
    referenceInputs: [{ id: "distance", value: id === "bridge" ? 2 : 3 }],
    goal: [
      { op: "ref", id: "leftTorque" },
      { op: "ref", id: "rightTorque" },
      { op: "sub" },
      { op: "abs" },
      { op: "literal", value: 1e-9 },
      { op: "lt" },
    ],
    successFeedback: "The opposing torques match. The catch releases.",
    failureFeedback:
      "The turning effects differ. Observe the dipping side and reconsider the counterweight's distance.",
    transfer: id === "lift",
  })),
};

function freezeTree<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

/** This world binds only this authored fixture, never arbitrary generated configurations. */
export const WINDPOST_MACHINE = freezeTree(
  validateLessonMachineConfig(authoredMachine) as SimulationConfig,
);

export function socketInputs(slot: Slot | null): { distance: number } {
  if (slot !== null && slot !== 1 && slot !== 2 && slot !== 3)
    throw new RangeError("Unknown counterweight socket");
  return { distance: slot ?? 0 };
}

export function measureMechanism(mechanism: MechanismId, slot: Slot | null) {
  return evaluateSimulation(WINDPOST_MACHINE, mechanism, socketInputs(slot));
}

/** Called only when a player encounters the actual empty mechanism before an attempt. */
export function observeMechanism(mechanism: MechanismId): SimulationTrial {
  return simulationTrial(WINDPOST_MACHINE, mechanism, socketInputs(null));
}

/** Stored readings are not recomputed here: verification must detect altered evidence. */
export function learningEvidence(state: WindpostState): {
  kind: "simulation";
  trials: SimulationTrial[];
} {
  const trials: SimulationTrial[] = [];
  const observed = new Set<MechanismId>();
  const addObservation = (mechanism: MechanismId) => {
    const observation = state.observations[mechanism];
    if (!observation || observed.has(mechanism)) return;
    trials.push({
      ...observation,
      inputs: { ...observation.inputs },
      outputs: { ...observation.outputs },
    });
    observed.add(mechanism);
  };
  for (const trial of state.trials) {
    // Legacy attempts without an observed baseline remain in the journal, not a proof.
    if (!state.observations[trial.mechanism]) continue;
    addObservation(trial.mechanism);
    trials.push({
      taskId: trial.mechanism,
      inputs: socketInputs(trial.slot),
      outputs: {
        leftTorque: trial.leftTorqueNm,
        rightTorque: trial.rightTorqueNm,
      },
      passed: trial.balanced,
    });
  }
  // A player can inspect the next empty machine without operating it yet.
  MECHANISM_IDS.forEach(addObservation);
  return { kind: "simulation", trials };
}

export function learningStatus(state: WindpostState): {
  verified: boolean;
  baselineCount: number;
  completedCases: number;
  missingBaselines: MechanismId[];
  status: "not-started" | "in-progress" | "verified" | "historical-progress";
} {
  const baselineCount = MECHANISM_IDS.filter(
    (id) => state.observations[id] !== null,
  ).length;
  const completedCases = Number(state.bridgeOpen) + Number(state.liftRaised);
  const missingBaselines = MECHANISM_IDS.filter(
    (id) =>
      !state.observations[id] &&
      state.trials.some((trial) => trial.mechanism === id),
  );
  const verified = verifyLessonMachineEvidence(
    WINDPOST_MACHINE,
    learningEvidence(state),
  );
  return {
    verified,
    baselineCount,
    completedCases,
    missingBaselines,
    status: verified
      ? "verified"
      : missingBaselines.length
        ? "historical-progress"
        : baselineCount || state.trials.length
          ? "in-progress"
          : "not-started",
  };
}
