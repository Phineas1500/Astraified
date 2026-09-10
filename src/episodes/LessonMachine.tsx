import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  evaluateSimulation,
  evidenceTrial,
  simulationInputs,
  simulationPlot,
  simulationTrial,
  verifyLessonMachineEvidence,
  type EvidenceConfig,
  type EvidenceRound,
  type EvidenceTrial,
  type LessonMachineConfig,
  type SimulationConfig,
  type SimulationInputs,
  type SimulationTask,
  type SimulationTrial,
} from "../domain/lesson-machines";
import "./lesson-machine.css";

type MachineSource = { id: string; title: string; url?: string; text?: string };
export type LessonMachineProps = {
  config: LessonMachineConfig;
  title: string;
  instructions: string;
  draft?: unknown;
  sources?: MachineSource[];
  onDraftChange?: (draft: unknown) => void;
  onComplete: (evidence: unknown) => void;
  onClose: () => void;
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
const fmt = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) >= 100000 || Math.abs(value) < 0.0001)
    return value.toExponential(2);
  return Number(value.toPrecision(5)).toString();
};
function useMachineDraft<T>(
  initialize: () => T,
  onDraftChange?: (draft: unknown) => void,
) {
  const [draft, setDraft] = useState(initialize);
  const notify = useRef(onDraftChange);
  notify.current = onDraftChange;
  useEffect(() => {
    notify.current?.(draft);
  }, [draft]);
  return [draft, setDraft] as const;
}
function appendTrial<T extends { taskId?: string; roundId?: string }>(
  trials: T[],
  trial: T,
): T[] {
  const id = trial.taskId ?? trial.roundId;
  const related = trials.filter(
    (value) => (value.taskId ?? value.roundId) === id,
  );
  const first = trials.findIndex(
    (value) => (value.taskId ?? value.roundId) === id,
  );
  if (first < 0) return [...trials, trial];
  return [
    ...trials.slice(0, first),
    ...related.slice(0, 1),
    ...related.slice(1).slice(-18),
    trial,
    ...trials
      .slice(first)
      .filter((value) => (value.taskId ?? value.roundId) !== id),
  ];
}
function restoreTrials<T>(
  raw: unknown,
  replay: (raw: Record<string, unknown>) => T,
) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).flatMap((value) => {
    if (!record(value)) return [];
    try {
      const result = replay(value);
      return same(result, value) ? [result] : [];
    } catch {
      return [];
    }
  });
}
function Shell({
  props,
  children,
}: {
  props: LessonMachineProps;
  children: ReactNode;
}) {
  return (
    <section className="lm-instrument" aria-label={props.title}>
      <div className="lm-heading">
        <p>{props.instructions}</p>
      </div>
      {children}
    </section>
  );
}
function Steps({
  stages,
  current,
  done,
  onSelect,
}: {
  stages: { id: string; title: string }[];
  current: number;
  done: boolean[];
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="lm-stages" aria-label="Investigation stages">
      {stages.map((stage, index) => (
        <li key={stage.id} className={done[index] ? "lm-stage-done" : ""}>
          <button
            aria-current={current === index ? "step" : undefined}
            disabled={index > 0 && !done.slice(0, index).every(Boolean)}
            onClick={() => onSelect(index)}
          >
            <span className="lm-stage-number" aria-hidden="true">
              {done[index] ? "✓" : index + 1}
            </span>
            <span className="lm-stage-label">
              {stage.title}
              {done[index] && <span className="lm-sr-only">, verified</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
function Mission({ stage }: { stage: SimulationTask | EvidenceRound }) {
  return (
    <div className="lm-mission">
      {stage.transfer && (
        <span className="lm-transfer">
          <span aria-hidden="true">◇</span> A new situation
        </span>
      )}
      <h3>{stage.title}</h3>
      <p>{stage.prompt}</p>
    </div>
  );
}
function Feedback({
  passed,
  text,
  observation,
}: {
  passed: boolean;
  text: string;
  observation?: string;
}) {
  return (
    <div
      className={`lm-feedback ${passed ? "" : "is-miss"}`}
      role="status"
      aria-live="polite"
    >
      <strong>
        {passed
          ? "That works. Here’s what the evidence tells us."
          : "Something to investigate."}
      </strong>
      <p>{text}</p>
      {observation && <p className="lm-feedback-observation">{observation}</p>}
    </div>
  );
}
function Progress({
  done,
  stages,
}: {
  done: boolean[];
  stages: { title: string; transfer: boolean }[];
}) {
  return (
    <ul className="lm-progress" aria-label="Collected evidence">
      {stages.map((stage, index) => (
        <li key={index} data-done={done[index]}>
          <span aria-hidden="true">{done[index] ? "✓" : "○"}</span>
          {stage.transfer
            ? "New situation tested"
            : `Investigation ${index + 1} tested`}
        </li>
      ))}
    </ul>
  );
}
function ModelNotebook({
  notes,
  briefing,
  children,
}: {
  notes: string;
  briefing: string;
  children?: ReactNode;
}) {
  return (
    <details className="lm-notebook">
      <summary>Field notes &amp; model limits</summary>
      <div>
        <p>{briefing}</p>
        <div className="lm-scope">
          <strong>What this model represents</strong>
          <p>{notes}</p>
        </div>
        {children}
      </div>
    </details>
  );
}

type SimulationDraft = {
  version: 1;
  kind: "simulation";
  stage: number;
  inputs: Record<string, SimulationInputs>;
  trials: SimulationTrial[];
};
function recoverSimulation(
  config: SimulationConfig,
  raw: unknown,
): SimulationDraft {
  const saved = record(raw) && raw.kind === "simulation" ? raw : {};
  let trials = restoreTrials(saved.trials, (value) =>
    simulationTrial(
      config,
      String(value.taskId),
      value.inputs as SimulationInputs,
    ),
  );
  const inputs: Record<string, SimulationInputs> = {};
  for (const task of config.tasks) {
    const baseline = simulationTrial(
      config,
      task.id,
      simulationInputs(config, task.id),
    );
    if (
      trials.some((trial) => trial.taskId === task.id) &&
      !same(
        trials.find((trial) => trial.taskId === task.id),
        baseline,
      )
    ) {
      trials = trials.filter((trial) => trial.taskId !== task.id);
    }
    const candidate =
      record(saved.inputs) && record(saved.inputs[task.id])
        ? (saved.inputs[task.id] as SimulationInputs)
        : null;
    try {
      if (candidate) {
        simulationTrial(config, task.id, candidate);
        inputs[task.id] = { ...candidate };
      }
    } catch {
      /* Changed packages and malformed browser saves restart this control panel. */
    }
    inputs[task.id] ??= simulationInputs(config, task.id);
  }
  if (!trials.some((trial) => trial.taskId === config.tasks[0].id))
    trials.push(
      simulationTrial(
        config,
        config.tasks[0].id,
        (inputs[config.tasks[0].id] = simulationInputs(
          config,
          config.tasks[0].id,
        )),
      ),
    );
  const requested = Number.isInteger(saved.stage) ? Number(saved.stage) : 0;
  let stage = Math.max(0, Math.min(requested, config.tasks.length - 1));
  while (
    stage > 0 &&
    !config.tasks
      .slice(0, stage)
      .every(
        (task) =>
          trials.filter((trial) => trial.taskId === task.id).at(-1)?.passed,
      )
  )
    stage--;
  if (!trials.some((trial) => trial.taskId === config.tasks[stage].id))
    trials.push(
      simulationTrial(
        config,
        config.tasks[stage].id,
        simulationInputs(config, config.tasks[stage].id),
      ),
    );
  return { version: 1, kind: "simulation", stage, inputs, trials };
}
function Curve({
  config,
  taskId,
  inputs,
  outputs,
}: {
  config: SimulationConfig;
  taskId: string;
  inputs: SimulationInputs;
  outputs: Record<string, number>;
}) {
  const titleId = useId();
  const plot = config.plots[0];
  if (!plot) return null;
  let samples: { input: number; output: number | null }[] = [];
  try {
    samples = simulationPlot(config, taskId, inputs);
  } catch {
    /* Domain errors leave a gap rather than inventing a curve. */
  }
  const good = samples.filter(
    (point): point is { input: number; output: number } =>
      point.output !== null && Number.isFinite(point.output),
  );
  if (!good.length)
    return (
      <p className="lm-plot-caption">
        This setting is outside the plotted model’s domain. Try a different
        control setting.
      </p>
    );
  let minY = Math.min(...good.map((point) => point.output)),
    maxY = Math.max(...good.map((point) => point.output));
  const pad = (maxY - minY || Math.max(1, Math.abs(maxY)) * 0.2) * 0.12;
  minY -= pad;
  maxY += pad;
  const left = 58,
    right = 365,
    top = 18,
    bottom = 192;
  const x = (value: number) =>
    left + ((value - plot.min) / (plot.max - plot.min)) * (right - left);
  const y = (value: number) =>
    bottom - ((value - minY) / (maxY - minY)) * (bottom - top);
  let gap = true;
  const path = samples
    .map((point) => {
      if (point.output === null || !Number.isFinite(point.output)) {
        gap = true;
        return "";
      }
      const command = gap ? "M" : "L";
      gap = false;
      return `${command}${x(point.input).toFixed(2)},${y(point.output).toFixed(2)}`;
    })
    .join(" ");
  const input = config.controls.find((control) => control.id === plot.inputId);
  const output = config.outputs.find((value) => value.id === plot.outputId);
  const markerX = inputs[plot.inputId],
    markerY = outputs[plot.outputId];
  const showMarker =
    Number.isFinite(markerY) &&
    markerX >= plot.min &&
    markerX <= plot.max &&
    markerY >= minY &&
    markerY <= maxY;
  return (
    <>
      <svg
        className="lm-chart"
        viewBox="0 0 385 235"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {output?.label} as {input?.label} changes. Current reading{" "}
          {fmt(markerY)}.
        </title>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={left}
              x2={right}
              y1={top + fraction * (bottom - top)}
              y2={top + fraction * (bottom - top)}
              stroke="#bdd0b5"
              strokeOpacity=".18"
              strokeDasharray="3 4"
            />
            <text
              x={left - 8}
              y={top + fraction * (bottom - top) + 3}
              textAnchor="end"
            >
              {fmt(maxY - fraction * (maxY - minY))}
            </text>
          </g>
        ))}
        <line x1={left} x2={left} y1={top} y2={bottom} stroke="#8aa795" />
        <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#8aa795" />
        {plot.min < 0 && plot.max > 0 && (
          <line
            x1={x(0)}
            x2={x(0)}
            y1={top}
            y2={bottom}
            stroke="#a8baa6"
            strokeOpacity=".3"
          />
        )}
        {minY < 0 && maxY > 0 && (
          <line
            x1={left}
            x2={right}
            y1={y(0)}
            y2={y(0)}
            stroke="#a8baa6"
            strokeOpacity=".3"
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="#c3ddbd"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {showMarker && (
          <g>
            <line
              x1={x(markerX)}
              x2={x(markerX)}
              y1={y(markerY)}
              y2={bottom}
              stroke="#f2c879"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(markerX)}
              cy={y(markerY)}
              r="5"
              fill="#f2c879"
              stroke="#112e37"
              strokeWidth="2"
            />
          </g>
        )}
        <text x={left} y={bottom + 16}>
          {fmt(plot.min)}
        </text>
        <text x={right} y={bottom + 16} textAnchor="end">
          {fmt(plot.max)}
        </text>
        <text
          className="lm-axis-label"
          x={(left + right) / 2}
          y="226"
          textAnchor="middle"
        >
          {input?.label}
          {input?.kind === "number" && input.unit ? ` (${input.unit})` : ""}
        </text>
      </svg>
      <p className="lm-plot-caption">
        {output?.label}
        {output?.unit ? ` (${output.unit})` : ""}. The brass dot marks your
        current setting; other controls stay fixed.
      </p>
    </>
  );
}
function SimulationMachine(
  props: LessonMachineProps & { config: SimulationConfig },
) {
  const { config } = props;
  const [state, setState] = useMachineDraft(
    () => recoverSimulation(config, props.draft),
    props.onDraftChange,
  );
  const task = config.tasks[state.stage];
  const inputs = state.inputs[task.id];
  const trials = state.trials.filter((trial) => trial.taskId === task.id);
  const last = trials.at(-1)!;
  const attempted = trials.length > 1;
  const done = config.tasks.map(
    (value) =>
      state.trials.filter((trial) => trial.taskId === value.id).at(-1)
        ?.passed === true,
  );
  const evidence = { kind: "simulation" as const, trials: state.trials };
  const ready = verifyLessonMachineEvidence(config, evidence);
  let outputs: Record<string, number> = {},
    error = "";
  try {
    outputs = evaluateSimulation(config, task.id, inputs).outputs;
  } catch {
    error =
      "This setting is outside the model’s domain. Adjust a control to take a reading.";
  }
  const setInput = (id: string, value: number) =>
    setState((previous) => ({
      ...previous,
      inputs: {
        ...previous.inputs,
        [task.id]: { ...previous.inputs[task.id], [id]: value },
      },
    }));
  const selectStage = (index: number) =>
    setState((previous) => {
      const next = config.tasks[index];
      return {
        ...previous,
        stage: index,
        trials: previous.trials.some((trial) => trial.taskId === next.id)
          ? previous.trials
          : [
              ...previous.trials,
              simulationTrial(
                config,
                next.id,
                simulationInputs(config, next.id),
              ),
            ],
      };
    });
  const run = () => {
    try {
      const trial = simulationTrial(config, task.id, inputs);
      setState((previous) => ({
        ...previous,
        trials: appendTrial(previous.trials, trial),
      }));
    } catch {
      /* Invalid domains are explained beside the controls; no evidence is fabricated. */
    }
  };
  return (
    <Shell props={props}>
      <Steps
        stages={config.tasks}
        current={state.stage}
        done={done}
        onSelect={selectStage}
      />
      <Mission stage={task} />
      <div className="lm-machine">
        <div className="lm-machine-top">
          <span>Observation bench</span>
          <span className="lm-machine-light" aria-hidden="true" />
        </div>
        <div className="lm-workbench">
          <div className="lm-controls">
            {config.controls.map((control) => (
              <div className="lm-control" key={control.id}>
                {control.kind === "number" ? (
                  <>
                    <div className="lm-control-title">
                      <span id={`lm-label-${control.id}`}>{control.label}</span>
                      <div className="lm-control-value">
                        <input
                          aria-label={`${control.label} value`}
                          type="number"
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={inputs[control.id]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (
                              event.target.value !== "" &&
                              Number.isFinite(value)
                            ) {
                              const clamped = Math.max(
                                control.min,
                                Math.min(control.max, value),
                              );
                              setInput(
                                control.id,
                                Number(
                                  (
                                    control.min +
                                    Math.round(
                                      (clamped - control.min) / control.step,
                                    ) *
                                      control.step
                                  ).toPrecision(12),
                                ),
                              );
                            }
                          }}
                        />
                        {control.unit && <small>{control.unit}</small>}
                      </div>
                    </div>
                    <input
                      aria-labelledby={`lm-label-${control.id}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={inputs[control.id]}
                      onChange={(event) =>
                        setInput(control.id, Number(event.target.value))
                      }
                    />
                    <div className="lm-control-range" aria-hidden="true">
                      <span>{fmt(control.min)}</span>
                      <span>{fmt(control.max)}</span>
                    </div>
                  </>
                ) : control.kind === "choice" ? (
                  <label>
                    <span className="lm-control-label">{control.label}</span>
                    <select
                      value={inputs[control.id]}
                      onChange={(event) =>
                        setInput(control.id, Number(event.target.value))
                      }
                    >
                      {control.options.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <span className="lm-control-label">{control.label}</span>
                    <button
                      className="lm-toggle"
                      aria-pressed={inputs[control.id] === 1}
                      onClick={() =>
                        setInput(control.id, inputs[control.id] === 1 ? 0 : 1)
                      }
                    >
                      <span aria-hidden="true">
                        {inputs[control.id] === 1 ? "●" : "○"}
                      </span>{" "}
                      {inputs[control.id] === 1
                        ? control.onLabel
                        : control.offLabel}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="lm-display">
            <Curve
              config={config}
              taskId={task.id}
              inputs={inputs}
              outputs={outputs}
            />
            <div className="lm-readouts" aria-label="Live readings">
              {config.outputs.map((output) => (
                <div className="lm-readout" key={output.id}>
                  <span>{output.label}</span>
                  <strong>
                    <span className="lm-number">{fmt(outputs[output.id])}</span>
                    {output.unit && <small>{output.unit}</small>}
                  </strong>
                  <small className="lm-previous">
                    First reading: {fmt(trials[0].outputs[output.id])}
                    {output.unit ? ` ${output.unit}` : ""}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lm-runbar">
          <button className="lm-run" onClick={run} disabled={!!error}>
            Test this setting
          </button>
          <button
            className="lm-reset"
            onClick={() =>
              setState((previous) => ({
                ...previous,
                inputs: {
                  ...previous.inputs,
                  [task.id]: simulationInputs(config, task.id),
                },
              }))
            }
          >
            Restore starting settings
          </button>
        </div>
        {error && (
          <p className="lm-domain-error" role="status">
            {error}
          </p>
        )}
      </div>
      <Feedback
        passed={attempted && last.passed}
        text={
          attempted
            ? last.passed
              ? task.successFeedback
              : task.failureFeedback
            : `The first reading is recorded. ${task.failureFeedback}`
        }
      />
      <Progress done={done} stages={config.tasks} />
      <div className="lm-foot">
        <p>
          {ready
            ? "Your observations hold up in the new situation. Take the verified evidence back to the case."
            : done[state.stage]
              ? "Reading verified. Carry what you discovered into the next investigation."
              : "Change the controls, observe the result, and test a setting that meets the task."}
        </p>
        {ready ? (
          <button
            className="lm-finish"
            onClick={() => props.onComplete(evidence)}
          >
            Use this evidence
          </button>
        ) : (
          <button
            className="lm-finish"
            disabled={
              !done[state.stage] || state.stage === config.tasks.length - 1
            }
            onClick={() => selectStage(state.stage + 1)}
          >
            Next investigation
          </button>
        )}
      </div>
      <ModelNotebook notes={config.modelNotes} briefing={config.briefing}>
        <ol className="lm-history">
          {trials.slice(-6).map((trial, index) => (
            <li key={index}>
              <strong>
                {index === 0 && trials.length <= 6
                  ? "Starting reading"
                  : trial.passed
                    ? "Verified reading"
                    : "Trial reading"}
              </strong>
              :{" "}
              {config.outputs
                .map(
                  (output) =>
                    `${output.label}: ${fmt(trial.outputs[output.id])}${output.unit ? ` ${output.unit}` : ""}`,
                )
                .join("; ")}
            </li>
          ))}
        </ol>
      </ModelNotebook>
    </Shell>
  );
}

type EvidenceDraft = {
  version: 1;
  kind: "evidence";
  stage: number;
  assignments: Record<string, (string | null)[]>;
  trials: EvidenceTrial[];
};
function recoverEvidence(config: EvidenceConfig, raw: unknown): EvidenceDraft {
  const saved = record(raw) && raw.kind === "evidence" ? raw : {};
  let trials = restoreTrials(saved.trials, (value) =>
    evidenceTrial(
      config,
      String(value.roundId),
      value.assignment as (string | null)[],
    ),
  );
  const assignments: EvidenceDraft["assignments"] = {};
  for (const round of config.rounds) {
    const baseline = evidenceTrial(
      config,
      round.id,
      round.cards.map(() => null),
    );
    if (
      trials.some((trial) => trial.roundId === round.id) &&
      !same(
        trials.find((trial) => trial.roundId === round.id),
        baseline,
      )
    )
      trials = trials.filter((trial) => trial.roundId !== round.id);
    const candidate = record(saved.assignments)
      ? saved.assignments[round.id]
      : null;
    try {
      if (Array.isArray(candidate))
        assignments[round.id] = evidenceTrial(
          config,
          round.id,
          candidate as (string | null)[],
        ).assignment;
    } catch {
      /* A malformed draft resets only this board. */
    }
    assignments[round.id] ??= round.cards.map(() => null);
  }
  if (!trials.some((trial) => trial.roundId === config.rounds[0].id))
    trials.push(
      evidenceTrial(
        config,
        config.rounds[0].id,
        config.rounds[0].cards.map(() => null),
      ),
    );
  const requested = Number.isInteger(saved.stage) ? Number(saved.stage) : 0;
  let stage = Math.max(0, Math.min(requested, config.rounds.length - 1));
  while (
    stage > 0 &&
    !config.rounds
      .slice(0, stage)
      .every(
        (round) =>
          trials.filter((trial) => trial.roundId === round.id).at(-1)?.passed,
      )
  )
    stage--;
  if (!trials.some((trial) => trial.roundId === config.rounds[stage].id))
    trials.push(
      evidenceTrial(
        config,
        config.rounds[stage].id,
        config.rounds[stage].cards.map(() => null),
      ),
    );
  return { version: 1, kind: "evidence", stage, assignments, trials };
}
function EvidenceMachine(
  props: LessonMachineProps & { config: EvidenceConfig },
) {
  const { config } = props;
  const [state, setState] = useMachineDraft(
    () => recoverEvidence(config, props.draft),
    props.onDraftChange,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [boardMessage, setBoardMessage] = useState("");
  const round = config.rounds[state.stage];
  const assignment = state.assignments[round.id];
  const trials = state.trials.filter((trial) => trial.roundId === round.id);
  const attempted = trials.length > 1,
    last = trials.at(-1)!;
  const done = config.rounds.map(
    (value) =>
      state.trials.filter((trial) => trial.roundId === value.id).at(-1)
        ?.passed === true,
  );
  const evidence = { kind: "evidence" as const, trials: state.trials };
  const ready = verifyLessonMachineEvidence(config, evidence);
  const selectStage = (index: number) => {
    setSelected(null);
    setBoardMessage("");
    setState((previous) => {
      const next = config.rounds[index];
      return {
        ...previous,
        stage: index,
        trials: previous.trials.some((trial) => trial.roundId === next.id)
          ? previous.trials
          : [
              ...previous.trials,
              evidenceTrial(
                config,
                next.id,
                next.cards.map(() => null),
              ),
            ],
      };
    });
  };
  const place = (slotId: string | null) => {
    if (selected === null) return;
    const next = [...assignment];
    const slot = round.slots.find((value) => value.id === slotId);
    const occupants = assignment.flatMap((value, index) =>
      value === slotId && index !== selected ? [index] : [],
    );
    if (slot && occupants.length >= slot.capacity) {
      if (slot.capacity !== 1) {
        setBoardMessage(
          `${slot.label} is full. Return a clue to the tray first.`,
        );
        return;
      }
      next[occupants[0]] = assignment[selected];
    }
    next[selected] = slotId;
    setState((previous) => ({
      ...previous,
      assignments: { ...previous.assignments, [round.id]: next },
    }));
    setBoardMessage(
      `${round.cards[selected].label} moved ${slot ? `to ${slot.label}` : "back to the clue tray"}.`,
    );
    setSelected(null);
  };
  const card = (index: number) => (
    <button
      key={round.cards[index].id}
      className="lm-evidence-card"
      aria-pressed={selected === index}
      onClick={() => {
        setSelected(selected === index ? null : index);
        setBoardMessage(
          selected === index
            ? "Clue put down."
            : `${round.cards[index].label} selected. Choose where it belongs.`,
        );
      }}
    >
      <span>{round.cards[index].label}</span>
      <small>{round.cards[index].text}</small>
    </button>
  );
  const test = () => {
    const trial = evidenceTrial(config, round.id, assignment);
    setState((previous) => ({
      ...previous,
      trials: appendTrial(previous.trials, trial),
    }));
    setSelected(null);
    setBoardMessage("");
  };
  return (
    <Shell props={props}>
      <Steps
        stages={config.rounds}
        current={state.stage}
        done={done}
        onSelect={selectStage}
      />
      <Mission stage={round} />
      <div className="lm-machine">
        <div className="lm-machine-top">
          <span>Evidence table</span>
          <span className="lm-machine-light" aria-hidden="true" />
        </div>
        <p className="lm-sort-help">
          Choose a clue, then choose its place on the board. You can move clues
          again before testing your theory.
        </p>
        <div className="lm-evidence-bank" aria-label="Unplaced clues">
          {round.cards.map((_, index) =>
            assignment[index] === null ? card(index) : null,
          )}
          {!assignment.some((value) => value === null) && (
            <p>
              Every clue has a place. Test the arrangement when you’re ready.
            </p>
          )}
        </div>
        <div className="lm-bins">
          {round.slots.map((slot) => (
            <div className="lm-bin" key={slot.id}>
              <button
                className="lm-bin-target"
                disabled={selected === null}
                onClick={() => place(slot.id)}
                aria-label={
                  selected === null
                    ? slot.label
                    : `Place ${round.cards[selected].label} in ${slot.label}`
                }
              >
                {slot.label}
              </button>
              <p>{slot.description}</p>
              {round.cards.map((_, index) =>
                assignment[index] === slot.id ? card(index) : null,
              )}
            </div>
          ))}
        </div>
        <div className="lm-runbar">
          <button
            className="lm-run"
            onClick={test}
            disabled={assignment.some((value) => value === null)}
          >
            Test this arrangement
          </button>
          {selected !== null && assignment[selected] !== null ? (
            <button className="lm-reset" onClick={() => place(null)}>
              Return selected clue to tray
            </button>
          ) : (
            <button
              className="lm-reset"
              onClick={() => {
                setState((previous) => ({
                  ...previous,
                  assignments: {
                    ...previous.assignments,
                    [round.id]: round.cards.map(() => null),
                  },
                }));
                setSelected(null);
                setBoardMessage("All clues returned to the tray.");
              }}
            >
              Clear the board
            </button>
          )}
        </div>
        <p className="lm-board-message" role="status" aria-live="polite">
          {boardMessage ||
            `${assignment.filter((value) => value !== null).length} of ${round.cards.length} clues placed.`}
        </p>
      </div>
      {attempted && (
        <Feedback
          passed={last.passed}
          text={last.passed ? round.successFeedback : round.failureFeedback}
        />
      )}
      {attempted && last.passed && (
        <details className="lm-connections">
          <summary>Read the connections in the evidence</summary>
          <div>
            {round.cards.map((value) => (
              <article key={value.id}>
                <strong>{value.label}</strong>
                <p>{value.explanation}</p>
                <p className="lm-source-label">
                  Sources:{" "}
                  {value.sourceIds.map((id, index) => {
                    const source = props.sources?.find(
                      (value) => value.id === id,
                    );
                    return (
                      <span key={id}>
                        {index > 0 ? "; " : ""}
                        {source?.title ?? `source ${index + 1}`}
                      </span>
                    );
                  })}
                </p>
              </article>
            ))}
          </div>
        </details>
      )}
      <Progress done={done} stages={config.rounds} />
      <div className="lm-foot">
        <p>
          {ready
            ? "The clues fit, including in the new situation. Take this evidence back to the case."
            : done[state.stage]
              ? "This explanation holds together. Now try it with a new set of clues."
              : "Use the relationships described in your clues. Every card needs a place before you can test the explanation."}
        </p>
        {ready ? (
          <button
            className="lm-finish"
            onClick={() => props.onComplete(evidence)}
          >
            Use this evidence
          </button>
        ) : (
          <button
            className="lm-finish"
            disabled={
              !done[state.stage] || state.stage === config.rounds.length - 1
            }
            onClick={() => selectStage(state.stage + 1)}
          >
            Next investigation
          </button>
        )}
      </div>
      <ModelNotebook notes={config.modelNotes} briefing={config.briefing} />
    </Shell>
  );
}

export function LessonMachine(props: LessonMachineProps) {
  return props.config.kind === "simulation" ? (
    <SimulationMachine {...props} config={props.config} />
  ) : (
    <EvidenceMachine {...props} config={props.config} />
  );
}
