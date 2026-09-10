/** Small, deterministic teaching instruments. Vectors are illustrative, not semantic labels.
 * The attention kernel follows Vaswani et al. (2017), sections 3.2.1 and 3.5.
 */
export type PositionConfig = {
  kind: "position";
  tokens: string[];
  embeddings: number[][];
  positions: number[][];
};
export type AttentionConfig = {
  kind: "attention";
  tokens: string[];
  query: number[];
  keys: number[][];
  values: number[][];
};
export type CausalConfig = {
  kind: "causal";
  tokens: string[];
  embeddings: number[][];
  changedEmbeddings: number[][];
  queryIndex: number;
};
export type TransformerConfig = PositionConfig | AttentionConfig | CausalConfig;
export type AttentionReading = {
  rawScores: number[];
  scores: number[];
  weights: number[];
  output: number[];
};
export type AttentionPatch = {
  scoreSource: "keys" | "values";
  valueSource: "keys" | "values";
  scale: "sqrt" | "none";
};
export type PositionTrial = {
  order: number[];
  positionsEnabled: boolean;
  readings: number[][];
};
export type AttentionTrial = {
  patch: AttentionPatch;
  change: "none" | "value";
  reading: AttentionReading;
};
export type CausalTrial = {
  board: "main" | "transfer";
  allowed: boolean[];
  experiment: "future" | "context";
  before: number[];
  after: number[];
};
export type TransformerEvidence =
  | {
      kind: "position";
      trials: PositionTrial[];
      installation: { order: number[]; positionsEnabled: boolean };
    }
  | {
      kind: "attention";
      trials: AttentionTrial[];
      installation: AttentionPatch;
    }
  | {
      kind: "causal";
      trials: CausalTrial[];
      installation: { main: boolean[]; transfer: boolean[] };
    };

