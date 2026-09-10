import { z } from "zod";

/** Data-only teaching machines. Expressions are a bounded postfix language: no code execution. */
export type MachineBinding = { id: string; value: number };
export type MachineInstruction =
  | { op: "literal"; value: number }
  | { op: "ref"; id: string }
  | {
      op:
        | "add"
        | "sub"
        | "mul"
        | "div"
        | "pow"
        | "min"
        | "max"
        | "lt"
        | "lte"
        | "gt"
        | "gte"
        | "eq"
        | "and"
        | "or"
        | "neg"
        | "abs"
        | "sqrt"
        | "sin"
        | "cos"
        | "exp"
        | "log"
        | "not"
        | "if";
    };
export type MachineExpression = MachineInstruction[];
export type SimulationControl =
  | {
      id: string;
      label: string;
      kind: "number";
      min: number;
      max: number;
      step: number;
      unit: string;
    }
  | {
      id: string;
      label: string;
      kind: "choice";
      options: { label: string; value: number }[];
    }
  | {
      id: string;
      label: string;
      kind: "toggle";
      offLabel: string;
      onLabel: string;
    };
export type SimulationTask = {
  id: string;
  title: string;
  prompt: string;
  constants: MachineBinding[];
  initialInputs: MachineBinding[];
  referenceInputs: MachineBinding[];
  goal: MachineExpression;
  successFeedback: string;
  failureFeedback: string;
  transfer: boolean;
};
export type SimulationConfig = {
  kind: "simulation";
  briefing: string;
  modelNotes: string;
  controls: SimulationControl[];
  outputs: {
    id: string;
    label: string;
    unit: string;
    expression: MachineExpression;
    derivativeWrt: string | null;
  }[];
  plots: { inputId: string; outputId: string; min: number; max: number }[];
  tasks: SimulationTask[];
};
export type EvidenceRound = {
  id: string;
  title: string;
  prompt: string;
  cards: {
    id: string;
    label: string;
    text: string;
    sourceIds: string[];
    explanation: string;
  }[];
  slots: { id: string; label: string; description: string; capacity: number }[];
  acceptedAssignments: string[][];
  successFeedback: string;
  failureFeedback: string;
  transfer: boolean;
};
export type EvidenceConfig = {
  kind: "evidence";
  briefing: string;
  modelNotes: string;
  rounds: EvidenceRound[];
};
export type LessonMachineConfig = SimulationConfig | EvidenceConfig;
export type SimulationInputs = Record<string, number>;
export type SimulationTrial = {
  taskId: string;
  inputs: SimulationInputs;
  outputs: Record<string, number>;
  passed: boolean;
};
export type EvidenceTrial = {
  roundId: string;
  assignment: (string | null)[];
  passed: boolean;
};
export type LessonMachineEvidence =
  | { kind: "simulation"; trials: SimulationTrial[] }
  | { kind: "evidence"; trials: EvidenceTrial[] };

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
  .refine(
    (v) => !["__proto__", "prototype", "constructor"].includes(v),
    "Reserved identifier",
  );
const text = z.string().min(1).max(2400);
const label = z.string().min(1).max(160);
const finite = z.number().finite().min(-1e9).max(1e9);
const bindingSchema = z.object({ id, value: finite }).strict();
const programSchema = z
  .array(
    z.union([
      z.object({ op: z.literal("literal"), value: finite }).strict(),
      z.object({ op: z.literal("ref"), id }).strict(),
      z
        .object({
          op: z.enum([
            "add",
            "sub",
            "mul",
            "div",
            "pow",
            "min",
            "max",
            "lt",
            "lte",
            "gt",
            "gte",
            "eq",
            "and",
            "or",
            "neg",
            "abs",
            "sqrt",
            "sin",
            "cos",
            "exp",
            "log",
            "not",
            "if",
          ]),
        })
        .strict(),
    ]),
  )
  .min(1)
  .max(96);
const controlSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id,
      label,
      kind: z.literal("number"),
      min: finite,
      max: finite,
      step: z.number().positive().max(1e9),
      unit: z.string().max(40),
    })
    .strict(),
  z
    .object({
      id,
      label,
      kind: z.literal("choice"),
      options: z
        .array(z.object({ label, value: finite }).strict())
        .min(2)
        .max(8),
    })
    .strict(),
  z
    .object({
      id,
      label,
      kind: z.literal("toggle"),
      offLabel: label,
      onLabel: label,
    })
    .strict(),
]);
export const simulationConfigSchema = z
  .object({
    kind: z.literal("simulation"),
    briefing: text,
    modelNotes: text,
    controls: z.array(controlSchema).min(1).max(6),
    outputs: z
      .array(
        z
          .object({
            id,
            label,
            unit: z.string().max(40),
            expression: programSchema,
            derivativeWrt: id.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    plots: z
      .array(
        z
          .object({ inputId: id, outputId: id, min: finite, max: finite })
          .strict(),
      )
      .max(1),
    tasks: z
      .array(
        z
          .object({
            id,
            title: label,
            prompt: text,
            constants: z.array(bindingSchema).max(12),
            initialInputs: z.array(bindingSchema).min(1).max(6),
            referenceInputs: z.array(bindingSchema).min(1).max(6),
            goal: programSchema,
            successFeedback: text,
            failureFeedback: text,
            transfer: z.boolean(),
          })
          .strict(),
      )
      .min(2)
      .max(4),
  })
  .strict();
export const evidenceConfigSchema = z
  .object({
    kind: z.literal("evidence"),
    briefing: text,
    modelNotes: text,
    rounds: z
      .array(
        z
          .object({
            id,
            title: label,
            prompt: text,
            cards: z
              .array(
                z
                  .object({
                    id,
                    label,
                    text,
                    sourceIds: z.array(id).min(1).max(12),
                    explanation: text,
                  })
                  .strict(),
              )
              .min(3)
              .max(10),
            slots: z
              .array(
                z
                  .object({
                    id,
                    label,
                    description: text,
                    capacity: z.number().int().min(1).max(10),
                  })
                  .strict(),
              )
              .min(2)
              .max(8),
            acceptedAssignments: z
              .array(z.array(id).min(3).max(10))
              .min(1)
              .max(12),
            successFeedback: text,
            failureFeedback: text,
            transfer: z.boolean(),
          })
          .strict(),
      )
      .min(2)
      .max(4),
  })
  .strict();
export const lessonMachineConfigSchema = z.discriminatedUnion("kind", [
  simulationConfigSchema,
  evidenceConfigSchema,
]);

const NUMBER_LIMIT = 1e12;
const EPS = 1e-8;
const unary = new Set([
  "neg",
  "abs",
  "sqrt",
  "sin",
  "cos",
  "exp",
  "log",
  "not",
]);
const booleanOps = new Set([
  "lt",
  "lte",
  "gt",
  "gte",
  "eq",
  "and",
  "or",
  "not",
]);
function demand(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function number(value: number): number {
  demand(
    Number.isFinite(value) && Math.abs(value) <= NUMBER_LIMIT,
    "The model produced an undefined or excessively large number.",
  );
  return value;
}
const close = (a: number, b: number) =>
  a === b || Math.abs(a - b) <= EPS * Math.max(Math.abs(a), Math.abs(b));
function distinct(values: string[], name: string): void {
  demand(
    new Set(values).size === values.length,
    `${name} identifiers must be unique.`,
  );
}
function bindingMap(bindings: MachineBinding[]): SimulationInputs {
  distinct(
    bindings.map((v) => v.id),
    "Binding",
  );
  return Object.fromEntries(bindings.map((v) => [v.id, v.value]));
}
function has(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}
function sameInputs(a: SimulationInputs, b: SimulationInputs): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => has(b, key) && close(a[key], b[key]))
  );
}
function taskFor(config: SimulationConfig, taskId: string): SimulationTask {
  const task = config.tasks.find((v) => v.id === taskId);
  demand(task, "Unknown simulation task.");
  return task;
}
function roundFor(config: EvidenceConfig, roundId: string): EvidenceRound {
  const round = config.rounds.find((v) => v.id === roundId);
  demand(round, "Unknown evidence round.");
  return round;
}
function checkInputs(
  config: SimulationConfig,
  raw: unknown,
): asserts raw is SimulationInputs {
  demand(
    typeof raw === "object" && raw !== null && !Array.isArray(raw),
    "The controls require an input object.",
  );
  const inputs = raw as SimulationInputs;
  demand(
    Object.keys(inputs).length === config.controls.length,
    "Supply exactly one value for every control.",
  );
  for (const control of config.controls) {
    const value = inputs[control.id];
    demand(
      has(inputs, control.id) &&
        typeof value === "number" &&
        Number.isFinite(value),
      "Every control value must be finite.",
    );
    if (control.kind === "number") {
      const steps = (value - control.min) / control.step;
      const maxSteps = (control.max - control.min) / control.step;
      demand(
        Number.isFinite(steps) && steps >= -1e-7 && steps <= maxSteps + 1e-7,
        `${control.label} is outside its range.`,
      );
      demand(
        Math.abs(steps - Math.round(steps)) <= 1e-7 &&
          close(value, control.min + Math.round(steps) * control.step),
        `${control.label} must follow its control step.`,
      );
    } else if (control.kind === "choice") {
      demand(
        control.options.some((option) => option.value === value),
        `${control.label} has no such option.`,
      );
    } else
      demand(
        value === 0 || value === 1,
        "Toggle controls must be zero or one.",
      );
  }
}
function checkProgram(program: MachineExpression, allowed: Set<string>): void {
  let depth = 0;
  for (const instruction of program) {
    if (instruction.op === "ref") {
      demand(
        allowed.has(instruction.id),
        `Expression refers to unavailable value ${instruction.id}.`,
      );
      depth++;
    } else if (instruction.op === "literal") depth++;
    else {
      const count =
        instruction.op === "if" ? 3 : unary.has(instruction.op) ? 1 : 2;
      demand(
        depth >= count,
        `Expression stack underflow at ${instruction.op}.`,
      );
      depth = depth - count + 1;
    }
    demand(depth <= 32, "Expression stack exceeds its limit.");
  }
  demand(depth === 1, "An expression must produce exactly one value.");
}

type Dual = { value: number; derivative: number };
function runExpression(
  program: MachineExpression,
  resolve: (id: string) => Dual,
  differentiating = false,
): Dual {
  const stack: Dual[] = [];
  const push = (value: number, derivative = 0) =>
    stack.push({ value: number(value), derivative: number(derivative) });
  const take = (): Dual => {
    const value = stack.pop();
    demand(value, "Malformed expression stack.");
    return value;
  };
  for (const instruction of program) {
    demand(
      !differentiating ||
        (!booleanOps.has(instruction.op) && instruction.op !== "if"),
      "Automatic derivatives require smooth arithmetic expressions; comparison, logical, and conditional dependencies are unsupported.",
    );
    if (instruction.op === "literal") {
      push(instruction.value);
      continue;
    }
    if (instruction.op === "ref") {
      const r = resolve(instruction.id);
      push(r.value, r.derivative);
      continue;
    }
    const b = take();
    if (unary.has(instruction.op)) {
      switch (instruction.op) {
        case "neg":
          push(-b.value, -b.derivative);
          break;
        case "abs":
          demand(
            !differentiating || b.value !== 0 || b.derivative === 0,
            "The absolute-value derivative is undefined at this corner.",
          );
          push(Math.abs(b.value), Math.sign(b.value) * b.derivative);
          break;
        case "sqrt":
          demand(
            b.value >= 0 && (!differentiating || b.value > 0),
            "Square root is outside its differentiable domain.",
          );
          push(
            Math.sqrt(b.value),
            b.derivative === 0 ? 0 : b.derivative / (2 * Math.sqrt(b.value)),
          );
          break;
        case "sin":
          push(Math.sin(b.value), Math.cos(b.value) * b.derivative);
          break;
        case "cos":
          push(Math.cos(b.value), -Math.sin(b.value) * b.derivative);
          break;
        case "exp":
          push(Math.exp(b.value), Math.exp(b.value) * b.derivative);
          break;
        case "log":
          demand(b.value > 0, "Logarithm requires a positive input.");
          push(Math.log(b.value), b.derivative / b.value);
          break;
        case "not":
          demand(
            !differentiating || b.value !== 0 || b.derivative === 0,
            "A logical boundary has no derivative at this point.",
          );
          push(b.value === 0 ? 1 : 0);
          break;
      }
      continue;
    }
    const a = take();
    if (instruction.op === "if") {
      const condition = take();
      demand(
        !differentiating || condition.value !== 0 || condition.derivative === 0,
        "A conditional boundary has no derivative at this point.",
      );
      const selected = condition.value !== 0 ? a : b;
      push(selected.value, selected.derivative);
      continue;
    }
    switch (instruction.op) {
      case "add":
        push(a.value + b.value, a.derivative + b.derivative);
        break;
      case "sub":
        push(a.value - b.value, a.derivative - b.derivative);
        break;
      case "mul":
        push(
          a.value * b.value,
          a.derivative * b.value + a.value * b.derivative,
        );
        break;
      case "div":
        demand(b.value !== 0, "Division by zero is undefined.");
        push(
          a.value / b.value,
          (a.derivative * b.value - a.value * b.derivative) /
            (b.value * b.value),
        );
        break;
      case "pow": {
        demand(
          !differentiating ||
            a.value !== 0 ||
            (Number.isInteger(b.value) && b.value >= 1),
          "A fractional or nonpositive power at zero is outside the supported differentiable domain.",
        );
        const value = Math.pow(a.value, b.value);
        let derivative = 0;
        if (a.derivative !== 0 || b.derivative !== 0) {
          if (b.derivative === 0) {
            demand(
              a.value >= 0 || Number.isInteger(b.value),
              "A negative base requires a constant integer exponent.",
            );
            derivative =
              b.value === 0
                ? 0
                : b.value * Math.pow(a.value, b.value - 1) * a.derivative;
          } else {
            demand(
              a.value > 0,
              "Differentiating a variable exponent requires a positive base.",
            );
            derivative =
              value *
              (b.derivative * Math.log(a.value) +
                (b.value * a.derivative) / a.value);
          }
        }
        push(value, derivative);
        break;
      }
      case "min":
      case "max": {
        demand(
          !differentiating ||
            a.value !== b.value ||
            a.derivative === b.derivative,
          "The derivative is undefined where the two branches meet.",
        );
        const selected =
          instruction.op === "min"
            ? a.value <= b.value
              ? a
              : b
            : a.value >= b.value
              ? a
              : b;
        push(selected.value, selected.derivative);
        break;
      }
      default: {
        demand(booleanOps.has(instruction.op), "Unknown expression operation.");
        demand(
          !differentiating ||
            !["lt", "lte", "gt", "gte", "eq"].includes(instruction.op) ||
            a.value !== b.value ||
            a.derivative === b.derivative,
          "A comparison changes branches at this point; its derivative is undefined.",
        );
        demand(
          !differentiating ||
            !["and", "or"].includes(instruction.op) ||
            ((a.value !== 0 || a.derivative === 0) &&
              (b.value !== 0 || b.derivative === 0)),
          "A logical boundary has no derivative at this point.",
        );
        const value =
          instruction.op === "lt"
            ? a.value < b.value
            : instruction.op === "lte"
              ? a.value <= b.value
              : instruction.op === "gt"
                ? a.value > b.value
                : instruction.op === "gte"
                  ? a.value >= b.value
                  : instruction.op === "eq"
                    ? a.value === b.value
                    : instruction.op === "and"
                      ? a.value !== 0 && b.value !== 0
                      : a.value !== 0 || b.value !== 0;
        push(value ? 1 : 0);
      }
    }
  }
  demand(stack.length === 1, "Malformed expression result.");
  return stack[0];
}

/** Execute a generated model; derivative outputs use dual-number chain rules, including referenced outputs. */
export function evaluateSimulation(
  config: SimulationConfig,
  taskId: string,
  inputs: SimulationInputs,
): { outputs: Record<string, number>; passed: boolean } {
  return evaluateSimulationInternal(config, taskId, inputs, true);
}
function evaluateSimulationInternal(
  config: SimulationConfig,
  taskId: string,
  inputs: SimulationInputs,
  enforceStep: boolean,
): { outputs: Record<string, number>; passed: boolean } {
  const task = taskFor(config, taskId);
  if (enforceStep) checkInputs(config, inputs);
  const constants = bindingMap(task.constants);
  const memo = new Map<string, Dual>();
  const computing = new Set<string>();
  const resolve = (name: string, wrt?: string): Dual => {
    if (has(inputs, name))
      return { value: inputs[name], derivative: wrt === name ? 1 : 0 };
    if (has(constants, name)) return { value: constants[name], derivative: 0 };
    const output = config.outputs.find((v) => v.id === name);
    demand(output, `Unknown model value ${name}.`);
    const memoKey = JSON.stringify([wrt ?? null, name]);
    const existing = memo.get(memoKey);
    if (existing) return existing;
    demand(!computing.has(memoKey), "Circular model reference.");
    computing.add(memoKey);
    let result: Dual;
    if (output.derivativeWrt !== null) {
      demand(
        wrt === undefined,
        "Higher derivatives of derivative outputs are not supported.",
      );
      const differentiated = runExpression(
        output.expression,
        (key) => resolve(key, output.derivativeWrt!),
        true,
      );
      result = { value: differentiated.derivative, derivative: 0 };
    } else
      result = runExpression(
        output.expression,
        (key) => resolve(key, wrt),
        wrt !== undefined,
      );
    computing.delete(memoKey);
    memo.set(memoKey, result);
    return result;
  };
  const outputs = Object.fromEntries(
    config.outputs.map((output) => [output.id, resolve(output.id).value]),
  );
  const goal = runExpression(task.goal, (key) => resolve(key));
  demand(
    goal.value === 0 || goal.value === 1,
    "A task goal must evaluate to a boolean comparison (zero or one).",
  );
  return { outputs, passed: goal.value !== 0 };
}
export function simulationInputs(
  config: SimulationConfig,
  taskId: string,
): SimulationInputs {
  return bindingMap(taskFor(config, taskId).initialInputs);
}
export function simulationTrial(
  config: SimulationConfig,
  taskId: string,
  inputs: SimulationInputs,
): SimulationTrial {
  const reading = evaluateSimulation(config, taskId, inputs);
  return { taskId, inputs: { ...inputs }, ...reading };
}
/** Plot gaps are explicit. Singularities never become invented zero-valued samples. */
export function simulationPlot(
  config: SimulationConfig,
  taskId: string,
  inputs: SimulationInputs,
): { input: number; output: number | null }[] {
  checkInputs(config, inputs);
  const plot = config.plots[0];
  if (!plot) return [];
  return Array.from({ length: 61 }, (_, i) => {
    const input = plot.min + ((plot.max - plot.min) * i) / 60;
    try {
      return {
        input,
        output: evaluateSimulationInternal(
          config,
          taskId,
          { ...inputs, [plot.inputId]: input },
          false,
        ).outputs[plot.outputId],
      };
    } catch {
      return { input, output: null };
    }
  });
}
export function evidenceTrial(
  config: EvidenceConfig,
  roundId: string,
  assignment: (string | null)[],
): EvidenceTrial {
  const round = roundFor(config, roundId);
  demand(
    Array.isArray(assignment) && assignment.length === round.cards.length,
    "Every evidence card needs an assignment slot.",
  );
  demand(
    assignment.every(
      (slot) =>
        slot === null ||
        (typeof slot === "string" && round.slots.some((v) => v.id === slot)),
    ),
    "Unknown evidence slot.",
  );
  for (const slot of round.slots)
    demand(
      assignment.filter((v) => v === slot.id).length <= slot.capacity,
      `${slot.label} has no remaining space.`,
    );
  const passed = round.acceptedAssignments.some((answer) =>
    answer.every((slot, i) => slot === assignment[i]),
  );
  return { roundId, assignment: [...assignment], passed };
}

/** Reject malformed, trivial, unsolvable-by-declared-witness, and mechanically duplicate transfer activities. */
export function validateLessonMachineConfig(raw: unknown): LessonMachineConfig {
  const config = lessonMachineConfigSchema.parse(raw) as LessonMachineConfig;
  if (config.kind === "simulation") {
    const controlIds = config.controls.map((v) => v.id);
    const outputIds = config.outputs.map((v) => v.id);
    const constantIds = config.tasks[0].constants.map((v) => v.id);
    distinct([...controlIds, ...outputIds, ...constantIds], "Model value");
    distinct(
      config.tasks.map((v) => v.id),
      "Task",
    );
    for (const control of config.controls) {
      if (control.kind === "number") {
        demand(
          control.max > control.min,
          "A numeric control needs a nonempty range.",
        );
        const steps = (control.max - control.min) / control.step;
        demand(
          steps >= 1 &&
            steps <= 1e6 &&
            Math.abs(steps - Math.round(steps)) <= 1e-6,
          "Control steps must divide their range into 1–1,000,000 intervals.",
        );
      } else if (control.kind === "choice")
        demand(
          new Set(control.options.map((v) => v.value)).size ===
            control.options.length,
          "Choice values must be distinct.",
        );
    }
    const allowed = new Set([...controlIds, ...constantIds]);
    const dependencies = new Map<string, Set<string>>();
    for (const output of config.outputs) {
      checkProgram(output.expression, allowed);
      const references = output.expression.flatMap((token) =>
        token.op === "ref" ? [token.id] : [],
      );
      const transitive = new Set(
        references.flatMap((ref) => [ref, ...(dependencies.get(ref) ?? [])]),
      );
      dependencies.set(output.id, transitive);
      if (output.derivativeWrt !== null) {
        demand(
          config.controls.some(
            (control) =>
              control.id === output.derivativeWrt && control.kind === "number",
          ),
          "A derivative must name a numeric control.",
        );
        demand(
          transitive.has(output.derivativeWrt),
          "A derivative must depend on its differentiation control.",
        );
        demand(
          !config.outputs.some(
            (other) => other.derivativeWrt !== null && transitive.has(other.id),
          ),
          "Higher derivatives of derivative outputs are not supported.",
        );
        const differentiatedPrograms = [
          output,
          ...config.outputs.filter((other) => transitive.has(other.id)),
        ];
        demand(
          differentiatedPrograms.every((dependency) =>
            dependency.expression.every(
              (token) => !booleanOps.has(token.op) && token.op !== "if",
            ),
          ),
          "Automatic derivatives require smooth arithmetic expressions; comparison, logical, and conditional dependencies are unsupported.",
        );
      }
      allowed.add(output.id);
    }
    demand(
      !config.tasks[0].transfer && config.tasks.at(-1)!.transfer,
      "Begin with a supported experiment and finish with a transfer task.",
    );
    for (const task of config.tasks) {
      distinct(
        task.constants.map((v) => v.id),
        "Constant",
      );
      demand(
        task.constants.length === constantIds.length &&
          task.constants.every((v) => constantIds.includes(v.id)),
        "Every task needs the same named model constants.",
      );
      checkProgram(task.goal, allowed);
      demand(
        task.goal.some(
          (token) => token.op === "ref" && outputIds.includes(token.id),
        ),
        "Task goals must inspect a model output.",
      );
      const baseline = bindingMap(task.initialInputs);
      const reference = bindingMap(task.referenceInputs);
      checkInputs(config, baseline);
      checkInputs(config, reference);
      const initial = evaluateSimulation(config, task.id, baseline);
      const solved = evaluateSimulation(config, task.id, reference);
      demand(
        !initial.passed,
        "A task must require an intervention: its initial controls already succeed.",
      );
      demand(
        solved.passed,
        "The declared reference intervention does not satisfy the task.",
      );
      demand(
        !sameInputs(baseline, reference) &&
          !sameInputs(initial.outputs, solved.outputs),
        "A successful intervention must change the model's observable output.",
      );
      // Sample the usable control range. Domain errors at ordinary selectable values make a bad instrument.
      for (const control of config.controls) {
        const values =
          control.kind === "number"
            ? [
                control.min,
                control.min +
                  Math.round((control.max - control.min) / control.step / 2) *
                    control.step,
                control.max,
              ]
            : control.kind === "choice"
              ? control.options.map((v) => v.value)
              : [0, 1];
        for (const value of values)
          evaluateSimulation(config, task.id, {
            ...baseline,
            [control.id]: value,
          });
      }
    }
    const last = config.tasks.at(-1)!;
    demand(
      config.tasks
        .slice(0, -1)
        .every(
          (task) =>
            !sameInputs(
              bindingMap(task.constants),
              bindingMap(last.constants),
            ) || JSON.stringify(task.goal) !== JSON.stringify(last.goal),
        ),
      "The transfer task needs changed model constants or a different goal, not only a new title.",
    );
    for (const plot of config.plots) {
      const input = config.controls.find((v) => v.id === plot.inputId);
      demand(
        input?.kind === "number" && outputIds.includes(plot.outputId),
        "A plot needs a numeric input control and a model output.",
      );
      demand(
        plot.min < plot.max && plot.min >= input.min && plot.max <= input.max,
        "Plot bounds must fit the numeric control range.",
      );
    }
  } else {
    distinct(
      config.rounds.map((v) => v.id),
      "Round",
    );
    demand(
      !config.rounds[0].transfer && config.rounds.at(-1)!.transfer,
      "Finish the evidence activity with a new transfer case.",
    );
    for (const round of config.rounds) {
      distinct(
        round.cards.map((v) => v.id),
        "Evidence card",
      );
      distinct(
        round.slots.map((v) => v.id),
        "Evidence slot",
      );
      distinct(
        round.acceptedAssignments.map((v) => JSON.stringify(v)),
        "Accepted arrangement",
      );
      demand(
        round.slots.reduce((total, slot) => total + slot.capacity, 0) >=
          round.cards.length,
        "Evidence slots must have enough capacity for every card.",
      );
      for (const answer of round.acceptedAssignments) {
        demand(
          answer.length === round.cards.length,
          "Accepted arrangements must place every card exactly once.",
        );
        demand(
          new Set(answer).size >= 2,
          "An evidence arrangement must distinguish at least two roles.",
        );
        demand(
          evidenceTrial(config, round.id, answer).passed,
          "Invalid accepted evidence arrangement.",
        );
      }
    }
    const transferTexts = new Set(
      config.rounds
        .at(-1)!
        .cards.map((card) =>
          card.text.toLowerCase().replace(/\s+/g, " ").trim(),
        ),
    );
    demand(
      config.rounds.slice(0, -1).every((round) => {
        const earlier = new Set(
          round.cards.map((card) =>
            card.text.toLowerCase().replace(/\s+/g, " ").trim(),
          ),
        );
        return [...transferTexts].some((text) => !earlier.has(text));
      }),
      "The transfer round must introduce new evidence, not relabel the same cards.",
    );
  }
  return config;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function hasExactly(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => has(value, key))
  );
}
/** Completion is based on replayed inputs, not an AI verdict or caller-supplied pass flag. */
export function verifyLessonMachineEvidence(
  config: LessonMachineConfig,
  raw: unknown,
): boolean {
  try {
    if (
      !record(raw) ||
      !hasExactly(raw, ["kind", "trials"]) ||
      raw.kind !== config.kind ||
      !Array.isArray(raw.trials) ||
      raw.trials.length < 4 ||
      raw.trials.length > 200
    )
      return false;
    if (config.kind === "simulation") {
      const seen = new Map<string, SimulationTrial[]>();
      let lastIndex = -1;
      for (const value of raw.trials) {
        if (
          !record(value) ||
          !hasExactly(value, ["taskId", "inputs", "outputs", "passed"]) ||
          typeof value.taskId !== "string" ||
          !record(value.inputs) ||
          !record(value.outputs) ||
          typeof value.passed !== "boolean"
        )
          return false;
        const taskIndex = config.tasks.findIndex(
          (task) => task.id === value.taskId,
        );
        if (taskIndex < 0 || taskIndex < lastIndex || taskIndex > lastIndex + 1)
          return false;
        if (
          taskIndex > lastIndex &&
          lastIndex >= 0 &&
          !seen.get(config.tasks[lastIndex].id)?.at(-1)?.passed
        )
          return false;
        const recomputed = simulationTrial(
          config,
          value.taskId,
          value.inputs as SimulationInputs,
        );
        if (
          value.passed !== recomputed.passed ||
          !Object.values(value.outputs).every(
            (v) => typeof v === "number" && Number.isFinite(v),
          ) ||
          !sameInputs(
            value.outputs as Record<string, number>,
            recomputed.outputs,
          )
        )
          return false;
        const prior = seen.get(value.taskId) ?? [];
        if (
          prior.length === 0 &&
          !sameInputs(recomputed.inputs, simulationInputs(config, value.taskId))
        )
          return false;
        prior.push(recomputed);
        seen.set(value.taskId, prior);
        lastIndex = taskIndex;
      }
      return config.tasks.every((task) => {
        const trials = seen.get(task.id) ?? [];
        const last = trials.at(-1);
        return (
          trials.length >= 2 &&
          trials[0].passed === false &&
          last?.passed === true &&
          !sameInputs(trials[0].inputs, last.inputs) &&
          !sameInputs(trials[0].outputs, last.outputs)
        );
      });
    }
    const seen = new Map<string, EvidenceTrial[]>();
    let lastIndex = -1;
    for (const value of raw.trials) {
      if (
        !record(value) ||
        !hasExactly(value, ["roundId", "assignment", "passed"]) ||
        typeof value.roundId !== "string" ||
        !Array.isArray(value.assignment) ||
        typeof value.passed !== "boolean"
      )
        return false;
      const roundIndex = config.rounds.findIndex(
        (round) => round.id === value.roundId,
      );
      if (
        roundIndex < 0 ||
        roundIndex < lastIndex ||
        roundIndex > lastIndex + 1
      )
        return false;
      if (
        roundIndex > lastIndex &&
        lastIndex >= 0 &&
        !seen.get(config.rounds[lastIndex].id)?.at(-1)?.passed
      )
        return false;
      const recomputed = evidenceTrial(
        config,
        value.roundId,
        value.assignment as (string | null)[],
      );
      if (value.passed !== recomputed.passed) return false;
      const prior = seen.get(value.roundId) ?? [];
      if (
        prior.length === 0 &&
        !recomputed.assignment.every((slot) => slot === null)
      )
        return false;
      prior.push(recomputed);
      seen.set(value.roundId, prior);
      lastIndex = roundIndex;
    }
    return config.rounds.every((round) => {
      const trials = seen.get(round.id) ?? [];
      return (
        trials.length >= 2 &&
        !trials[0].passed &&
        trials.at(-1)?.passed === true
      );
    });
  } catch {
    return false;
  }
}
/** A declared witness is recomputed at validation time; it is never trusted as a successful trace. */
export function canonicalLessonMachineEvidence(
  config: LessonMachineConfig,
): LessonMachineEvidence {
  if (config.kind === "simulation")
    return {
      kind: "simulation",
      trials: config.tasks.flatMap((task) => [
        simulationTrial(config, task.id, simulationInputs(config, task.id)),
        simulationTrial(config, task.id, bindingMap(task.referenceInputs)),
      ]),
    };
  return {
    kind: "evidence",
    trials: config.rounds.flatMap((round) => [
      evidenceTrial(
        config,
        round.id,
        round.cards.map(() => null),
      ),
      evidenceTrial(config, round.id, round.acceptedAssignments[0]),
    ]),
  };
}
