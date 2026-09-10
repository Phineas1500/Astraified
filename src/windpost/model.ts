import type { SimulationTrial } from "../domain/lesson-machines";
import {
  COUNTERWEIGHT_KG,
  G,
  MECHANISMS,
  measureMechanism,
  observeMechanism,
} from "./learning";
import { discoveryReply, isDiscoveryId, type DiscoveryId } from "./discoveries";

export { COUNTERWEIGHT_KG, G, MECHANISMS } from "./learning";
export { DISCOVERIES, discoveryReply, type DiscoveryId } from "./discoveries";

/** Authored Windpost quest rules. Rendering, proximity and input live outside this module. */
export type MechanismId = "bridge" | "lift";
export type CarryItem = "bridge-weight" | "lift-weight" | "parcel";
export type Slot = 1 | 2 | 3;

export interface Trial {
  mechanism: MechanismId;
  slot: Slot | null;
  balanced: boolean;
  leftTorqueNm: number;
  rightTorqueNm: number;
  /** Hint count at the moment of the attempt, distinct from its outcome. */
  hints: number;
}

export interface WindpostState {
  metMoss: boolean;
  metBea: boolean;
  bridgeSlot: Slot | null;
  liftSlot: Slot | null;
  bridgeOpen: boolean;
  liftRaised: boolean;
  parcelCollected: boolean;
  delivered: boolean;
  carrying: CarryItem | null;
  postcards: string[];
  discoveries: DiscoveryId[];
  postcardReturned: boolean;
  /** Actual empty-beam encounters, kept independently of attempted crank operations. */
  observations: Record<MechanismId, SimulationTrial | null>;
  trials: Trial[];
  hints: number;
}

export type GameAction =
  | { type: "talk-moss" }
  | { type: "talk-bea" }
  | { type: "pickup"; item: CarryItem }
  | { type: "place"; mechanism: MechanismId; slot: Slot }
  | { type: "retrieve"; mechanism: MechanismId }
  | { type: "activate"; mechanism: MechanismId }
  | { type: "deliver" }
  | { type: "postcard"; id: string }
  | { type: "discover"; id: DiscoveryId }
  | { type: "return-postcard" }
  | { type: "hint" }
  | { type: "drop" };

export interface Balance {
  leftTorqueNm: number;
  rightTorqueNm: number;
  balanced: boolean;
  /** The side that would turn downward; left is the fixed load. */
  direction: "left" | "right" | "balanced";
}

export const SAVE_KEY = "astraified:windpost:authored-v1";
/** Plus two separately retained observations, below the shared verifier's 200-event limit. */
export const HISTORY_LIMIT = 100;
export const SLOTS: readonly Slot[] = [1, 2, 3];
export const POSTCARD_IDS = ["harbor", "workshop", "lookout"] as const;

export const WINDPOST_SOURCES = [
  {
    title: "OpenStax · University Physics Volume 1 · 10.6 Torque",
    url: "https://openstax.org/books/university-physics-volume-1/pages/10-6-torque",
    supports: "Torque is force times perpendicular lever arm, measured in N·m.",
  },
  {
    title:
      "OpenStax · University Physics Volume 1 · 12.2 Examples of Static Equilibrium",
    url: "https://openstax.org/books/university-physics-volume-1/pages/12-2-examples-of-static-equilibrium",
    supports: "Opposing torques balance about a pivot in static equilibrium.",
  },
] as const;

export const MODEL_ASSUMPTIONS = [
  "Masses hang from a horizontal, massless beam; marked distances are perpendicular lever arms.",
  "The beam's tilt illustrates which side dips. Torque is evaluated at the horizontal balance position, rather than simulated through the animation.",
  "Gravity is the same on both sides: g = 9.81 m/s². Weight force is mass × g, and torque is mass × g × arm length.",
  "Comparing mass × distance works here because the same g cancels; kg·m is not the torque unit.",
  "The pivot supplies the supporting force. Friction, beam deformation and moving-load dynamics are omitted.",
  "Balance releases a fictional safety catch; operating the crank supplies motion and latches the bridge or lift in place.",
  "Recorded attempts and hint use describe this playthrough, not measured mastery or long-term learning.",
] as const;

