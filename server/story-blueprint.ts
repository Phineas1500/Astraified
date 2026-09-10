import { z } from "zod";
import type {
  GeneralLearningPlan,
  GeneralStory,
} from "./general-generation.js";
import { SourceError } from "./errors.js";

const label = z.string().min(1).max(140);
const line = z.string().min(1).max(350);
const prose = z.string().min(1).max(1000);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const portrait = z.enum(["wren", "ada", "pip", "tock", "button"]);
const icon = z.enum([
  "paper",
  "note",
  "record",
  "ticket",
  "map",
  "letter",
  "tape",
  "comb",
  "rail",
  "cartridge",
  "shutter",
  "mask",
  "magnet",
  "hook",
  "tool",
  "key",
  "thread",
  "cord",
  "keepsake",
  "gift",
  "machine",
  "radio",
]);
const room = z
  .object({
    name: label,
    description: line,
    background: z.enum([
      "jetty",
      "tearoom",
      "workshop",
      "storeroom",
      "signalhouse",
      "lantern",
    ]),
  })
  .strict();
const item = z.object({ name: label, description: line, icon }).strict();
const pickup = item.extend({ worldLabel: label, pickupLine: line }).strict();

/** The model authors fiction and source-specific hooks; code owns the quest graph. */
export const storyBlueprintSchema = z
  .object({
    title: label,
    subtitle: label,
    description: prose,
    briefing: prose,
    ending: prose,
    topology: z.enum(["loop", "hub"]),
    swapLeads: z.boolean(),
    rooms: z
      .object({
        arrival: room,
        firstLead: room,
        secondLead: room,
        finale: room,
      })
      .strict(),
    guide: z
      .object({
        name: label,
        portrait,
        welcome: line,
        afterFirstLead: line,
        readyToFinish: line,
        afterCompletion: line,
      })
      .strict(),
    neighbor: z
      .object({
        name: label,
        portrait,
        room: z.enum(["firstLead", "secondLead"]),
        greeting: line,
        request: line,
        thanks: line,
        afterCompletion: line,
      })
      .strict(),
    equipment: z
      .object({
        firstPart: pickup,
        secondPart: pickup,
        combinedTool: item,
        combinationLine: line,
      })
      .strict(),
    favor: z.object({ lostItem: pickup, reward: item }).strict(),
    machines: z
      .array(
        z
          .object({
            objectiveId: id,
            title: label,
            instructions: line,
            apparatusLabel: label,
            icon,
            intro: line,
            solved: line,
            discovery: z.object({ title: label, text: prose }).strict(),
          })
          .strict(),
      )
      .min(2)
      .max(3),
    finish: z
      .object({
        objectLabel: label,
        icon,
        lockedLine: line,
        readyLine: line,
        completedLine: line,
      })
      .strict(),
  })
  .strict();
export type StoryBlueprint = z.infer<typeof storyBlueprintSchema>;

type FlatCondition = GeneralStory["completion"][number];
type FlatEffect = GeneralStory["rules"][number]["effects"][number];
type SolutionStep = GeneralStory["referenceSolution"][number];
type SceneId = "arrival" | "first-lead" | "second-lead" | "finale";
const atom = (
  kind: FlatCondition["kind"],
  id: string,
  expected = true,
): FlatCondition => ({ kind, id, expected });
const effect = (
  type: FlatEffect["type"],
  id: string,
  value = true,
): FlatEffect => ({ type, id, value });
const action = (
  type: SolutionStep["type"],
  fields: Partial<Omit<SolutionStep, "type">> = {},
): SolutionStep => ({
  type,
  target: null,
  item: null,
  scene: null,
  puzzle: null,
  ...fields,
});

/**
 * Compile a small, reviewable narrative into either of two reversible quest
 * structures. There are no topic branches and no model-authored rule boilerplate.
 */
