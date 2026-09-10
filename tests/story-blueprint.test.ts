import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  compileStoryBlueprint,
  storyBlueprintSchema,
  type StoryBlueprint,
} from "../server/story-blueprint";
import {
  compileGeneralStory,
  type GeneralLearningPlan,
  type GeneralMechanics,
} from "../server/general-generation";
import { createEpisodeState, transitionEpisode } from "../src/episodes/engine";
import { validateEpisodePackage } from "../src/episodes/schema";
import type {
  EpisodeAction,
  EpisodePackage,
  EpisodeState,
} from "../src/episodes/types";
import {
  calculusPlan,
  calculusMechanics,
  calculusSources,
  calculusMachine,
} from "./fixtures/general-episode";

function inputs(count = 2) {
  const plan: GeneralLearningPlan = calculusPlan();
  const mechanics: GeneralMechanics = calculusMechanics();
  if (count === 3) {
    plan.objectives.push({
      ...plan.objectives[0],
      id: "velocity-target",
      title: "Apply a rate to a new operating target",
    });
    mechanics.machines.push({
      objectiveId: "velocity-target",
      config: calculusMachine(),
    });
  }
  return { plan, mechanics };
}
function blueprint(plan = calculusPlan()): StoryBlueprint {
  return {
    title: "The Bell That Wouldn't Ring",
    subtitle: "A festival investigation",
    description:
      "A fictional harbor festival has lost its timing and its bell pull.",
    briefing:
      "Follow two independent motion clues, collect two repair parts and put the bell pull back in service.",
    ending:
      "The bell rings at the right moment. The harbor applauds the repaired festival.",
    topology: "loop",
    swapLeads: false,
    rooms: {
      arrival: {
        name: "Festival Quay",
        description: "Bunting waits above a silent quay.",
        background: "jetty",
      },
      firstLead: {
        name: "Cart Workshop",
        description: "A test cart waits beside a spool.",
        background: "workshop",
      },
      secondLead: {
        name: "Motion Archive",
        description: "Old movement records sit beside a small hook.",
        background: "storeroom",
      },
      finale: {
        name: "Bell Loft",
        description: "The silent festival bell overlooks the harbor.",
        background: "lantern",
      },
    },
    guide: {
      name: "Mallow",
      portrait: "wren",
      welcome:
        "Two clues, one silent bell. I have never missed a festival this quietly.",
      afterFirstLead:
        "One clue untangled. The other room is still worth a look.",
      readyToFinish:
        "Our readings are settled. Now put that repaired pull to work.",
      afterCompletion: "At last! A festival loud enough to count.",
    },
    neighbor: {
      name: "Sedge",
      portrait: "pip",
      room: "secondLead",
      greeting: "I came for the festival and misplaced my invitation.",
      request:
        "If you see a folded blue invitation near the quay, could you bring it here?",
      thanks: "My invitation! Take this little ribbon with my thanks.",
      afterCompletion:
        "The bell is ringing and my invitation is safe. An excellent afternoon.",
    },
    equipment: {
      firstPart: {
        name: "Strong cord",
        description: "A length of cord suitable for a bell pull.",
        icon: "cord",
        worldLabel: "The spare cord",
        pickupLine: "A useful length of cord. Into the bag it goes.",
      },
      secondPart: {
        name: "Brass hook",
        description: "A hook with an eye for threading cord.",
        icon: "hook",
        worldLabel: "The brass hook",
        pickupLine: "A hook with a promisingly large eye.",
      },
      combinedTool: {
        name: "Repaired bell pull",
        description: "Strong cord tied securely to a brass hook.",
        icon: "tool",
      },
      combinationLine:
        "The cord knots through the hook. One proper bell pull, ready for work.",
    },
    favor: {
      lostItem: {
        name: "Blue invitation",
        description: "A folded invitation addressed to Sedge.",
        icon: "letter",
        worldLabel: "The folded blue invitation",
        pickupLine: "Someone has dropped a festival invitation.",
      },
      reward: {
        name: "Festival ribbon",
        description: "A tiny ribbon awarded for being observant and kind.",
        icon: "keepsake",
      },
    },
    machines: plan.objectives.map((objective, index) => ({
      objectiveId: objective.id,
      title: `Investigation ${index + 1}`,
      instructions:
        "Change the time control, observe the motion readings and test the changed case.",
      apparatusLabel: `Motion apparatus ${index + 1}`,
      icon: "machine",
      intro:
        "This apparatus records motion. A careful reading should untangle its timing.",
      solved: "The timing makes sense now. That clue is settled.",
      discovery: {
        title: objective.title,
        text: `${objective.claim} This instrument is an illustrative smooth motion model.`,
      },
    })),
    finish: {
      objectLabel: "The festival bell",
      icon: "machine",
      lockedLine: "Settle the motion clues before ringing the festival bell.",
      readyLine:
        "The timing is settled. The bell only needs its repaired pull.",
      completedLine:
        "The hook catches, the cord pulls, and the festival bell rings.",
    },
  };
}
function compile(
  options: {
    count?: number;
    topology?: StoryBlueprint["topology"];
    swap?: boolean;
  } = {},
) {
  const { plan, mechanics } = inputs(options.count);
  const raw = blueprint(plan);
  raw.topology = options.topology || "loop";
  raw.swapLeads = options.swap || false;
  const story = compileStoryBlueprint(raw, plan);
  const episode = compileGeneralStory({
    raw: story,
    plan,
    mechanics,
    sources: calculusSources,
    level: "College",
    id: "compiled-blueprint",
    createdAt: "2026-09-10T12:00:00.000Z",
  });
  return { raw, story, episode, plan };
}
function travel(
  pkg: EpisodePackage,
  state: EpisodeState,
  destination: string,
): EpisodeState {
  const queue = [[state.scene]];
  const seen = new Set([state.scene]);
  while (queue.length) {
    const path = queue.shift()!;
    if (path.at(-1) === destination) {
      for (const scene of path.slice(1))
        state = transitionEpisode(pkg, state, { type: "move", scene }).state;
      return state;
    }
    for (const next of pkg.scenes.find((scene) => scene.id === path.at(-1))!
      .exits)
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
  }
  throw new Error("Disconnected test route");
}
function play(
  pkg: EpisodePackage,
  state = createEpisodeState(pkg),
  actions = pkg.referenceSolution,
) {
  for (const action of actions)
    state = transitionEpisode(pkg, state, action).state;
  return state;
}