const isMechanism = (value: unknown): value is MechanismId =>
  value === "bridge" || value === "lift";
const isSlot = (value: unknown): value is Slot =>
  value === 1 || value === 2 || value === 3;
const isNullableSlot = (value: unknown): value is Slot | null =>
  value === null || isSlot(value);
const isCarryItem = (value: unknown): value is CarryItem =>
  value === "bridge-weight" || value === "lift-weight" || value === "parcel";
const isHintCount = (value: unknown): value is number =>
  Number.isInteger(value) &&
  typeof value === "number" &&
  value >= 0 &&
  value <= 999;
const weightFor = (mechanism: MechanismId): CarryItem =>
  mechanism === "bridge" ? "bridge-weight" : "lift-weight";
const slotFor = (state: WindpostState, mechanism: MechanismId): Slot | null =>
  mechanism === "bridge" ? state.bridgeSlot : state.liftSlot;
const locked = (state: WindpostState, mechanism: MechanismId): boolean =>
  mechanism === "bridge" ? state.bridgeOpen : state.liftRaised;
const available = (state: WindpostState, mechanism: MechanismId): boolean =>
  state.metMoss &&
  (mechanism === "bridge" || (state.bridgeOpen && state.metBea));

/** Horizontal-beam gravitational torque magnitude, in N·m. */
export function torqueNm(massKg: number, leverArmM: number): number {
  if (
    !Number.isFinite(massKg) ||
    massKg < 0 ||
    !Number.isFinite(leverArmM) ||
    leverArmM < 0
  ) {
    throw new RangeError("Mass and lever arm must be finite and nonnegative");
  }
  const result = massKg * G * leverArmM;
  if (!Number.isFinite(result))
    throw new RangeError("Torque exceeds the numeric range");
  return result;
}

export function balance(mechanism: MechanismId, slot: Slot | null): Balance {
  if (!isMechanism(mechanism) || !isNullableSlot(slot)) {
    throw new RangeError("Unknown mechanism or counterweight socket");
  }
  const reading = measureMechanism(mechanism, slot);
  const leftTorqueNm = reading.outputs.leftTorque;
  const rightTorqueNm = reading.outputs.rightTorque;
  const balanced = reading.passed;
  return {
    leftTorqueNm,
    rightTorqueNm,
    balanced,
    direction: balanced
      ? "balanced"
      : leftTorqueNm > rightTorqueNm
        ? "left"
        : "right",
  };
}

export function initialState(): WindpostState {
  return {
    metMoss: false,
    metBea: false,
    bridgeSlot: null,
    liftSlot: null,
    bridgeOpen: false,
    liftRaised: false,
    parcelCollected: false,
    delivered: false,
    carrying: null,
    postcards: [],
    discoveries: [],
    postcardReturned: false,
    observations: { bridge: null, lift: null },
    trials: [],
    hints: 0,
  };
}

function appendTrial(trials: readonly Trial[], trial: Trial): Trial[] {
  const next = [...trials, trial];
  // A latch's successful attempt is durable evidence even after a long later puzzle.
  while (next.length > HISTORY_LIMIT) {
    const oldestFailure = next.findIndex((entry) => !entry.balanced);
    if (oldestFailure === -1) break;
    next.splice(oldestFailure, 1);
  }
  return next;
}

function observeInitial(
  state: WindpostState,
  mechanism: MechanismId,
): WindpostState {
  if (
    state.observations[mechanism] ||
    slotFor(state, mechanism) !== null ||
    state.carrying === weightFor(mechanism) ||
    state.trials.some((trial) => trial.mechanism === mechanism)
  )
    return state;
  return {
    ...state,
    observations: {
      ...state.observations,
      [mechanism]: observeMechanism(mechanism),
    },
  };
}

