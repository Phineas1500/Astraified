import {
  evaluateSimulation,
  evidenceTrial,
  simulationInputs,
  simulationTrial,
  verifyLessonMachineEvidence,
  type SimulationInputs,
  type SimulationTrial,
  type EvidenceTrial,
  type LessonMachineEvidence,
} from "../domain/lesson-machines";
import {
  stationConfig,
  stationMachine,
  stationRound,
  type EpisodeFixture,
  type SiteId,
  type NpcId,
  type Slot,
  type QuestPhase,
} from "./episodes";

export type { SiteId, Slot, NpcId } from "./episodes";
export type CarryItem =
  "bridge-weight" | "lift-weight" | "parcel" | `evidence:${SiteId}:${string}`;
export type RecordedTrial = SimulationTrial | EvidenceTrial;
export const isSimulationTrial = (
  trial: RecordedTrial,
): trial is SimulationTrial => "taskId" in trial;
export interface EpisodeTrial {
  mechanism: SiteId;
  evidence: RecordedTrial;
  hints: number;
}
export interface EpisodeProgress {
  episodeId: string;
  revision: number;
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
  discoveries: string[];
  postcardReturned: boolean;
  hints: number;
  inputs: Record<SiteId, SimulationInputs>;
  assignments: Record<SiteId, (string | null)[]>;
  observations: Record<SiteId, RecordedTrial | null>;
  trials: EpisodeTrial[];
}
export type EpisodeAction =
  | { type: "talk-moss" }
  | { type: "talk-bea" }
  | { type: "pickup"; item: CarryItem }
  | { type: "place"; mechanism: SiteId; slot: Slot }
  | { type: "retrieve"; mechanism: SiteId }
  | { type: "activate"; mechanism: SiteId }
  | { type: "adjust"; mechanism: SiteId }
  | { type: "pickup-card"; mechanism: SiteId; cardId: string }
  | { type: "place-card"; mechanism: SiteId; slotId: string }
  | { type: "retrieve-card"; mechanism: SiteId; cardId: string }
  | { type: "deliver" }
  | { type: "postcard"; id: string }
  | { type: "discover"; id: string }
  | { type: "return-postcard" }
  | { type: "hint" }
  | { type: "drop" };

export const HISTORY_LIMIT = 100;
export const SITES: readonly SiteId[] = ["bridge", "lift"];
export const SLOTS: readonly Slot[] = [1, 2, 3];
const siteId = (value: unknown): value is SiteId =>
  value === "bridge" || value === "lift";
const slotValue = (value: unknown): value is Slot =>
  value === 1 || value === 2 || value === 3;
const carryValue = (value: unknown): value is CarryItem =>
  value === "bridge-weight" ||
  value === "lift-weight" ||
  value === "parcel" ||
  (typeof value === "string" &&
    /^evidence:(bridge|lift):[a-zA-Z][a-zA-Z0-9_-]*$/.test(value));
