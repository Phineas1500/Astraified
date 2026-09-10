import { z } from "zod";
import type { SourceRecord } from "../domain/types";
import type { EpisodePackage } from "../episodes/types";
import {
  evaluateSimulation,
  simulationInputs,
  validateLessonMachineConfig,
  type LessonMachineConfig,
} from "../domain/lesson-machines";
import {
  assertGeneratedSimulationTransfer,
  validateEpisodeFixture,
  type EpisodeFixture,
  type SiteId,
  type StationBinding,
} from "./episodes";

const text = z.string().min(1).max(2400);
const stationStory = z
  .object({
    title: text,
    itemLabel: text,
    intro: text,
    retry: text,
    success: text,
    hints: z.array(text).length(3),
    discovery: z.object({ title: text, text }).strict(),
  })
  .strict();
export const harborStorySchema = z
  .object({
    title: text,
    subtitle: text,
    description: text,
    briefing: text,
    ending: text,
    stations: z.array(stationStory).length(2),
    flavor: z
      .object({
        mossWelcome: text,
        mossReturn: text,
        mossEnding: text,
        beaWelcome: text,
        beaReturn: text,
        beaEnding: text,
        postcardText: text,
        favorThanks: text,
      })
      .strict(),
  })
  .strict();
export type HarborStory = z.infer<typeof harborStorySchema>;
export interface GeneratedHarborInput {
  id: string;
  createdAt: string;
  level: string;
  model?: string;
  sources: SourceRecord[];
  objective: {
    id: string;
    title: string;
    claim: string;
    boundaries: string;
    misconception: string;
    evidence: { sourceId: string; quote: string }[];
  };
  config: LessonMachineConfig;
  story: HarborStory;
}

/** Mechanics gate used before story generation; unsupported lessons fail explicitly. */
export function validateGeneratedHarborConfig(
  raw: unknown,
  sources: SourceRecord[],
): LessonMachineConfig {
  const config = validateLessonMachineConfig(raw);
  const cases = config.kind === "simulation" ? config.tasks : config.rounds;
  if (cases.length !== 2)
    throw new RangeError(
      "A generated harbor episode requires exactly two cases",
    );
  if (config.kind === "simulation") {
    const token = config.controls[0],
      dial = config.controls[1];
    if (
      config.controls.length < 1 ||
      config.controls.length > 2 ||
      token.kind !== "choice" ||
      token.options.length !== 3 ||
      (dial &&
        (dial.kind !== "choice" ||
          dial.options.length < 2 ||
          dial.options.length > 8)) ||
      config.outputs.length < 1 ||
      config.outputs.length > 4
    )
      throw new RangeError(
        "Generated experiments require one three-choice token, an optional choice dial with 2–8 values, and 1–4 outputs",
      );
    for (const task of config.tasks)
      for (const option of token.options)
        for (const dialOption of dial?.options ?? [undefined])
          evaluateSimulation(config, task.id, {
            ...simulationInputs(config, task.id),
            [token.id]: option.value,
            ...(dial ? { [dial.id]: dialOption!.value } : {}),
          });
    assertGeneratedSimulationTransfer(config);
  } else
    for (const round of config.rounds) {
      if (
        round.cards.length < 3 ||
        round.cards.length > 6 ||
        round.slots.length < 2 ||
        round.slots.length > 3
      )
        throw new RangeError("Evidence crates support 3–6 cards and 2–3 slots");
      if (
        round.cards.some((card) =>
          card.sourceIds.some(
            (id) => !sources.some((source) => source.id === id),
          ),
        )
      )
        throw new RangeError("Evidence card cites an unknown supplied source");
    }
  return config;
}

