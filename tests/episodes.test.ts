import { describe, expect, it } from "vitest";
import {
  createTransformerFixtures,
  canonicalTransformerEvidence,
} from "../src/domain/transformers";
import {
  createEpisodeState,
  matchesEpisodeCondition,
  parseEpisodeSave,
  transitionEpisode,
} from "../src/episodes/engine";
import {
  certifyEpisodeSolvability,
  validateEpisodePackage,
} from "../src/episodes/schema";
import type {
  EpisodeAction,
  EpisodePackage,
  EpisodeState,
} from "../src/episodes/types";
import { TRANSFORMER_REFERENCE } from "../src/episodes/reference";

function fixture(): EpisodePackage {
  const config = createTransformerFixtures().position;
  return {
    version: 1,
    id: "tiny-case",
    revision: 1,
    title: "Tiny case",
    subtitle: "A verified repair",
    description: "Repair the board.",
    briefing: "Find the parts.",
    ending: "The board works.",
    level: "Introductory",
    generated: false,
    sources: [
      {
        id: "source",
        title: "A source",
        url: "https://example.com/paper",
        text: "Tokens and positions have distinct roles.",
      },
    ],
    objectives: [
      { id: "order", title: "Use position information", sourceIds: ["source"] },
    ],
    scenes: [
      {
        id: "hall",
        name: "Hall",
        description: "A quiet hall.",
        background: "jetty",
        exits: ["lab"],
        hotspots: [
          {
            id: "key",
            label: "Key",
            x: 10,
            y: 10,
            w: 10,
            h: 10,
            kind: "object",
            visibleIf: { not: { flag: "key-taken" } },
          },
          {
            id: "cord",
            label: "Cord",
            x: 30,
            y: 10,
            w: 10,
            h: 10,
            kind: "object",
            visibleIf: { not: { flag: "cord-taken" } },
          },
          {
            id: "bell",
            label: "Bell",
            x: 50,
            y: 10,
            w: 10,
            h: 10,
            kind: "object",
          },
        ],
      },
      {
        id: "lab",
        name: "Lab",
        description: "An apparatus awaits.",
        background: "workshop",
        exits: ["hall"],
        hotspots: [
          {
            id: "board",
            label: "Board",
            x: 20,
            y: 30,
            w: 30,
            h: 20,
            kind: "object",
          },
        ],
      },
    ],
    startScene: "hall",
    items: ["key", "cord", "tool"].map((id) => ({
      id,
      name: id,
      description: `A useful ${id}.`,
      icon: id,
    })),
    discoveries: [
      {
        id: "note",
        title: "A note",
        text: "The same token can have different position information.",
        sourceIds: ["source"],
      },
    ],
    puzzles: [
      {
        id: "position",
        title: "Position board",
        instructions: "Compare controlled trials.",
        objectiveId: "order",
        sourceIds: ["source"],
        config,
      },
    ],
    rules: [
      {
        id: "take-key",
        trigger: { verb: "interact", target: "key" },
        effects: [
          { type: "grantItem", item: "key" },
          { type: "setFlag", flag: "key-taken", value: true },
        ],
      },
      {
        id: "take-cord",
        trigger: { verb: "interact", target: "cord" },
        effects: [
          { type: "grantItem", item: "cord" },
          { type: "setFlag", flag: "cord-taken", value: true },
        ],
      },
      {
        id: "combine",
        trigger: { verb: "combine", target: "key", item: "cord" },
        effects: [
          { type: "consumeItem", item: "key" },
          { type: "consumeItem", item: "cord" },
          { type: "grantItem", item: "tool" },
        ],
      },
      {
        id: "open",
        trigger: { verb: "use", target: "board", item: "tool" },
        effects: [
          { type: "openPuzzle", puzzle: "position" },
          { type: "discover", discovery: "note" },
        ],
      },
      {
        id: "finish",
        trigger: { verb: "interact", target: "bell" },
        when: { puzzlePassed: "position" },
        effects: [{ type: "setFlag", flag: "done", value: true }],
      },
    ],
    hints: [{ when: { all: [] }, text: "Collect and combine the two parts." }],
    completion: { flag: "done" },
    referenceSolution: [
      { type: "start" },
      { type: "interact", target: "key" },
      { type: "interact", target: "cord" },
      { type: "combine", target: "key", item: "cord" },
      { type: "move", scene: "lab" },
      { type: "use", target: "board", item: "tool" },
      {
        type: "submitPuzzle",
        puzzle: "position",
        evidence: canonicalTransformerEvidence(config),
      },
      { type: "move", scene: "hall" },
      { type: "interact", target: "bell" },
    ],
  };
}
function run(
  pkg: EpisodePackage,
  actions: EpisodeAction[],
  initial = createEpisodeState(pkg),
): EpisodeState {
  return actions.reduce(
    (state, action) => transitionEpisode(pkg, state, action).state,
    initial,
  );
}

