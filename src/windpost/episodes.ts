import { z } from "zod";
import type { SourceRecord } from "../domain/types";
import type { EpisodePackage } from "../episodes/types";
import {
  evaluateSimulation,
  simulationInputs,
  validateLessonMachineConfig,
  type MachineExpression,
  type EvidenceConfig,
  type EvidenceRound,
  type LessonMachineConfig,
  type SimulationConfig,
  type SimulationInputs,
} from "../domain/lesson-machines";
import { WINDPOST_MACHINE } from "./learning";
import { DISCOVERIES, MODEL_ASSUMPTIONS, WINDPOST_SOURCES } from "./model";

export type SiteId = "bridge" | "lift";
export type NpcId = "moss" | "bea";
export type Slot = 1 | 2 | 3;
export type QuestPhase =
  | "arrival"
  | "bridge"
  | "crossing"
  | "lift"
  | "collect"
  | "return"
  | "complete";
export type DialoguePhase =
  "welcome" | "intro" | "retry" | "ready" | "parcel" | "complete" | "blocked";
export interface StationPresentation {
  puzzleId: string;
  taskId: string;
  title: string;
  itemLabel: string;
  readouts: {
    id: string;
    label: string;
    unit: string;
    kind: "input" | "output";
  }[];
  placementFeedback: string;
  baselineFeedback: string;
  evidenceSummary: string;
  successFeedback: string;
  failureFeedback: string;
  activationLabel: string;
}
export interface SimulationStationBinding extends StationPresentation {
  kind: "counterweight" | "timing-gates" | "experiment";
  socketInput: string;
  socketValues: [number, number, number];
  socketLabels: [string, string, string];
  prediction?: { inputId: string; values: number[]; unit: string };
  /** A scene-controlled clock, never an unbound player control. */
  fixedInputs?: SimulationInputs;
  motion?: {
    timeInput: string;
    positionOutput: string;
    velocityOutput: string;
    timeMin: number;
    timeMax: number;
  };
}
export interface EvidenceStationBinding extends StationPresentation {
  kind: "evidence-crates";
  slotIds: string[];
  slotLabels: string[];
  socketInput?: never;
  socketValues?: never;
  socketLabels?: never;
  prediction?: never;
  fixedInputs?: never;
  motion?: never;
}
export type StationBinding = SimulationStationBinding | EvidenceStationBinding;
export interface EpisodeFixture extends Pick<
  EpisodePackage,
  | "id"
  | "revision"
  | "title"
  | "subtitle"
  | "description"
  | "briefing"
  | "ending"
  | "objectives"
  | "puzzles"
  | "discoveries"
> {
  version: 1;
  generated?: boolean;
  generation?: EpisodePackage["generation"];
  level?: string;
  sources: SourceRecord[];
  assumptions: string[];
  scene: { kit: "harbor-route-v1"; stations: Record<SiteId, StationBinding> };
  story: {
    npcNames: Record<NpcId, string>;
    goals: Record<QuestPhase, string>;
    dialogue: Record<NpcId, Record<DialoguePhase, string>>;
    hints: Record<SiteId, [string, string, string]>;
    discoveryReplies: Record<NpcId, Record<string, string>>;
    postcards: { id: string; title: string; text: string }[];
    favor: {
      postcardId: string;
      receiver: "bea";
      prompt: string;
      thanks: string;
    };
  };
}

const text = z.string().min(1).max(5000);
const id = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
  .max(64)
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value),
    "Reserved identifier",
  );