const LIMIT = 100;
const MAX_ROWS = 16;
const MAX_DIMS = 8;
const EPS = 1e-7;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function vector(raw: unknown, dimensions?: number): number[] {
  demand(
    Array.isArray(raw) && raw.length >= 2 && raw.length <= MAX_DIMS,
    "Vectors need 2–8 dimensions.",
  );
  demand(
    dimensions === undefined || raw.length === dimensions,
    "Vector dimensions must match.",
  );
  demand(
    raw.every(
      (v) =>
        typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= LIMIT,
    ),
    "Vector entries must be finite numbers between -100 and 100.",
  );
  return [...raw] as number[];
}
function matrix(raw: unknown, rows: number, dimensions?: number): number[][] {
  demand(
    Array.isArray(raw) && raw.length === rows,
    "The matrix must have one row per token.",
  );
  const first = vector(raw[0], dimensions);
  return raw.map((row) => vector(row, first.length));
}
function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}
export function vectorsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => close(v, b[i]));
}
function arraysEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number")
    return Number.isFinite(a) && Number.isFinite(b) && close(a, b);
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => arraysEqual(v, b[i]));
  return a === b;
}
function readingEqual(a: unknown, b: AttentionReading): boolean {
  return (
    record(a) &&
    ["rawScores", "scores", "weights", "output"].every((key) =>
      arraysEqual(a[key], b[key as keyof AttentionReading]),
    )
  );
}
export function canonicalOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}
function validOrder(raw: unknown, length: number): raw is number[] {
  return (
    Array.isArray(raw) &&
    raw.length === length &&
    new Set(raw).size === length &&
    raw.every((v) => Number.isInteger(v) && v >= 0 && v < length)
  );
}
/** Subtract the largest allowed score before exp; masked cells are exactly zero. */
export function stableSoftmax(
  scores: number[],
  allowed: boolean[] = scores.map(() => true),
): number[] {
  demand(
    Array.isArray(scores) &&
      scores.length > 0 &&
      scores.length <= MAX_ROWS &&
      scores.every(Number.isFinite),
    "Softmax requires 1–16 finite scores.",
  );
  demand(
    allowed.length === scores.length &&
      allowed.every((v) => typeof v === "boolean") &&
      allowed.some(Boolean),
    "A mask must allow at least one key.",
  );
  const largest = Math.max(...scores.filter((_, i) => allowed[i]));
  const exponentials = scores.map((score, i) =>
    allowed[i] ? Math.exp(score - largest) : 0,
  );
  const total = exponentials.reduce((a, b) => a + b, 0);
  return exponentials.map((value) => value / total);
}
export function attention(
  query: number[],
  keys: number[][],
  values: number[][],
  allowed?: boolean[],
  scaled = true,
): AttentionReading {
  const q = vector(query);
  demand(
    Array.isArray(keys) && keys.length > 0 && keys.length <= MAX_ROWS,
    "Attention needs 1–16 keys.",
  );
  const k = matrix(keys, keys.length, q.length);
  const v = matrix(values, keys.length);
  const rawScores = k.map((key) =>
    key.reduce((sum, value, j) => sum + value * q[j], 0),
  );
  const scores = rawScores.map((score) =>
    scaled ? score / Math.sqrt(q.length) : score,
  );
  const weights = stableSoftmax(scores, allowed);
  const output = v[0].map((_, j) =>
    weights.reduce((sum, weight, i) => sum + weight * v[i][j], 0),
  );
  return { rawScores, scores, weights, output };
}
export function positionTrial(
  config: PositionConfig,
  order: number[],
  positionsEnabled: boolean,
): PositionTrial {
  demand(
    validOrder(order, config.tokens.length),
    "The tape must contain each token tile once.",
  );
  demand(
    typeof positionsEnabled === "boolean",
    "Choose a connected or disconnected position rail.",
  );
  // Reading rows follow token identity, so moving a token can be compared fairly.
  const readings = config.embeddings.map((embedding, token) => {
    const slot = order.indexOf(token);
    return embedding.map(
      (value, j) => value + (positionsEnabled ? config.positions[slot][j] : 0),
    );
  });
  return { order: [...order], positionsEnabled, readings };
}
export const CORRECT_ATTENTION_PATCH: AttentionPatch = {
  scoreSource: "keys",
  valueSource: "values",
  scale: "sqrt",
};
export function attentionTrial(
  config: AttentionConfig,
  patch: AttentionPatch,
  change: "none" | "value",
): AttentionTrial {
  demand(
    validPatch(patch) && (change === "none" || change === "value"),
    "Invalid attention experiment.",
  );
  const values = config.values.map((row) => [...row]);
  if (change === "value") values[0][0] += 0.5;
  const keysForScore = patch.scoreSource === "keys" ? config.keys : values;
  const payload = patch.valueSource === "values" ? values : config.keys;
  return {
    patch: { ...patch },
    change,
    reading: attention(
      config.query,
      keysForScore,
      payload,
      undefined,
      patch.scale === "sqrt",
    ),
  };
}
function validPatch(raw: unknown): raw is AttentionPatch {
  return (
    record(raw) &&
    (raw.scoreSource === "keys" || raw.scoreSource === "values") &&
    (raw.valueSource === "keys" || raw.valueSource === "values") &&
    (raw.scale === "sqrt" || raw.scale === "none")
  );
}
function correctPatch(patch: AttentionPatch): boolean {
  return (
    patch.scoreSource === "keys" &&
    patch.valueSource === "values" &&
    patch.scale === "sqrt"
  );
}
export function causalMask(config: CausalConfig): boolean[] {
  return config.tokens.map((_, i) => i <= config.queryIndex);
}
/** A longer tape at a later input position checks transfer beyond one memorized board. */
export function causalTransfer(config: CausalConfig): CausalConfig {
  const extra = config.embeddings[0].map((value, j) =>
    j === 0 ? -value - 0.5 : value + 0.25,
  );
  const embeddings = [...config.embeddings.map((row) => [...row]), extra];
  const queryIndex = config.queryIndex + 1;
  const changedEmbeddings = embeddings.map((row, i) =>
    row.map((v, j) => (i > queryIndex ? v + (j === 0 ? 0.75 : -0.5) : v)),
  );
  return {
    kind: "causal",
    tokens: [...config.tokens, "tonight"],
    embeddings,
    changedEmbeddings,
    queryIndex,
  };
}
export function causalTrial(
  config: CausalConfig,
  board: "main" | "transfer",
  allowed: boolean[],
  experiment: "future" | "context",
): CausalTrial {
  demand(
    (board === "main" || board === "transfer") &&
      (experiment === "future" || experiment === "context"),
    "Invalid shutter experiment.",
  );
  const fixture = board === "main" ? config : causalTransfer(config);
  demand(
    Array.isArray(allowed) &&
      allowed.length === fixture.tokens.length &&
      allowed.every((v) => typeof v === "boolean"),
    "Every shutter needs an open or closed setting.",
  );
  const changed =
    experiment === "future"
      ? fixture.changedEmbeddings
      : fixture.embeddings.map((row, i) =>
          row.map((v, j) => (i === 0 && j === 0 ? v + 0.5 : v)),
        );
  const before = attention(
    fixture.embeddings[fixture.queryIndex],
    fixture.embeddings,
    fixture.embeddings,
    allowed,
  ).output;
  const after = attention(
    changed[fixture.queryIndex],
    changed,
    changed,
    allowed,
  ).output;
  return { board, allowed: [...allowed], experiment, before, after };
}