/** Invalid or unavailable interactions are harmless no-ops. */
export function reduceGame(
  state: WindpostState,
  action: GameAction,
): WindpostState {
  if (!action || typeof action !== "object") return state;
  switch (action.type) {
    case "talk-moss":
      return state.metMoss ? state : { ...state, metMoss: true };
    case "talk-bea":
      return !state.bridgeOpen || state.metBea
        ? state
        : { ...state, metBea: true };
    case "pickup": {
      if (state.carrying || state.delivered || !isCarryItem(action.item))
        return state;
      if (action.item === "parcel") {
        return state.liftRaised && !state.parcelCollected
          ? { ...state, carrying: "parcel", parcelCollected: true }
          : state;
      }
      const mechanism = action.item === "bridge-weight" ? "bridge" : "lift";
      return available(state, mechanism) &&
        !locked(state, mechanism) &&
        slotFor(state, mechanism) === null
        ? { ...observeInitial(state, mechanism), carrying: action.item }
        : state;
    }
    case "place": {
      if (!isMechanism(action.mechanism) || !isSlot(action.slot)) return state;
      const mechanism = action.mechanism;
      if (
        !available(state, mechanism) ||
        locked(state, mechanism) ||
        state.carrying !== weightFor(mechanism) ||
        slotFor(state, mechanism) !== null
      )
        return state;
      return mechanism === "bridge"
        ? { ...state, bridgeSlot: action.slot, carrying: null }
        : { ...state, liftSlot: action.slot, carrying: null };
    }
    case "retrieve": {
      if (!isMechanism(action.mechanism)) return state;
      const mechanism = action.mechanism;
      if (
        !available(state, mechanism) ||
        locked(state, mechanism) ||
        state.carrying ||
        slotFor(state, mechanism) === null
      )
        return state;
      return mechanism === "bridge"
        ? { ...state, bridgeSlot: null, carrying: "bridge-weight" }
        : { ...state, liftSlot: null, carrying: "lift-weight" };
    }
    case "activate": {
      if (!isMechanism(action.mechanism)) return state;
      const mechanism = action.mechanism;
      if (!available(state, mechanism) || locked(state, mechanism))
        return state;
      const slot = slotFor(state, mechanism);
      const measurement = balance(mechanism, slot);
      const trial: Trial = {
        mechanism,
        slot,
        balanced: measurement.balanced,
        leftTorqueNm: measurement.leftTorqueNm,
        rightTorqueNm: measurement.rightTorqueNm,
        hints: state.hints,
      };
      return {
        ...observeInitial(state, mechanism),
        trials: appendTrial(state.trials, trial),
        bridgeOpen:
          state.bridgeOpen || (mechanism === "bridge" && measurement.balanced),
        liftRaised:
          state.liftRaised || (mechanism === "lift" && measurement.balanced),
      };
    }
    case "deliver":
      return state.carrying === "parcel" &&
        state.parcelCollected &&
        state.liftRaised &&
        !state.delivered
        ? { ...state, carrying: null, delivered: true }
        : state;
    case "postcard":
      return POSTCARD_IDS.some((id) => id === action.id) &&
        !state.postcards.includes(action.id)
        ? { ...state, postcards: [...state.postcards, action.id] }
        : state;
    case "discover":
      return isDiscoveryId(action.id) &&
        !state.discoveries.includes(action.id) &&
        (action.id !== "cargo-manifest" || state.bridgeOpen)
        ? { ...state, discoveries: [...state.discoveries, action.id] }
        : state;
    case "return-postcard":
      return state.metBea &&
        state.postcards.includes("workshop") &&
        !state.postcardReturned
        ? { ...state, postcardReturned: true }
        : state;
    case "hint":
      return { ...state, hints: Math.min(999, state.hints + 1) };
    case "drop":
      return state.carrying
        ? {
            ...state,
            carrying: null,
            parcelCollected:
              state.carrying === "parcel" ? false : state.parcelCollected,
          }
        : state;
    default:
      return state;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatedState(value: unknown, legacy = false): WindpostState | null {
  if (!record(value)) return null;
  const bools = [
    "metMoss",
    "metBea",
    "bridgeOpen",
    "liftRaised",
    "parcelCollected",
    "delivered",
  ] as const;
  if (
    !bools.every((key) => typeof value[key] === "boolean") ||
    !isNullableSlot(value.bridgeSlot) ||
    !isNullableSlot(value.liftSlot) ||
    !(value.carrying === null || isCarryItem(value.carrying)) ||
    !isHintCount(value.hints)
  )
    return null;
  if (
    !Array.isArray(value.postcards) ||
    value.postcards.length > POSTCARD_IDS.length ||
    new Set(value.postcards).size !== value.postcards.length ||
    !value.postcards.every((id) => POSTCARD_IDS.some((known) => known === id))
  )
    return null;
  if (!Array.isArray(value.trials) || value.trials.length > HISTORY_LIMIT)
    return null;

  const observations: WindpostState["observations"] = {
    bridge: null,
    lift: null,
  };
  let discoveries: DiscoveryId[] = [];
  let postcardReturned = false;
  if (!legacy) {
    if (
      !record(value.observations) ||
      Object.keys(value.observations).length !== 2 ||
      !Array.isArray(value.discoveries) ||
      value.discoveries.length > 2 ||
      !value.discoveries.every(isDiscoveryId) ||
      new Set(value.discoveries).size !== value.discoveries.length ||
      typeof value.postcardReturned !== "boolean"
    )
      return null;
    discoveries = [...value.discoveries];
    postcardReturned = value.postcardReturned;
    for (const mechanism of ["bridge", "lift"] as const) {
      const observation = value.observations[mechanism];
      if (observation === null) continue;
      const measured = observeMechanism(mechanism);
      if (
        !record(observation) ||
        Object.keys(observation).length !== 4 ||
        observation.taskId !== mechanism ||
        observation.passed !== false ||
        !record(observation.inputs) ||
        Object.keys(observation.inputs).length !== 1 ||
        observation.inputs.distance !== 0 ||
        !record(observation.outputs) ||
        Object.keys(observation.outputs).length !== 2 ||
        observation.outputs.leftTorque !== measured.outputs.leftTorque ||
        observation.outputs.rightTorque !== measured.outputs.rightTorque
      )
        return null;
      observations[mechanism] = measured;
    }
  }

  let bridgeEvidence = false;
  let liftEvidence = false;
  let previousHints = 0;
  const trials: Trial[] = [];
  for (const entry of value.trials) {
    if (
      !record(entry) ||
      !isMechanism(entry.mechanism) ||
      !isNullableSlot(entry.slot) ||
      typeof entry.balanced !== "boolean" ||
      !isHintCount(entry.hints) ||
      entry.hints > value.hints ||
      entry.hints < previousHints
    )
      return null;
    const measured = balance(entry.mechanism, entry.slot);
    if (
      entry.balanced !== measured.balanced ||
      entry.leftTorqueNm !== measured.leftTorqueNm ||
      entry.rightTorqueNm !== measured.rightTorqueNm
    )
      return null;
    if (entry.mechanism === "bridge") {
      if (bridgeEvidence) return null;
      bridgeEvidence = entry.balanced;
    } else {
      if (!bridgeEvidence || liftEvidence) return null;
      liftEvidence = entry.balanced;
    }
    previousHints = entry.hints;
    trials.push({
      mechanism: entry.mechanism,
      slot: entry.slot,
      balanced: entry.balanced,
      leftTorqueNm: measured.leftTorqueNm,
      rightTorqueNm: measured.rightTorqueNm,
      hints: entry.hints,
    });
  }

  const state: WindpostState = {
    metMoss: value.metMoss as boolean,
    metBea: value.metBea as boolean,
    bridgeSlot: value.bridgeSlot,
    liftSlot: value.liftSlot,
    bridgeOpen: value.bridgeOpen as boolean,
    liftRaised: value.liftRaised as boolean,
    parcelCollected: value.parcelCollected as boolean,
    delivered: value.delivered as boolean,
    carrying: value.carrying,
    postcards: [...value.postcards],
    observations,
    discoveries,
    postcardReturned,
    trials,
    hints: value.hints,
  };
  if (state.bridgeOpen !== bridgeEvidence || state.liftRaised !== liftEvidence)
    return null;
  if (state.bridgeOpen && state.bridgeSlot !== 2) return null;
  if (state.liftRaised && state.liftSlot !== 3) return null;
  if (state.metBea && !state.bridgeOpen) return null;
  if (state.observations.bridge && !state.metMoss) return null;
  if (state.observations.lift && !state.metBea) return null;
  if (state.discoveries.includes("cargo-manifest") && !state.bridgeOpen)
    return null;
  if (
    state.postcardReturned &&
    (!state.metBea || !state.postcards.includes("workshop"))
  )
    return null;
  if (
    !state.metMoss &&
    (state.metBea ||
      state.bridgeSlot !== null ||
      state.liftSlot !== null ||
      state.carrying !== null ||
      state.trials.length > 0)
  )
    return null;
  if (
    !state.metBea &&
    (state.liftSlot !== null ||
      state.carrying === "lift-weight" ||
      state.trials.some((trial) => trial.mechanism === "lift"))
  )
    return null;
  if (
    state.carrying === "bridge-weight" &&
    (state.bridgeSlot !== null || state.bridgeOpen)
  )
    return null;
  if (
    state.carrying === "lift-weight" &&
    (state.liftSlot !== null || state.liftRaised)
  )
    return null;
  if (
    state.parcelCollected !== (state.carrying === "parcel" || state.delivered)
  )
    return null;
  if ((state.parcelCollected || state.delivered) && !state.liftRaised)
    return null;
  if (state.delivered && state.carrying !== null) return null;
  return state;
}

/** Persist only this authored game. This format does not share the generation pipeline's saves. */
export function serialize(state: WindpostState): string {
  const validated = validatedState(state);
  if (!validated)
    throw new RangeError("Cannot save inconsistent Windpost progress");
  return JSON.stringify({ version: 2, state: validated });
}

/** Version 1 keeps its quest progress, but cannot supply observations it never recorded. */
export function deserialize(raw: string | null | undefined): WindpostState {
  if (typeof raw !== "string" || !raw || raw.length > 100_000)
    return initialState();
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || (envelope.version !== 1 && envelope.version !== 2))
      return initialState();
    return (
      validatedState(envelope.state, envelope.version === 1) ?? initialState()
    );
  } catch {
    return initialState();
  }
}