export function compileStoryBlueprint(
  raw: unknown,
  plan: GeneralLearningPlan,
): GeneralStory {
  const parsed = storyBlueprintSchema.safeParse(raw);
  if (!parsed.success)
    throw new SourceError(
      502,
      `The narrative blueprint did not match its format: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`.slice(0, 1700),
      "invalid_episode",
    );
  const blueprint = parsed.data;
  const objectiveIds = plan.objectives.map((objective) => objective.id);
  if (
    objectiveIds.length < 2 ||
    objectiveIds.length > 3 ||
    new Set(objectiveIds).size !== objectiveIds.length ||
    blueprint.machines.length !== objectiveIds.length ||
    new Set(blueprint.machines.map((machine) => machine.objectiveId)).size !==
      objectiveIds.length ||
    blueprint.machines.some(
      (machine) => !objectiveIds.includes(machine.objectiveId),
    )
  )
    throw new SourceError(
      502,
      "The narrative blueprint needs exactly one machine hook for every supplied learning objective.",
      "invalid_episode",
    );
  const machines = objectiveIds.map((objectiveId) =>
    blueprint.machines.find((machine) => machine.objectiveId === objectiveId)!,
  );
  const firstScene: SceneId = blueprint.swapLeads
    ? "second-lead"
    : "first-lead";
  const secondScene: SceneId = blueprint.swapLeads
    ? "first-lead"
    : "second-lead";
  const machineScenes: SceneId[] = [firstScene, secondScene, "finale"];
  const roomData = {
    arrival: blueprint.rooms.arrival,
    "first-lead": blueprint.rooms.firstLead,
    "second-lead": blueprint.rooms.secondLead,
    finale: blueprint.rooms.finale,
  };
  const neighborScene: SceneId =
    blueprint.neighbor.room === "firstLead" ? "first-lead" : "second-lead";
  const exitMap: Record<SceneId, SceneId[]> =
    blueprint.topology === "hub"
      ? {
          arrival: ["first-lead", "second-lead", "finale"],
          "first-lead": ["arrival"],
          "second-lead": ["arrival"],
          finale: ["arrival"],
        }
      : {
          arrival: ["first-lead", "second-lead"],
          "first-lead": ["arrival", "finale"],
          "second-lead": ["arrival", "finale"],
          finale: ["first-lead", "second-lead"],
        };
  const scenes: GeneralStory["scenes"] = (
    Object.keys(roomData) as SceneId[]
  ).map((sceneId) => ({
    id: sceneId,
    ...roomData[sceneId],
    exits: exitMap[sceneId],
    hotspots: [],
  }));
  const addSpot = (
    sceneId: SceneId,
    spot: Partial<GeneralStory["scenes"][number]["hotspots"][number]> & {
      id: string;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    },
  ) => {
    scenes
      .find((scene) => scene.id === sceneId)!
      .hotspots.push({
        kind: "object",
        portrait: null,
        icon: "note",
        visibleIf: [],
        ...spot,
      });
  };
  addSpot("arrival", {
    id: "guide",
    label: blueprint.guide.name,
    x: 70,
    y: 29,
    w: 20,
    h: 48,
    kind: "character",
    portrait: blueprint.guide.portrait,
    icon: null,
  });
  addSpot("arrival", {
    id: "case-notes",
    label: "The case notes",
    x: 10,
    y: 35,
    w: 25,
    h: 32,
    icon: "note",
  });
  addSpot("arrival", {
    id: "lost-item-spot",
    label: blueprint.favor.lostItem.worldLabel,
    x: 46,
    y: 59,
    w: 14,
    h: 15,
    icon: blueprint.favor.lostItem.icon,
    visibleIf: [
      atom("item", "lost-item", false),
      atom("flag", "favor-done", false),
    ],
  });
  for (let i = 0; i < machines.length; i++)
    addSpot(machineScenes[i], {
      id: `machine-${i + 1}`,
      label: machines[i].apparatusLabel,
      x: 9,
      y: 32,
      w: 28,
      h: 42,
      icon: machines[i].icon,
    });
  for (const [index, part] of [
    blueprint.equipment.firstPart,
    blueprint.equipment.secondPart,
  ].entries())
    addSpot(machineScenes[index], {
      id: `part-${index + 1}-spot`,
      label: part.worldLabel,
      x: 46,
      y: 56,
      w: 14,
      h: 17,
      icon: part.icon,
      visibleIf: [atom("flag", `part-${index + 1}-taken`, false)],
    });
  addSpot(neighborScene, {
    id: "neighbor",
    label: blueprint.neighbor.name,
    x: 71,
    y: 29,
    w: 20,
    h: 48,
    kind: "character",
    portrait: blueprint.neighbor.portrait,
    icon: null,
  });
  addSpot("finale", {
    id: "finish-object",
    label: blueprint.finish.objectLabel,
    x: 66,
    y: 47,
    w: 23,
    h: 27,
    icon: blueprint.finish.icon,
  });
  if (machines.length === 2)
    addSpot("finale", {
      id: "final-notice",
      label: `${blueprint.rooms.finale.name} notice`,
      x: 10,
      y: 35,
      w: 25,
      h: 34,
      icon: "paper",
    });

  const items: GeneralStory["items"] = [
    { id: "part-1", ...blueprint.equipment.firstPart },
    { id: "part-2", ...blueprint.equipment.secondPart },
    { id: "combined-tool", ...blueprint.equipment.combinedTool },
    { id: "lost-item", ...blueprint.favor.lostItem },
    { id: "favor-reward", ...blueprint.favor.reward },
  ].map(({ id, name, description, icon }) => ({ id, name, description, icon }));
  const discoveries: GeneralStory["discoveries"] = [
    {
      id: "case-note",
      title: blueprint.title,
      text: blueprint.description,
      objective: null,
    },
    ...machines.map((machine, index) => ({
      id: `concept-note-${index + 1}`,
      title: machine.discovery.title,
      text: machine.discovery.text,
      objective: machine.objectiveId,
    })),
  ];
  const rules: GeneralStory["rules"] = [];
  const dialogue = (
    lines: string | string[],
    speaker = blueprint.guide.name,
    face: StoryBlueprint["guide"]["portrait"] | null = blueprint.guide.portrait,
  ): NonNullable<GeneralStory["rules"][number]["dialogue"]> => ({
    speaker,
    portrait: face,
    lines: Array.isArray(lines) ? lines : [lines],
  });
  const rule = (
    id: string,
    verb: "interact" | "use" | "combine" | "inspect",
    target: string,
    options: {
      item?: string;
      when?: FlatCondition[];
      effects?: FlatEffect[];
      dialogue?: ReturnType<typeof dialogue>;
    } = {},
  ) => {
    rules.push({
      id,
      trigger: { verb, target, item: options.item || null },
      when: options.when || [],
      effects: options.effects || [],
      dialogue: options.dialogue || null,
    });
  };
  const allPassed = objectiveIds.map((objectiveId) =>
    atom("puzzle", objectiveId),
  );
  rule("guide-finished", "interact", "guide", {
    when: [atom("flag", "case-complete")],
    dialogue: dialogue(blueprint.guide.afterCompletion),
  });
  rule("guide-ready", "interact", "guide", {
    when: allPassed,
    dialogue: dialogue(blueprint.guide.readyToFinish),
  });
  for (const [index, objectiveId] of objectiveIds.slice(0, 2).entries())
    rule(`guide-lead-${index + 1}`, "interact", "guide", {
      when: [atom("puzzle", objectiveId)],
      dialogue: dialogue(blueprint.guide.afterFirstLead),
    });
  rule("guide-welcome", "interact", "guide", {
    dialogue: dialogue(blueprint.guide.welcome),
  });
  rule("read-case-notes", "interact", "case-notes", {
    effects: [effect("discover", "case-note")],
    dialogue: dialogue(blueprint.briefing.slice(0, 550)),
  });
  for (const [index, part] of [
    blueprint.equipment.firstPart,
    blueprint.equipment.secondPart,
  ].entries())
    rule(`take-part-${index + 1}`, "interact", `part-${index + 1}-spot`, {
      when: [atom("flag", `part-${index + 1}-taken`, false)],
      effects: [
        effect("grantItem", `part-${index + 1}`),
        effect("setFlag", `part-${index + 1}-taken`),
      ],
      dialogue: dialogue(part.pickupLine),
    });
  rule("combine-equipment", "combine", "part-2", {
    item: "part-1",
    when: [atom("item", "combined-tool", false)],
    effects: [
      effect("consumeItem", "part-1"),
      effect("consumeItem", "part-2"),
      effect("grantItem", "combined-tool"),
    ],
    dialogue: dialogue(blueprint.equipment.combinationLine),
  });
  for (let index = 0; index < machines.length; index++) {
    const machine = machines[index];
    rule(`machine-${index + 1}-solved`, "interact", `machine-${index + 1}`, {
      when: [atom("puzzle", machine.objectiveId)],
      dialogue: dialogue(machine.solved),
    });
    rule(`machine-${index + 1}-open`, "interact", `machine-${index + 1}`, {
      when:
        index === 2
          ? objectiveIds
              .slice(0, 2)
              .map((objectiveId) => atom("puzzle", objectiveId))
          : [],
      effects: [
        effect("discover", `concept-note-${index + 1}`),
        effect("openPuzzle", machine.objectiveId),
      ],
      dialogue: dialogue(machine.intro),
    });
    if (index === 2)
      rule("machine-3-locked", "interact", "machine-3", {
        dialogue: dialogue(
          `Two leads are still tangled. Investigate ${machines[0].apparatusLabel} in ${roomData[firstScene].name} and ${machines[1].apparatusLabel} in ${roomData[secondScene].name} first.`.slice(
            0,
            550,
          ),
        ),
      });
  }
  rule("take-lost-item", "interact", "lost-item-spot", {
    when: [atom("item", "lost-item", false), atom("flag", "favor-done", false)],
    effects: [effect("grantItem", "lost-item")],
    dialogue: dialogue(blueprint.favor.lostItem.pickupLine),
  });
  rule("neighbor-finished", "interact", "neighbor", {
    when: [atom("flag", "favor-done"), atom("flag", "case-complete")],
    dialogue: dialogue(
      blueprint.neighbor.afterCompletion,
      blueprint.neighbor.name,
      blueprint.neighbor.portrait,
    ),
  });
  rule("neighbor-thanks", "interact", "neighbor", {
    when: [atom("flag", "favor-done")],
    dialogue: dialogue(
      blueprint.neighbor.thanks,
      blueprint.neighbor.name,
      blueprint.neighbor.portrait,
    ),
  });
  rule("neighbor-request", "interact", "neighbor", {
    dialogue: dialogue(
      [blueprint.neighbor.greeting, blueprint.neighbor.request],
      blueprint.neighbor.name,
      blueprint.neighbor.portrait,
    ),
  });
  rule("return-lost-item", "use", "neighbor", {
    item: "lost-item",
    when: [atom("flag", "favor-done", false)],
    effects: [
      effect("consumeItem", "lost-item"),
      effect("grantItem", "favor-reward"),
      effect("setFlag", "favor-done"),
    ],
    dialogue: dialogue(
      blueprint.neighbor.thanks,
      blueprint.neighbor.name,
      blueprint.neighbor.portrait,
    ),
  });
  rule("finish-already-used", "use", "finish-object", {
    item: "combined-tool",
    when: [atom("flag", "case-complete")],
    dialogue: dialogue(blueprint.finish.completedLine),
  });
  rule("finish-case", "use", "finish-object", {
    item: "combined-tool",
    when: allPassed,
    effects: [effect("setFlag", "case-complete")],
    dialogue: dialogue(blueprint.finish.completedLine),
  });
  rule("finish-use-locked", "use", "finish-object", {
    item: "combined-tool",
    dialogue: dialogue(blueprint.finish.lockedLine),
  });
  rule("finish-already-inspected", "interact", "finish-object", {
    when: [atom("flag", "case-complete")],
    dialogue: dialogue(blueprint.finish.completedLine),
  });
  rule("finish-ready", "interact", "finish-object", {
    when: allPassed,
    dialogue: dialogue(
      [
        blueprint.finish.readyLine,
        `Use ${blueprint.equipment.combinedTool.name} on ${blueprint.finish.objectLabel}.`,
      ].map((line) => line.slice(0, 550)),
    ),
  });
  rule("finish-inspect-locked", "interact", "finish-object", {
    dialogue: dialogue(blueprint.finish.lockedLine),
  });
  if (machines.length === 2)
    rule("read-final-notice", "interact", "final-notice", {
      dialogue: dialogue(blueprint.rooms.finale.description),
    });

  const hints: GeneralStory["hints"] = [
    {
      when: [atom("flag", "case-complete")],
      text: `The case is complete. ${blueprint.neighbor.name}'s small favor is optional.`.slice(
        0,
        550,
      ),
    },
    {
      when: [...allPassed, atom("item", "combined-tool")],
      text: `Take ${blueprint.equipment.combinedTool.name} to ${roomData.finale.name} and use it on ${blueprint.finish.objectLabel}.`.slice(
        0,
        550,
      ),
    },
    {
      when: [...allPassed, atom("item", "part-1"), atom("item", "part-2")],
      text: `Combine ${blueprint.equipment.firstPart.name} with ${blueprint.equipment.secondPart.name} in your bag.`.slice(
        0,
        550,
      ),
    },
    {
      when: [...allPassed, atom("flag", "part-1-taken", false)],
      text: `Look for ${blueprint.equipment.firstPart.worldLabel} in ${roomData[firstScene].name}.`.slice(
        0,
        550,
      ),
    },
    {
      when: [...allPassed, atom("flag", "part-2-taken", false)],
      text: `Look for ${blueprint.equipment.secondPart.worldLabel} in ${roomData[secondScene].name}.`.slice(
        0,
        550,
      ),
    },
    ...(machines.length === 3
      ? [
          {
            when: objectiveIds
              .slice(0, 2)
              .map((objectiveId) => atom("puzzle", objectiveId)),
            text: `The two leads unlock ${machines[2].apparatusLabel} in ${roomData.finale.name}.`.slice(
              0,
              550,
            ),
          },
        ]
      : []),
    ...machines
      .slice(0, 2)
      .map((machine, index) => ({
        when: [atom("puzzle", machine.objectiveId, false)],
        text: `Investigate ${machine.apparatusLabel} in ${roomData[machineScenes[index]].name}. You may follow either early lead first.`.slice(
          0,
          550,
        ),
      })),
    {
      when: [],
      text: `Visit ${blueprint.guide.name} in ${roomData.arrival.name} for the case briefing.`.slice(
        0,
        550,
      ),
    },
  ];
  const referenceSolution: SolutionStep[] = [action("start")];
  let current: SceneId = "arrival";
  const go = (target: SceneId) => {
    const queue: SceneId[][] = [[current]];
    const seen = new Set<SceneId>([current]);
    while (queue.length) {
      const route = queue.shift()!;
      const at = route.at(-1)!;
      if (at === target) {
        for (const scene of route.slice(1))
          referenceSolution.push(action("move", { scene }));
        current = target;
        return;
      }
      for (const next of exitMap[at])
        if (!seen.has(next)) {
          seen.add(next);
          queue.push([...route, next]);
        }
    }
    throw new SourceError(
      502,
      "The compiled quest graph contains a disconnected room.",
      "invalid_episode",
    );
  };
  for (let index = 0; index < 2; index++) {
    go(machineScenes[index]);
    referenceSolution.push(
      action("interact", { target: `part-${index + 1}-spot` }),
      action("interact", { target: `machine-${index + 1}` }),
      action("submitPuzzle", { puzzle: machines[index].objectiveId }),
    );
  }
  referenceSolution.push(
    action("combine", { item: "part-1", target: "part-2" }),
  );
  go("finale");
  if (machines.length === 3)
    referenceSolution.push(
      action("interact", { target: "machine-3" }),
      action("submitPuzzle", { puzzle: machines[2].objectiveId }),
    );
  referenceSolution.push(
    action("use", { item: "combined-tool", target: "finish-object" }),
  );
  return {
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    description: blueprint.description,
    briefing: blueprint.briefing,
    ending: blueprint.ending,
    startScene: "arrival",
    scenes,
    items,
    discoveries,
    puzzles: machines.map((machine) => ({
      id: machine.objectiveId,
      title: machine.title,
      instructions: machine.instructions,
    })),
    rules,
    hints,
    completion: [atom("flag", "case-complete")],
    referenceSolution,
  };
}
