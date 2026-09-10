import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  compileGeneralStory,
  generalLearningPlanSchema,
  generalMechanicsSchema,
  generalStorySchema,
  generalReviewSchema,
  generalRepairSchema,
  storyMachineBriefs,
  validateGeneralLearningPlan,
  validateGeneralMechanics,
  validateGeneralReview,
} from "../server/general-generation";
import { createEpisodeState, transitionEpisode } from "../src/episodes/engine";
import {
  calculusSources,
  calculusPlan,
  calculusMechanics,
  civicsSources,
  civicsPlan,
  civicsMechanics,
  generalStory,
} from "./fixtures/general-episode";

describe("subject-independent source planning and machine compilation", () => {
  it("gives the story writer instructional context and controls without formulas or answer keys", () => {
    const models = {
      machines: [
        ...calculusMechanics().machines,
        ...civicsMechanics().machines,
      ],
    };
    const before = structuredClone(models);
    const briefs = storyMachineBriefs(models);
    const numeric = briefs[0];
    const evidence = briefs[2];
    if (numeric.kind !== "simulation" || evidence.kind !== "evidence")
      throw new Error("The story brief must retain the machine kind.");
    expect(numeric).toMatchObject({
      objectiveId: "instantaneous-rate",
      kind: "simulation",
      briefing: models.machines[0].config.briefing,
      modelNotes: models.machines[0].config.modelNotes,
      controls: [
        {
          id: "time",
          label: "Time",
          kind: "number",
          min: 0,
          max: 10,
          step: 1,
          unit: "s",
        },
      ],
      outputs: [
        { id: "position", label: "Position", unit: "m" },
        { id: "velocity", label: "Velocity", unit: "m/s" },
      ],
      tasks: [
        {
          id: "first",
          title: "First motion",
          prompt: "Find a time with velocity at least 6 m/s.",
          transfer: false,
        },
        { id: "transfer", title: "A changed motion", transfer: true },
      ],
    });
    expect(numeric.tasks?.[0].successFeedback).toContain("slope");
    expect(numeric.capabilities).toContain("baseline reading");
    expect(evidence).toMatchObject({
      objectiveId: "branch-functions",
      kind: "evidence",
    });
    expect(evidence.rounds?.[0].cardLabels).toEqual([
      { id: "l", label: "Record 1" },
      { id: "e", label: "Record 2" },
      { id: "j", label: "Record 3" },
    ]);
    expect(evidence.rounds?.[0].slots[0]).toMatchObject({
      id: "legislative",
      capacity: 1,
    });
    expect(evidence.rounds?.[0].prompt).toContain("branch function");
    expect(evidence.capabilities).toContain("destination slot");
    const serialized = JSON.stringify(briefs);
    for (const privateField of [
      "expression",
      "derivativeWrt",
      "initialInputs",
      "referenceInputs",
      "constants",
      "goal",
      "acceptedAssignments",
      "explanation",
    ])
      expect(serialized).not.toContain(`"${privateField}":`);
    expect(models).toEqual(before);
  });
  it("accepts unrelated calculus and civics objectives without an enumerated curriculum", () => {
    expect(
      validateGeneralLearningPlan(calculusPlan(), calculusSources).objectives[0]
        .id,
    ).toBe("instantaneous-rate");
    expect(
      validateGeneralLearningPlan(civicsPlan(), civicsSources).objectives[0].id,
    ).toBe("branch-functions");
  });
  it("requires substantive support, distinct goals and verified continuous quotations", () => {
    expect(() =>
      validateGeneralLearningPlan(
        {
          supported: false,
          reason: "This is a shopping list without explanatory content.",
          objectives: [],
          notes: [],
        },
        calculusSources,
      ),
    ).toThrow("shopping list");
    const duplicate = calculusPlan();
    duplicate.objectives[1].id = duplicate.objectives[0].id;
    expect(() =>
      validateGeneralLearningPlan(duplicate, calculusSources),
    ).toThrow("distinct");
    const forged = calculusPlan();
    forged.objectives[0].evidence[0].quote =
      "The derivative is always larger than the original function.";
    expect(() => validateGeneralLearningPlan(forged, calculusSources)).toThrow(
      "quotation",
    );
  });
  it("compiles both generated expression models and evidence arrangements into playable adventures", () => {
    for (const [plan, mechanics, sources] of [
      [calculusPlan(), calculusMechanics(), calculusSources],
      [civicsPlan(), civicsMechanics(), civicsSources],
    ] as const) {
      const pkg = compileGeneralStory({
        raw: generalStory(plan.objectives.map((o) => o.id)),
        plan,
        mechanics,
        sources,
        level: "College",
        id: `generated-${plan.objectives[0].id}`,
        createdAt: "2026-09-10T12:00:00.000Z",
      });
      expect(pkg.objectives[0].evidence).toEqual(plan.objectives[0].evidence);
      expect(pkg.objectives[0].boundaries).toBe(plan.objectives[0].boundaries);
      let state = createEpisodeState(pkg);
      for (const action of pkg.referenceSolution) {
        if (action.type === "submitPuzzle") {
          const forged = structuredClone(action.evidence) as {
            kind: string;
            trials: Array<{
              inputs?: Record<string, number>;
              assignment?: Array<string | null>;
              passed: boolean;
            }>;
          };
          const successful = forged.trials.find((trial) => trial.passed)!;
          if (forged.kind === "simulation") successful.inputs!.time = 0;
          else successful.assignment![0] = "judicial";
          expect(
            transitionEpisode(pkg, state, { ...action, evidence: forged }).state
              .solvedPuzzles,
          ).not.toContain(action.puzzle);
        }
        state = transitionEpisode(pkg, state, action).state;
      }
      expect(state.completed).toBe(true);
      expect(state.solvedPuzzles).toHaveLength(2);
    }
  });
  it("rejects mismatched machine IDs, unknown evidence sources and code fields", () => {
    const mismatch = calculusMechanics();
    mismatch.machines[0].objectiveId = "unknown";
    expect(() =>
      validateGeneralMechanics(mismatch, calculusPlan(), calculusSources),
    ).toThrow("exactly one");
    const unknown = civicsMechanics();
    if (unknown.machines[0].config.kind === "evidence")
      unknown.machines[0].config.rounds[0].cards[0].sourceIds = ["fabricated"];
    expect(() =>
      validateGeneralMechanics(unknown, civicsPlan(), civicsSources),
    ).toThrow("unknown source");
    const code = calculusMechanics();
    Object.assign(code.machines[0].config, { code: "return 1" });
    expect(() =>
      validateGeneralMechanics(code, calculusPlan(), calculusSources),
    ).toThrow("format");
  });
  it("rejects a mathematically false declared solution even when the story is playable", () => {
    const broken = calculusMechanics();
    if (broken.machines[0].config.kind === "simulation")
      broken.machines[0].config.tasks[0].referenceInputs[0].value = 1;
    expect(() =>
      validateGeneralMechanics(broken, calculusPlan(), calculusSources),
    ).toThrow("reference intervention");
  });
  it("rejects a route that bypasses the real learning instrument", () => {
    const story = generalStory();
    story.referenceSolution = story.referenceSolution.filter(
      (step) => step.target !== "first-machine",
    );
    expect(() =>
      compileGeneralStory({
        raw: story,
        plan: calculusPlan(),
        mechanics: calculusMechanics(),
        sources: calculusSources,
        level: "College",
        id: "generated-broken",
        createdAt: "2026-09-10T12:00:00.000Z",
      }),
    ).toThrow("reference solution");
  });
  it("exports strict provider schemas for every stage including nested mechanic programs", () => {
    for (const schema of [
      generalLearningPlanSchema,
      generalMechanicsSchema,
      generalStorySchema,
      generalReviewSchema,
      generalRepairSchema,
    ]) {
      const format = zodTextFormat(schema, "general_test");
      expect(format.strict).toBe(true);
      expect(JSON.stringify(format)).not.toContain(
        '"additionalProperties":true',
      );
    }
  });
  it("does not allow an approval to conceal blocking reviewer findings", () => {
    expect(() =>
      validateGeneralReview(
        {
          passed: true,
          summary: "This lesson needs corrections.",
          issues: [
            {
              severity: "blocking",
              objectiveId: "instantaneous-rate",
              problem: "Wrong units.",
              repair: "Use velocity units.",
            },
          ],
        },
        calculusPlan(),
      ),
    ).toThrow("blocking");
    expect(() =>
      validateGeneralReview(
        {
          passed: false,
          summary: "Wrong source.",
          issues: [
            {
              severity: "blocking",
              objectiveId: "invented-goal",
              problem: "Wrong source.",
              repair: "Cite actual material.",
            },
          ],
        },
        calculusPlan(),
      ),
    ).toThrow("unknown learning objective");
  });
});
