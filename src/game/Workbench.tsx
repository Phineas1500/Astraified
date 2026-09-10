import { useMemo, useState } from "react";
import { Check, Lightbulb, Play, RotateCcw, Undo2, Zap } from "lucide-react";
import type { Station } from "../domain/types";
import {
  evaluateCircuitGoal,
  simulateCircuit,
  type CircuitResult,
} from "../domain/circuits";
import { classifyWiring, type Terminal, type Wire } from "../domain/wiring";
import { validateRoute } from "../domain/routing";

const points: Record<Terminal, { x: number; y: number; label: string }> = {
  p: { x: 62, y: 128, label: "Battery positive" },
  n: { x: 62, y: 248, label: "Battery negative" },
  a1: { x: 225, y: 100, label: "Lamp A left terminal" },
  a2: { x: 365, y: 100, label: "Lamp A right terminal" },
  b1: { x: 225, y: 276, label: "Lamp B left terminal" },
  b2: { x: 365, y: 276, label: "Lamp B right terminal" },
};
const off: CircuitResult = {
  lampA: { on: false, current: 0, power: 0 },
  lampB: { on: false, current: 0, power: 0 },
  totalCurrent: 0,
  explanation: "",
};

export default function Workbench({
  station,
  onComplete,
  onHint,
  onAttempt,
  onSupport,
}: {
  station: Station;
  onComplete: (assisted: boolean) => void;
  onHint: () => void;
  onAttempt: () => void;
  onSupport: () => void;
}) {
  const [solved, setSolved] = useState(false),
    [answer, setAnswer] = useState<number | null>(null),
    [incorrect, setIncorrect] = useState(false);
  const [hint, setHint] = useState(-1),
    [checking, setChecking] = useState(false);
  const [trialMessage, setTrialMessage] = useState("");
  const assisted = hint >= 0 || incorrect;
  const completeTrial = (success: boolean, message: string) => {
    onAttempt();
    setTrialMessage(message);
    setSolved(success);
  };
  const invalidateTrial = () => {
    setSolved(false);
    setTrialMessage("");
  };
  return (
    <div className="workbench">
      <div className="task-intro">
        <p className="character-line">Iona, harbor caretaker</p>
        <p>{station.story}</p>
        <div className="task-goal">
          <Zap size={17} />
          <strong>{station.task}</strong>
        </div>
      </div>
      <div hidden={checking}>
        {station.kind === "circuit" ? (
          <CircuitBoard
            station={station}
            onTrial={completeTrial}
            onChange={invalidateTrial}
          />
        ) : (
          <RouteBoard
            station={station}
            onTrial={completeTrial}
            onChange={invalidateTrial}
          />
        )}
        {trialMessage && (
          <div
            role="status"
            className={`experiment-feedback ${solved ? "success" : ""}`}
          >
            {solved && <Check size={18} />}
            <span>{trialMessage}</span>
          </div>
        )}
        {hint >= 0 && (
          <div className="hint-note">
            <Lightbulb size={18} />
            <p>{station.hints[hint]}</p>
          </div>
        )}
        <div className="workbench-footer">
          <button
            className="text-button"
            onClick={() => {
              setHint(Math.min(hint + 1, station.hints.length - 1));
              onHint();
            }}
            disabled={hint >= station.hints.length - 1}
          >
            <Lightbulb size={16} />{" "}
            {hint < 0 ? "A little nudge" : "Another hint"}
          </button>
          <button
            className="button primary"
            disabled={!solved}
            onClick={() => setChecking(true)}
          >
            Try a new situation <span>→</span>
          </button>
        </div>
      </div>
      {checking && (
        <div className="transfer-panel">
          <div className="circle-icon">
            <Lightbulb size={25} />
          </div>
          <p className="small-label">Take the idea with you</p>
          <h3>{station.check.question}</h3>
          <div className="answer-options">
            {station.check.options.map((option, index) => (
              <button
                key={index}
                className={`answer-option ${answer === index ? "selected" : ""}`}
                onClick={() => setAnswer(index)}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
              </button>
            ))}
          </div>
          {incorrect && (
            <p role="status" className="hint-note">
              Think about the paths you tested. You can return to the experiment
              and compare what changes.
            </p>
          )}
          <div className="workbench-footer">
            <button className="text-button" onClick={() => setChecking(false)}>
              Back to experiment
            </button>
            <button
              className="button primary"
              disabled={answer === null}
              onClick={() => {
                onAttempt();
                if (answer === station.check.answer) onComplete(assisted);
                else {
                  setIncorrect(true);
                  onSupport();
                }
              }}
            >
              Check & continue <Check size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CircuitBoard({
  station,
  onTrial,
  onChange,
}: {
  station: Station;
  onTrial: (ok: boolean, message: string) => void;
  onChange: () => void;
}) {
  const circuit = station.circuit!;
  const single = circuit.goal === "closed";
  const [wires, setWires] = useState<Wire[]>([]),
    [selected, setSelected] = useState<Terminal | null>(null);
  const [broken, setBroken] = useState<"a" | "b" | null>(null),
    [result, setResult] = useState<CircuitResult>(off),
    [tested, setTested] = useState(false);
  const [prediction, setPrediction] = useState(""),
    [testedPrediction, setTestedPrediction] = useState("");
  const wiring = useMemo(() => classifyWiring(wires, single), [wires, single]);
  const invalidate = () => {
    setTested(false);
    setResult(off);
    setPrediction("");
    onChange();
  };
  function connect(terminal: Terminal) {
    if (!selected) {
      setSelected(terminal);
      return;
    }
    if (selected === terminal) {
      setSelected(null);
      return;
    }
    const existing = wires.findIndex(
      ([a, b]) =>
        (a === selected && b === terminal) ||
        (b === selected && a === terminal),
    );
    setWires(
      existing >= 0
        ? wires.filter((_, i) => i !== existing)
        : [...wires, [selected, terminal]],
    );
    setSelected(null);
    invalidate();
  }
  function test() {
    if (wiring.shorted) {
      invalidate();
      onTrial(
        false,
        "The battery terminals are connected directly. Remove that bypass so the current has a path through a lamp.",
      );
      return;
    }
    const input = { ...circuit, topology: wiring.topology, brokenLamp: broken };
    const next = simulateCircuit(input);
    setResult(next);
    setTested(true);
    setTestedPrediction(prediction);
    const success = evaluateCircuitGoal(circuit.goal, input);
    const bothReady =
      circuit.goal === "parallel" && wiring.topology === "parallel" && !broken;
    onTrial(
      success,
      success
        ? `It works. ${next.explanation}`
        : bothReady
          ? "Both lamps are lit. Now open one lamp’s branch and test whether the other stays on."
          : `${next.explanation} ${wiring.feedback}`,
    );
  }
  const lamps = single ? (["a"] as const) : (["a", "b"] as const);
  return (
    <>
      <div className="board-topline">
        <span>
          <strong>{circuit.voltage} V</strong> supply{" "}
          <span className="muted">/ {circuit.resistance} Ω per lamp</span>
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Undo last wire"
            disabled={!wires.length}
            onClick={() => {
              setWires(wires.slice(0, -1));
              invalidate();
            }}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Clear all wires"
            disabled={!wires.length}
            onClick={() => {
              setWires([]);
              setSelected(null);
              setBroken(null);
              invalidate();
            }}
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      <div className="circuit-board">
        <svg
          viewBox="0 0 460 365"
          role="group"
          aria-label="Circuit workbench. Select two terminals to connect a wire."
        >
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" fill="#54738a" opacity=".35" />
            </pattern>
            <radialGradient id="lamp-glow">
              <stop stopColor="#ffd987" stopOpacity=".9" />
              <stop offset="1" stopColor="#ffd987" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="460" height="365" fill="url(#grid)" />
          <rect
            x="29"
            y="156"
            width="67"
            height="62"
            rx="9"
            fill="#263f54"
            stroke="#93adb9"
            strokeWidth="2"
          />
          <path d="M62 128v28m0 62v30" stroke="#afc2cc" strokeWidth="3" />
          <text x="47" y="193" fill="#e1edf1" fontSize="23">
            + −
          </text>
          <text x="35" y="295" fill="#a5bdcb" fontSize="12">
            Battery
          </text>
          {lamps.map((lamp) => {
            const y = lamp === "a" ? 100 : 276;
            const state = lamp === "a" ? result.lampA : result.lampB;
            const isBroken = broken === lamp;
            return (
              <g key={lamp}>
                {state.on && (
                  <circle
                    cx="295"
                    cy={y}
                    r="62"
                    fill="url(#lamp-glow)"
                    opacity={Math.max(
                      0.35,
                      Math.min(
                        1,
                        state.power /
                          ((circuit.voltage * circuit.voltage) /
                            circuit.resistance),
                      ),
                    )}
                  />
                )}
                <path
                  d={`M225 ${y}h45m50 0h45`}
                  stroke="#b4c5cf"
                  strokeWidth="3"
                />
                <circle
                  cx="295"
                  cy={y}
                  r="25"
                  fill={state.on ? "#f6d68b" : "#294356"}
                  stroke={state.on ? "#fff0b5" : "#a6bcc9"}
                  strokeWidth="2"
                />
                <path
                  d={`M283 ${y - 12}l24 24m0-24l-24 24`}
                  stroke={state.on ? "#8a692c" : "#aec1cd"}
                  strokeWidth="2"
                />
                {isBroken && (
                  <path
                    d={`M277 ${y + 25}l36-50`}
                    stroke="#e99886"
                    strokeWidth="4"
                  />
                )}
                <text
                  x="295"
                  y={y - 40}
                  textAnchor="middle"
                  fill="#d5e4ec"
                  fontSize="13"
                >
                  Lamp {lamp.toUpperCase()}
                </text>
                <text
                  x="295"
                  y={y + 48}
                  textAnchor="middle"
                  fill={state.on ? "#f6d68b" : "#87a4b8"}
                  fontSize="12"
                >
                  {tested ? `${state.power.toFixed(1)} W` : "Not tested"}
                </text>
              </g>
            );
          })}
          {wires.map(([a, b], i) => {
            const p = points[a],
              q = points[b];
            return (
              <path
                key={i}
                d={`M${p.x} ${p.y} C${p.x} ${(p.y + q.y) / 2 + 30},${q.x} ${(p.y + q.y) / 2 + 30},${q.x} ${q.y}`}
                fill="none"
                stroke={tested && !wiring.shorted ? "#e8c77c" : "#77b1b4"}
                strokeWidth="4"
                strokeLinecap="round"
              />
            );
          })}
          {(Object.entries(points) as [Terminal, (typeof points)[Terminal]][])
            .filter(([id]) => !single || !id.startsWith("b"))
            .map(([id, p]) => (
              <g
                key={id}
                role="button"
                aria-label={p.label}
                tabIndex={0}
                className="terminal"
                onClick={() => connect(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    connect(id);
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r="17" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="8"
                  fill={selected === id ? "#f3c97e" : "#172e40"}
                  stroke={selected === id ? "#fff2c5" : "#d5e5ec"}
                  strokeWidth="3"
                />
                {selected === id && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="13"
                    fill="none"
                    stroke="#f3c97e"
                  />
                )}
              </g>
            ))}
        </svg>
        <p className="board-instruction" aria-live="polite">
          {selected
            ? `${points[selected].label} selected. Choose another terminal.`
            : "Click two terminals to connect them. Click a connected pair to remove a wire."}
        </p>
      </div>
      {!single && (
        <div className="failure-controls">
          <span>Open a branch</span>
          <div className="segmented small">
            {([null, "a", "b"] as const).map((value) => (
              <button
                key={value ?? "none"}
                className={broken === value ? "active" : ""}
                onClick={() => {
                  setBroken(value);
                  invalidate();
                }}
              >
                {value ? `Lamp ${value.toUpperCase()}` : "Neither"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="experiment-controls">
        <label>
          Predict before testing
          <select
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
          >
            <option value="">Which lamps will light?</option>
            <option value="none">Neither lamp</option>
            <option value="a">Only lamp A</option>
            {!single && (
              <>
                <option value="b">Only lamp B</option>
                <option value="both">Both lamps</option>
              </>
            )}
          </select>
        </label>
        <button
          className="button primary"
          disabled={!prediction}
          onClick={test}
        >
          <Play size={16} /> Test circuit
        </button>
      </div>
      {tested && (
        <p className="prediction-result">
          {testedPrediction ===
          (result.lampA.on
            ? result.lampB.on
              ? "both"
              : "a"
            : result.lampB.on
              ? "b"
              : "none")
            ? "Your prediction matches the experiment."
            : "The result differs from your prediction. Trace the complete paths and try again."}{" "}
          Supply current: {result.totalCurrent.toFixed(2)} A.
        </p>
      )}
    </>
  );
}

function RouteBoard({
  station,
  onTrial,
  onChange,
}: {
  station: Station;
  onTrial: (ok: boolean, message: string) => void;
  onChange: () => void;
}) {
  const graph = station.routing!;
  const [path, setPath] = useState<string[]>([graph.start]);
  const coords = Object.fromEntries(
    graph.nodes.map((node, index) => [
      node,
      {
        x:
          230 +
          155 *
            Math.cos(-Math.PI / 2 + (index * Math.PI * 2) / graph.nodes.length),
        y:
          175 +
          120 *
            Math.sin(-Math.PI / 2 + (index * Math.PI * 2) / graph.nodes.length),
      },
    ]),
  );
  const labels: { x: number; y: number; anchorX: number; anchorY: number }[] =
    [];
  for (const edge of graph.edges) {
    const a = coords[edge.from],
      b = coords[edge.to],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    const candidates = [
      0, 16, -16, 32, -32, 48, -48, 64, -64, 80, -80, 96, -96,
    ].flatMap((offset) =>
      [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85].map((t) => ({
        x: a.x + dx * t - (dy / length) * offset,
        y: a.y + dy * t + (dx / length) * offset,
        anchorX: a.x + dx * t,
        anchorY: a.y + dy * t,
      })),
    );
    const penalty = (p: (typeof candidates)[number]) => {
      const outside = p.x < 20 || p.x > 440 || p.y < 18 || p.y > 332;
      const labelHits = labels.filter(
        (q) => Math.abs(p.x - q.x) < 40 && Math.abs(p.y - q.y) < 34,
      ).length;
      const nodeHits = Object.values(coords).filter(
        (q) => Math.hypot(p.x - q.x, p.y - q.y) < 45,
      ).length;
      return (outside ? 1000 : 0) + labelHits * 100 + nodeHits * 100;
    };
    // Prefer positions on the edge. Dense maps can use a leader to nearby free space.
    let candidate = candidates.find((p) => penalty(p) === 0);
    if (!candidate) {
      const freeSpace: typeof candidates = [];
      for (let x = 28; x <= 432; x += 18)
        for (let y = 22; y <= 328; y += 18) {
          const t = Math.max(
            0.15,
            Math.min(
              0.85,
              ((x - a.x) * dx + (y - a.y) * dy) / (length * length),
            ),
          );
          freeSpace.push({
            x,
            y,
            anchorX: a.x + dx * t,
            anchorY: a.y + dy * t,
          });
        }
      freeSpace.sort(
        (p, q) =>
          Math.hypot(p.x - p.anchorX, p.y - p.anchorY) -
          Math.hypot(q.x - q.anchorX, q.y - q.anchorY),
      );
      candidate = freeSpace.find((p) => penalty(p) === 0);
    }
    candidate ??= candidates.reduce((best, p) =>
      penalty(p) < penalty(best) ? p : best,
    );
    labels.push(candidate);
  }
  const last = path[path.length - 1];
  function choose(node: string) {
    if (
      graph.edges.some(
        (e) =>
          (e.from === last && e.to === node) ||
          (e.to === last && e.from === node),
      )
    ) {
      setPath([...path, node]);
      onChange();
    }
  }
  return (
    <>
      <div className="board-topline">
        <span>
          Find the lowest-cost route from <strong>{graph.start}</strong> to{" "}
          <strong>{graph.end}</strong>
        </span>
        <button
          className="icon-button"
          aria-label="Reset route"
          onClick={() => {
            setPath([graph.start]);
            onChange();
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="circuit-board">
        <svg viewBox="0 0 460 350" role="group" aria-label="Route map">
          {graph.edges.map((edge, index) => {
            const a = coords[edge.from],
              b = coords[edge.to];
            const chosen = path.some(
              (p, i) =>
                i > 0 &&
                ((p === edge.from && path[i - 1] === edge.to) ||
                  (p === edge.to && path[i - 1] === edge.from)),
            );
            const description = `${edge.from} to ${edge.to}, travel cost ${edge.weight}${chosen ? ", on your route" : ""}`;
            return (
              <g key={index} role="img" aria-label={description}>
                <title>{description}</title>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={chosen ? "#f3c97e" : "#55778e"}
                  strokeWidth={chosen ? 5 : 2}
                />
              </g>
            );
          })}
          {labels.map((p, index) => (
            <line
              key={index}
              aria-hidden="true"
              x1={p.anchorX}
              y1={p.anchorY}
              x2={p.x}
              y2={p.y}
              stroke="#a0bbc9"
              strokeWidth="1.5"
            />
          ))}
          {graph.edges.map((edge, index) => {
            const p = labels[index];
            return (
              <g key={index} aria-hidden="true">
                <rect
                  x={p.x - 16}
                  y={p.y - 13}
                  width="32"
                  height="26"
                  rx="7"
                  fill="#203e54"
                  stroke="#7694a7"
                  strokeWidth="1"
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fill="#eff5f8"
                  fontSize="13"
                >
                  {edge.weight}
                </text>
              </g>
            );
          })}
          {graph.nodes.map((node) => {
            const p = coords[node];
            return (
              <g
                className="terminal"
                role="button"
                tabIndex={0}
                aria-label={`Visit ${node}`}
                key={node}
                onClick={() => choose(node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(node);
                  }
                }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="23"
                  fill={path.includes(node) ? "#f3c97e" : "#2c536b"}
                  stroke="#c4d9e0"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fill={path.includes(node) ? "#173249" : "#eaf2f5"}
                  fontSize="12"
                >
                  {node.slice(0, 8)}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="board-instruction">
          Choose connected stops. A number on a path is its travel cost.
        </p>
      </div>
      <p className="route-trail">Your route: {path.join(" → ")}</p>
      <div className="experiment-controls">
        <button
          className="text-button"
          disabled={path.length < 2}
          onClick={() => {
            setPath(path.slice(0, -1));
            onChange();
          }}
        >
          <Undo2 size={16} /> Back one stop
        </button>
        <button
          className="button primary"
          onClick={() => {
            const result = validateRoute(graph, path);
            onTrial(result.valid && result.optimal, result.feedback);
          }}
        >
          <Play size={16} /> Test route
        </button>
      </div>
    </>
  );
}