export function evidenceItem(site: SiteId, cardId: string): CarryItem {
  if (!siteId(site) || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cardId))
    throw new RangeError("Invalid evidence item");
  return `evidence:${site}:${cardId}`;
}
export function carriedEvidence(
  state: Pick<EpisodeProgress, "carrying">,
): { site: SiteId; cardId: string } | null {
  if (!state.carrying?.startsWith("evidence:")) return null;
  const [, site, cardId] = state.carrying.split(":");
  return siteId(site) && cardId ? { site, cardId } : null;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hintCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 999;
const slotFor = (state: EpisodeProgress, site: SiteId) =>
  site === "bridge" ? state.bridgeSlot : state.liftSlot;
const locked = (state: EpisodeProgress, site: SiteId) =>
  site === "bridge" ? state.bridgeOpen : state.liftRaised;
const available = (state: EpisodeProgress, site: SiteId) =>
  state.metMoss && (site === "bridge" || (state.bridgeOpen && state.metBea));
const itemFor = (site: SiteId): CarryItem =>
  site === "bridge" ? "bridge-weight" : "lift-weight";
const sameNumbers = (a: unknown, b: SimulationInputs): boolean =>
  record(a) &&
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(b).every(
    ([key, value]) => Object.hasOwn(a, key) && a[key] === value,
  );
function matchesEpisode(episode: EpisodeFixture, state: EpisodeProgress) {
  if (state.episodeId !== episode.id || state.revision !== episode.revision)
    throw new RangeError("Progress belongs to a different episode or revision");
}
function initialInputs(episode: EpisodeFixture, site: SiteId) {
  if (stationMachine(episode, site).kind === "evidence") return {};
  return simulationInputs(
    stationConfig(episode, site),
    episode.scene.stations[site].taskId,
  );
}

export function initialProgress(episode: EpisodeFixture): EpisodeProgress {
  return {
    episodeId: episode.id,
    revision: episode.revision,
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
    hints: 0,
    inputs: {
      bridge: initialInputs(episode, "bridge"),
      lift: initialInputs(episode, "lift"),
    },
    assignments: {
      bridge: initialAssignment(episode, "bridge"),
      lift: initialAssignment(episode, "lift"),
    },
    observations: { bridge: null, lift: null },
    trials: [],
  };
}
function initialAssignment(
  episode: EpisodeFixture,
  site: SiteId,
): (string | null)[] {
  return stationMachine(episode, site).kind === "evidence"
    ? stationRound(episode, site).cards.map(() => null)
    : [];
}
function currentTrial(
  episode: EpisodeFixture,
  state: EpisodeProgress,
  site: SiteId,
): RecordedTrial {
  const config = stationMachine(episode, site),
    id = episode.scene.stations[site].taskId;
  return config.kind === "simulation"
    ? simulationTrial(config, id, state.inputs[site])
    : evidenceTrial(config, id, state.assignments[site]);
}

export function stationReading(
  episode: EpisodeFixture,
  state: EpisodeProgress,
  site: SiteId,
): {
  kind: "simulation" | "evidence";
  inputs: SimulationInputs;
  outputs: Record<string, number>;
  passed: boolean;
  assignment?: (string | null)[];
} {
  matchesEpisode(episode, state);
  if (!siteId(site)) throw new RangeError("Unknown harbor station");
  const inputs = state.inputs[site];
  const trial = currentTrial(episode, state, site);
  if (!isSimulationTrial(trial))
    return {
      kind: "evidence",
      inputs: {},
      outputs: {},
      passed: trial.passed,
      assignment: [...trial.assignment],
    };
  return {
    kind: "simulation",
    inputs: { ...inputs },
    ...evaluateSimulation(
      stationConfig(episode, site),
      episode.scene.stations[site].taskId,
      inputs,
    ),
  };
}

/** Render sampling uses the same position and derivative expressions as the lesson. */
export function motionSample(
  episode: EpisodeFixture,
  site: SiteId,
  time: number,
): { time: number; position: number; velocity: number } {
  const station = episode.scene.stations[site];
  const motion = station.motion;
  if (
    !motion ||
    !Number.isFinite(time) ||
    time < motion.timeMin ||
    time > motion.timeMax
  )
    throw new RangeError("Motion sample is outside this station's domain");
  const config = stationConfig(episode, site);
  const clock = config.controls.find(
    (control) => control.id === motion.timeInput,
  );
  if (clock?.kind !== "number")
    throw new RangeError("Motion clock is not bound");
  // Only animated sampling is quantized to the declared clock step; trial inputs/readings are untouched.
  const sampledTime =
    clock.min + Math.round((time - clock.min) / clock.step) * clock.step;
  const reading = evaluateSimulation(config, station.taskId, {
    ...initialInputs(episode, site),
    [clock.id]: sampledTime,
  });
  return {
    time: sampledTime,
    position: reading.outputs[motion.positionOutput],
    velocity: reading.outputs[motion.velocityOutput],
  };
}

function observeInitial(
  episode: EpisodeFixture,
  state: EpisodeProgress,
  site: SiteId,
): EpisodeProgress {
  if (
    state.observations[site] ||
    slotFor(state, site) !== null ||
    state.carrying === itemFor(site) ||
    state.trials.some((trial) => trial.mechanism === site) ||
    state.assignments[site].some((slot) => slot !== null) ||
    carriedEvidence(state)?.site === site ||
    !sameNumbers(state.inputs[site], initialInputs(episode, site))
  )
    return state;
  return {
    ...state,
    observations: {
      ...state.observations,
      [site]: currentTrial(episode, state, site),
    },
  };
}
function appendTrial(
  trials: readonly EpisodeTrial[],
  trial: EpisodeTrial,
): EpisodeTrial[] {
  const next = [...trials, trial];
  while (next.length > HISTORY_LIMIT) {
    const failure = next.findIndex((entry) => !entry.evidence.passed);
    if (failure < 0) break;
    next.splice(failure, 1);
  }
  return next;
}

/** The same small quest runtime drives both fixtures; effects depend on replayed goals. */
export function reduceEpisode(
  episode: EpisodeFixture,
  state: EpisodeProgress,
  action: EpisodeAction,
): EpisodeProgress {
  matchesEpisode(episode, state);
  if (!action || typeof action !== "object") return state;
  switch (action.type) {
    case "talk-moss":
      return state.metMoss ? state : { ...state, metMoss: true };
    case "talk-bea":
      return !state.bridgeOpen || state.metBea
        ? state
        : { ...state, metBea: true };
    case "pickup": {
      if (state.carrying || state.delivered || !carryValue(action.item))
        return state;
      if (action.item === "parcel")
        return state.liftRaised && !state.parcelCollected
          ? { ...state, carrying: "parcel", parcelCollected: true }
          : state;
      const site = action.item === "bridge-weight" ? "bridge" : "lift";
      if (action.item !== "bridge-weight" && action.item !== "lift-weight")
        return state;
      if (episode.scene.stations[site].kind === "evidence-crates") return state;
      if (
        !available(state, site) ||
        locked(state, site) ||
        slotFor(state, site) !== null
      )
        return state;
      return { ...observeInitial(episode, state, site), carrying: action.item };
    }
    case "place": {
      if (!siteId(action.mechanism) || !slotValue(action.slot)) return state;
      const site = action.mechanism;
      if (
        !available(state, site) ||
        locked(state, site) ||
        state.carrying !== itemFor(site) ||
        slotFor(state, site) !== null
      )
        return state;
      const station = episode.scene.stations[site];
      if (station.kind === "evidence-crates") return state;
      return {
        ...state,
        [site === "bridge" ? "bridgeSlot" : "liftSlot"]: action.slot,
        carrying: null,
        inputs: {
          ...state.inputs,
          [site]: {
            ...state.inputs[site],
            [station.socketInput]: station.socketValues[action.slot - 1],
          },
        },
      };
    }
    case "retrieve": {
      if (!siteId(action.mechanism)) return state;
      const site = action.mechanism;
      if (
        !available(state, site) ||
        locked(state, site) ||
        state.carrying ||
        slotFor(state, site) === null
      )
        return state;
      const station = episode.scene.stations[site];
      if (station.kind === "evidence-crates") return state;
      const input = station.socketInput;
      return {
        ...state,
        [site === "bridge" ? "bridgeSlot" : "liftSlot"]: null,
        carrying: itemFor(site),
        inputs: {
          ...state.inputs,
          [site]: {
            ...state.inputs[site],
            [input]: initialInputs(episode, site)[input],
          },
        },
      };
    }
    case "adjust": {
      if (!siteId(action.mechanism)) return state;
      const site = action.mechanism;
      const prediction = episode.scene.stations[site].prediction;
      if (!prediction || !available(state, site) || locked(state, site))
        return state;
      const observed = observeInitial(episode, state, site);
      const current = prediction.values.indexOf(
        state.inputs[site][prediction.inputId],
      );
      const next = prediction.values[(current + 1) % prediction.values.length];
      return {
        ...observed,
        inputs: {
          ...observed.inputs,
          [site]: { ...observed.inputs[site], [prediction.inputId]: next },
        },
      };
    }
    case "activate": {
      if (!siteId(action.mechanism)) return state;
      const site = action.mechanism;
      if (!available(state, site) || locked(state, site)) return state;
      const observed = observeInitial(episode, state, site);
      if (
        episode.scene.stations[site].kind === "experiment" &&
        slotFor(state, site) === null
      )
        return observed;
      const evidence = currentTrial(episode, state, site);
      return {
        ...observed,
        trials: appendTrial(state.trials, {
          mechanism: site,
          evidence,
          hints: state.hints,
        }),
        bridgeOpen: state.bridgeOpen || (site === "bridge" && evidence.passed),
        liftRaised: state.liftRaised || (site === "lift" && evidence.passed),
      };
    }
    case "pickup-card":
    case "retrieve-card": {
      if (!siteId(action.mechanism)) return state;
      const site = action.mechanism;
      if (
        !available(state, site) ||
        locked(state, site) ||
        state.carrying ||
        episode.scene.stations[site].kind !== "evidence-crates"
      )
        return state;
      const round = stationRound(episode, site),
        index = round.cards.findIndex((card) => card.id === action.cardId);
      if (
        index < 0 ||
        (action.type === "pickup-card"
          ? state.assignments[site][index] !== null
          : state.assignments[site][index] === null)
      )
        return state;
      const observed = observeInitial(episode, state, site),
        assignment = [...state.assignments[site]];
      assignment[index] = null;
      return {
        ...observed,
        carrying: evidenceItem(site, action.cardId),
        assignments: { ...observed.assignments, [site]: assignment },
      };
    }
    case "place-card": {
      if (!siteId(action.mechanism)) return state;
      const site = action.mechanism,
        carried = carriedEvidence(state);
      if (
        !available(state, site) ||
        locked(state, site) ||
        !carried ||
        carried.site !== site ||
        episode.scene.stations[site].kind !== "evidence-crates"
      )
        return state;
      const round = stationRound(episode, site),
        index = round.cards.findIndex((card) => card.id === carried.cardId),
        slot = round.slots.find((slot) => slot.id === action.slotId);
      if (
        index < 0 ||
        !slot ||
        state.assignments[site][index] !== null ||
        state.assignments[site].filter((value) => value === slot.id).length >=
          slot.capacity
      )
        return state;
      const assignment = [...state.assignments[site]];
      assignment[index] = slot.id;
      return {
        ...state,
        carrying: null,
        assignments: { ...state.assignments, [site]: assignment },
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
      return episode.story.postcards.some((entry) => entry.id === action.id) &&
        !state.postcards.includes(action.id)
        ? { ...state, postcards: [...state.postcards, action.id] }
        : state;
    case "discover":
      return episode.discoveries.some((entry) => entry.id === action.id) &&
        !state.discoveries.includes(action.id) &&
        (action.id !== "cargo-manifest" || state.bridgeOpen)
        ? { ...state, discoveries: [...state.discoveries, action.id] }
        : state;
    case "return-postcard":
      return state.metBea &&
        state.postcards.includes(episode.story.favor.postcardId) &&
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

export function learningEvidence(
  episode: EpisodeFixture,
  state: EpisodeProgress,
): LessonMachineEvidence {
  matchesEpisode(episode, state);
  const trials: RecordedTrial[] = [];
  const seen = new Set<SiteId>();
  const copy = (trial: RecordedTrial): RecordedTrial =>
    isSimulationTrial(trial)
      ? { ...trial, inputs: { ...trial.inputs }, outputs: { ...trial.outputs } }
      : { ...trial, assignment: [...trial.assignment] };
  const add = (site: SiteId) => {
    const observation = state.observations[site];
    if (observation && !seen.has(site)) {
      trials.push(copy(observation));
      seen.add(site);
    }
  };
  for (const trial of state.trials) {
    if (!state.observations[trial.mechanism]) continue;
    add(trial.mechanism);
    trials.push(copy(trial.evidence));
  }
  SITES.forEach(add);
  return {
    kind: stationMachine(episode, "bridge").kind,
    trials,
  } as LessonMachineEvidence;
}
export function learningStatus(
  episode: EpisodeFixture,
  state: EpisodeProgress,
): {
  verified: boolean;
  baselineCount: number;
  completedCases: number;
  missingBaselines: SiteId[];
  status: "not-started" | "in-progress" | "verified" | "historical-progress";
} {
  const evidence = learningEvidence(episode, state);
  const verified =
    validateProgress(episode, state) !== null &&
    verifyLessonMachineEvidence(stationMachine(episode, "bridge"), evidence);
  const baselineCount = SITES.filter(
    (site) => state.observations[site] !== null,
  ).length;
  const missingBaselines = SITES.filter(
    (site) =>
      !state.observations[site] &&
      state.trials.some((trial) => trial.mechanism === site),
  );
  return {
    verified,
    baselineCount,
    completedCases: Number(state.bridgeOpen) + Number(state.liftRaised),
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

export function questPhase(state: EpisodeProgress): QuestPhase {
  return state.delivered
    ? "complete"
    : !state.metMoss
      ? "arrival"
      : !state.bridgeOpen
        ? "bridge"
        : !state.metBea
          ? "crossing"
          : !state.liftRaised
            ? "lift"
            : !state.parcelCollected
              ? "collect"
              : "return";
}
export function questGoal(
  episode: EpisodeFixture,
  state: EpisodeProgress,
): string {
  matchesEpisode(episode, state);
  return episode.story.goals[questPhase(state)];
}
export function discoveryReply(
  episode: EpisodeFixture,
  npc: NpcId,
  state: EpisodeProgress,
): string | undefined {
  matchesEpisode(episode, state);
  return state.discoveries
    .map((id) => episode.story.discoveryReplies[npc][id])
    .find(Boolean);
}
export function dialogueFor(
  episode: EpisodeFixture,
  npc: NpcId,
  state: EpisodeProgress,
): { speaker: string; line: string } {
  matchesEpisode(episode, state);
  const lines = episode.story.dialogue[npc];
  let line: string;
  if (npc === "moss")
    line = state.delivered
      ? lines.complete
      : state.carrying === "parcel"
        ? lines.parcel
        : !state.metMoss
          ? lines.welcome
          : state.bridgeOpen
            ? lines.ready
            : state.trials.some((trial) => trial.mechanism === "bridge")
              ? lines.retry
              : (discoveryReply(episode, npc, state) ?? lines.intro);
  else
    line = !state.bridgeOpen
      ? lines.blocked
      : state.delivered
        ? lines.complete
        : state.carrying === "parcel"
          ? lines.parcel
          : state.liftRaised
            ? lines.ready
            : !state.metBea
              ? lines.welcome
              : state.trials.some((trial) => trial.mechanism === "lift")
                ? lines.retry
                : (discoveryReply(episode, npc, state) ?? lines.intro);
  return { speaker: episode.story.npcNames[npc], line };
}
export function hintFor(
  episode: EpisodeFixture,
  state: EpisodeProgress,
): string {
  matchesEpisode(episode, state);
  const phase = questPhase(state);
  if (phase !== "bridge" && phase !== "lift") return episode.story.goals[phase];
  const previous =
    phase === "bridge"
      ? 0
      : (state.trials.find(
          (trial) => trial.mechanism === "bridge" && trial.evidence.passed,
        )?.hints ?? 0);
  const level = Math.min(2, Math.max(0, state.hints - previous - 1));
  return episode.story.hints[phase][level];
}

function validTrial(
  episode: EpisodeFixture,
  site: SiteId,
  raw: unknown,
  baseline = false,
): RecordedTrial | null {
  if (!record(raw) || typeof raw.passed !== "boolean") return null;
  const config = stationMachine(episode, site),
    station = episode.scene.stations[site];
  if (config.kind === "evidence") {
    if (
      Object.keys(raw).length !== 3 ||
      raw.roundId !== station.taskId ||
      !Array.isArray(raw.assignment) ||
      (baseline && !raw.assignment.every((slot) => slot === null))
    )
      return null;
    try {
      const measured = evidenceTrial(config, station.taskId, raw.assignment);
      return measured.passed === raw.passed && (!baseline || !measured.passed)
        ? measured
        : null;
    } catch {
      return null;
    }
  }
  if (
    Object.keys(raw).length !== 4 ||
    raw.taskId !== station.taskId ||
    !record(raw.inputs)
  )
    return null;
  const trialInputs = raw.inputs;
  if (baseline && !sameNumbers(trialInputs, initialInputs(episode, site)))
    return null;
  if (
    Object.entries(station.fixedInputs ?? {}).some(
      ([key, value]) => trialInputs[key] !== value,
    )
  )
    return null;
  try {
    const measured = simulationTrial(
      config,
      station.taskId,
      trialInputs as SimulationInputs,
    );
    return raw.passed === measured.passed &&
      sameNumbers(raw.outputs, measured.outputs) &&
      (!baseline || !measured.passed)
      ? measured
      : null;
  } catch {
    return null;
  }
}
const sameAssignment = (
  a: readonly (string | null)[],
  b: readonly (string | null)[],
) => a.length === b.length && a.every((slot, index) => slot === b[index]);

/** Save-boundary validation replays readings and rejects impossible latches or carrying states. */
export function validateProgress(
  episode: EpisodeFixture,
  raw: unknown,
): EpisodeProgress | null {
  if (
    !record(raw) ||
    raw.episodeId !== episode.id ||
    raw.revision !== episode.revision
  )
    return null;
  const bools = [
    "metMoss",
    "metBea",
    "bridgeOpen",
    "liftRaised",
    "parcelCollected",
    "delivered",
    "postcardReturned",
  ] as const;
  if (
    !bools.every((key) => typeof raw[key] === "boolean") ||
    !(raw.bridgeSlot === null || slotValue(raw.bridgeSlot)) ||
    !(raw.liftSlot === null || slotValue(raw.liftSlot)) ||
    !(raw.carrying === null || carryValue(raw.carrying)) ||
    !hintCount(raw.hints)
  )
    return null;
  const collection = (value: unknown, known: string[]): value is string[] =>
    Array.isArray(value) &&
    value.length <= known.length &&
    new Set(value).size === value.length &&
    value.every((entry) => known.includes(entry));
  if (
    !collection(
      raw.postcards,
      episode.story.postcards.map((entry) => entry.id),
    ) ||
    !collection(
      raw.discoveries,
      episode.discoveries.map((entry) => entry.id),
    ) ||
    !record(raw.inputs) ||
    Object.keys(raw.inputs).length !== 2 ||
    !record(raw.observations) ||
    Object.keys(raw.observations).length !== 2 ||
    !Array.isArray(raw.trials) ||
    raw.trials.length > HISTORY_LIMIT
  )
    return null;
  // Existing authored simulation saves predate evidence assignments; no evidence history is inferred.
  const oldSimulation =
    raw.assignments === undefined &&
    !episode.generated &&
    stationMachine(episode, "bridge").kind === "simulation";
  const rawAssignments = oldSimulation
    ? { bridge: [], lift: [] }
    : raw.assignments;
  if (!record(rawAssignments) || Object.keys(rawAssignments).length !== 2)
    return null;
  const current: Record<SiteId, SimulationInputs> = { bridge: {}, lift: {} };
  const assignments: Record<SiteId, (string | null)[]> = {
    bridge: [],
    lift: [],
  };
  const observations: Record<SiteId, RecordedTrial | null> = {
    bridge: null,
    lift: null,
  };
  for (const site of SITES) {
    const station = episode.scene.stations[site],
      config = stationMachine(episode, site),
      siteInputs = raw.inputs[site],
      assigned = rawAssignments[site];
    if (!record(siteInputs) || !Array.isArray(assigned)) return null;
    const slot = raw[
      site === "bridge" ? "bridgeSlot" : "liftSlot"
    ] as Slot | null;
    if (config.kind === "evidence") {
      if (
        station.kind !== "evidence-crates" ||
        slot !== null ||
        Object.keys(siteInputs).length !== 0
      )
        return null;
      try {
        assignments[site] = evidenceTrial(
          config,
          station.taskId,
          assigned,
        ).assignment;
      } catch {
        return null;
      }
    } else {
      if (station.kind === "evidence-crates" || assigned.length !== 0)
        return null;
      try {
        evaluateSimulation(
          config,
          station.taskId,
          siteInputs as SimulationInputs,
        );
      } catch {
        return null;
      }
      if (
        Object.entries(station.fixedInputs ?? {}).some(
          ([key, value]) => siteInputs[key] !== value,
        )
      )
        return null;
      if (
        siteInputs[station.socketInput] !==
        (slot === null
          ? initialInputs(episode, site)[station.socketInput]
          : station.socketValues[slot - 1])
      )
        return null;
      current[site] = { ...siteInputs } as SimulationInputs;
    }
    if (raw.observations[site] !== null) {
      const observation = validTrial(
        episode,
        site,
        raw.observations[site],
        true,
      );
      if (!observation) return null;
      observations[site] = observation;
    }
  }
  let bridgePassed = false,
    liftPassed = false,
    previousHints = 0;
  const trials: EpisodeTrial[] = [];
  for (const trial of raw.trials) {
    if (
      !record(trial) ||
      Object.keys(trial).length !== 3 ||
      !siteId(trial.mechanism) ||
      !hintCount(trial.hints) ||
      trial.hints > raw.hints ||
      trial.hints < previousHints
    )
      return null;
    const evidence = validTrial(episode, trial.mechanism, trial.evidence);
    if (!evidence) return null;
    if (trial.mechanism === "bridge") {
      if (bridgePassed) return null;
      bridgePassed = evidence.passed;
    } else {
      if (!bridgePassed || liftPassed) return null;
      liftPassed = evidence.passed;
    }
    if (
      evidence.passed &&
      (isSimulationTrial(evidence)
        ? !sameNumbers(current[trial.mechanism], evidence.inputs)
        : !sameAssignment(assignments[trial.mechanism], evidence.assignment))
    )
      return null;
    previousHints = trial.hints;
    trials.push({ mechanism: trial.mechanism, evidence, hints: trial.hints });
  }
  const state: EpisodeProgress = {
    episodeId: episode.id,
    revision: episode.revision,
    metMoss: raw.metMoss as boolean,
    metBea: raw.metBea as boolean,
    bridgeSlot: raw.bridgeSlot,
    liftSlot: raw.liftSlot,
    bridgeOpen: raw.bridgeOpen as boolean,
    liftRaised: raw.liftRaised as boolean,
    parcelCollected: raw.parcelCollected as boolean,
    delivered: raw.delivered as boolean,
    carrying: raw.carrying,
    postcards: [...raw.postcards],
    discoveries: [...raw.discoveries],
    postcardReturned: raw.postcardReturned as boolean,
    hints: raw.hints,
    inputs: current,
    assignments,
    observations,
    trials,
  };
  if (
    state.bridgeOpen !== bridgePassed ||
    state.liftRaised !== liftPassed ||
    (state.metBea && !state.bridgeOpen)
  )
    return null;
  for (const site of SITES) {
    const station = episode.scene.stations[site],
      assigned = state.assignments[site],
      carried = carriedEvidence(state);
    if (
      station.kind !== "evidence-crates" &&
      locked(state, site) &&
      slotFor(state, site) === null
    )
      return null;
    if (
      !available(state, site) &&
      (slotFor(state, site) !== null ||
        assigned.some((slot) => slot !== null) ||
        state.observations[site] ||
        state.trials.some((trial) => trial.mechanism === site) ||
        !sameNumbers(state.inputs[site], initialInputs(episode, site)) ||
        carried?.site === site)
    )
      return null;
    if (
      (episode.generated || station.kind === "evidence-crates") &&
      !state.observations[site] &&
      (slotFor(state, site) !== null ||
        assigned.some((slot) => slot !== null) ||
        state.carrying === itemFor(site) ||
        carried?.site === site ||
        state.trials.some((trial) => trial.mechanism === site) ||
        !sameNumbers(state.inputs[site], initialInputs(episode, site)))
    )
      return null;
  }
  const carried = carriedEvidence(state);
  if (carried) {
    if (
      episode.scene.stations[carried.site].kind !== "evidence-crates" ||
      !available(state, carried.site) ||
      locked(state, carried.site)
    )
      return null;
    const index = stationRound(episode, carried.site).cards.findIndex(
      (card) => card.id === carried.cardId,
    );
    if (index < 0 || state.assignments[carried.site][index] !== null)
      return null;
  }
  if (
    state.carrying === "bridge-weight" &&
    (state.bridgeSlot !== null ||
      state.bridgeOpen ||
      !state.metMoss ||
      episode.scene.stations.bridge.kind === "evidence-crates")
  )
    return null;
  if (
    state.carrying === "lift-weight" &&
    (state.liftSlot !== null ||
      state.liftRaised ||
      !state.metBea ||
      episode.scene.stations.lift.kind === "evidence-crates")
  )
    return null;
  if (
    state.parcelCollected !==
      (state.carrying === "parcel" || state.delivered) ||
    ((state.parcelCollected || state.delivered) && !state.liftRaised) ||
    (state.delivered && state.carrying !== null)
  )
    return null;
  if (state.discoveries.includes("cargo-manifest") && !state.bridgeOpen)
    return null;
  if (
    state.postcardReturned &&
    (!state.metBea || !state.postcards.includes(episode.story.favor.postcardId))
  )
    return null;
  return state;
}