export function questGoal(state: WindpostState): string {
  if (state.delivered)
    return "Delivery complete. Stay a little longer and find the island's three postcards.";
  if (!state.metMoss) return "Find Moss by the canal bridge and say hello.";
  if (!state.bridgeOpen)
    return "Carry the brass counterweight to a bridge socket, then try the crank.";
  if (!state.metBea)
    return "Cross your newly opened bridge and meet Bea at Windpost.";
  if (!state.liftRaised)
    return "Use the second counterweight to balance the heavier parcel lift, then pull its lever.";
  if (!state.parcelCollected)
    return "Collect the mail parcel from the raised lift.";
  return "Carry the parcel back across the bridge to Moss.";
}

export function dialogueFor(
  npc: "moss" | "bea",
  state: WindpostState,
): { speaker: string; line: string } {
  if (npc === "moss") {
    if (state.delivered)
      return {
        speaker: "Moss",
        line: "The weather charts! Just in time. You brought the whole harbor a little closer today. Those postcards are yours to find, if you'd like to linger.",
      };
    if (state.carrying === "parcel")
      return {
        speaker: "Moss",
        line: "That's our parcel! Bring it here. The bridge will stay open for the next courier, too.",
      };
    if (!state.metMoss)
      return {
        speaker: "Moss",
        line: "Morning, courier! Bea has our mail across the canal, but this bridge is stuck. That little brass weight might do the work of a bigger one—if you give it room.",
      };
    if (!state.bridgeOpen)
      return {
        speaker: "Moss",
        line: state.trials.some((trial) => trial.mechanism === "bridge")
          ? "The catch is still holding. Watch which side dips: the greater torque turns that side down. You can take the weight back and try another socket."
          : (discoveryReply("moss", state) ??
            "The fixed load is 4 kg, one meter from the pivot. Your weight is only 2 kg. Choose a socket, watch which side dips, and try the crank when both sides balance."),
      };
    return {
      speaker: "Moss",
      line: "Beautiful! The catch holds the bridge open now. Follow the path to Bea and bring back the parcel. I'll keep the kettle on.",
    };
  }
  if (!state.bridgeOpen)
    return {
      speaker: "Bea",
      line: "Windpost is across the canal. Find Moss to get the bridge open first.",
    };
  if (state.postcardReturned)
    return {
      speaker: "Bea",
      line: `Moss's note! Thank you for showing it to me. Keep the postcard for your collection. ${state.delivered ? "And thank you for getting our mail home." : state.liftRaised ? "The parcel is ready for Moss." : "Now, let's get that heavier parcel lift balanced."}`,
    };
  if (state.delivered)
    return {
      speaker: "Bea",
      line: "A completed delivery and an open route. That's a good day's work for a courier.",
    };
  if (state.liftRaised)
    return {
      speaker: "Bea",
      line: "There we go! Take the parcel from the lift and bring it home to Moss. A longer arm let the same small weight balance a heavier load.",
    };
  return {
    speaker: "Bea",
    line: state.trials.some((trial) => trial.mechanism === "lift")
      ? "Still held by the catch? Our 6 kg load turns harder than the bridge's 4 kg load at the same distance. You can move your 2 kg weight and try again."
      : (discoveryReply("bea", state) ??
        "Moss sent you? Perfect. Our parcel lift has a 6 kg load one meter from its pivot, but only another 2 kg counterweight. Will the bridge's arrangement still work here?"),
  };
}

