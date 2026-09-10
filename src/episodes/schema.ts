import { z } from "zod";
import {
  canonicalTransformerEvidence,
  validateTransformerConfig,
  verifyTransformerEvidence,
} from "../domain/transformers";
import { createEpisodeState, transitionEpisode } from "./engine";
import type {
  EpisodeAction,
  EpisodeCondition,
  EpisodePackage,
  EpisodeState,
  EpisodeValidationResult,
} from "./types";

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value),
    "Reserved identifier",
  );
const short = z.string().min(1).max(200);
const prose = z.string().min(1).max(4000);
const portrait = z.enum(["wren", "ada", "pip", "tock", "button"]);
export const episodeConditionSchema: z.ZodType<EpisodeCondition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(episodeConditionSchema).max(24) }).strict(),
    z.object({ any: z.array(episodeConditionSchema).min(1).max(24) }).strict(),
    z.object({ not: episodeConditionSchema }).strict(),
    z.object({ flag: id }).strict(),
    z.object({ hasItem: id }).strict(),
    z.object({ discovered: id }).strict(),
    z.object({ puzzlePassed: id }).strict(),
  ]),
);
const effect = z.discriminatedUnion("type", [
  z.object({ type: z.literal("grantItem"), item: id }).strict(),
  z.object({ type: z.literal("consumeItem"), item: id }).strict(),
  z
    .object({ type: z.literal("setFlag"), flag: id, value: z.boolean() })
    .strict(),
  z.object({ type: z.literal("discover"), discovery: id }).strict(),
  z.object({ type: z.literal("openPuzzle"), puzzle: id }).strict(),
]);
const dialogue = z
  .object({
    speaker: short,
    portrait: portrait.optional(),
    lines: z.array(prose).min(1).max(8),
  })
  .strict();