describe("declarative episode runtime", () => {
  it("certifies the authored Transformer adventure across all 3,000+ reachable states", () => {
    const result = validateEpisodePackage(TRANSFORMER_REFERENCE);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.exploredStates).toBeGreaterThan(3000);
  });
  it("finishes a generic package using verified evidence and preserves the caller state", () => {
    const pkg = fixture();
    const initial = createEpisodeState(pkg);
    const final = run(pkg, pkg.referenceSolution, initial);
    expect(final.completed).toBe(true);
    expect(final.inventory).toEqual(["tool"]);
    expect(final.discoveries).toEqual(["note"]);
    expect(initial).toEqual(createEpisodeState(pkg));
    expect(validateEpisodePackage(pkg).valid).toBe(true);
  });
  it("accepts either pickup order and either combination orientation", () => {
    const pkg = fixture();
    const actions = structuredClone(pkg.referenceSolution);
    [actions[1], actions[2]] = [actions[2], actions[1]];
    actions[3] = { type: "combine", target: "cord", item: "key" };
    expect(run(pkg, actions).completed).toBe(true);
  });
  it("rejects travel before start, teleportation, remote use and unowned inventory", () => {
    const pkg = fixture();
    const initial = createEpisodeState(pkg);
    expect(
      transitionEpisode(pkg, initial, { type: "move", scene: "lab" }).state,
    ).toBe(initial);
    const started = run(pkg, [{ type: "start" }]);
    expect(
      transitionEpisode(pkg, started, { type: "move", scene: "missing" }).state,
    ).toBe(started);
    expect(
      transitionEpisode(pkg, started, {
        type: "use",
        target: "board",
        item: "tool",
      }).puzzle,
    ).toBeUndefined();
    expect(
      transitionEpisode(pkg, started, { type: "inspect", target: "tool" })
        .message,
    ).toContain("not found");
    const withTool = run(pkg, pkg.referenceSolution.slice(0, 4));
    expect(
      transitionEpisode(pkg, withTool, {
        type: "use",
        target: "board",
        item: "tool",
      }).puzzle,
    ).toBeUndefined();
  });
  it("inspection only uses carried items, even when a matching pickup hotspot is visible", () => {
    const pkg = fixture();
    pkg.rules.push({
      id: "read-key",
      trigger: { verb: "inspect", target: "key" },
      effects: [{ type: "discover", discovery: "note" }],
    });
    const started = run(pkg, [{ type: "start" }]);
    expect(
      transitionEpisode(pkg, started, { type: "inspect", target: "key" }).state,
    ).toBe(started);
    const carried = run(pkg, [{ type: "interact", target: "key" }], started);
    expect(
      run(pkg, [{ type: "inspect", target: "key" }], carried).discoveries,
    ).toEqual(["note"]);
    expect(validateEpisodePackage(pkg).valid).toBe(true);
  });
  it("does not consume inventory when a malformed inventory rule tries to open an apparatus", () => {
    const pkg = fixture();
    pkg.rules[2].effects.push({ type: "openPuzzle", puzzle: "position" });
    const before = run(pkg, pkg.referenceSolution.slice(0, 3));
    const result = transitionEpisode(pkg, before, pkg.referenceSolution[3]);
    expect(result.state).toBe(before);
    expect(result.state.inventory).toEqual(["key", "cord"]);
    expect(result.puzzle).toBeUndefined();
    expect(result.message).toContain("interaction in the room");
  });
  it("restores a local apparatus opened by a use action that consumed its tool", () => {
    const pkg = fixture();
    pkg.rules[3].effects.push({ type: "consumeItem", item: "tool" });
    const opened = run(pkg, pkg.referenceSolution.slice(0, 6));
    expect(opened.inventory).toEqual([]);
    expect(opened.activePuzzle).toBe("position");
    expect(parseEpisodeSave(pkg, JSON.stringify(opened))).toEqual(opened);
    expect(run(pkg, pkg.referenceSolution.slice(6), opened).completed).toBe(
      true,
    );
  });
  it("cannot recollect a hidden consumed object or combine it again", () => {
    const pkg = fixture();
    const state = run(pkg, pkg.referenceSolution.slice(0, 4));
    expect(
      transitionEpisode(pkg, state, { type: "interact", target: "key" }).state,
    ).toBe(state);
    expect(
      transitionEpisode(pkg, state, {
        type: "combine",
        item: "key",
        target: "cord",
      }).state,
    ).toBe(state);
  });
  it("requires opening the correct local puzzle and rejects invented success", () => {
    const pkg = fixture();
    const solve = pkg.referenceSolution[6];
    const unopened = run(pkg, pkg.referenceSolution.slice(0, 5));
    expect(transitionEpisode(pkg, unopened, solve).state.solvedPuzzles).toEqual(
      [],
    );
    const opened = run(pkg, pkg.referenceSolution.slice(0, 6));
    expect(opened.activePuzzle).toBe("position");
    expect(
      transitionEpisode(pkg, opened, {
        type: "submitPuzzle",
        puzzle: "position",
        evidence: { success: true },
      }).state.solvedPuzzles,
    ).toEqual([]);
    expect(transitionEpisode(pkg, opened, solve).state.solvedPuzzles).toEqual([
      "position",
    ]);
    expect(
      run(pkg, [{ type: "move", scene: "hall" }, solve], opened).solvedPuzzles,
    ).toEqual([]);
  });
  it("blocks the ending before the lesson and gives deterministic hints", () => {
    const pkg = fixture();
    const state = run(pkg, [
      { type: "start" },
      { type: "interact", target: "bell" },
    ]);
    expect(state.completed).toBe(false);
    const result = transitionEpisode(pkg, state, { type: "hint" });
    expect(result.message).toContain("Collect");
    expect(result.state.hintsUsed).toBe(1);
    expect(
      matchesEpisodeCondition(state, {
        all: [
          { not: { puzzlePassed: "position" } },
          { any: [{ flag: "done" }, { all: [] }] },
        ],
      }),
    ).toBe(true);
  });
  it("restores valid partial apparatus saves and rejects stale, malformed or fabricated flags", () => {
    const pkg = fixture();
    const state = run(pkg, pkg.referenceSolution.slice(0, 6));
    expect(parseEpisodeSave(pkg, JSON.stringify(state))).toEqual(state);
    expect(parseEpisodeSave(pkg, "not json")).toBeNull();
    for (const patch of [
      { revision: 2 },
      { scene: "elsewhere" },
      { inventory: ["tool", "tool"] },
      { inventory: ["invented"] },
      { flags: { arbitrary: true } },
      { hintsUsed: -1 },
      { solvedPuzzles: ["position"], activePuzzle: "position" },
      { activePuzzle: "unknown" },
      { extra: true },
      { completed: true },
      { started: false },
    ])
      expect(parseEpisodeSave(pkg, { ...state, ...patch })).toBeNull();
    const forgedEnding = {
      ...state,
      activePuzzle: undefined,
      flags: { ...state.flags, done: true },
      completed: true,
    };
    expect(parseEpisodeSave(pkg, forgedEnding)).toBeNull();
  });
});