export function hintFor(state: WindpostState): string {
  if (!state.metMoss)
    return "Moss is waiting beside the canal bridge. Walk over and talk.";
  if (state.delivered)
    return "Look for the three postcards around the harbor, workshop and lookout.";
  if (state.liftRaised)
    return state.parcelCollected
      ? "Moss is back on the first island. The bridge stays open for your return."
      : "The raised lift holds the mail parcel. Collect it with empty hands.";
  if (state.bridgeOpen && !state.metBea)
    return "Cross the bridge and find Bea by the parcel lift.";
  const mechanism: MechanismId = state.bridgeOpen ? "lift" : "bridge";
  const attempted = state.trials.filter(
    (trial) => trial.mechanism === mechanism,
  );
  const startHints =
    mechanism === "bridge"
      ? 0
      : (state.trials.find(
          (trial) => trial.mechanism === "bridge" && trial.balanced,
        )?.hints ?? 0);
  const level = Math.max(1, state.hints - startHints);
  if (level <= 1)
    return "Watch the beam: the side with the larger turning effect dips. Carrying the same weight farther from the pivot increases its effect.";
  if (level === 2)
    return "Compare mass × distance on both sides. Gravity is the same, so it cancels when checking whether the two torques match.";
  const socket = mechanism === "bridge" ? 2 : 3;
  return `${attempted.length ? "Try" : "Place the weight at"} the ${socket} m socket, then operate the ${mechanism === "bridge" ? "crank" : "lever"}. ${COUNTERWEIGHT_KG} × ${socket} matches ${MECHANISMS[mechanism].fixedMassKg} × 1.`;
}
