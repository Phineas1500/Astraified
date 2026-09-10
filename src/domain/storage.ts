import { z } from "zod";
import type { MissionPackage, StationId } from "./types";
import { shortestRoute } from "./routing";

export interface SavedProgress {
  completed: StationId[];
  assisted: StationId[];
  attempts: number;
  hints: number;
}

const STATION_IDS: StationId[] = ["workshop", "relay", "beacon"];
const MAX_MISSION_CHARS = 512_000;
const MAX_PROGRESS_CHARS = 16_000;
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0);
const short = text(180);
const prose = text(1600);
const referenceIds = z
  .array(short)
  .min(1)
  .max(6)
  .refine((ids) => new Set(ids).size === ids.length);
const sourceUrl = text(4096).refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
});

const SourceSchema = z
  .object({
    id: short,
    title: text(320),
    text: text(24_000),
    url: sourceUrl.optional(),
    page: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

const StationSchema = z
  .object({
    id: z.enum(["workshop", "relay", "beacon"]),
    name: short,
    title: short,
    story: prose,
    task: prose,
    concept: prose,
    sourceIds: referenceIds,
    hints: z.array(prose).min(1).max(3),
    kind: z.enum(["circuit", "routing"]),
    circuit: z
      .object({
        goal: z.enum(["closed", "series", "parallel"]),
        voltage: z.number().min(1).max(48),
        resistance: z.number().min(1).max(1000),
      })
      .strict()
      .optional(),
    routing: z
      .object({
        nodes: z.array(text(20)).min(3).max(7),
        edges: z
          .array(
            z
              .object({
                from: text(20),
                to: text(20),
                weight: z.number().int().min(0).max(50),
              })
              .strict(),
          )
          .min(2)
          .max(16),
        start: text(20),
        end: text(20),
      })
      .strict()
      .optional(),
    check: z
      .object({
        question: prose,
        options: z
          .array(text(800))
          .min(2)
          .max(6)
          .refine((options) => new Set(options).size === options.length),
        answer: z.number().int().min(0).max(5),
        explanation: prose,
      })
      .strict()
      .refine((check) => check.answer < check.options.length),
  })
  .strict();

const MissionSchema = z
  .object({
    version: z.literal(1),
    id: short,
    title: short,
    subtitle: short,
    topic: short,
    description: prose,
    briefing: prose,
    estimatedMinutes: z.number().int().min(1).max(60),
    level: short,
    sources: z.array(SourceSchema).min(1).max(80),
    objectives: z
      .array(
        z.object({ id: short, title: short, sourceIds: referenceIds }).strict(),
      )
      .length(3),
    stations: z.array(StationSchema).length(3),
    conclusion: prose,
    generated: z.boolean(),
    generation: z
      .object({
        model: short,
        createdAt: text(50).refine(
          (value) =>
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
              value,
            ) && Number.isFinite(Date.parse(value)),
        ),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Treat saved browser data as an untrusted cache; callers choose the fallback. */
export function parseSavedMission(raw: string | null): MissionPackage | null {
  if (!raw || raw.length > MAX_MISSION_CHARS) return null;
  try {
    const result = MissionSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    const mission = result.data;
    if (mission.generated && !mission.generation) return null;
    const sources = new Set(mission.sources.map((source) => source.id));
    if (
      sources.size !== mission.sources.length ||
      mission.sources.reduce((sum, source) => sum + source.text.length, 0) >
        64_000
    )
      return null;
    if (new Set(mission.objectives.map((objective) => objective.id)).size !== 3)
      return null;
    if (
      ![...mission.objectives, ...mission.stations].every((item) =>
        item.sourceIds.every((id) => sources.has(id)),
      )
    )
      return null;
    if (
      !mission.stations.every(
        (station, index) =>
          station.id === STATION_IDS[index] &&
          station.kind === mission.stations[0]!.kind,
      )
    )
      return null;

    for (const [index, station] of mission.stations.entries()) {
      if (station.kind === "circuit") {
        if (
          !station.circuit ||
          station.routing ||
          station.circuit.goal !== ["closed", "series", "parallel"][index]
        )
          return null;
      } else {
        if (!station.routing || station.circuit) return null;
        const graph = station.routing;
        if (
          !graph.nodes.includes(graph.start) ||
          !graph.nodes.includes(graph.end) ||
          graph.start === graph.end ||
          graph.edges.some((edge) => edge.from === edge.to)
        )
          return null;
        // At most seven nodes and sixteen edges; reuse the reviewed graph validator.
        if (
          graph.nodes.some(
            (node) => shortestRoute({ ...graph, end: node }) === null,
          )
        )
          return null;
      }
    }
    return mission;
  } catch {
    return null;
  }
}

/** Normalizes stale progress while never inventing completed work or assistance. */
export function parseSavedProgress(
  raw: string | null,
  mission: MissionPackage,
): SavedProgress {
  const empty = (): SavedProgress => ({
    completed: [],
    assisted: [],
    attempts: 0,
    hints: 0,
  });
  if (!raw || raw.length > MAX_PROGRESS_CHARS) return empty();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return empty();
    const saved = parsed as Record<string, unknown>;
    const validIds = mission.stations.map((station) => station.id);
    const known = (value: unknown): Set<StationId> =>
      new Set(
        Array.isArray(value)
          ? value.filter(
              (id): id is StationId =>
                typeof id === "string" && validIds.includes(id as StationId),
            )
          : [],
      );
    const requestedCompleted = known(saved.completed);
    const assisted = known(saved.assisted);
    const completed: StationId[] = [];
    for (const id of validIds) {
      if (!requestedCompleted.has(id)) break;
      completed.push(id);
    }
    const counter = (value: unknown): number =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : 0;
    return {
      completed,
      assisted: validIds.filter((id) => assisted.has(id)),
      attempts: counter(saved.attempts),
      hints: counter(saved.hints),
    };
  } catch {
    return empty();
  }
}