export function validateTransformerConfig(raw: unknown): TransformerConfig {
  demand(record(raw), "A Transformer instrument must be an object.");
  demand(
    Array.isArray(raw.tokens) &&
      raw.tokens.length >= 3 &&
      raw.tokens.length <= 5 &&
      raw.tokens.every(
        (t) => typeof t === "string" && t.trim().length > 0 && t.length <= 32,
      ),
    "An instrument needs 3–5 short token labels.",
  );
  const tokens = [...raw.tokens] as string[];
  const n = tokens.length;
  if (raw.kind === "position") {
    const embeddings = matrix(raw.embeddings, n);
    const positions = matrix(raw.positions, n, embeddings[0].length);
    demand(
      new Set(tokens).size > 1,
      "The tape needs at least two distinct token labels.",
    );
    demand(
      positions.some((row) => !vectorsEqual(row, positions[0])),
      "Position vectors must distinguish at least two slots.",
    );
    tokens.forEach((token, i) =>
      tokens.forEach((other, j) =>
        demand(
          token !== other || vectorsEqual(embeddings[i], embeddings[j]),
          "Repeated token labels must share the same token embedding.",
        ),
      ),
    );
    return { kind: "position", tokens, embeddings, positions };
  }
  if (raw.kind === "attention") {
    const query = vector(raw.query);
    const keys = matrix(raw.keys, n, query.length);
    const values = matrix(raw.values, n, query.length);
    demand(
      values[0][0] <= LIMIT - 0.5,
      "Leave room for the controlled value change.",
    );
    const config: AttentionConfig = {
      kind: "attention",
      tokens,
      query,
      keys,
      values,
    };
    const expected = attentionTrial(
      config,
      CORRECT_ATTENTION_PATCH,
      "none",
    ).reading;
    const broken = attentionTrial(
      config,
      { scoreSource: "values", valueSource: "keys", scale: "none" },
      "none",
    ).reading;
    demand(
      !vectorsEqual(expected.output, broken.output) ||
        !vectorsEqual(expected.weights, broken.weights),
      "Use distinct key/value examples so the crossed wires have a measurable effect.",
    );
    const changed = attentionTrial(
      config,
      CORRECT_ATTENTION_PATCH,
      "value",
    ).reading;
    demand(
      !vectorsEqual(expected.output, changed.output),
      "The controlled value change must produce a measurable output change.",
    );
    return config;
  }
  if (raw.kind === "causal") {
    const embeddings = matrix(raw.embeddings, n);
    const changedEmbeddings = matrix(
      raw.changedEmbeddings,
      n,
      embeddings[0].length,
    );
    demand(
      Number.isInteger(raw.queryIndex) &&
        (raw.queryIndex as number) >= 1 &&
        (raw.queryIndex as number) < n - 1,
      "The prediction position needs earlier context and at least one future token.",
    );
    const queryIndex = raw.queryIndex as number;
    demand(
      embeddings.every((row) => row.every((v) => Math.abs(v) <= 95)),
      "Leave numerical room for transfer and context experiments.",
    );
    demand(
      embeddings
        .slice(0, queryIndex + 1)
        .every((row, i) =>
          row.every((value, j) => value === changedEmbeddings[i][j]),
        ),
      "The future experiment must preserve the complete allowed prefix.",
    );
    const config: CausalConfig = {
      kind: "causal",
      tokens,
      embeddings,
      changedEmbeddings,
      queryIndex,
    };
    const leak = causalTrial(
      config,
      "main",
      tokens.map(() => true),
      "future",
    );
    demand(
      !vectorsEqual(leak.before, leak.after),
      "The open-shutter future experiment must expose a measurable leak.",
    );
    for (const board of ["main", "transfer"] as const) {
      const fixture = board === "main" ? config : causalTransfer(config);
      const context = causalTrial(
        config,
        board,
        causalMask(fixture),
        "context",
      );
      demand(
        !vectorsEqual(context.before, context.after),
        "Allowed context must have a measurable effect.",
      );
    }
    return config;
  }
  throw new Error("Unknown Transformer instrument kind.");
}