export const episodeActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("move"), scene: id }).strict(),
  z.object({ type: z.literal("interact"), target: id }).strict(),
  z.object({ type: z.literal("inspect"), target: id }).strict(),
  z.object({ type: z.literal("use"), item: id, target: id }).strict(),
  z.object({ type: z.literal("combine"), item: id, target: id }).strict(),
  z
    .object({
      type: z.literal("submitPuzzle"),
      puzzle: id,
      evidence: z.unknown(),
    })
    .strict(),
  z.object({ type: z.literal("hint") }).strict(),
]);
const safeUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Source URL must be HTTP(S) without credentials");
export const episodePackageSchema = z
  .object({
    version: z.literal(1),
    id,
    revision: z.number().int().min(1).max(1_000_000),
    title: short,
    subtitle: short,
    description: prose,
    briefing: prose,
    ending: prose,
    level: short,
    generated: z.boolean(),
    generation: z
      .object({ model: short, createdAt: z.string().datetime() })
      .strict()
      .optional(),
    sources: z
      .array(
        z
          .object({
            id,
            title: short,
            url: safeUrl.optional(),
            text: z.string().min(1).max(120_000),
            page: z.number().int().min(1).max(100_000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(24),
    objectives: z
      .array(
        z
          .object({ id, title: short, sourceIds: z.array(id).min(1).max(24) })
          .strict(),
      )
      .min(1)
      .max(8),
    scenes: z
      .array(
        z
          .object({
            id,
            name: short,
            description: prose,
            background: z.enum([
              "jetty",
              "tearoom",
              "workshop",
              "storeroom",
              "signalhouse",
              "lantern",
            ]),
            exits: z.array(id).max(8),
            hotspots: z
              .array(
                z
                  .object({
                    id,
                    label: short,
                    x: z.number().min(0).max(100),
                    y: z.number().min(0).max(100),
                    w: z.number().positive().max(100),
                    h: z.number().positive().max(100),
                    kind: z.enum(["character", "object"]),
                    portrait: portrait.optional(),
                    icon: short.optional(),
                    visibleIf: episodeConditionSchema.optional(),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    startScene: id,
    items: z
      .array(
        z.object({ id, name: short, description: prose, icon: short }).strict(),
      )
      .max(24),
    discoveries: z
      .array(
        z
          .object({
            id,
            title: short,
            text: prose,
            sourceIds: z.array(id).max(24),
          })
          .strict(),
      )
      .max(40),
    puzzles: z
      .array(
        z
          .object({
            id,
            title: short,
            instructions: prose,
            objectiveId: id,
            sourceIds: z.array(id).min(1).max(24),
            config: z.unknown(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    rules: z
      .array(
        z
          .object({
            id,
            trigger: z
              .object({
                verb: z.enum(["inspect", "interact", "use", "combine"]),
                target: id,
                item: id.optional(),
              })
              .strict(),
            when: episodeConditionSchema.optional(),
            effects: z.array(effect).max(16),
            dialogue: dialogue.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    hints: z
      .array(z.object({ when: episodeConditionSchema, text: prose }).strict())
      .min(1)
      .max(40),
    completion: episodeConditionSchema,
    referenceSolution: z.array(episodeActionSchema).min(2).max(256),
  })
  .strict();

function stateKey(state: EpisodeState): string {
  return JSON.stringify([
    state.scene,
    [...state.inventory].sort(),
    Object.keys(state.flags)
      .filter((key) => state.flags[key])
      .sort(),
    [...state.discoveries].sort(),
    [...state.solvedPuzzles].sort(),
    state.started,
    state.completed,
    state.activePuzzle ?? null,
  ]);
}

/** Exhaustive finite story-state exploration; reviewed puzzle witnesses replace only valid apparatus trials. */
export function certifyEpisodeSolvability(
  pkg: EpisodePackage,
  maxStates = 20_000,
): { valid: boolean; errors: string[]; exploredStates: number } {
  const errors: string[] = [];
  const witnesses = new Map<string, unknown>();
  for (const puzzle of pkg.puzzles) {
    try {
      const evidence = canonicalTransformerEvidence(puzzle.config);
      if (!verifyTransformerEvidence(puzzle.config, evidence))
        throw new Error("reviewed witness does not verify");
      witnesses.set(puzzle.id, evidence);
    } catch (error) {
      errors.push(
        `Puzzle ${puzzle.id} has no verified solution: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (errors.length) return { valid: false, errors, exploredStates: 0 };
  let reference = createEpisodeState(pkg);
  for (const action of pkg.referenceSolution)
    reference = transitionEpisode(pkg, reference, action).state;
  if (!reference.completed)
    return {
      valid: false,
      errors: [
        "The reference solution does not reach the ending using valid actions and verified puzzle evidence.",
      ],
      exploredStates: 0,
    };
  const initial = createEpisodeState(pkg);
  const states = [initial];
  const indices = new Map([[stateKey(initial), 0]]);
  const incoming: number[][] = [[]];
  const wins: number[] = [];
  const ruleActions: EpisodeAction[] = pkg.rules.map(({ trigger }) =>
    trigger.verb === "combine" || trigger.verb === "use"
      ? { type: trigger.verb, target: trigger.target, item: trigger.item! }
      : { type: trigger.verb, target: trigger.target },
  );
  for (let cursor = 0; cursor < states.length; cursor += 1) {
    const state = states[cursor];
    if (state.completed) {
      if (
        pkg.objectives.some(
          (objective) =>
            !pkg.puzzles.some(
              (puzzle) =>
                puzzle.objectiveId === objective.id &&
                state.solvedPuzzles.includes(puzzle.id),
            ),
        )
      )
        return {
          valid: false,
          errors: [
            "The ending is reachable before every learning objective has verified puzzle evidence.",
          ],
          exploredStates: states.length,
        };
      wins.push(cursor);
    }
    const scene = pkg.scenes.find((candidate) => candidate.id === state.scene)!;
    const actions: EpisodeAction[] = !state.started
      ? [{ type: "start" }]
      : [
          ...scene.exits.map((target): EpisodeAction => ({
            type: "move",
            scene: target,
          })),
          ...ruleActions,
          ...(state.activePuzzle
            ? [
                {
                  type: "submitPuzzle" as const,
                  puzzle: state.activePuzzle,
                  evidence: witnesses.get(state.activePuzzle),
                },
              ]
            : []),
        ];
    for (const action of actions) {
      const next = transitionEpisode(pkg, state, action).state;
      if (state.completed && !next.completed)
        return {
          valid: false,
          errors: ["An optional interaction can undo the completed ending."],
          exploredStates: states.length,
        };
      const key = stateKey(next);
      let target = indices.get(key);
      if (target === undefined) {
        if (states.length >= maxStates)
          return {
            valid: false,
            errors: [
              `Solvability proof exceeded its ${maxStates}-state bound. Simplify the case; it has not been certified.`,
            ],
            exploredStates: states.length,
          };
        target = states.length;
        states.push(next);
        indices.set(key, target);
        incoming.push([]);
      }
      if (target !== cursor) incoming[target].push(cursor);
    }
  }
  const canFinish = new Set(wins);
  for (let cursor = 0; cursor < wins.length; cursor += 1)
    for (const prior of incoming[wins[cursor]])
      if (!canFinish.has(prior)) {
        canFinish.add(prior);
        wins.push(prior);
      }
  const stranded = states.findIndex((_, index) => !canFinish.has(index));
  if (stranded >= 0)
    errors.push(
      `A reachable state cannot finish the case (room ${states[stranded].scene}; inventory ${states[stranded].inventory.join(", ") || "empty"}). An action can strand the player.`,
    );
  return { valid: errors.length === 0, errors, exploredStates: states.length };
}

export function validateEpisodePackage(raw: unknown): EpisodeValidationResult {
  const errors: string[] = [];
  try {
    if (JSON.stringify(raw).length > 2_000_000)
      return {
        valid: false,
        errors: ["Episode package exceeds the 2 MB data limit."],
      };
    const parsed = episodePackageSchema.safeParse(raw);
    if (!parsed.success)
      return {
        valid: false,
        errors: parsed.error.issues
          .slice(0, 30)
          .map(
            (issue) => `${issue.path.join(".") || "package"}: ${issue.message}`,
          ),
      };
    const pkg = parsed.data as EpisodePackage;
    const sets = {
      scenes: new Set(pkg.scenes.map((entry) => entry.id)),
      items: new Set(pkg.items.map((entry) => entry.id)),
      sources: new Set(pkg.sources.map((entry) => entry.id)),
      discoveries: new Set(pkg.discoveries.map((entry) => entry.id)),
      puzzles: new Set(pkg.puzzles.map((entry) => entry.id)),
      objectives: new Set(pkg.objectives.map((entry) => entry.id)),
      hotspots: new Set(
        pkg.scenes.flatMap((scene) => scene.hotspots.map((spot) => spot.id)),
      ),
      flags: new Set(
        pkg.rules.flatMap((rule) =>
          rule.effects.flatMap((entry) =>
            entry.type === "setFlag" ? [entry.flag] : [],
          ),
        ),
      ),
    };
    for (const [name, entries] of Object.entries({
      scenes: pkg.scenes,
      items: pkg.items,
      sources: pkg.sources,
      discoveries: pkg.discoveries,
      puzzles: pkg.puzzles,
      objectives: pkg.objectives,
      rules: pkg.rules,
      hotspots: pkg.scenes.flatMap((scene) => scene.hotspots),
    }))
      if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
        errors.push(`Duplicate ${name} identifiers.`);
    const ref = (set: Set<string>, value: string, label: string) => {
      if (!set.has(value)) errors.push(`Unknown ${label}: ${value}.`);
    };
    const sourceRefs = (values: string[], label: string) => {
      if (new Set(values).size !== values.length)
        errors.push(`Duplicate source references in ${label}.`);
      values.forEach((value) => ref(sets.sources, value, `${label} source`));
    };
    const condition = (value: EpisodeCondition, depth = 0): void => {
      if (depth > 12) {
        errors.push("Condition nesting exceeds 12 levels.");
        return;
      }
      if ("all" in value || "any" in value)
        ("all" in value ? value.all : value.any).forEach((part) =>
          condition(part, depth + 1),
        );
      else if ("not" in value) condition(value.not, depth + 1);
      else if ("flag" in value) ref(sets.flags, value.flag, "condition flag");
      else if ("hasItem" in value)
        ref(sets.items, value.hasItem, "condition item");
      else if ("discovered" in value)
        ref(sets.discoveries, value.discovered, "condition discovery");
      else ref(sets.puzzles, value.puzzlePassed, "condition puzzle");
    };
    ref(sets.scenes, pkg.startScene, "start scene");
    for (const scene of pkg.scenes) {
      if (new Set(scene.exits).size !== scene.exits.length)
        errors.push(`Duplicate exits in ${scene.id}.`);
      for (const exit of scene.exits) {
        ref(sets.scenes, exit, "exit scene");
        if (exit === scene.id)
          errors.push(`Scene ${scene.id} exits to itself.`);
      }
      for (const spot of scene.hotspots) {
        if (spot.x + spot.w > 100.001 || spot.y + spot.h > 100.001)
          errors.push(`Hotspot ${spot.id} exceeds scene boundaries.`);
        if (spot.visibleIf) condition(spot.visibleIf);
      }
    }
    for (const objective of pkg.objectives) {
      sourceRefs(objective.sourceIds, objective.id);
      if (!pkg.puzzles.some((puzzle) => puzzle.objectiveId === objective.id))
        errors.push(`Objective ${objective.id} has no puzzle.`);
    }
    for (const discovery of pkg.discoveries)
      sourceRefs(discovery.sourceIds, discovery.id);
    for (const puzzle of pkg.puzzles) {
      sourceRefs(puzzle.sourceIds, puzzle.id);
      ref(sets.objectives, puzzle.objectiveId, "puzzle objective");
      try {
        puzzle.config = validateTransformerConfig(puzzle.config);
      } catch (error) {
        errors.push(
          `Puzzle ${puzzle.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (
        !pkg.rules.some((rule) =>
          rule.effects.some(
            (entry) =>
              entry.type === "openPuzzle" && entry.puzzle === puzzle.id,
          ),
        )
      )
        errors.push(
          `Puzzle ${puzzle.id} has no world interaction that opens it.`,
        );
    }
    for (const rule of pkg.rules) {
      if (rule.when) condition(rule.when);
      const trigger = rule.trigger;
      if (trigger.verb === "combine") {
        ref(sets.items, trigger.target, "combination target");
        if (trigger.item === trigger.target)
          errors.push(`Rule ${rule.id} combines an item with itself.`);
      } else if (trigger.verb === "inspect") {
        ref(sets.items, trigger.target, "inventory inspection target");
      } else ref(sets.hotspots, trigger.target, "interaction target");
      if (trigger.verb === "use" || trigger.verb === "combine") {
        if (!trigger.item) errors.push(`Rule ${rule.id} requires an item.`);
        else ref(sets.items, trigger.item, "trigger item");
      } else if (trigger.item !== undefined)
        errors.push(`Rule ${rule.id} has an unexpected trigger item.`);
      if (
        rule.effects.filter((entry) => entry.type === "openPuzzle").length > 1
      )
        errors.push(`Rule ${rule.id} opens multiple puzzles.`);
      for (const entry of rule.effects) {
        if (entry.type === "grantItem" || entry.type === "consumeItem")
          ref(sets.items, entry.item, "effect item");
        else if (entry.type === "discover")
          ref(sets.discoveries, entry.discovery, "effect discovery");
        else if (entry.type === "openPuzzle") {
          ref(sets.puzzles, entry.puzzle, "effect puzzle");
          if (trigger.verb !== "interact" && trigger.verb !== "use")
            errors.push(
              `Rule ${rule.id}: openPuzzle requires an interact or use action on a world hotspot.`,
            );
        }
      }
    }
    for (const action of pkg.referenceSolution) {
      if (action.type === "move")
        ref(sets.scenes, action.scene, "reference scene");
      else if (action.type === "submitPuzzle")
        ref(sets.puzzles, action.puzzle, "reference puzzle");
      else if (action.type !== "start" && action.type !== "hint") {
        if (action.type === "use" || action.type === "combine")
          ref(sets.items, action.item, "reference item");
        if (action.type === "combine")
          ref(sets.items, action.target, "reference combination target");
        else if (action.type === "inspect") {
          ref(
            sets.items,
            action.target,
            "reference inventory inspection target",
          );
        } else
          ref(sets.hotspots, action.target, "reference interaction target");
      }
    }
    pkg.hints.forEach((hint) => condition(hint.when));
    condition(pkg.completion);
    if (sets.flags.size > 24)
      errors.push("The case exceeds the 24-flag story-state limit.");
    if (errors.length) return { valid: false, errors };
    const proof = certifyEpisodeSolvability(pkg);
    return proof.valid
      ? {
          valid: true,
          package: pkg,
          errors: [],
          exploredStates: proof.exploredStates,
        }
      : proof;
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Invalid episode data: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
