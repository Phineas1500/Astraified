import { describe, expect, it } from "vitest";
import {
  attention,
  attentionTrial,
  canonicalOrder,
  causalMask,
  causalTransfer,
  causalTrial,
  CORRECT_ATTENTION_PATCH,
  createTransformerEvidence,
  createTransformerFixtures,
  positionTrial,
  stableSoftmax,
  validateTransformerConfig,
  verifyTransformerEvidence,
  type TransformerEvidence,
} from "../src/domain/transformers";

const fixtures = createTransformerFixtures();

describe("Transformer instruments: numerical foundations", () => {
  it("uses a stable softmax, including very large finite scores", () => {
    const expected = [
      1 / (1 + Math.exp(-1)),
      Math.exp(-1) / (1 + Math.exp(-1)),
    ];
    const actual = stableSoftmax([10000, 9999]);
    expect(actual[0]).toBeCloseTo(expected[0], 13);
    expect(actual[1]).toBeCloseTo(expected[1], 13);
    expect(actual.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
  });
  it("gives masked cells zero probability and rejects an entirely masked row", () => {
    expect(stableSoftmax([10000, 0], [false, true])).toEqual([0, 1]);
    expect(() => stableSoftmax([1, 2], [false, false])).toThrow();
    expect(() => stableSoftmax([1, Infinity])).toThrow();
  });
  it("calculates QK scores, dimension scaling, softmax, and a V mixture", () => {
    const actual = attention(
      [1, 0],
      [
        [2, 0],
        [0, 1],
      ],
      [
        [0, 2],
        [2, 0],
      ],
    );
    const weight = Math.exp(Math.SQRT2) / (Math.exp(Math.SQRT2) + 1);
    expect(actual.rawScores).toEqual([2, 0]);
    expect(actual.scores[0]).toBeCloseTo(Math.SQRT2, 13);
    expect(actual.weights[0]).toBeCloseTo(weight, 13);
    expect(actual.output[0]).toBeCloseTo(2 * (1 - weight), 13);
    expect(actual.output[1]).toBeCloseTo(2 * weight, 13);
    expect(actual.output).not.toEqual([0, 2]);
  });
  it("supports different value width in the generic attention kernel", () => {
    expect(
      attention(
        [0, 0],
        [
          [1, 0],
          [0, 1],
        ],
        [
          [1, 2, 3],
          [3, 4, 5],
        ],
      ).output,
    ).toEqual([2, 3, 4]);
  });
  it("is permutation equivariant when key/value pairs are reordered together", () => {
    const { query, keys, values } = fixtures.attention;
    const original = attention(query, keys, values);
    const reversed = attention(
      query,
      [...keys].reverse(),
      [...values].reverse(),
    );
    original.output.forEach((v, i) =>
      expect(reversed.output[i]).toBeCloseTo(v, 13),
    );
    original.weights.forEach((v, i) =>
      expect(reversed.weights.at(-i - 1)).toBeCloseTo(v, 13),
    );
  });
  it("rejects mismatched, excessive, non-finite, and nonnumeric inputs", () => {
    expect(() => attention([1, 2], [[1, 2, 3]], [[0, 1]])).toThrow();
    expect(() => attention([1, NaN], [[1, 2]], [[0, 1]])).toThrow();
    expect(() => attention([1, 2], [], [])).toThrow();
    expect(() =>
      attention([1, 2], Array(17).fill([1, 2]), Array(17).fill([1, 2])),
    ).toThrow();
    expect(() =>
      validateTransformerConfig({ ...fixtures.attention, query: [101, 0] }),
    ).toThrow();
    expect(() =>
      validateTransformerConfig({ ...fixtures.position, tokens: ["one"] }),
    ).toThrow();
  });
});

describe("Transformer instruments: educational invariants", () => {
  it("preserves token embeddings when a repeated token moves, and changes its positional input", () => {
    const c = fixtures.position;
    const order = [1, 2, 3, 4, 0];
    const without = positionTrial(c, order, false);
    expect(without.readings).toEqual(c.embeddings);
    expect(without.readings[0]).toEqual(without.readings[3]);
    const withPositions = positionTrial(c, order, true);
    expect(withPositions.readings[0]).not.toEqual(withPositions.readings[3]);
    expect(withPositions.readings[0][0]).toBeCloseTo(
      c.embeddings[0][0] + c.positions[4][0],
      13,
    );
  });
  it("rejects inconsistent embeddings for repeated tokens", () => {
    const embeddings = fixtures.position.embeddings.map((row) => [...row]);
    embeddings[3] = [4, 4];
    expect(() =>
      validateTransformerConfig({ ...fixtures.position, embeddings }),
    ).toThrow(/Repeated/);
  });
  it("keeps attention weights fixed when only a value changes, while the mixture responds", () => {
    const a = attentionTrial(
      fixtures.attention,
      CORRECT_ATTENTION_PATCH,
      "none",
    ).reading;
    const b = attentionTrial(
      fixtures.attention,
      CORRECT_ATTENTION_PATCH,
      "value",
    ).reading;
    expect(b.weights).toEqual(a.weights);
    expect(b.output[0] - a.output[0]).toBeCloseTo(0.5 * a.weights[0], 13);
    expect(b.output[1]).toEqual(a.output[1]);
  });
  it("lets the current input and previous inputs through, blocking later inputs", () => {
    expect(causalMask(fixtures.causal)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    const safe = causalTrial(
      fixtures.causal,
      "main",
      causalMask(fixtures.causal),
      "future",
    );
    expect(safe.after).toEqual(safe.before);
    const leaky = causalTrial(
      fixtures.causal,
      "main",
      Array(5).fill(true),
      "future",
    );
    expect(leaky.after).not.toEqual(leaky.before);
    const context = causalTrial(
      fixtures.causal,
      "main",
      causalMask(fixtures.causal),
      "context",
    );
    expect(context.after).not.toEqual(context.before);
  });
  it("tests a longer tape at a later query position for transfer", () => {
    const transfer = causalTransfer(fixtures.causal);
    expect(transfer.tokens.length).toEqual(6);
    expect(transfer.queryIndex).toEqual(3);
    expect(causalMask(transfer)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    const safe = causalTrial(
      fixtures.causal,
      "transfer",
      causalMask(transfer),
      "future",
    );
    expect(safe.after).toEqual(safe.before);
  });
  it("rejects a supposed future comparison that changes the allowed prefix", () => {
    const changedEmbeddings = fixtures.causal.changedEmbeddings.map((row) => [
      ...row,
    ]);
    changedEmbeddings[0][0] += 1;
    expect(() =>
      validateTransformerConfig({ ...fixtures.causal, changedEmbeddings }),
    ).toThrow(/prefix/);
  });
});

describe("Transformer instruments: independently verified experiment evidence", () => {
  it.each(["position", "attention", "causal"] as const)(
    "replays the %s reference trace and rejects a bare solved claim",
    (kind) => {
      const config = fixtures[kind];
      expect(
        verifyTransformerEvidence(config, createTransformerEvidence(config)),
      ).toBe(true);
      expect(verifyTransformerEvidence(config, { kind, solved: true })).toBe(
        false,
      );
    },
  );
  it("requires the same reordered tape to be compared with and without positions", () => {
    const config = fixtures.position;
    const proof = createTransformerEvidence(config) as Extract<
      TransformerEvidence,
      { kind: "position" }
    >;
    proof.trials[0] = positionTrial(config, canonicalOrder(5), false);
    expect(verifyTransformerEvidence(config, proof)).toBe(false);
    proof.trials = [
      positionTrial(config, canonicalOrder(5), false),
      positionTrial(config, canonicalOrder(5), true),
    ];
    expect(verifyTransformerEvidence(config, proof)).toBe(false);
  });
  it("requires a broken attention trial, a repaired baseline, and the controlled value trial", () => {
    const config = fixtures.attention;
    const proof = createTransformerEvidence(config) as Extract<
      TransformerEvidence,
      { kind: "attention" }
    >;
    for (let missing = 0; missing < proof.trials.length; missing++) {
      expect(
        verifyTransformerEvidence(config, {
          ...proof,
          trials: proof.trials.filter((_, i) => i !== missing),
        }),
      ).toBe(false);
    }
    proof.trials[2].reading.output[0] += 0.01;
    expect(verifyTransformerEvidence(config, proof)).toBe(false);
  });
  it("rejects forged causal readings and constant-output solutions that hide permitted context", () => {
    const config = fixtures.causal;
    const proof = createTransformerEvidence(config) as Extract<
      TransformerEvidence,
      { kind: "causal" }
    >;
    const oneOpen = [false, false, true, false, false];
    const next = {
      ...proof,
      installation: { ...proof.installation, main: oneOpen },
    };
    expect(verifyTransformerEvidence(config, next)).toBe(false);
    proof.trials[0].after = [...proof.trials[0].before];
    expect(verifyTransformerEvidence(config, proof)).toBe(false);
  });
  it("requires both future invariance and permitted-context response on both boards", () => {
    const config = fixtures.causal;
    const proof = createTransformerEvidence(config) as Extract<
      TransformerEvidence,
      { kind: "causal" }
    >;
    for (let missing = 0; missing < proof.trials.length; missing++) {
      expect(
        verifyTransformerEvidence(config, {
          ...proof,
          trials: proof.trials.filter((_, i) => i !== missing),
        }),
      ).toBe(false);
    }
  });
  it("does not throw on arbitrary malformed evidence", () => {
    for (const evidence of [
      null,
      [],
      4,
      { kind: "causal", installation: {}, trials: [null] },
      { kind: "attention", installation: {}, trials: Array(200).fill({}) },
    ]) {
      expect(verifyTransformerEvidence(fixtures.causal, evidence)).toBe(false);
    }
  });
});