describe("compact narrative blueprint compilation", () => {
  it.each([
    ["loop", false, 2],
    ["loop", true, 2],
    ["hub", false, 2],
    ["hub", true, 2],
    ["loop", false, 3],
    ["loop", true, 3],
    ["hub", false, 3],
    ["hub", true, 3],
  ] as const)(
    "certifies every reachable state for %s travel, swap=%s and %i objectives",
    (topology, swap, count) => {
      const { story, episode, plan } = compile({ topology, swap, count });
      expect(story.scenes).toHaveLength(4);
      expect(story.items).toHaveLength(5);
      expect(story.referenceSolution.length).toBeLessThanOrEqual(25);
      expect(story.rules.length).toBeLessThanOrEqual(28);
      const validation = validateEpisodePackage(episode);
      expect(validation.valid, validation.errors.join("; ")).toBe(true);
      expect(validation.exploredStates).toBeGreaterThan(100);
      const finished = play(episode);
      expect(finished.completed).toBe(true);
      expect(finished.solvedPuzzles).toHaveLength(count);
      expect(finished.inventory).toContain("combined-tool");
      expect(finished.inventory).not.toContain("part-1");
      expect(finished.inventory).not.toContain("part-2");
      expect(episode.puzzles.map((puzzle) => puzzle.objectiveId)).toEqual(
        plan.objectives.map((objective) => objective.id),
      );
      for (const objective of plan.objectives) {
        const discovery = story.discoveries.find(
          (entry) => entry.objective === objective.id,
        )!;
        expect(discovery.text).toContain(objective.claim);
        expect(
          episode.discoveries.find((entry) => entry.id === discovery.id)
            ?.sourceIds,
        ).toEqual(["source-1"]);
      }
    },
  );
  it("lets either lead be investigated first and keeps the third apparatus gated", () => {
    const { episode } = compile({ count: 3, topology: "hub", swap: true });
    let state = transitionEpisode(episode, createEpisodeState(episode), {
      type: "start",
    }).state;
    state = travel(episode, state, "finale");
    expect(
      transitionEpisode(episode, state, {
        type: "interact",
        target: "machine-3",
      }).state.activePuzzle,
    ).toBeUndefined();
    for (const target of ["machine-2", "machine-1"]) {
      state = travel(
        episode,
        state,
        episode.scenes.find((scene) =>
          scene.hotspots.some((spot) => spot.id === target),
        )!.id,
      );
      expect(
        transitionEpisode(episode, state, { type: "interact", target }).state
          .activePuzzle,
      ).toBeDefined();
    }
  });
  it("supports reverse combination and prevents consumed parts from respawning", () => {
    const { episode } = compile();
    const actions = episode.referenceSolution.map((action): EpisodeAction =>
      action.type === "combine"
        ? { ...action, item: action.target, target: action.item }
        : action,
    );
    let state = play(episode, undefined, actions);
    expect(state.completed).toBe(true);
    for (const target of ["part-1-spot", "part-2-spot"]) {
      state = travel(
        episode,
        state,
        episode.scenes.find((scene) =>
          scene.hotspots.some((spot) => spot.id === target),
        )!.id,
      );
      state = transitionEpisode(episode, state, {
        type: "interact",
        target,
      }).state;
    }
    expect(state.inventory).not.toContain("part-1");
    expect(state.inventory).not.toContain("part-2");
    expect(state.inventory.filter((id) => id === "combined-tool")).toHaveLength(
      1,
    );
  });
  it.each(["before", "after"] as const)(
    "keeps the optional favor nonblocking %s the ending",
    (timing) => {
      const { episode } = compile({ count: 3, topology: "loop" });
      let state =
        timing === "after"
          ? play(episode)
          : transitionEpisode(episode, createEpisodeState(episode), {
              type: "start",
            }).state;
      state = travel(episode, state, "arrival");
      state = transitionEpisode(episode, state, {
        type: "interact",
        target: "lost-item-spot",
      }).state;
      state = travel(
        episode,
        state,
        episode.scenes.find((scene) =>
          scene.hotspots.some((spot) => spot.id === "neighbor"),
        )!.id,
      );
      state = transitionEpisode(episode, state, {
        type: "use",
        item: "lost-item",
        target: "neighbor",
      }).state;
      expect(state.inventory).toContain("favor-reward");
      expect(state.inventory).not.toContain("lost-item");
      if (timing === "before") {
        state = travel(episode, state, "arrival");
        state = play(episode, state, episode.referenceSolution.slice(1));
      }
      expect(state.completed).toBe(true);
      expect(state.inventory).toContain("combined-tool");
      state = travel(episode, state, "arrival");
      state = transitionEpisode(episode, state, {
        type: "interact",
        target: "lost-item-spot",
      }).state;
      expect(state.inventory).not.toContain("lost-item");
    },
  );
  it("rejects missing/duplicated objective hooks and executable extra fields", () => {
    const plan = calculusPlan();
    const missing = blueprint(plan);
    missing.machines[1].objectiveId = "unrelated";
    expect(() => compileStoryBlueprint(missing, plan)).toThrow(
      "every supplied learning objective",
    );
    const repeated = blueprint(plan);
    repeated.machines[1].objectiveId = repeated.machines[0].objectiveId;
    expect(() => compileStoryBlueprint(repeated, plan)).toThrow(
      "every supplied learning objective",
    );
    expect(() =>
      compileStoryBlueprint(
        { ...blueprint(plan), script: "doSomething()" },
        plan,
      ),
    ).toThrow("format");
    expect(zodTextFormat(storyBlueprintSchema, "compact_story").strict).toBe(
      true,
    );
  });
});
