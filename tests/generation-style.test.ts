import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralProvider } from "../server/general-generation";
import {
  defaultHarborProvider,
  type HarborPlan,
} from "../server/harbor-generation";
import {
  SIMPLE_LESSON_REVIEW,
  SIMPLE_LESSON_STYLE,
} from "../server/lesson-style";
import {
  calculusMechanics,
  calculusPlan,
  calculusSources,
  generalStory,
} from "./fixtures/general-episode";
import { GENERATED_EXPERIMENT_INPUT } from "./fixtures/generated-harbor";

const transport = vi.hoisted(() => ({
  parse: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("../server/model-client", () => ({
  createModelClient: () => ({
    client: { responses: { parse: transport.parse } },
    destroy: transport.destroy,
  }),
}));

type Schema = {
  $ref?: string;
  properties?: Record<string, Schema>;
  anyOf?: Schema[];
  oneOf?: Schema[];
  items?: Schema;
  const?: string;
  enum?: string[];
  minItems?: number;
  maxItems?: number;
};

type CapturedRequest = {
  input: Array<{ role: string; content: string }>;
  text: { format: { schema: Schema } };
};

function resolve(root: Schema, value: Schema): Schema {
  if (!value.$ref) return value;
  expect(value.$ref).toMatch(/^#\//);
  let target: unknown = root;
  for (const key of value.$ref.slice(2).split("/")) {
    target = (target as Record<string, unknown>)[
      key.replace(/~1/g, "/").replace(/~0/g, "~")
    ];
  }
  expect(target).toBeDefined();
  return resolve(root, target as Schema);
}

function property(root: Schema, value: Schema, key: string): Schema {
  const result = resolve(root, value).properties?.[key];
  expect(result, `Structured output property ${key}`).toBeDefined();
  return resolve(root, result!);
}

function item(root: Schema, value: Schema): Schema {
  const result = resolve(root, value).items;
  expect(result, "Structured output array items").toBeDefined();
  return resolve(root, result!);
}

function exactCount(value: Schema, count: number) {
  expect(value.minItems).toBe(count);
  expect(value.maxItems).toBe(count);
}

function expectSimpleMachines(root: Schema, config: Schema) {
  const resolved = resolve(root, config);
  const branches = (resolved.anyOf ?? resolved.oneOf ?? [resolved]).map(
    (branch) => resolve(root, branch),
  );
  const variant = (kind: string) => {
    const result = branches.find((branch) => {
      const discriminator = property(root, branch, "kind");
      return discriminator.const === kind || discriminator.enum?.includes(kind);
    });
    expect(result, `${kind} remains an available interaction`).toBeDefined();
    return result!;
  };
  const simulation = variant("simulation");
  exactCount(property(root, simulation, "controls"), 1);
  const outputs = property(root, simulation, "outputs");
  expect(outputs.minItems).toBeGreaterThanOrEqual(1);
  expect(outputs.maxItems).toBeLessThanOrEqual(2);
  exactCount(property(root, simulation, "tasks"), 2);

  const evidence = variant("evidence");
  const rounds = property(root, evidence, "rounds");
  exactCount(rounds, 2);
  const round = item(root, rounds);
  exactCount(property(root, round, "cards"), 3);
  exactCount(property(root, round, "slots"), 2);
}

const baseInput = () => ({
  topic: "An introduction to the source",
  level: "High school / introductory college",
  apiKey: "unused-test-key",
  signal: new AbortController().signal,
});

type Stage =
  | "plan"
  | "mechanics"
  | "story"
  | "review"
  | "repairMechanics"
  | "repairBundle";
type Mode = "point-and-click" | "3D";

function providerCall(mode: Mode, stage: Stage): () => Promise<unknown> {
  if (mode === "point-and-click") {
    const plan = calculusPlan();
    const mechanics = calculusMechanics();
    const input = {
      ...baseInput(),
      sources: calculusSources,
      plan,
      mechanics,
      story: generalStory(plan.objectives.map((objective) => objective.id)),
      draft: mechanics,
      issues: "The instructions require too many simultaneous decisions.",
    };
    return () => defaultGeneralProvider[stage](input);
  }
  const fixture = GENERATED_EXPERIMENT_INPUT;
  const plan: HarborPlan = {
    supported: true,
    reason: "",
    notes: [],
    objectives: [
      {
        ...fixture.objective,
        approach: "simulation",
        learnerAction: "Change a count and observe the result.",
      },
    ],
  };
  const input = {
    ...baseInput(),
    sources: fixture.sources,
    plan,
    mechanics: { config: fixture.config },
    story: fixture.story,
    draft: { config: fixture.config },
    issues: "The instructions require too many simultaneous decisions.",
  };
  return () => defaultHarborProvider[stage](input);
}

async function capture(invoke: () => Promise<unknown>) {
  // Stop before provider output or story compilation. No API access is possible.
  await expect(invoke()).rejects.toMatchObject({ code: "provider_error" });
  expect(transport.parse).toHaveBeenCalledTimes(1);
  expect(transport.destroy).toHaveBeenCalledTimes(1);
  return transport.parse.mock.calls[0][0] as CapturedRequest;
}

beforeEach(() => {
  transport.parse.mockReset().mockRejectedValue(new Error("request captured"));
  transport.destroy.mockReset().mockResolvedValue(undefined);
});

describe("simpler defaults reach every real generation request", () => {
  const stages: Stage[] = [
    "plan",
    "mechanics",
    "story",
    "review",
    "repairMechanics",
    "repairBundle",
  ];
  for (const mode of ["point-and-click", "3D"] as const) {
    for (const stage of stages) {
      it(`${mode} ${stage} uses beginner guidance and the appropriate output bounds`, async () => {
        const request = await capture(providerCall(mode, stage));
        const instructions = request.input.find(
          (message) => message.role === "system",
        )!.content;
        expect(instructions).toContain(SIMPLE_LESSON_STYLE);
        if (stage === "review")
          expect(instructions).toContain(SIMPLE_LESSON_REVIEW);
        const facts = JSON.parse(
          request.input.find((message) => message.role === "user")!.content,
        );
        expect(facts).toMatchObject({
          topic: baseInput().topic,
          level: baseInput().level,
        });
        expect(facts.untrustedSourceRecords).toEqual(
          mode === "3D" ? GENERATED_EXPERIMENT_INPUT.sources : calculusSources,
        );

        const root = request.text.format.schema;
        if (stage === "plan") {
          expect(property(root, root, "objectives").maxItems).toBe(
            mode === "3D" ? 1 : 2,
          );
        } else if (
          stage === "mechanics" ||
          stage === "repairMechanics" ||
          stage === "repairBundle"
        ) {
          const mechanics =
            stage === "repairBundle" ? property(root, root, "mechanics") : root;
          let config: Schema;
          if (mode === "point-and-click") {
            const machines = property(root, mechanics, "machines");
            exactCount(machines, 2);
            config = property(root, item(root, machines), "config");
          } else config = property(root, mechanics, "config");
          expectSimpleMachines(root, config);
        }
      });
    }
  }

  for (const stage of [
    "mechanics",
    "repairMechanics",
    "repairBundle",
  ] as const) {
    it(`preserves all three objectives in an older checkpoint during ${stage}`, async () => {
      const plan = calculusPlan();
      plan.objectives.push({
        ...plan.objectives[0],
        id: "third-saved-objective",
      });
      const mechanics = calculusMechanics();
      mechanics.machines.push({
        ...mechanics.machines[0],
        objectiveId: "third-saved-objective",
      });
      const request = await capture(() =>
        defaultGeneralProvider[stage]({
          ...baseInput(),
          sources: calculusSources,
          plan,
          mechanics,
          story: generalStory(plan.objectives.map((objective) => objective.id)),
          draft: mechanics,
          issues: "Make the existing planned activities simpler.",
        }),
      );
      const root = request.text.format.schema;
      const bundle =
        stage === "repairBundle" ? property(root, root, "mechanics") : root;
      const machines = property(root, bundle, "machines");
      exactCount(machines, 3);
      expectSimpleMachines(
        root,
        property(root, item(root, machines), "config"),
      );
    });
  }
});
