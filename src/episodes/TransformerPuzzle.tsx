import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  attentionTrial,
  canonicalOrder,
  causalMask,
  causalTransfer,
  causalTrial,
  positionTrial,
  vectorsEqual,
  verifyTransformerEvidence,
  type AttentionConfig,
  type AttentionPatch,
  type AttentionTrial,
  type CausalConfig,
  type CausalTrial,
  type PositionConfig,
  type PositionTrial,
  type TransformerConfig,
  type TransformerEvidence,
} from "../domain/transformers";
import "./transformer-puzzles.css";

export type TransformerPuzzleProps = {
  config: TransformerConfig;
  title: string;
  instructions: string;
  draft?: unknown;
  onDraftChange?: (draft: unknown) => void;
  onComplete: (evidence: unknown) => void;
  onClose: () => void;
};
const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);
const fmt = (v: number) =>
  Math.abs(v) < 0.0005 ? "0" : Number(v.toFixed(3)).toString();
const vec = (values: number[]) => `[${values.map(fmt).join(", ")}]`;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function useDraft<T>(
  initial: () => T,
  onDraftChange?: (draft: unknown) => void,
) {
  const [state, setState] = useState(initial);
  const handler = useRef(onDraftChange);
  handler.current = onDraftChange;
  useEffect(() => {
    handler.current?.(state);
  }, [state]);
  return [state, setState] as const;
}
function appendTrial<T>(trials: T[], trial: T): T[] {
  return [...trials.filter((value) => !same(value, trial)), trial].slice(-28);
}
function restoreTrials<T>(
  raw: unknown,
  replay: (raw: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 28).flatMap((value) => {
    if (!isRecord(value)) return [];
    try {
      const trial = replay(value);
      return same(value, trial) ? [trial] : [];
    } catch {
      return [];
    }
  });
}
function validOrder(raw: unknown, n: number): raw is number[] {
  return (
    Array.isArray(raw) &&
    raw.length === n &&
    new Set(raw).size === n &&
    raw.every((v) => Number.isInteger(v) && v >= 0 && v < n)
  );
}
function validMask(raw: unknown, n: number): raw is boolean[] {
  return (
    Array.isArray(raw) &&
    raw.length === n &&
    raw.every((v) => typeof v === "boolean")
  );
}
function validPatch(raw: unknown): raw is AttentionPatch {
  return (
    isRecord(raw) &&
    ["keys", "values"].includes(String(raw.scoreSource)) &&
    ["keys", "values"].includes(String(raw.valueSource)) &&
    ["sqrt", "none"].includes(String(raw.scale))
  );
}
function Stamp({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <span className={`tf-stamp ${done ? "is-done" : ""}`}>
      <span aria-hidden="true">{done ? "✓" : "○"}</span>
      {children}
    </span>
  );
}
function ExperimentNote({ children }: { children: ReactNode }) {
  return (
    <p className="tf-note" role="status" aria-live="polite">
      {children}
    </p>
  );
}
function Instrument({
  title,
  instructions,
  onClose,
  children,
}: Pick<TransformerPuzzleProps, "title" | "instructions" | "onClose"> & {
  children: ReactNode;
}) {
  return (
    <section className="tf-instrument" aria-label={title}>
      <div className="tf-instrument-head">
        <div>
          <h2>{title}</h2>
          <p>{instructions}</p>
        </div>
        <button
          className="tf-close"
          onClick={onClose}
          aria-label="Close instrument"
        >
          ×
        </button>
      </div>
      {children}
      <p className="tf-scope">
        These small vectors are illustrative. Their coordinates do not have
        assigned word meanings. This instrument demonstrates one part of a
        Transformer.
      </p>
    </section>
  );
}