/** Replay every submitted experiment; authored/generated dialogue cannot award completion. */
export function verifyTransformerEvidence(
  input: TransformerConfig,
  evidence: unknown,
): boolean {
  try {
    const config = validateTransformerConfig(input);
    if (
      !record(evidence) ||
      evidence.kind !== config.kind ||
      !Array.isArray(evidence.trials) ||
      evidence.trials.length > 32 ||
      !record(evidence.installation)
    )
      return false;
    const rawTrials = evidence.trials;
    if (config.kind === "position") {
      if (
        !validOrder(evidence.installation.order, config.tokens.length) ||
        !arraysEqual(
          evidence.installation.order,
          canonicalOrder(config.tokens.length),
        ) ||
        evidence.installation.positionsEnabled !== true
      )
        return false;
      const trials: PositionTrial[] = [];
      for (const raw of rawTrials) {
        if (
          !record(raw) ||
          !validOrder(raw.order, config.tokens.length) ||
          typeof raw.positionsEnabled !== "boolean"
        )
          return false;
        const expected = positionTrial(config, raw.order, raw.positionsEnabled);
        if (!arraysEqual(raw.readings, expected.readings)) return false;
        trials.push(expected);
      }
      const original = positionTrial(
        config,
        canonicalOrder(config.tokens.length),
        true,
      );
      return trials.some(
        (a) =>
          !a.positionsEnabled &&
          trials.some(
            (b) =>
              b.positionsEnabled &&
              arraysEqual(a.order, b.order) &&
              b.readings.some(
                (row, i) => !vectorsEqual(row, original.readings[i]),
              ),
          ),
      );
    }
    if (config.kind === "attention") {
      if (
        !validPatch(evidence.installation) ||
        !correctPatch(evidence.installation)
      )
        return false;
      const trials: AttentionTrial[] = [];
      for (const raw of rawTrials) {
        if (
          !record(raw) ||
          !validPatch(raw.patch) ||
          (raw.change !== "none" && raw.change !== "value")
        )
          return false;
        const expected = attentionTrial(config, raw.patch, raw.change);
        if (!readingEqual(raw.reading, expected.reading)) return false;
        trials.push(expected);
      }
      const baseline = trials.find(
        (trial) => correctPatch(trial.patch) && trial.change === "none",
      );
      const changed = trials.find(
        (trial) => correctPatch(trial.patch) && trial.change === "value",
      );
      return Boolean(
        baseline &&
        changed &&
        vectorsEqual(baseline.reading.weights, changed.reading.weights) &&
        !vectorsEqual(baseline.reading.output, changed.reading.output) &&
        trials.some(
          (trial) =>
            trial.change === "none" &&
            !correctPatch(trial.patch) &&
            (!vectorsEqual(trial.reading.output, baseline.reading.output) ||
              !vectorsEqual(trial.reading.weights, baseline.reading.weights)),
        ),
      );
    }
    if (
      !arraysEqual(evidence.installation.main, causalMask(config)) ||
      !arraysEqual(
        evidence.installation.transfer,
        causalMask(causalTransfer(config)),
      )
    )
      return false;
    const trials: CausalTrial[] = [];
    for (const raw of rawTrials) {
      if (
        !record(raw) ||
        (raw.board !== "main" && raw.board !== "transfer") ||
        (raw.experiment !== "future" && raw.experiment !== "context") ||
        !Array.isArray(raw.allowed)
      )
        return false;
      const expected = causalTrial(
        config,
        raw.board,
        raw.allowed,
        raw.experiment,
      );
      if (
        !arraysEqual(raw.before, expected.before) ||
        !arraysEqual(raw.after, expected.after)
      )
        return false;
      trials.push(expected);
    }
    const leakSeen = trials.some(
      (t) =>
        t.board === "main" &&
        t.experiment === "future" &&
        t.allowed.every(Boolean) &&
        !vectorsEqual(t.before, t.after),
    );
    return (
      leakSeen &&
      (["main", "transfer"] as const).every((board) => {
        const mask = causalMask(
          board === "main" ? config : causalTransfer(config),
        );
        return (
          trials.some(
            (t) =>
              t.board === board &&
              t.experiment === "future" &&
              arraysEqual(t.allowed, mask) &&
              vectorsEqual(t.before, t.after),
          ) &&
          trials.some(
            (t) =>
              t.board === board &&
              t.experiment === "context" &&
              arraysEqual(t.allowed, mask) &&
              !vectorsEqual(t.before, t.after),
          )
        );
      })
    );
  } catch {
    return false;
  }
}