/** Compile reviewed source content into the supported physical kit; never replace its lesson. */
export function compileGeneratedHarbor(
  input: GeneratedHarborInput,
): EpisodeFixture {
  const story = harborStorySchema.parse(input.story);
  const config = validateGeneratedHarborConfig(input.config, input.sources);
  const evidence = input.objective.evidence;
  if (
    !evidence.length ||
    evidence.some(
      (entry) => !input.sources.some((source) => source.id === entry.sourceId),
    )
  )
    throw new RangeError(
      "Generated objective requires supplied source evidence",
    );
  const sourceIds = [...new Set(evidence.map((entry) => entry.sourceId))];
  const cases = config.kind === "simulation" ? config.tasks : config.rounds;
  const station = (site: SiteId, index: 0 | 1): StationBinding => {
    const words = story.stations[index],
      task = cases[index];
    const common = {
      puzzleId: "source-lesson",
      taskId: task.id,
      title: words.title,
      itemLabel: words.itemLabel,
      placementFeedback: task.prompt,
      baselineFeedback:
        config.kind === "simulation"
          ? "Observe the apparatus's starting readings before placing the token or adjusting its dial."
          : "Inspect the source-linked cards before arranging them. The starting layout has every card unassigned.",
      evidenceSummary: input.objective.claim,
      successFeedback: task.successFeedback,
      failureFeedback: task.failureFeedback,
      activationLabel:
        config.kind === "simulation"
          ? "Test the experiment"
          : "Check the arrangement",
    };
    if (config.kind === "evidence")
      return {
        ...common,
        kind: "evidence-crates",
        slotIds: config.rounds[index].slots.map((slot) => slot.id),
        slotLabels: config.rounds[index].slots.map((slot) => slot.label),
        readouts: [],
      };
    const token = config.controls[0],
      dial = config.controls[1];
    if (token.kind !== "choice" || (dial && dial.kind !== "choice"))
      throw new RangeError("Unsupported generated control");
    return {
      ...common,
      kind: "experiment",
      socketInput: token.id,
      socketValues: token.options.map((option) => option.value) as [
        number,
        number,
        number,
      ],
      socketLabels: token.options.map((option) => option.label) as [
        string,
        string,
        string,
      ],
      ...(dial
        ? {
            prediction: {
              inputId: dial.id,
              values: dial.options.map((option) => option.value),
              unit: "value",
            },
          }
        : {}),
      readouts: config.outputs.map((output) => ({
        id: output.id,
        label: output.label,
        unit: output.unit,
        kind: "output" as const,
      })),
    };
  };
  const discoveryIds = ["workshop-sketch", "cargo-manifest"] as const;
  const hints = {
    bridge: story.stations[0].hints,
    lift: story.stations[1].hints,
  };
  const casesBySite = { bridge: cases[0], lift: cases[1] };
  const goals = {
    arrival: "Find Moss beside the first station and ask about the route.",
    bridge: casesBySite.bridge.prompt,
    crossing: "Cross the opened bridge and meet Bea at the second station.",
    lift: casesBySite.lift.prompt,
    collect: "Collect the parcel from the raised platform.",
    return: "Carry the parcel back across the bridge to Moss.",
    complete: story.ending,
  };
  const npc = (site: SiteId, index: 0 | 1) => ({
    welcome:
      site === "bridge" ? story.flavor.mossWelcome : story.flavor.beaWelcome,
    intro: cases[index].prompt,
    retry: cases[index].failureFeedback,
    ready:
      site === "bridge"
        ? `${story.stations[index].success} ${goals.crossing}`
        : `${story.stations[index].success} ${goals.collect}`,
    parcel:
      site === "bridge" ? story.flavor.mossReturn : story.flavor.beaReturn,
    complete:
      site === "bridge" ? story.flavor.mossEnding : story.flavor.beaEnding,
    blocked: "Meet Moss and open the first route before continuing.",
  });
  const objective: EpisodePackage["objectives"][number] = {
    id: input.objective.id,
    title: input.objective.title,
    claim: input.objective.claim,
    boundaries: input.objective.boundaries,
    misconception: input.objective.misconception,
    evidence: input.objective.evidence,
    sourceIds,
  };
  return validateEpisodeFixture({
    version: 1,
    id: input.id,
    revision: 1,
    generated: true,
    level: input.level,
    generation: {
      model: input.model ?? "unspecified",
      createdAt: input.createdAt,
    },
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
    briefing: story.briefing,
    ending: story.ending,
    sources: input.sources,
    objectives: [objective],
    puzzles: [
      {
        id: "source-lesson",
        title: input.objective.title,
        instructions: config.briefing,
        objectiveId: input.objective.id,
        sourceIds,
        config,
      },
    ],
    discoveries: story.stations.map((entry, index) => ({
      id: discoveryIds[index],
      title: entry.discovery.title,
      text: entry.discovery.text,
      sourceIds,
    })),
    assumptions: [
      input.objective.boundaries,
      config.modelNotes,
      "This game uses a supplied source model and a fixed harbor scene. Scene machinery and characters are presentation, not evidence of the lesson's scientific or historical claims.",
      "The recorded starting arrangement, attempts and hints describe this playthrough, not measured mastery.",
    ],
    scene: {
      kit: "harbor-route-v1",
      stations: { bridge: station("bridge", 0), lift: station("lift", 1) },
    },
    story: {
      npcNames: { moss: "Moss", bea: "Bea" },
      goals,
      dialogue: { moss: npc("bridge", 0), bea: npc("lift", 1) },
      hints,
      discoveryReplies: {
        moss: { "workshop-sketch": story.stations[0].intro },
        bea: { "cargo-manifest": story.stations[1].intro },
      },
      postcards: [
        {
          id: "harbor",
          title: "From the harbor",
          text: "A keepsake from the start of your route.",
        },
        {
          id: "workshop",
          title: "A postcard for Bea",
          text: story.flavor.postcardText,
        },
        {
          id: "lookout",
          title: "Across the water",
          text: "A keepsake from the far end of your route.",
        },
      ],
      favor: {
        postcardId: "workshop",
        receiver: "bea",
        prompt: "I found a postcard for you.",
        thanks: story.flavor.favorThanks,
      },
    },
  });
}