const number = z.number().finite();
const inputs = z.record(z.string(), number);
const simulationStationSchema = z
  .object({
    kind: z.enum(["counterweight", "timing-gates", "experiment"]),
    puzzleId: id,
    taskId: id,
    title: text,
    itemLabel: text,
    socketInput: z.string().min(1),
    socketValues: z.tuple([number, number, number]),
    socketLabels: z.tuple([text, text, text]),
    prediction: z
      .object({
        inputId: z.string().min(1),
        values: z.array(number).min(2).max(8),
        unit: text,
      })
      .strict()
      .optional(),
    fixedInputs: inputs.optional(),
    motion: z
      .object({
        timeInput: text,
        positionOutput: text,
        velocityOutput: text,
        timeMin: number,
        timeMax: number,
      })
      .strict()
      .optional(),
    readouts: z
      .array(
        z
          .object({
            id: text,
            label: text,
            unit: text,
            kind: z.enum(["input", "output"]),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    placementFeedback: text,
    baselineFeedback: text,
    evidenceSummary: text,
    successFeedback: text,
    failureFeedback: text,
    activationLabel: text,
  })
  .strict();
const stationSchema = z.union([
  simulationStationSchema,
  simulationStationSchema
    .omit({
      socketInput: true,
      socketValues: true,
      socketLabels: true,
      prediction: true,
      fixedInputs: true,
      motion: true,
    })
    .extend({
      kind: z.literal("evidence-crates"),
      slotIds: z.array(id).min(2).max(3),
      slotLabels: z.array(text).min(2).max(3),
      readouts: z.array(z.never()).length(0),
    })
    .strict(),
]);
const dialogueSchema = z
  .object({
    welcome: text,
    intro: text,
    retry: text,
    ready: text,
    parcel: text,
    complete: text,
    blocked: text,
  })
  .strict();
const sourceRefs = z.array(id).min(1);
const fixtureSchema = z
  .object({
    version: z.literal(1),
    generated: z.boolean().optional(),
    level: text.optional(),
    generation: z
      .object({
        model: text,
        createdAt: z.string().datetime(),
        review: z
          .object({ status: z.literal("passed"), summary: text })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    id,
    revision: z.number().int().positive(),
    title: text,
    subtitle: text,
    description: text,
    briefing: text,
    ending: text,
    sources: z
      .array(
        z
          .object({
            id,
            title: text,
            text,
            url: z
              .string()
              .url()
              .refine((value) => /^https?:\/\//.test(value))
              .optional(),
            page: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .min(1),
    objectives: z
      .array(
        z
          .object({
            id,
            title: text,
            sourceIds: sourceRefs,
            claim: text.optional(),
            boundaries: text.optional(),
            misconception: text.optional(),
            evidence: z
              .array(z.object({ sourceId: id, quote: text }).strict())
              .optional(),
          })
          .strict(),
      )
      .min(1),
    puzzles: z
      .array(
        z
          .object({
            id,
            title: text,
            instructions: text,
            objectiveId: id,
            sourceIds: sourceRefs,
            config: z.unknown(),
          })
          .strict(),
      )
      .length(1),
    discoveries: z
      .array(
        z.object({ id, title: text, text, sourceIds: sourceRefs }).strict(),
      )
      .length(2),
    assumptions: z.array(text).min(1),
    scene: z
      .object({
        kit: z.literal("harbor-route-v1"),
        stations: z
          .object({ bridge: stationSchema, lift: stationSchema })
          .strict(),
      })
      .strict(),
    story: z
      .object({
        npcNames: z.object({ moss: text, bea: text }).strict(),
        goals: z
          .object({
            arrival: text,
            bridge: text,
            crossing: text,
            lift: text,
            collect: text,
            return: text,
            complete: text,
          })
          .strict(),
        dialogue: z
          .object({ moss: dialogueSchema, bea: dialogueSchema })
          .strict(),
        hints: z
          .object({
            bridge: z.tuple([text, text, text]),
            lift: z.tuple([text, text, text]),
          })
          .strict(),
        discoveryReplies: z
          .object({
            moss: z.record(z.string(), text),
            bea: z.record(z.string(), text),
          })
          .strict(),
        postcards: z
          .array(z.object({ id, title: text, text }).strict())
          .length(3),
        favor: z
          .object({
            postcardId: id,
            receiver: z.literal("bea"),
            prompt: text,
            thanks: text,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

function demand(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new RangeError(`Unsupported harbor episode: ${message}`);
}
const sameNumbers = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value) => b.includes(value));
function unique(values: string[], label: string) {
  demand(
    new Set(values).size === values.length,
    `${label} ids must be unique.`,
  );
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Generated transfer cases must require reconsidering the first case's successful controls. */
export function assertGeneratedSimulationTransfer(
  config: SimulationConfig,
): void {
  if (config.tasks.length !== 2)
    throw new RangeError("Generated simulations require exactly two cases");
  const firstReference = Object.fromEntries(
    config.tasks[0].referenceInputs.map((input) => [input.id, input.value]),
  );
  if (evaluateSimulation(config, config.tasks[1].id, firstReference).passed)
    throw new RangeError(
      "Generated transfer must require a changed solution: the first task's reference inputs also pass the second case. Revise the second case's constants or goal and supply a different passing reference.",
    );
}

/** Validate the finite harbor kit and every physical control binding before playing. */
export function validateEpisodeFixture(raw: unknown): EpisodeFixture {
  const episode = fixtureSchema.parse(raw) as EpisodeFixture;
  for (const name of [
    "sources",
    "objectives",
    "puzzles",
    "discoveries",
  ] as const)
    unique(
      episode[name].map((entry) => entry.id),
      name,
    );
  const sourceIds = episode.sources.map((source) => source.id);
  const refs = (values: string[]) =>
    demand(
      values.every((value) => sourceIds.includes(value)),
      "unknown source reference.",
    );
  episode.objectives.forEach((objective) => {
    refs(objective.sourceIds);
    objective.evidence?.forEach((entry) => refs([entry.sourceId]));
  });
  episode.discoveries.forEach((discovery) => refs(discovery.sourceIds));
  demand(
    episode.discoveries.some((entry) => entry.id === "workshop-sketch") &&
      episode.discoveries.some((entry) => entry.id === "cargo-manifest"),
    "this kit has exactly two named discovery anchors.",
  );
  const postcardIds = episode.story.postcards.map((postcard) => postcard.id);
  unique(postcardIds, "Postcard");
  demand(
    ["harbor", "workshop", "lookout"].every((value) =>
      postcardIds.includes(value),
    ),
    "this kit has three named postcard anchors.",
  );
  demand(
    episode.story.favor.postcardId === "workshop",
    "the favor uses the workshop postcard.",
  );
  for (const replies of Object.values(episode.story.discoveryReplies))
    demand(
      Object.keys(replies).every((key) =>
        episode.discoveries.some((entry) => entry.id === key),
      ),
      "unknown dialogue discovery reference.",
    );
  const puzzle = episode.puzzles[0];
  refs(puzzle.sourceIds);
  demand(
    episode.objectives.some((objective) => objective.id === puzzle.objectiveId),
    "unknown puzzle objective.",
  );
  demand(
    episode.objectives.every(
      (objective) => objective.id === puzzle.objectiveId,
    ),
    "every objective needs a bound puzzle.",
  );
  const config = validateLessonMachineConfig(puzzle.config);
  if (episode.generated)
    demand(
      Object.values(episode.scene.stations).every(
        (station) =>
          station.kind === "experiment" || station.kind === "evidence-crates",
      ),
      "source-generated episodes must use the general experiment or evidence apparatus.",
    );
  if (config.kind === "evidence") {
    demand(
      config.rounds.length === 2,
      "this kit provides exactly two ordered evidence sites.",
    );
    puzzle.config = config;
    for (const [index, site] of (["bridge", "lift"] as const).entries()) {
      const station = episode.scene.stations[site],
        round = config.rounds[index];
      demand(
        station.kind === "evidence-crates",
        "evidence requires physical evidence crates.",
      );
      demand(
        station.puzzleId === puzzle.id && station.taskId === round.id,
        "station order must cover every round exactly once.",
      );
      demand(
        round.cards.length >= 3 &&
          round.cards.length <= 6 &&
          round.slots.length >= 2 &&
          round.slots.length <= 3,
        "evidence crates support 3–6 cards and 2–3 slots.",
      );
      round.cards.forEach((card) => refs(card.sourceIds));
      demand(
        station.slotIds.length === round.slots.length &&
          station.slotLabels.length === round.slots.length &&
          round.slots.every(
            (slot, index) =>
              station.slotIds[index] === slot.id &&
              station.slotLabels[index] === slot.label,
          ),
        "evidence crates must cover every labeled slot in order.",
      );
      demand(
        station.readouts.length === 0,
        "evidence crates expose source cards, not invented numeric readings.",
      );
    }
    return freeze(episode);
  }
  demand(
    config.tasks.length === 2,
    "this kit provides exactly two ordered task sites.",
  );
  if (episode.generated) assertGeneratedSimulationTransfer(config);
  puzzle.config = config;
  for (const [index, site] of (["bridge", "lift"] as const).entries()) {
    const station = episode.scene.stations[site];
    demand(
      station.kind !== "evidence-crates",
      "a simulation requires numeric experiment apparatus.",
    );
    demand(
      station.puzzleId === puzzle.id &&
        station.taskId === config.tasks[index].id,
      "station order must cover every task exactly once.",
    );
    const initial = simulationInputs(config, station.taskId);
    const socket = config.controls.find(
      (control) => control.id === station.socketInput,
    );
    demand(socket?.kind === "choice", "sockets require a choice control.");
    demand(
      new Set(station.socketValues).size === 3 &&
        station.socketValues.every((value) =>
          socket.options.some((option) => option.value === value),
        ),
      "socket values must bind three distinct legal choices.",
    );
    demand(
      sameNumbers(
        socket.options.map((option) => option.value),
        [...new Set([initial[socket.id], ...station.socketValues])],
      ),
      "every socket choice must be reachable.",
    );
    const bound = [
      station.socketInput,
      ...Object.keys(station.fixedInputs ?? {}),
    ];
    if (station.prediction) {
      const prediction = config.controls.find(
        (control) => control.id === station.prediction!.inputId,
      );
      demand(
        prediction?.kind === "choice",
        "the prediction dial requires a choice control.",
      );
      demand(
        new Set(station.prediction.values).size ===
          station.prediction.values.length &&
          sameNumbers(
            prediction.options.map((option) => option.value),
            station.prediction.values,
          ),
        "the dial must cover every prediction choice.",
      );
      bound.push(station.prediction.inputId);
    }
    unique(bound, "Control binding");
    demand(
      bound.length === config.controls.length &&
        config.controls.every((control) => bound.includes(control.id)),
      "every control needs a supported physical or fixed-clock binding.",
    );
    for (const [key, value] of Object.entries(station.fixedInputs ?? {}))
      demand(
        initial[key] === value &&
          config.tasks[index].referenceInputs.some(
            (input) => input.id === key && input.value === value,
          ),
        "fixed controls cannot change during the task.",
      );
    for (const readout of station.readouts) {
      if (readout.kind === "input")
        demand(
          config.controls.some((control) => control.id === readout.id),
          "unknown input readout.",
        );
      else
        demand(
          config.outputs.some(
            (output) =>
              output.id === readout.id && output.unit === readout.unit,
          ),
          "unknown output or misleading readout unit.",
        );
    }
    if (station.kind === "counterweight") {
      demand(
        !station.prediction &&
          !station.motion &&
          Object.keys(station.fixedInputs ?? {}).length === 0,
        "counterweights support only physical arm placement.",
      );
      demand(
        initial[station.socketInput] === 0 &&
          station.socketValues.every((value, index) => value === index + 1),
        "counterweight sockets represent 1, 2 and 3 meters with zero unattached.",
      );
      const constants = Object.fromEntries(
        config.tasks[index].constants.map((entry) => [entry.id, entry.value]),
      );
      demand(
        constants.gravity === 9.81 &&
          constants.counterMass === 2 &&
          constants.fixedArm === 1 &&
          constants.fixedMass > 0,
        "counterweight masses, gravity and pivot must match this kit.",
      );
      for (const distance of [0, 1, 2, 3]) {
        const reading = evaluateSimulation(config, station.taskId, {
          [station.socketInput]: distance,
        });
        demand(
          Math.abs(reading.outputs.leftTorque - constants.fixedMass * 9.81) <
            1e-9 &&
            Math.abs(reading.outputs.rightTorque - 2 * 9.81 * distance) <
              1e-9 &&
            reading.passed ===
              Math.abs(constants.fixedMass - 2 * distance) < 1e-9,
          "counterweight outputs and goal must match the visible beam.",
        );
      }
    } else if (station.kind === "experiment") {
      demand(
        !station.motion && Object.keys(station.fixedInputs ?? {}).length === 0,
        "general experiments expose every control; fixed controls and motion are unsupported.",
      );
      demand(
        config.controls.length >= 1 &&
          config.controls.length <= 2 &&
          config.controls[0].id === station.socketInput &&
          socket.options.length === 3,
        "general experiments require the first control to be a three-choice carried token.",
      );
      demand(
        config.controls.length === (station.prediction ? 2 : 1) &&
          (!station.prediction ||
            (config.controls[1].id === station.prediction.inputId &&
              station.prediction.values.length >= 2 &&
              station.prediction.values.length <= 8)),
        "general experiment dials must bind the optional second choice control with 2–8 values.",
      );
      demand(
        config.outputs.length >= 1 &&
          config.outputs.length <= 4 &&
          station.readouts.length === config.outputs.length &&
          config.outputs.every((output) =>
            station.readouts.some(
              (readout) =>
                readout.kind === "output" &&
                readout.id === output.id &&
                readout.label === output.label &&
                readout.unit === output.unit,
            ),
          ),
        "general experiment readouts must expose all 1–4 model outputs with their authored labels and units.",
      );
    } else {
      demand(
        station.prediction && station.motion,
        "timing gates require a prediction dial and sampled motion.",
      );
      const motion = station.motion;
      const clock = config.controls.find(
        (control) => control.id === motion.timeInput,
      );
      demand(
        clock?.kind === "number" &&
          station.fixedInputs?.[clock.id] !== undefined,
        "motion needs a fixed numeric sample clock.",
      );
      demand(
        clock.unit === "s" && station.prediction.unit === "m/s",
        "timing-gates clock and prediction must use seconds and meters per second.",
      );
      demand(
        Object.keys(station.fixedInputs ?? {}).length === 1 &&
          motion.timeMin === clock.min &&
          motion.timeMax === clock.max,
        "only the sample clock may be fixed, within its declared domain.",
      );
      demand(
        config.outputs.some(
          (output) =>
            output.id === motion.positionOutput &&
            output.unit === "m" &&
            output.derivativeWrt === null,
        ),
        "motion needs a position output in meters.",
      );
      const positionControls = new Set<string>();
      const visitedOutputs = new Set<string>();
      const inspectPosition = (outputId: string) => {
        if (visitedOutputs.has(outputId)) return;
        visitedOutputs.add(outputId);
        const output = config.outputs.find((entry) => entry.id === outputId);
        for (const token of output?.expression ?? []) {
          if (token.op !== "ref") continue;
          if (config.controls.some((control) => control.id === token.id))
            positionControls.add(token.id);
          else inspectPosition(token.id);
        }
      };
      inspectPosition(motion.positionOutput);
      demand(
        positionControls.size === 1 && positionControls.has(clock.id),
        "the replay trajectory may depend only on its fixed clock and task constants, never the window or prediction controls.",
      );
      demand(
        config.outputs.some(
          (output) =>
            output.id === motion.velocityOutput &&
            output.unit === "m/s" &&
            output.derivativeWrt === clock.id &&
            output.expression.length === 1 &&
            output.expression[0].op === "ref" &&
            output.expression[0].id === motion.positionOutput,
        ),
        "motion velocity must differentiate the visible position output.",
      );
      demand(
        motion.positionOutput === "position" &&
          motion.velocityOutput === "instantaneous",
        "timing-gates prefab binds the named position and instantaneous outputs.",
      );
      for (const [outputId, unit] of [
        ["positionBefore", "m"],
        ["deltaPosition", "m"],
        ["average", "m/s"],
      ])
        demand(
          config.outputs.some(
            (output) =>
              output.id === outputId &&
              output.unit === unit &&
              output.derivativeWrt === null,
          ),
          `timing-gates prefab requires ${outputId} in ${unit}.`,
        );
      demand(
        station.socketValues.every(
          (window) =>
            window > 0 &&
            initial[clock.id] - window >= clock.min &&
            initial[clock.id] <= clock.max,
        ),
        "observation windows must stay within the motion domain.",
      );
      for (const window of [
        ...new Set([initial[station.socketInput], ...station.socketValues]),
      ])
        for (const prediction of station.prediction.values) {
          const reading = evaluateSimulation(config, station.taskId, {
            ...initial,
            [station.socketInput]: window,
            [station.prediction.inputId]: prediction,
          });
          const previous = evaluateSimulation(config, station.taskId, {
            ...initial,
            [clock.id]: initial[clock.id] - window,
          }).outputs.position;
          const delta = reading.outputs.position - previous;
          const close = (a: number, b: number) => Math.abs(a - b) < 1e-8;
          demand(
            close(reading.outputs.positionBefore, previous) &&
              close(reading.outputs.deltaPosition, delta) &&
              close(reading.outputs.average, delta / window),
            "timing readouts must use the actual backward position difference.",
          );
          demand(
            reading.passed ===
              (Math.abs(
                reading.outputs.average - reading.outputs.instantaneous,
              ) < 0.12 && prediction === reading.outputs.instantaneous),
            "timing goal must match the declared 0.12 m/s tolerance and signed prediction.",
          );
          if (window === initial[station.socketInput])
            demand(
              !reading.passed,
              "default recorder window cannot finish calibration before beacon placement.",
            );
        }
    }
    // Every reachable arrangement must execute; never defer unsupported values to gameplay.
    for (const value of station.socketValues)
      for (const estimate of station.prediction?.values ?? [undefined])
        evaluateSimulation(config, station.taskId, {
          ...initial,
          [station.socketInput]: value,
          ...(station.prediction
            ? { [station.prediction.inputId]: estimate! }
            : {}),
        });
  }
  return freeze(episode);
}

export function stationConfig(
  episode: EpisodeFixture,
  site: SiteId,
): SimulationConfig {
  const config = stationMachine(episode, site);
  if (config.kind !== "simulation")
    throw new RangeError("Station lacks a simulation");
  return config;
}

export function stationMachine(
  episode: EpisodeFixture,
  site: SiteId,
): LessonMachineConfig {
  const binding = episode.scene.stations[site];
  const config = episode.puzzles.find(
    (puzzle) => puzzle.id === binding.puzzleId,
  )?.config;
  if (!config || (config.kind !== "simulation" && config.kind !== "evidence"))
    throw new RangeError("Station lacks a supported lesson machine");
  return config;
}
export function stationRound(
  episode: EpisodeFixture,
  site: SiteId,
): EvidenceRound {
  const config = stationMachine(episode, site);
  if (config.kind !== "evidence")
    throw new RangeError("Station is not an evidence activity");
  const round = config.rounds.find(
    (entry) => entry.id === episode.scene.stations[site].taskId,
  );
  if (!round) throw new RangeError("Station lacks its evidence round");
  return round;
}

/** Exhaustive finite bounds for faithful general-apparatus gauges, never a success rule. */
export function experimentReadoutRanges(
  episode: EpisodeFixture,
  site: SiteId,
): Record<string, { min: number; max: number }> {
  const station = episode.scene.stations[site];
  if (station.kind !== "experiment")
    throw new RangeError("Readout ranges require a general experiment");
  const config = stationConfig(episode, site),
    initial = simulationInputs(config, station.taskId);
  const ranges = Object.fromEntries(
    config.outputs.map((output) => [
      output.id,
      { min: Infinity, max: -Infinity },
    ]),
  );
  for (const value of station.socketValues)
    for (const prediction of station.prediction?.values ?? [undefined]) {
      const reading = evaluateSimulation(config, station.taskId, {
        ...initial,
        [station.socketInput]: value,
        ...(station.prediction
          ? { [station.prediction.inputId]: prediction! }
          : {}),
      });
      for (const [id, value] of Object.entries(reading.outputs)) {
        ranges[id].min = Math.min(ranges[id].min, value);
        ranges[id].max = Math.max(ranges[id].max, value);
      }
    }
  return ranges;
}

const sharedGoals = {
  arrival: "Find Moss by the canal bridge and say hello.",
  bridge:
    "Carry the brass counterweight to a bridge socket, then try the crank.",
  crossing: "Cross your newly opened bridge and meet Bea at Windpost.",
  lift: "Use the second counterweight to balance the heavier parcel lift, then pull its lever.",
  collect: "Collect the mail parcel from the raised lift.",
  return: "Carry the parcel back across the bridge to Moss.",
  complete:
    "Delivery complete. Stay a little longer and find the island's three postcards.",
};
const postcards = [
  {
    id: "harbor",
    title: "Harbor light",
    text: "A small harbor, a wide horizon. A postcard for your collection.",
  },
  {
    id: "workshop",
    title: "A note for Bea",
    text: "To Bea: the kettle is always on at the workshop. —Moss",
  },
  {
    id: "lookout",
    title: "Across the water",
    text: "From the lookout, the whole courier route fits in one view.",
  },
];
const windSources: SourceRecord[] = WINDPOST_SOURCES.map((source, index) => ({
  id: `torque-source-${index + 1}`,
  title: source.title,
  url: source.url,
  text: `Editorial summary: ${source.supports}`,
}));
const counterStation = (site: SiteId): StationBinding => ({
  kind: "counterweight",
  puzzleId: "counterweight-route",
  taskId: site,
  title: site === "bridge" ? "Canal bridge" : "Parcel lift",
  itemLabel: "2 kg brass counterweight",
  socketInput: "distance",
  socketValues: [1, 2, 3],
  socketLabels: ["1 m", "2 m", "3 m"],
  readouts: [
    { id: "leftTorque", label: "Fixed load", unit: "N·m", kind: "output" },
    { id: "rightTorque", label: "Counterweight", unit: "N·m", kind: "output" },
  ],
  placementFeedback: "Watch which side dips, then try the mechanism.",
  successFeedback: "The opposing torques match. The catch releases!",
  failureFeedback:
    "The turning effects differ. Take back the weight and reconsider its distance.",
  activationLabel: site === "bridge" ? "Try the crank" : "Pull the lever",
  baselineFeedback:
    "Before attaching the counterweight, the fixed load turns the beam while the empty side contributes no torque.",
  evidenceSummary:
    site === "bridge"
      ? "The 2 kg counterweight at 2 m matches the torque of 4 kg at 1 m."
      : "The changed 6 kg load needs the same 2 kg counterweight at 3 m. The longer arm balances its greater torque.",
});

export const WINDPOST_EPISODE = validateEpisodeFixture({
  version: 1,
  id: "windpost",
  revision: 1,
  title: "Windpost",
  subtitle: "A little weight. A long way.",
  description:
    "An authored seaside courier adventure about torque and balance.",
  briefing:
    "Bea has the harbor's mail across the canal. Help Moss open the route, balance the parcel lift, and bring the delivery home.",
  ending:
    "The weather charts arrived. The route stays open for the next courier.",
  sources: windSources,
  objectives: [
    {
      id: "torque-balance",
      title: "Balance opposing torques by changing a lever arm",
      sourceIds: windSources.map((source) => source.id),
      claim:
        "Under the same gravity, matching mass × perpendicular distance matches torque.",
      boundaries:
        "Horizontal, massless beams with supported pivots; this is not a dynamics simulation.",
    },
  ],
  puzzles: [
    {
      id: "counterweight-route",
      title: "The courier route",
      instructions:
        "Observe each unloaded machine, place its counterweight, and operate the catch when opposing torques match.",
      objectiveId: "torque-balance",
      sourceIds: windSources.map((source) => source.id),
      config: WINDPOST_MACHINE,
    },
  ],
  discoveries: Object.entries(DISCOVERIES).map(([id, entry]) => ({
    id,
    title: entry.title,
    text: entry.text,
    sourceIds: entry.sourceIndices.map((index) => windSources[index].id),
  })),
  assumptions: [...MODEL_ASSUMPTIONS],
  scene: {
    kit: "harbor-route-v1",
    stations: {
      bridge: counterStation("bridge"),
      lift: counterStation("lift"),
    },
  },
  story: {
    npcNames: { moss: "Moss", bea: "Bea" },
    goals: sharedGoals,
    dialogue: {
      moss: {
        welcome:
          "Morning, courier! Bea has our mail across the canal, but this bridge is stuck. That little brass weight might do the work of a bigger one—if you give it room.",
        intro:
          "The fixed load is 4 kg, one meter from the pivot. Your weight is 2 kg. Choose a socket, watch which side dips, and try the crank when both sides balance.",
        retry:
          "The catch is still holding. The side with greater torque dips. Take the weight back and try another socket.",
        ready:
          "Beautiful! The catch holds the bridge open now. Find Bea and bring back our parcel. I'll keep the kettle on.",
        parcel:
          "That's our parcel! Bring it here. The bridge will stay open for the next courier, too.",
        complete:
          "The weather charts! Just in time. You brought the whole harbor a little closer today.",
        blocked: "Find the bridge beside the workshop.",
      },
      bea: {
        welcome:
          "Moss sent you? Our lift has a 6 kg load one meter from its pivot, and another 2 kg counterweight. Will the bridge's arrangement work here?",
        intro:
          "Our lift carries more than the bridge. Choose the counterweight's arm and try the lever.",
        retry:
          "The catch still holds. A 6 kg load turns harder than a 4 kg load at the same arm. Reconsider your weight's distance.",
        ready:
          "There we go! Take the parcel from the lift and bring it home to Moss.",
        parcel: "Moss is waiting across the canal. Safe travels!",
        complete:
          "A completed delivery and an open route. That's a good day's work.",
        blocked: "Find Moss to open the canal bridge first.",
      },
    },
    hints: {
      bridge: [
        "Watch which side dips. The same weight turns harder farther from the pivot.",
        "Compare mass × distance. The same gravity cancels on both sides.",
        "Place the 2 kg weight at 2 m, then try the crank: 2 × 2 matches 4 × 1.",
      ],
      lift: [
        "The lift has a heavier fixed load than the bridge.",
        "The fixed side is 6 × 1. Choose a distance that makes 2 × distance match.",
        "Place the 2 kg weight at 3 m, then try the lever: 2 × 3 matches 6 × 1.",
      ],
    },
    discoveryReplies: {
      moss: {
        "workshop-sketch":
          "You found my sketch! A small weight can match a bigger one with a longer arm. Measure from the pivot.",
      },
      bea: {
        "cargo-manifest":
          "The manifest explains the change: 6 kg here, 4 kg at the bridge. The same 2 kg counterweight needs a longer arm.",
      },
    },
    postcards,
    favor: {
      postcardId: "workshop",
      receiver: "bea",
      prompt: "I found a postcard for you.",
      thanks:
        "Moss's note! Thank you for bringing it. Keep the postcard for your collection; I'll visit when the mail is home.",
    },
  },
});

const ref = (id: string): MachineExpression => [{ op: "ref", id }];
const polynomial = (time: MachineExpression): MachineExpression => [
  ...ref("a"),
  ...time,
  { op: "literal", value: 2 },
  { op: "pow" },
  { op: "mul" },
  ...ref("b"),
  ...time,
  { op: "mul" },
  { op: "add" },
  ...ref("c"),
  { op: "add" },
];
const motionMachine: SimulationConfig = {
  kind: "simulation",
  briefing:
    "Calibrate two moving mail carts by choosing a time window and predicting signed instantaneous velocity.",
  modelNotes:
    "The authored cart positions are s(t)=t²−2t and s(t)=24−3t² in meters, with t in seconds. Compare the backward average [s(t)−s(t−h)]/h with the derivative at the checkpoint. The calibration requires an average within 0.12 m/s and the correct signed instantaneous prediction.",
  controls: [
    {
      id: "time",
      label: "Checkpoint time",
      kind: "number",
      min: 0,
      max: 2,
      step: 0.001,
      unit: "s",
    },
    {
      id: "interval",
      label: "Observation window",
      kind: "choice",
      options: [
        { label: "1 s", value: 1 },
        { label: "0.1 s", value: 0.1 },
        { label: "0.01 s", value: 0.01 },
      ],
    },
    {
      id: "estimate",
      label: "Predicted signed velocity",
      kind: "choice",
      options: [-6, -2, 0, 2, 6].map((value) => ({
        label: `${value} m/s`,
        value,
      })),
    },
  ],
  outputs: [
    {
      id: "position",
      label: "Position at checkpoint",
      unit: "m",
      expression: polynomial(ref("time")),
      derivativeWrt: null,
    },
    {
      id: "positionBefore",
      label: "Earlier position",
      unit: "m",
      expression: polynomial([
        ...ref("time"),
        ...ref("interval"),
        { op: "sub" },
      ]),
      derivativeWrt: null,
    },
    {
      id: "deltaPosition",
      label: "Signed displacement",
      unit: "m",
      expression: [...ref("position"), ...ref("positionBefore"), { op: "sub" }],
      derivativeWrt: null,
    },
    {
      id: "average",
      label: "Average velocity",
      unit: "m/s",
      expression: [...ref("deltaPosition"), ...ref("interval"), { op: "div" }],
      derivativeWrt: null,
    },
    {
      id: "instantaneous",
      label: "Instantaneous velocity",
      unit: "m/s",
      expression: ref("position"),
      derivativeWrt: "time",
    },
  ],
  plots: [{ inputId: "time", outputId: "position", min: 0, max: 2 }],
  tasks: (["bridge", "lift"] as const).map((site) => ({
    id: site,
    title: site === "bridge" ? "Outbound checkpoint" : "Return checkpoint",
    prompt:
      site === "bridge"
        ? "At t=2 s, choose a window whose average is within 0.12 m/s of instantaneous velocity; then set your signed prediction."
        : "The return cart follows a changed position law. At t=1 s, again bring the average within 0.12 m/s and predict signed instantaneous velocity.",
    constants: [
      { id: "a", value: site === "bridge" ? 1 : -3 },
      { id: "b", value: site === "bridge" ? -2 : 0 },
      { id: "c", value: site === "bridge" ? 0 : 24 },
    ],
    initialInputs: [
      { id: "time", value: site === "bridge" ? 2 : 1 },
      { id: "interval", value: 1 },
      { id: "estimate", value: 0 },
    ],
    referenceInputs: [
      { id: "time", value: site === "bridge" ? 2 : 1 },
      { id: "interval", value: 0.01 },
      { id: "estimate", value: site === "bridge" ? 2 : -6 },
    ],
    goal: [
      ...ref("average"),
      ...ref("instantaneous"),
      { op: "sub" },
      { op: "abs" },
      { op: "literal", value: 0.12 },
      { op: "lt" },
      ...ref("estimate"),
      ...ref("instantaneous"),
      { op: "eq" },
      { op: "and" },
    ],
    successFeedback:
      "The sampled average is close enough and your signed prediction matches. Calibration accepted.",
    failureFeedback:
      "Reconsider the time window and the signed velocity prediction; the average must be within 0.12 m/s.",
    transfer: site === "lift",
  })),
};
const motionStation = (site: SiteId): StationBinding => ({
  kind: "timing-gates",
  puzzleId: "motion-route",
  taskId: site,
  title: site === "bridge" ? "Outbound timing gate" : "Return timing gate",
  itemLabel: "Timing beacon",
  socketInput: "interval",
  socketValues: [1, 0.1, 0.01],
  socketLabels: ["1 s window", "0.1 s window", "0.01 s window"],
  prediction: { inputId: "estimate", values: [-6, -2, 0, 2, 6], unit: "m/s" },
  fixedInputs: { time: site === "bridge" ? 2 : 1 },
  motion: {
    timeInput: "time",
    positionOutput: "position",
    velocityOutput: "instantaneous",
    timeMin: 0,
    timeMax: 2,
  },
  readouts: [
    { id: "average", label: "Average velocity", unit: "m/s", kind: "output" },
    { id: "estimate", label: "Your prediction", unit: "m/s", kind: "input" },
    {
      id: "deltaPosition",
      label: "Signed displacement",
      unit: "m",
      kind: "output",
    },
  ],
  placementFeedback:
    "The beacon selects a time window. Watch the cart, set a signed prediction on the dial, and try the checkpoint.",
  baselineFeedback:
    "The recorder starts with a 1-second interval ending at the checkpoint and a zero prediction. This wide window samples motion before you change either control.",
  evidenceSummary:
    site === "bridge"
      ? "A shorter backward interval brings the average toward +2 m/s at t=2 s. A finite interval remains an approximation."
      : "The changed return trajectory needs the 0.01-second interval for this tolerance. Its −5.97 m/s average approaches −6 m/s instantaneous velocity; the negative sign describes direction.",
  successFeedback:
    "Calibration accepted! The average is within 0.12 m/s and your signed prediction matches.",
  failureFeedback:
    "The window or prediction needs another look. Aim for an average within 0.12 m/s of instantaneous velocity.",
  activationLabel: "Test calibration",
});
const motionSources: SourceRecord[] = [
  {
    id: "average-change",
    title: "OpenStax · Calculus Volume 1 · 3.1 Defining the Derivative",
    url: "https://openstax.org/books/calculus-volume-1/pages/3-1-defining-the-derivative",
    text: "Editorial summary: an average rate of change is the change in a function divided by the change in its input; instantaneous velocity is the limit of average velocities as the time interval shrinks.",
  },
  {
    id: "derivative-function",
    title:
      "OpenStax · University Physics Volume 1 · 3.2 Instantaneous Velocity and Speed",
    url: "https://openstax.org/books/university-physics-volume-1/pages/3-2-instantaneous-velocity-and-speed",
    text: "Editorial summary: differentiating position with respect to time gives signed instantaneous velocity. Negative velocity indicates motion in the negative coordinate direction; speed is its magnitude.",
  },
];
export const MINUTE_MAIL_EPISODE = validateEpisodeFixture({
  version: 1,
  id: "minute-mail",
  revision: 1,
  title: "Minute Mail",
  subtitle: "A small moment. A moving world.",
  description:
    "An authored courier adventure about average and instantaneous velocity.",
  briefing:
    "Moss's mail carts need their timing gates calibrated. Watch each cart, choose an observation window, and predict its signed velocity to reopen the courier route.",
  ending:
    "The timing gates agree with the moving carts. Moss's weather charts arrive on time.",
  sources: motionSources,
  objectives: [
    {
      id: "instantaneous-velocity",
      title:
        "Connect position, average velocity and signed instantaneous velocity",
      sourceIds: motionSources.map((source) => source.id),
      claim:
        "As a time window shrinks, its average velocity approaches the derivative of position at the checkpoint.",
      boundaries:
        "Two authored smooth one-dimensional trajectories; a finite interval remains an approximation, and two successful calibrations are not a mastery measurement.",
      misconception:
        "A cart moving backward has negative velocity, not negative speed.",
    },
  ],
  puzzles: [
    {
      id: "motion-route",
      title: "Mail-cart calibration",
      instructions:
        "Choose a time window and a signed instantaneous-velocity prediction. Calibration needs the correct prediction and an average within 0.12 m/s.",
      objectiveId: "instantaneous-velocity",
      sourceIds: motionSources.map((source) => source.id),
      config: motionMachine,
    },
  ],
  discoveries: [
    {
      id: "workshop-sketch",
      title: "Moss's timing sketch",
      text: "Two marks on a position-versus-time sketch enclose a window. Change in position ÷ elapsed time gives average velocity. Narrowing the window reveals what the cart is doing near the checkpoint.",
      sourceIds: ["average-change"],
    },
    {
      id: "cargo-manifest",
      title: "Bea's return schedule",
      text: "The return cart moves toward smaller position numbers. Its velocity is negative, even though its speed is positive. A changed route can need a narrower window for the same calibration tolerance.",
      sourceIds: ["derivative-function"],
    },
  ],
  assumptions: [
    "These two position laws are authored examples, not measured cart data: outbound s(t)=t²−2t at t=2 s; return s(t)=24−3t² at t=1 s.",
    "Positions are meters along one fixed coordinate axis; t is seconds. Displayed animation covers 0–2 s.",
    "A beacon selects the backward time window [t−h,t], not a spatial distance. Average velocity is the actual signed position difference divided by positive elapsed time h.",
    "Instantaneous velocity is the shared interpreter's automatic derivative of the same position expression. The displayed finite-window average is never labeled exact instantaneous velocity.",
    "Calibration requires |average − instantaneous| < 0.12 m/s plus the correct signed prediction. The tolerance is an authored instrument rule.",
    "A negative velocity means decreasing position; speed is the nonnegative magnitude of velocity.",
    "The cart animation repeats for observation. Carrying a timing beacon changes the observation window, not the cart's trajectory.",
    "Recorded observations, attempts and hint counts describe this playthrough, not measured mastery or long-term learning.",
  ],
  scene: {
    kit: "harbor-route-v1",
    stations: { bridge: motionStation("bridge"), lift: motionStation("lift") },
  },
  story: {
    npcNames: { moss: "Moss", bea: "Bea" },
    goals: {
      ...sharedGoals,
      bridge:
        "Carry the timing beacon to a window post, set a signed prediction on the dial, then test the outbound gate.",
      lift: "Calibrate Bea's return cart with a suitable time window and signed prediction.",
    },
    dialogue: {
      moss: {
        welcome:
          "Morning, courier! The bridge waits for our outbound cart's timing gate. Carry that beacon to a window post, watch the cart, and tell the dial how fast it's moving at the checkpoint.",
        intro:
          "The outbound cart follows s(t)=t²−2t. Our checkpoint is t=2 s. A post selects a time window; the dial sets your signed instantaneous-velocity prediction.",
        retry:
          "The gate needs the right prediction and an average within 0.12 m/s. Try a shorter time window and watch how the measured average changes.",
        ready:
          "That's the outbound gate calibrated! Cross the canal and ask Bea about the return cart. Bring our parcel home.",
        parcel:
          "Our weather charts! Bring the parcel here; you've kept the carts and the courier on time.",
        complete:
          "Right on time. Two calibrated gates and one very welcome delivery. Thank you, courier.",
        blocked: "The outbound timing gate is beside the bridge.",
      },
      bea: {
        welcome:
          "Our return cart is different: s(t)=24−3t², with a checkpoint at t=1 s. It heads toward smaller position numbers. Calibrate this gate to bring up the parcel.",
        intro:
          "Watch the return cart's direction. The dial predicts signed velocity, while the posts choose how long we observe it.",
        retry:
          "This cart changes velocity more quickly. A window that suited the first cart might be too wide here. Keep the negative direction in your prediction.",
        ready:
          "Return gate calibrated! The parcel is on the raised lift. Take it home to Moss.",
        parcel:
          "Moss is waiting across the canal. The gate will stay calibrated.",
        complete:
          "The mail is home and both timing gates are ready. A good day on the route.",
        blocked: "Open Moss's outbound route before coming to Windpost.",
      },
    },
    hints: {
      bridge: [
        "Watch the change in position over the selected time window. A shorter window samples closer to the checkpoint.",
        "Average velocity is [s(2)−s(2−h)]/h. It approaches the instantaneous value as h shrinks; the cart moves in the positive direction at t=2.",
        "Try the 0.1 s or 0.01 s post and predict +2 m/s. Their averages, 1.9 and 1.99 m/s, are within 0.12 m/s of +2.",
      ],
      lift: [
        "The return cart moves toward smaller position numbers. Choose a negative velocity prediction.",
        "For this route the average over [1−h,1] is −6+3h m/s. At h=0.1 the error is 0.3 m/s, outside the 0.12 tolerance.",
        "Use the 0.01 s window and predict −6 m/s. Its average is −5.97 m/s, only 0.03 m/s away.",
      ],
    },
    discoveryReplies: {
      moss: {
        "workshop-sketch":
          "That's my timing sketch. Two positions give an average; bring their times closer to inspect motion at one moment.",
      },
      bea: {
        "cargo-manifest":
          "The return schedule uses signed position. Heading toward smaller numbers means negative velocity, not negative speed.",
      },
    },
    postcards,
    favor: {
      postcardId: "workshop",
      receiver: "bea",
      prompt: "Moss left a postcard for you.",
      thanks:
        "A note from Moss! Thank you for bringing it across. Keep it for your collection; I'll stop by when the cart is back.",
    },
  },
});

export const EPISODES: readonly EpisodeFixture[] = [
  WINDPOST_EPISODE,
  MINUTE_MAIL_EPISODE,
];