/** For offline reachability checking and test fixtures; the player UI records its own trials. */
export function canonicalTransformerEvidence(
  config: TransformerConfig,
): TransformerEvidence {
  config = validateTransformerConfig(config);
  let evidence: TransformerEvidence;
  if (config.kind === "position") {
    const order = canonicalOrder(config.tokens.length);
    // A full rotation moves every identity, including a repeated-token pair.
    const probe = [...order.slice(1), order[0]];
    evidence = {
      kind: "position",
      installation: { order, positionsEnabled: true },
      trials: [
        positionTrial(config, probe, false),
        positionTrial(config, probe, true),
      ],
    };
  } else if (config.kind === "attention") {
    evidence = {
      kind: "attention",
      installation: { ...CORRECT_ATTENTION_PATCH },
      trials: [
        attentionTrial(
          config,
          { scoreSource: "values", valueSource: "keys", scale: "none" },
          "none",
        ),
        attentionTrial(config, CORRECT_ATTENTION_PATCH, "none"),
        attentionTrial(config, CORRECT_ATTENTION_PATCH, "value"),
      ],
    };
  } else {
    const main = causalMask(config);
    const transfer = causalMask(causalTransfer(config));
    evidence = {
      kind: "causal",
      installation: { main, transfer },
      trials: [
        causalTrial(
          config,
          "main",
          config.tokens.map(() => true),
          "future",
        ),
        causalTrial(config, "main", main, "future"),
        causalTrial(config, "main", main, "context"),
        causalTrial(config, "transfer", transfer, "future"),
        causalTrial(config, "transfer", transfer, "context"),
      ],
    };
  }
  demand(
    verifyTransformerEvidence(config, evidence),
    "This instrument has no verified reference solution.",
  );
  return evidence;
}
export const createTransformerReferenceEvidence = canonicalTransformerEvidence;
export const createTransformerEvidence = canonicalTransformerEvidence;
export function createTransformerFixtures(): {
  position: PositionConfig;
  attention: AttentionConfig;
  causal: CausalConfig;
} {
  return {
    position: {
      kind: "position",
      tokens: ["the", "signal", "follows", "the", "bell"],
      embeddings: [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [-1, 1],
      ],
      positions: Array.from({ length: 5 }, (_, i) => [
        Math.sin(i),
        Math.cos(i),
      ]),
    },
    attention: {
      kind: "attention",
      tokens: ["bell", "train", "rain"],
      query: [1, 0],
      keys: [
        [2, 0],
        [0, 1],
        [-1, 1],
      ],
      values: [
        [0, 2],
        [2, 0],
        [1, -1],
      ],
    },
    causal: {
      kind: "causal",
      tokens: ["the", "night", "train", "brings", "rain"],
      embeddings: [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, -1],
        [-1, 2],
      ],
      changedEmbeddings: [
        [1, 0],
        [0, 1],
        [1, 1],
        [-2, 2],
        [3, -2],
      ],
      queryIndex: 2,
    },
  };
}