describe("episode package certification", () => {
  it("rejects references, unknown code properties and unsafe asset/source URLs", () => {
    const invalid: EpisodePackage[] = [];
    let pkg = fixture();
    pkg.rules[0].effects.push({ type: "grantItem", item: "missing" });
    invalid.push(pkg);
    pkg = fixture();
    pkg.sources[0].url = "javascript:alert(1)";
    invalid.push(pkg);
    pkg = fixture();
    pkg.sources[0].url = "https://user:secret@example.com";
    invalid.push(pkg);
    pkg = fixture();
    pkg.scenes[0].hotspots[0].x = 99;
    invalid.push(pkg);
    pkg = fixture();
    pkg.puzzles[0].sourceIds = ["unknown"];
    invalid.push(pkg);
    pkg = fixture();
    pkg.objectives[0].id = "orphan";
    invalid.push(pkg);
    pkg = fixture();
    pkg.referenceSolution.splice(1, 0, { type: "move", scene: "missing" });
    invalid.push(pkg);
    for (const candidate of invalid)
      expect(validateEpisodePackage(candidate).valid).toBe(false);
    expect(
      validateEpisodePackage({ ...fixture(), code: "alert(1)" }).valid,
    ).toBe(false);
    pkg = fixture();
    (pkg.scenes[0] as unknown as { background: string }).background =
      "https://example.com/asset.png";
    expect(validateEpisodePackage(pkg).valid).toBe(false);
  });
  it("rejects world-only inspection rules and reference steps that the player cannot perform", () => {
    const withRule = fixture();
    withRule.rules.push({
      id: "inspect-board",
      trigger: { verb: "inspect", target: "board" },
      effects: [{ type: "discover", discovery: "note" }],
    });
    expect(validateEpisodePackage(withRule).errors.join(" ")).toContain(
      "inventory inspection target",
    );
    const withStep = fixture();
    withStep.referenceSolution.splice(5, 0, {
      type: "inspect",
      target: "board",
    });
    expect(validateEpisodePackage(withStep).errors.join(" ")).toContain(
      "reference inventory inspection target",
    );
  });
  it("rejects inventory inspection or combination rules that open puzzles", () => {
    for (const verb of ["inspect", "combine"] as const) {
      const pkg = fixture();
      pkg.rules.push({
        id: "inventory-apparatus",
        trigger: {
          verb,
          target: "key",
          ...(verb === "combine" ? { item: "cord" } : {}),
        },
        effects: [
          { type: "consumeItem", item: "key" },
          { type: "openPuzzle", puzzle: "position" },
        ],
      });
      expect(validateEpisodePackage(pkg).errors.join(" ")).toContain(
        "openPuzzle requires an interact or use action on a world hotspot",
      );
    }
  });
  it("rejects a reference route that skips real apparatus evidence", () => {
    const pkg = fixture();
    pkg.referenceSolution[6] = {
      type: "submitPuzzle",
      puzzle: "position",
      evidence: { success: true },
    };
    expect(validateEpisodePackage(pkg).errors.join(" ")).toContain(
      "reference solution",
    );
  });
  it("detects an optional interaction that consumes a required item and strands the player", () => {
    const pkg = fixture();
    pkg.rules.push({
      id: "throw-key-away",
      trigger: { verb: "inspect", target: "key" },
      effects: [{ type: "consumeItem", item: "key" }],
    });
    const result = validateEpisodePackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("strand");
  });
  it("detects an alternate route that ends without verified learning", () => {
    const pkg = fixture();
    pkg.rules[4].when = undefined;
    expect(validateEpisodePackage(pkg).errors.join(" ")).toContain(
      "before every learning objective",
    );
  });
  it("rejects optional post-ending interactions that erase completion", () => {
    const pkg = fixture();
    pkg.rules.push({
      id: "undo-ending",
      trigger: { verb: "interact", target: "board" },
      when: { flag: "done" },
      effects: [{ type: "setFlag", flag: "done", value: false }],
    });
    expect(validateEpisodePackage(pkg).errors.join(" ")).toContain(
      "undo the completed ending",
    );
  });
  it("fails closed when the exhaustive proof exceeds its budget", () => {
    const result = certifyEpisodeSolvability(fixture(), 2);
    expect(result.valid).toBe(false);
    expect(result.exploredStates).toBe(2);
    expect(result.errors[0]).toContain("has not been certified");
  });
  it("allows non-educational flavor discoveries without fabricated source citations", () => {
    const pkg = fixture();
    pkg.discoveries.push({
      id: "flavor",
      title: "A joke",
      text: "The teapot has been promoted.",
      sourceIds: [],
    });
    expect(validateEpisodePackage(pkg).valid).toBe(true);
  });
});
