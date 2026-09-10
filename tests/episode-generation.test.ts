import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  createTransformerFixtures,
  createTransformerReferenceEvidence,
} from "../src/domain/transformers";
import {
  compileConditions,
  compileEpisodeStory,
  episodeStorySchema,
  learningPlanSchema,
  validateLearningPlan,
  type EpisodeLearningPlan,
  type EpisodeStory,
  type ReviewedPuzzles,
} from "../server/episode-generation";
import { createEpisodeState, transitionEpisode } from "../src/episodes/engine";

const sourceText =
  "Token embeddings are combined with positional encodings to represent order. Attention compares queries with keys, scales their dot products, and uses softmax weights to mix values. A causal mask prevents positions from attending to subsequent positions in autoregressive self-attention.";
const sources = [
  { id: "source-1", title: "Transformer source", text: sourceText },
];
const families = ["positions", "attention", "causal"] as const;
const plan = (): EpisodeLearningPlan => ({
  supported: true,
  reason: "",
  objectives: families.map((family) => ({
    family,
    title: `Explore ${family}`,
    claim: "A supported principle.",
    boundaries: "An illustrative instrument, not a complete trained model.",
    learnerAction: "Make and compare controlled changes.",
    misconception:
      "The observation should change when only the relevant variable changes.",
    evidence: [
      {
        sourceId: "source-1",
        quote: sourceText.split(". ")[families.indexOf(family)],
      },
    ],
  })),
  notes: [],
});

function story(): EpisodeStory {
  const condition = (
    kind: "flag" | "item" | "discovery" | "puzzle",
    id: string,
    expected = true,
  ) => ({ kind, id, expected });
  const rule = (
    id: string,
    target: string,
    type?: "grantItem" | "setFlag" | "openPuzzle",
    effectId?: string,
    when: ReturnType<typeof condition>[] = [],
    verb: "interact" | "inspect" = "interact",
  ): EpisodeStory["rules"][number] => ({
    id,
    trigger: { verb, target, item: null },
    when,
    effects: type ? [{ type, id: effectId!, value: true }] : [],
    dialogue: {
      speaker: "Keeper",
      portrait: "tock",
      lines: ["Try a careful experiment."],
    },
  });
  const spot = (
    id: string,
    index: number,
  ): EpisodeStory["scenes"][number]["hotspots"][number] => ({
    id,
    label: id,
    x: 10 + index * 25,
    y: 40,
    w: 15,
    h: 25,
    kind: "object",
    portrait: null,
    icon: "machine",
    visibleIf: [],
  });
  const step = (
    type: EpisodeStory["referenceSolution"][number]["type"],
    value?: string,
  ): EpisodeStory["referenceSolution"][number] => ({
    type,
    target: ["interact", "inspect"].includes(type) ? value! : null,
    item: null,
    scene: type === "move" ? value! : null,
    puzzle:
      type === "submitPuzzle" ? (value as (typeof families)[number]) : null,
  });
  return {
    title: "The Test Dispatch",
    subtitle: "A complete generated shape",
    description: "A small proof fixture.",
    briefing: "Repair the instruments.",
    ending: "The dispatch arrives.",
    startScene: "a",
    scenes: [
      {
        id: "a",
        name: "Arrival",
        description: "The first room.",
        background: "jetty",
        exits: ["b", "d"],
        hotspots: [spot("keeper", 0), spot("key-spot", 1)],
      },
      {
        id: "b",
        name: "Archive",
        description: "The records room.",
        background: "storeroom",
        exits: ["a", "c"],
        hotspots: [spot("position-machine", 0), spot("tape-spot", 1)],
      },
      {
        id: "c",
        name: "Mixing room",
        description: "The second instrument.",
        background: "workshop",
        exits: ["b", "d"],
        hotspots: [spot("attention-machine", 0), spot("seal-spot", 1)],
      },
      {
        id: "d",
        name: "Dispatch",
        description: "The final instrument.",
        background: "lantern",
        exits: ["c", "a"],
        hotspots: [spot("causal-machine", 0), spot("send", 1)],
      },
    ],
    items: ["key", "tape", "seal"].map((id) => ({
      id,
      name: id,
      description: "A useful object.",
      icon: "key",
    })),
    discoveries: families.map((id) => ({
      id: `${id}-note`,
      title: `About ${id}`,
      text: "A supported explanatory note.",
      objective: id,
    })),
    puzzles: families.map((id) => ({
      id,
      title: `The ${id} instrument`,
      instructions: "Use the apparatus controls and compare changes.",
    })),
    rules: [
      rule("keeper-talk", "keeper"),
      rule("take-key", "key-spot", "grantItem", "key", [
        condition("item", "key", false),
      ]),
      rule("open-positions", "position-machine", "openPuzzle", "positions"),
      rule("take-tape", "tape-spot", "grantItem", "tape", [
        condition("item", "tape", false),
      ]),
      rule("inspect-tape", "tape", undefined, undefined, [], "inspect"),
      rule("open-attention", "attention-machine", "openPuzzle", "attention"),
      rule("open-causal", "causal-machine", "openPuzzle", "causal", [
        condition("puzzle", "positions"),
        condition("puzzle", "attention"),
      ]),
      rule(
        "send-dispatch",
        "send",
        "setFlag",
        "sent",
        families.map((id) => condition("puzzle", id)),
      ),
      rule("take-seal", "seal-spot", "grantItem", "seal", [
        condition("item", "seal", false),
      ]),
      rule("inspect-key", "key", undefined, undefined, [], "inspect"),
    ],
    hints: [
      {
        when: [condition("puzzle", "positions", false)],
        text: "Try the archive instrument.",
      },
      {
        when: [condition("puzzle", "attention", false)],
        text: "Try the mixing room.",
      },
      { when: [], text: "Go to dispatch." },
    ],
    completion: [condition("flag", "sent")],
    referenceSolution: [
      step("start"),
      step("move", "b"),
      step("interact", "position-machine"),
      step("submitPuzzle", "positions"),
      step("move", "c"),
      step("interact", "attention-machine"),
      step("submitPuzzle", "attention"),
      step("move", "d"),
      step("interact", "causal-machine"),
      step("submitPuzzle", "causal"),
      step("interact", "send"),
    ],
  };
}