type PositionDraft = {
  version: 1;
  kind: "position";
  order: number[];
  positionsEnabled: boolean;
  trials: PositionTrial[];
};
function PositionInstrument(
  props: TransformerPuzzleProps & { config: PositionConfig },
) {
  const { config, onComplete } = props;
  const [state, setState] = useDraft<PositionDraft>(() => {
    const raw =
      isRecord(props.draft) && props.draft.kind === "position"
        ? props.draft
        : {};
    return {
      version: 1,
      kind: "position",
      order: validOrder(raw.order, config.tokens.length)
        ? [...raw.order]
        : canonicalOrder(config.tokens.length),
      positionsEnabled: raw.positionsEnabled === true,
      trials: restoreTrials(raw.trials, (value) =>
        positionTrial(
          config,
          value.order as number[],
          value.positionsEnabled as boolean,
        ),
      ),
    };
  }, props.onDraftChange);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState(
    "Slide two token tiles past each other, then take a reading. The order should change; the tokens should stay the same.",
  );
  const order = canonicalOrder(config.tokens.length);
  const original = positionTrial(config, order, true);
  const now = positionTrial(config, state.order, state.positionsEnabled);
  const probePair = state.trials.some(
    (a) =>
      !a.positionsEnabled &&
      state.trials.some(
        (b) =>
          b.positionsEnabled &&
          same(a.order, b.order) &&
          b.readings.some((row, i) => !vectorsEqual(row, original.readings[i])),
      ),
  );
  const movedObserved = state.trials.some(
    (t) => !t.positionsEnabled && !same(t.order, order),
  );
  const restored = same(state.order, order) && state.positionsEnabled;
  const evidence: TransformerEvidence = {
    kind: "position",
    trials: state.trials,
    installation: {
      order: state.order,
      positionsEnabled: state.positionsEnabled,
    },
  };
  const ready = verifyTransformerEvidence(config, evidence);
  const swap = (slot: number) => {
    if (selected === null) {
      setSelected(slot);
      return;
    }
    if (selected !== slot)
      setState((prev) => {
        const next = [...prev.order];
        [next[selected], next[slot]] = [next[slot], next[selected]];
        return { ...prev, order: next };
      });
    setSelected(null);
  };
  const record = () => {
    setState((prev) => ({ ...prev, trials: appendTrial(prev.trials, now) }));
    if (same(state.order, order))
      setMessage(
        "That is the original dispatch. Move a token to a different slot and compare that same arrangement with the position rail disconnected and connected.",
      );
    else if (!state.positionsEnabled)
      setMessage(
        "The tape moved, but every token kept its original embedding. A repeated token still has the same reading in either slot. Keep this arrangement and connect the position rail.",
      );
    else if (
      now.readings.every((row, i) => vectorsEqual(row, original.readings[i]))
    )
      setMessage(
        "This arrangement moved tokens between slots with the same position readings. Try a different swap so the position rail has a measurable effect.",
      );
    else
      setMessage(
        "The same token now combines with a different slot vector. Its input reading changes when it moves. Compare this arrangement with the rail disconnected too, then restore the original dispatch with the rail connected.",
      );
  };
  return (
    <Instrument {...props}>
      <div className="tf-position-board">
        <div className="tf-dispatch-original">
          <span>Dispatch to restore</span>
          <p>{config.tokens.join(" ")}</p>
        </div>
        <div
          className="tf-token-rail"
          style={
            { "--tf-token-count": config.tokens.length } as React.CSSProperties
          }
        >
          {state.order.map((token, slot) => (
            <div className="tf-rail-slot" key={slot}>
              <small>Slot {slot + 1}</small>
              <button
                className={`tf-token-tile ${selected === slot ? "is-selected" : ""}`}
                aria-label={`Token ${token + 1}, ${config.tokens[token]}, in slot ${slot + 1}${selected === slot ? ", selected" : ""}`}
                aria-pressed={selected === slot}
                onClick={() => swap(slot)}
              >
                <span>{config.tokens[token]}</span>
                <small>Tile {token + 1}</small>
              </button>
              <div
                className={`tf-position-tag ${state.positionsEnabled ? "is-connected" : ""}`}
              >
                <span aria-hidden="true">＋</span>
                <span>Position {slot + 1}</span>
              </div>
              <output
                className="tf-small-reading"
                aria-label={`Input for token ${token + 1}`}
              >
                {vec(now.readings[token])}
              </output>
            </div>
          ))}
        </div>
        <div className="tf-controls tf-rail-controls">
          <button
            onClick={() => {
              setSelected(null);
              setState((prev) => ({
                ...prev,
                order: [...prev.order.slice(1), prev.order[0]],
              }));
            }}
          >
            Rotate tape one slot
          </button>
          <button
            onClick={() => {
              setSelected(null);
              setState((prev) => ({ ...prev, order }));
            }}
          >
            Restore original order
          </button>
          <button
            className="tf-lever"
            aria-pressed={state.positionsEnabled}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                positionsEnabled: !prev.positionsEnabled,
              }))
            }
          >
            <span className="tf-lever-track" aria-hidden="true">
              <i />
            </span>
            Position rail{" "}
            {state.positionsEnabled ? "connected" : "disconnected"}
          </button>
        </div>
        <p className="tf-control-help">
          Select a tile, then another tile to swap them. Compare token
          identities, including repeated labels, across slots.
        </p>
      </div>
      <div className="tf-actions">
        <button className="tf-primary" onClick={record}>
          Take a tape reading
        </button>
      </div>
      <ExperimentNote>{message}</ExperimentNote>
      <details className="tf-numbers">
        <summary>Inspect the token and position vectors</summary>
        <p>
          The slot vector is added to the token embedding. This supplied fixture
          illustrates additive positional encoding; other Transformer designs
          can represent position differently.
        </p>
        <div className="tf-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Token identity</th>
                <th>Token embedding</th>
                <th>Current slot vector</th>
                <th>Input reading</th>
              </tr>
            </thead>
            <tbody>
              {config.tokens.map((token, i) => (
                <tr key={i}>
                  <th>
                    {i + 1}: {token}
                  </th>
                  <td>{vec(config.embeddings[i])}</td>
                  <td>
                    {state.positionsEnabled
                      ? vec(config.positions[state.order.indexOf(i)])
                      : "Disconnected"}
                  </td>
                  <td>{vec(now.readings[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="tf-checklist">
        <Stamp done={movedObserved}>Moved tape observed</Stamp>
        <Stamp done={probePair}>Both rail settings compared</Stamp>
        <Stamp done={restored}>Dispatch restored</Stamp>
      </div>
      <div className="tf-actions tf-final-actions">
        <button
          className="tf-primary"
          disabled={!ready}
          onClick={() => onComplete(evidence)}
        >
          Install the repaired position rail
        </button>
        <span>Experiment, compare, then restore.</span>
      </div>
    </Instrument>
  );
}

type AttentionDraft = {
  version: 1;
  kind: "attention";
  patch: AttentionPatch;
  trials: AttentionTrial[];
};
const wrongPatch: AttentionPatch = {
  scoreSource: "values",
  valueSource: "keys",
  scale: "none",
};
const correctPatch = (patch: AttentionPatch) =>
  patch.scoreSource === "keys" &&
  patch.valueSource === "values" &&
  patch.scale === "sqrt";
function AttentionInstrument(
  props: TransformerPuzzleProps & { config: AttentionConfig },
) {
  const { config, onComplete } = props;
  const [state, setState] = useDraft<AttentionDraft>(() => {
    const raw =
      isRecord(props.draft) && props.draft.kind === "attention"
        ? props.draft
        : {};
    return {
      version: 1,
      kind: "attention",
      patch: validPatch(raw.patch) ? { ...raw.patch } : { ...wrongPatch },
      trials: restoreTrials(raw.trials, (value) =>
        attentionTrial(
          config,
          value.patch as AttentionPatch,
          value.change as "none" | "value",
        ),
      ),
    };
  }, props.onDraftChange);
  const [message, setMessage] = useState(
    "Someone crossed the comparison and delivery leads. Run the bench in its current state to capture the fault before moving any plugs.",
  );
  const [reading, setReading] = useState<AttentionTrial | null>(
    () => state.trials.at(-1) ?? null,
  );
  const setPatch = (patch: Partial<AttentionPatch>) => {
    setState((prev) => ({ ...prev, patch: { ...prev.patch, ...patch } }));
    setReading(null);
  };
  const baseline = state.trials.find(
    (t) => correctPatch(t.patch) && t.change === "none",
  );
  const changed = state.trials.find(
    (t) => correctPatch(t.patch) && t.change === "value",
  );
  const referenceReading = attentionTrial(
    config,
    { scoreSource: "keys", valueSource: "values", scale: "sqrt" },
    "none",
  ).reading;
  const faultSeen = state.trials.some(
    (t) =>
      !correctPatch(t.patch) &&
      t.change === "none" &&
      (!vectorsEqual(t.reading.weights, referenceReading.weights) ||
        !vectorsEqual(t.reading.output, referenceReading.output)),
  );
  const evidence: TransformerEvidence = {
    kind: "attention",
    trials: state.trials,
    installation: state.patch,
  };
  const ready = verifyTransformerEvidence(config, evidence);
  const run = (change: "none" | "value") => {
    const trial = attentionTrial(config, state.patch, change);
    setReading(trial);
    setState((prev) => ({ ...prev, trials: appendTrial(prev.trials, trial) }));
    if (!correctPatch(state.patch))
      setMessage(
        "Fault recorded. Follow the engraved route: query meets keys; divide the scores by √dₖ; softmax creates weights; those weights mix the values. Repair the leads, then run the original dispatch again.",
      );
    else if (change === "none")
      setMessage(
        "The repaired bench produces a weighted mixture, including contributions from more than one token. Now change only the first value and compare the result. Will the matching weights move too?",
      );
    else
      setMessage(
        "Only a value changed. With the correct leads, the weights stay exactly the same while the delivered mixture changes. Keys determine matching; values supply what is mixed.",
      );
  };
  const sourceY = state.patch.scoreSource === "keys" ? 70 : 146;
  const valueY = state.patch.valueSource === "values" ? 146 : 70;
  return (
    <Instrument {...props}>
      <div className="tf-attention-bench">
        <div className="tf-bench-caption">
          <span>Dispatch query</span>
          <strong>Q {vec(config.query)}</strong>
          <span className="tf-engraving">Compare → scale → softmax → mix</span>
        </div>
        <div className="tf-patch-board">
          <svg
            className="tf-patch-wires"
            viewBox="0 0 720 214"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={`M 171 ${sourceY} C 267 ${sourceY} 206 45 313 45`}
              className="tf-wire tf-wire-score"
            />
            <path
              d={`M 171 ${valueY} C 250 ${valueY} 259 180 490 180 S 541 146 553 146`}
              className="tf-wire tf-wire-value"
            />
            <path
              d="M 421 45 C 485 45 495 68 555 68"
              className="tf-wire tf-wire-weight"
            />
            <circle cx="171" cy={sourceY} r="6" />
            <circle cx="171" cy={valueY} r="6" />
          </svg>
          <div className="tf-cartridges">
            <div className="tf-cartridge tf-key-cartridge">
              <strong>K</strong>
              <span>
                Keys
                <br />
                <small>For matching</small>
              </span>
            </div>
            <div className="tf-cartridge tf-value-cartridge">
              <strong>V</strong>
              <span>
                Values
                <br />
                <small>For delivery</small>
              </span>
            </div>
          </div>
          <div className="tf-score-socket">
            <span>Query compares with</span>
            <div className="tf-toggle-pair">
              <button
                aria-pressed={state.patch.scoreSource === "keys"}
                onClick={() => setPatch({ scoreSource: "keys" })}
              >
                Keys
              </button>
              <button
                aria-pressed={state.patch.scoreSource === "values"}
                onClick={() => setPatch({ scoreSource: "values" })}
              >
                Values
              </button>
            </div>
            <label>
              Score scale
              <select
                aria-label="Attention score scale"
                value={state.patch.scale}
                onChange={(e) =>
                  setPatch({ scale: e.target.value as AttentionPatch["scale"] })
                }
              >
                <option value="none">No scaling</option>
                <option value="sqrt">Divide by √dₖ</option>
              </select>
            </label>
          </div>
          <div className="tf-mix-socket">
            <span>Weights mix</span>
            <div className="tf-toggle-pair">
              <button
                aria-pressed={state.patch.valueSource === "values"}
                onClick={() => setPatch({ valueSource: "values" })}
              >
                Values
              </button>
              <button
                aria-pressed={state.patch.valueSource === "keys"}
                onClick={() => setPatch({ valueSource: "keys" })}
              >
                Keys
              </button>
            </div>
            <small>All weighted contributions are added.</small>
          </div>
        </div>
        <div className="tf-mixture">
          <div className="tf-weight-dials">
            {config.tokens.map((token, i) => (
              <div className="tf-weight-channel" key={i}>
                <span>{token}</span>
                <div className="tf-weight-track">
                  <i
                    style={{
                      width: `${(reading?.reading.weights[i] ?? 0) * 100}%`,
                    }}
                  />
                </div>
                <output>
                  {reading
                    ? `${(reading.reading.weights[i] * 100).toFixed(1)}%`
                    : "—"}
                </output>
              </div>
            ))}
          </div>
          <div className="tf-mix-output">
            <span>Delivered mixture</span>
            <output>
              {reading ? vec(reading.reading.output) : "Awaiting a run"}
            </output>
            <small>
              {reading?.change === "value"
                ? `Only V₁[1] changed by +0.5`
                : "Original dispatch values"}
            </small>
          </div>
        </div>
      </div>
      <div className="tf-actions">
        <button className="tf-primary" onClick={() => run("none")}>
          Run original dispatch
        </button>
        <button onClick={() => run("value")}>Change one value + run</button>
      </div>
      <ExperimentNote>{message}</ExperimentNote>
      {baseline && changed && (
        <div className="tf-comparison">
          <span>
            Original mixture <strong>{vec(baseline.reading.output)}</strong>
          </span>
          <span>
            Changed value <strong>{vec(changed.reading.output)}</strong>
          </span>
          <span>
            Matching weights{" "}
            <strong>
              {vectorsEqual(baseline.reading.weights, changed.reading.weights)
                ? "Unchanged"
                : "Changed"}
            </strong>
          </span>
        </div>
      )}
      <details className="tf-numbers">
        <summary>Inspect the calculation</summary>
        <p>
          Scores are Q·K / √dₖ, where dₖ = {config.query.length}. Softmax turns
          the scores into nonnegative weights summing to 1. The output is
          Σ(weight × value). Attention weights alone do not explain a complete
          model’s reasoning.
        </p>
        <div className="tf-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Key</th>
                <th>Value</th>
                <th>Dot product</th>
                <th>Scaled score</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {config.tokens.map((token, i) => (
                <tr key={i}>
                  <th>{token}</th>
                  <td>{vec(config.keys[i])}</td>
                  <td>
                    {vec(
                      config.values[i].map((v, j) =>
                        reading?.change === "value" && i === 0 && j === 0
                          ? v + 0.5
                          : v,
                      ),
                    )}
                  </td>
                  <td>{reading ? fmt(reading.reading.rawScores[i]) : "—"}</td>
                  <td>{reading ? fmt(reading.reading.scores[i]) : "—"}</td>
                  <td>{reading ? fmt(reading.reading.weights[i]) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="tf-checklist">
        <Stamp done={faultSeen}>Crossed leads observed</Stamp>
        <Stamp done={Boolean(baseline)}>Repaired baseline measured</Stamp>
        <Stamp done={Boolean(changed)}>One-value experiment</Stamp>
      </div>
      <div className="tf-actions tf-final-actions">
        <button
          className="tf-primary"
          disabled={!ready}
          onClick={() => onComplete(evidence)}
        >
          Install the attention mixer
        </button>
        <span>
          Keep matching and delivery connected to their proper cartridges.
        </span>
      </div>
    </Instrument>
  );
}

type CausalDraft = {
  version: 1;
  kind: "causal";
  board: "main" | "transfer";
  main: boolean[];
  transfer: boolean[];
  trials: CausalTrial[];
};
function CausalInstrument(
  props: TransformerPuzzleProps & { config: CausalConfig },
) {
  const { config, onComplete } = props;
  const transferConfig = causalTransfer(config);
  const [state, setState] = useDraft<CausalDraft>(() => {
    const raw =
      isRecord(props.draft) && props.draft.kind === "causal" ? props.draft : {};
    return {
      version: 1,
      kind: "causal",
      board: raw.board === "transfer" ? "transfer" : "main",
      main: validMask(raw.main, config.tokens.length)
        ? [...raw.main]
        : config.tokens.map(() => true),
      transfer: validMask(raw.transfer, transferConfig.tokens.length)
        ? [...raw.transfer]
        : transferConfig.tokens.map(() => true),
      trials: restoreTrials(raw.trials, (value) =>
        causalTrial(
          config,
          value.board as CausalTrial["board"],
          value.allowed as boolean[],
          value.experiment as CausalTrial["experiment"],
        ),
      ),
    };
  }, props.onDraftChange);
  const [message, setMessage] = useState(
    "The announcer knows tomorrow’s words suspiciously well. Leave the shutters open for one future-change experiment to catch it in the act.",
  );
  const [lastTrial, setLastTrial] = useState<CausalTrial | null>(
    () => state.trials.at(-1) ?? null,
  );
  const fixture = state.board === "main" ? config : transferConfig;
  const mask = state[state.board];
  const canonical = causalMask(fixture);
  const tested = (
    board: CausalTrial["board"],
    experiment: CausalTrial["experiment"],
  ) =>
    state.trials.some(
      (t) =>
        t.board === board &&
        t.experiment === experiment &&
        same(
          t.allowed,
          causalMask(board === "main" ? config : transferConfig),
        ) &&
        (experiment === "future"
          ? vectorsEqual(t.before, t.after)
          : !vectorsEqual(t.before, t.after)),
    );
  const leakSeen = state.trials.some(
    (t) =>
      t.board === "main" &&
      t.allowed.every(Boolean) &&
      t.experiment === "future" &&
      !vectorsEqual(t.before, t.after),
  );
  const mainDone =
    leakSeen && tested("main", "future") && tested("main", "context");
  const evidence: TransformerEvidence = {
    kind: "causal",
    trials: state.trials,
    installation: { main: state.main, transfer: state.transfer },
  };
  const ready = verifyTransformerEvidence(config, evidence);
  const run = (experiment: "future" | "context") => {
    if (!mask.some(Boolean)) {
      setMessage(
        "Every shutter is closed. There is no allowed key for softmax. Keep the current input and its earlier context available.",
      );
      return;
    }
    const trial = causalTrial(config, state.board, mask, experiment);
    setLastTrial(trial);
    setState((prev) => ({ ...prev, trials: appendTrial(prev.trials, trial) }));
    const changed = !vectorsEqual(trial.before, trial.after);
    if (experiment === "future") {
      if (changed)
        setMessage(
          "Caught! Changing later inputs changed the earlier mixture. The announcer is peeking past its prediction position. Close the future shutters, then rerun this same experiment.",
        );
      else if (!same(mask, canonical))
        setMessage(
          "The future no longer changes this output, but some permitted context is missing. Keep every earlier input and the current input open; close only later inputs.",
        );
      else
        setMessage(
          "The two future continuations give exactly the same mixture here. Now change an allowed context input: a useful repair should still respond to information it can use.",
        );
    } else if (!same(mask, canonical))
      setMessage(
        "This board still does not preserve the complete allowed context. The current input and all earlier inputs belong on the open side.",
      );
    else if (changed)
      setMessage(
        state.board === "main"
          ? "The mixture responds to an allowed input, while the future test stays unchanged. Try the longer dispatch at a later prediction position before fitting the shutter assembly."
          : "Both tests pass on the longer dispatch too. The announcer can use its allowed context without peeking at future inputs.",
      );
    else
      setMessage(
        "The allowed context did not affect this run. Check which shutters are open.",
      );
  };
  const toggle = (index: number) => {
    setState((prev) => ({
      ...prev,
      [prev.board]: prev[prev.board].map((value, i) =>
        i === index ? !value : value,
      ),
    }));
    setLastTrial(null);
  };
  return (
    <Instrument {...props}>
      <div className="tf-causal-board">
        <div className="tf-board-tabs" aria-label="Dispatch experiment">
          <button
            aria-pressed={state.board === "main"}
            onClick={() => {
              setState((prev) => ({ ...prev, board: "main" }));
              setLastTrial(null);
            }}
          >
            First dispatch
          </button>
          <button
            aria-pressed={state.board === "transfer"}
            disabled={!mainDone}
            onClick={() => {
              setState((prev) => ({ ...prev, board: "transfer" }));
              setLastTrial(null);
            }}
          >
            Longer dispatch
          </button>
        </div>
        <div className="tf-prediction">
          <span>Current input position</span>
          <strong>
            {fixture.queryIndex + 1}: {fixture.tokens[fixture.queryIndex]}
          </strong>
          <p>
            This row prepares the next-token prediction. It may use the current
            input and earlier inputs. Later input positions are hidden.
          </p>
        </div>
        <div
          className="tf-shutter-rail"
          style={
            { "--tf-token-count": fixture.tokens.length } as React.CSSProperties
          }
        >
          {fixture.tokens.map((token, i) => (
            <div
              className={`tf-shutter-slot ${i === fixture.queryIndex ? "is-query" : ""}`}
              key={i}
            >
              <small>Input {i + 1}</small>
              <div className="tf-shutter-window">
                <span className="tf-shutter-token">{token}</span>
                <button
                  className={`tf-shutter ${mask[i] ? "is-open" : ""}`}
                  aria-label={`${mask[i] ? "Close" : "Open"} shutter for input ${i + 1}, ${token}`}
                  aria-pressed={mask[i]}
                  onClick={() => toggle(i)}
                >
                  <span aria-hidden="true">{mask[i] ? "▤" : "▥"}</span>
                  <small>{mask[i] ? "Open" : "Closed"}</small>
                </button>
              </div>
              <span className="tf-slot-role">
                {i < fixture.queryIndex
                  ? "Earlier input"
                  : i === fixture.queryIndex
                    ? "Current input"
                    : "Later input"}
              </span>
            </div>
          ))}
        </div>
        <div className="tf-shutter-route" aria-hidden="true">
          <span>Allowed information flows to the current query</span>
        </div>
        <div className="tf-causal-output">
          <div>
            <span>Before the change</span>
            <output>
              {lastTrial ? vec(lastTrial.before) : "Awaiting experiment"}
            </output>
          </div>
          <span
            className={`tf-equality ${lastTrial && vectorsEqual(lastTrial.before, lastTrial.after) ? "is-equal" : ""}`}
          >
            {lastTrial
              ? vectorsEqual(lastTrial.before, lastTrial.after)
                ? "="
                : "≠"
              : "·"}
          </span>
          <div>
            <span>After the change</span>
            <output>
              {lastTrial ? vec(lastTrial.after) : "Awaiting experiment"}
            </output>
          </div>
        </div>
        <p className="tf-control-help">
          {lastTrial?.experiment === "context"
            ? "Only input 1 changes. All other input vectors stay fixed."
            : "The future trial keeps the complete prefix fixed and changes only later input vectors."}
        </p>
      </div>
      <div className="tf-actions">
        <button className="tf-primary" onClick={() => run("future")}>
          Change future inputs + compare
        </button>
        <button onClick={() => run("context")}>
          Change allowed context + compare
        </button>
      </div>
      <ExperimentNote>{message}</ExperimentNote>
      <details className="tf-numbers">
        <summary>Inspect the causal calculation</summary>
        <p>
          This small self-attention instrument uses the supplied embeddings as
          Q, K, and V (identity projections). Closed shutters receive exactly
          zero softmax weight. An entirely closed row is invalid. This causal
          rule applies to the autoregressive setting shown here; other attention
          layers need not use a causal mask.
        </p>
        <p>
          In the shifted next-token setup, the target for input position{" "}
          {fixture.queryIndex + 1} is the next token. Allowing the current input
          does not expose that target.
        </p>
        <div className="tf-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Input</th>
                <th>Original vector</th>
                <th>Future trial vector</th>
                <th>Visibility</th>
              </tr>
            </thead>
            <tbody>
              {fixture.tokens.map((token, i) => (
                <tr key={i}>
                  <th>
                    {i + 1}: {token}
                  </th>
                  <td>{vec(fixture.embeddings[i])}</td>
                  <td>{vec(fixture.changedEmbeddings[i])}</td>
                  <td>{mask[i] ? "Allowed" : "Masked"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="tf-checklist">
        <Stamp done={leakSeen}>Future leak caught</Stamp>
        <Stamp done={tested(state.board, "future")}>Future has no effect</Stamp>
        <Stamp done={tested(state.board, "context")}>
          Allowed context still works
        </Stamp>
        <Stamp
          done={tested("transfer", "future") && tested("transfer", "context")}
        >
          Longer dispatch tested
        </Stamp>
      </div>
      <div className="tf-actions tf-final-actions">
        <button
          className="tf-primary"
          disabled={!ready}
          onClick={() => onComplete(evidence)}
        >
          Fit the causal shutters
        </button>
        <span>The repair must pass both experiments on both dispatches.</span>
      </div>
    </Instrument>
  );
}

export function TransformerPuzzle(props: TransformerPuzzleProps) {
  const key = JSON.stringify(props.config);
  if (props.config.kind === "position")
    return <PositionInstrument key={key} {...props} config={props.config} />;
  if (props.config.kind === "attention")
    return <AttentionInstrument key={key} {...props} config={props.config} />;
  return <CausalInstrument key={key} {...props} config={props.config} />;
}
export default TransformerPuzzle;