function compile(raw: unknown) {
  const fixtures = createTransformerFixtures();
  const reviewedPuzzles = Object.fromEntries(
    families.map((id) => {
      const config = id === "positions" ? fixtures.position : fixtures[id];
      return [
        id,
        { config, evidence: createTransformerReferenceEvidence(config) },
      ];
    }),
  ) as ReviewedPuzzles;
  return compileEpisodeStory({
    raw,
    plan: plan(),
    sources,
    level: "College",
    id: "generated-test",
    createdAt: "2026-09-10T12:00:00.000Z",
    reviewedPuzzles,
  });
}

describe("Transformer source planning", () => {
  it("requires all three concept families with actual source quotations", () => {
    expect(validateLearningPlan(plan(), sources).objectives).toHaveLength(3);
    const duplicate = plan();
    duplicate.objectives[2].family = "attention";
    expect(() => validateLearningPlan(duplicate, sources)).toThrow(
      "three Transformer",
    );
  });
  it("rejects invented quotations and unknown source identities", () => {
    const invented = plan();
    invented.objectives[0].evidence[0].quote =
      "This quotation was never present in the source.";
    expect(() => validateLearningPlan(invented, sources)).toThrow("quotation");
    const wrongSource = plan();
    wrongSource.objectives[1].evidence[0].sourceId = "invented";
    expect(() => validateLearningPlan(wrongSource, sources)).toThrow(
      "quotation",
    );
  });
  it("rejects unsupported or insufficient material with a useful reason", () => {
    expect(() =>
      validateLearningPlan(
        {
          supported: false,
          reason: "The source does not explain causal masking.",
          objectives: [],
          notes: [],
        },
        sources,
      ),
    ).toThrow("causal masking");
  });
  it("accepts whitespace-normalized exact evidence without inventing paraphrases", () => {
    const spaced = plan();
    spaced.objectives[0].evidence[0].quote =
      spaced.objectives[0].evidence[0].quote.replace(/ /g, "\n ");
    expect(validateLearningPlan(spaced, sources).supported).toBe(true);
  });
  it("exports strict provider schemas without undefined optional properties", () => {
    for (const schema of [learningPlanSchema, episodeStorySchema]) {
      const format = zodTextFormat(schema, "test_format");
      expect(format.strict).toBe(true);
      expect(JSON.stringify(format)).not.toMatch(/"additionalProperties":true/);
    }
  });
});

describe("generated story compilation", () => {
  it("turns flat conditions into closed runtime predicates", () => {
    expect(
      compileConditions([
        { kind: "item", id: "key", expected: false },
        { kind: "puzzle", id: "positions", expected: true },
      ]),
    ).toEqual({
      all: [{ not: { hasItem: "key" } }, { puzzlePassed: "positions" }],
    });
  });
  it("preserves variable story data and installs verified scientific apparatus and provenance", () => {
    const pkg = compile(story());
    expect(pkg.scenes.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(pkg.sources).toEqual(sources);
    expect(pkg.generated).toBe(true);
    expect(pkg.puzzles.map((p) => p.config.kind)).toEqual([
      "position",
      "attention",
      "causal",
    ]);
    let state = createEpisodeState(pkg);
    for (const action of pkg.referenceSolution)
      state = transitionEpisode(pkg, state, action).state;
    expect(state.completed).toBe(true);
    expect(state.solvedPuzzles).toHaveLength(3);
  });
  it("rejects a reference route that skips opening an apparatus", () => {
    const broken = story();
    broken.referenceSolution = broken.referenceSolution.filter(
      (step) => step.target !== "position-machine",
    );
    expect(() => compile(broken)).toThrow("reference solution");
  });
  it("rejects dangling triggers and off-canvas hotspots", () => {
    const broken = story();
    broken.rules[0].trigger.target = "missing-character";
    expect(() => compile(broken)).toThrow("Unknown interaction target");
    const bounds = story();
    bounds.scenes[0].hotspots[0].x = 90;
    expect(() => compile(bounds)).toThrow("boundaries");
  });
  it("rejects provider-authored code and duplicate apparatus families", () => {
    expect(() => compile({ ...story(), script: "doThings()" })).toThrow(
      "format",
    );
    const repeated = story();
    repeated.puzzles[2].id = "attention";
    expect(() => compile(repeated)).toThrow("three reviewed");
  });
});
