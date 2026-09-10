import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { classifyWiring } from "../domain/wiring";
import type { Terminal, Wire } from "../domain/wiring";
import { simulateCircuit } from "../domain/circuits";
import {
  parseFeederDraft,
  parseWiringDraft,
  readPuzzleDraft,
  writePuzzleDraft,
} from "./puzzleDrafts";
import type { Probe } from "./puzzleDrafts";
import "./puzzles.css";
export { clearAdventurePuzzleDrafts } from "./puzzleDrafts";

export interface AdventurePuzzleProps {
  puzzle: "lamp" | "signals" | "feeder";
  onSolve: () => void;
  onClose: () => void;
  onHint?: () => void;
  draftKey?: string;
}

type Point = { x: number; y: number };
const names: Record<Terminal, string> = {
  p: "Supply positive",
  n: "Supply negative",
  a1: "Red lamp left contact",
  a2: "Red lamp right contact",
  b1: "Green lamp left contact",
  b2: "Green lamp right contact",
};
const signalPoints: Record<Terminal, Point> = {
  p: { x: 13, y: 50 },
  n: { x: 87, y: 50 },
  a1: { x: 36, y: 27 },
  a2: { x: 64, y: 27 },
  b1: { x: 36, y: 72 },
  b2: { x: 64, y: 72 },
};
const lampPoints: Record<Terminal, Point> = {
  p: { x: 26, y: 76 },
  n: { x: 74, y: 76 },
  a1: { x: 36, y: 31 },
  a2: { x: 64, y: 31 },
  b1: { x: 36, y: 72 },
  b2: { x: 64, y: 72 },
};
const wireColors = [
  "#e38a46",
  "#72bed0",
  "#ddd276",
  "#d782b6",
  "#9ec97c",
  "#d2e3d9",
];
const at = ({ x, y }: Point): CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
});
const sameWire = (wire: Wire, a: Terminal, b: Terminal) =>
  (wire[0] === a && wire[1] === b) || (wire[0] === b && wire[1] === a);

function Bulb({
  x,
  y,
  color,
  on,
  dim = false,
  label,
}: Point & {
  color: "red" | "green" | "amber";
  on: boolean;
  dim?: boolean;
  label: string;
}) {
  return (
    <div
      className={`ap-bulb ap-bulb-${color} ${on ? "is-on" : ""} ${dim ? "is-dim" : ""}`}
      style={at({ x, y })}
    >
      <div className="ap-bulb-glass">
        <span className="ap-filament" />
      </div>
      <span className="ap-bulb-caption">
        {label} <span>{on ? (dim ? "dim" : "lit") : "off"}</span>
      </span>
    </div>
  );
}

function PuzzleFrame({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], [tabindex='0']",
        ) ?? []),
      ].filter((node) => node.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !ref.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !ref.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="ap-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="ap-case"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <header className="ap-header">
          <div>
            <p className="ap-eyebrow">{eyebrow}</p>
            <h2 id={id}>{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ap-close"
            onClick={onClose}
            aria-label="Close apparatus"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function WiringPuzzle({
  single,
  onSolve,
  onClose,
  onHint,
  draftKey,
}: {
  single: boolean;
  onSolve: () => void;
  onClose: () => void;
  onHint?: () => void;
  draftKey?: string;
}) {
  const [draft] = useState(() =>
    parseWiringDraft(readPuzzleDraft(draftKey), single ? "lamp" : "signals"),
  );
  const [wires, setWires] = useState<Wire[]>(
    draft?.wires ?? (single ? [["p", "a1"]] : []),
  );
  const [history, setHistory] = useState<Wire[][]>([]);
  const [selected, setSelected] = useState<Terminal | null>(
    draft?.selected ?? null,
  );
  const [broken, setBroken] = useState(draft?.branchOpen ?? false);
  const [passed, setPassed] = useState(draft?.trialComplete ?? false);
  const [hint, setHint] = useState(draft?.hintLevel ?? 0);
  const [feedback, setFeedback] = useState(
    draft
      ? draft.trialComplete
        ? "Your successful trial is recorded. The apparatus is ready to take back into the harbor."
        : "Your leads are just where you left them. Pick up the investigation from here."
      : single
        ? "One lead is already clipped on. Ada left the other one in a place she calls ‘extremely somewhere’."
        : "Two signal lamps. One very impatient ferry. Give each lamp a route to power, then try a failure.",
  );
  useEffect(() => {
    writePuzzleDraft(draftKey, {
      version: 1,
      kind: single ? "lamp" : "signals",
      wires,
      selected,
      branchOpen: broken,
      trialComplete: passed,
      hintLevel: Math.min(hint, 3),
    });
  }, [draftKey, single, wires, selected, broken, passed, hint]);
  const points = single ? lampPoints : signalPoints;
  const terminals: Terminal[] = single
    ? ["p", "n", "a1", "a2"]
    : ["p", "n", "a1", "a2", "b1", "b2"];
  const arrangement = classifyWiring(wires, single);
  const result = simulateCircuit({
    topology: arrangement.topology,
    voltage: 12,
    resistance: 12,
    brokenLamp: broken ? "a" : null,
  });
  const label = (terminal: Terminal) =>
    single ? names[terminal].replace("Red lamp", "Lamp") : names[terminal];
  function change(next: Wire[], message: string) {
    setHistory((previous) => [...previous, wires]);
    setWires(next);
    setSelected(null);
    setBroken(false);
    setPassed(false);
    setFeedback(message);
  }
  function connect(terminal: Terminal) {
    if (!selected) {
      setSelected(terminal);
      setFeedback(
        `${label(terminal)} selected. Choose another contact to clip a lead between them.`,
      );
      return;
    }
    if (selected === terminal) {
      setSelected(null);
      setFeedback(
        "Lead put down. No rush; the ferry has a surprisingly long horn.",
      );
      return;
    }
    const exists = wires.some((wire) => sameWire(wire, selected, terminal));
    change(
      exists
        ? wires.filter((wire) => !sameWire(wire, selected, terminal))
        : [...wires, [selected, terminal]],
      exists
        ? "Lead unclipped. Try another route."
        : "Click. Lead attached. Follow the path through the lamp and back to the supply.",
    );
  }
  function test() {
    setSelected(null);
    if (arrangement.shorted) {
      setPassed(false);
      setFeedback(
        "Click! The practice supply tripped. A lead bypasses the lamps and joins + straight to −. Remove that shortcut; the supply resets itself.",
      );
      return;
    }
    if (single) {
      if (result.lampA.on) {
        setPassed(true);
        setFeedback(
          "A warm glow! The lead, lamp, and supply now form a complete loop. Ada: ‘There. A portable rebuttal to the dark.’",
        );
      } else
        setFeedback(
          "Still dark. Start at + and trace a path through the lamp to −. A wire must reach each lamp contact.",
        );
      return;
    }
    const trial = !broken;
    setBroken(trial);
    if (!trial) {
      setFeedback(
        "Red branch restored. Both lamps can work again if both have a complete path.",
      );
      return;
    }
    const tested = simulateCircuit({
      topology: arrangement.topology,
      voltage: 12,
      resistance: 12,
      brokenLamp: "a",
    });
    if (
      arrangement.topology === "parallel" &&
      tested.lampB.on &&
      !tested.lampA.on
    ) {
      setPassed(true);
      setFeedback(
        "Red is disconnected. Green stays just as bright! Each lamp has its own path across the supply. That's the signal keeper's requirement met.",
      );
    } else if (arrangement.topology === "series") {
      setFeedback(
        "Both went out. They share one path, so opening it stops both lamps. The captain would prefer a less synchronized disaster.",
      );
    } else {
      setFeedback(
        "The trial needs two working lamps first. Trace a complete supply-to-lamp-to-return loop for each, then try opening red's branch again.",
      );
    }
  }
  function revealHint() {
    onHint?.();
    const hints = single
      ? [
          "The glass lamp contains a filament between its two contacts. That part of the path is already connected inside.",
          "The existing orange lead reaches one side of the lamp. Its other contact needs a path back to the supply's − contact.",
        ]
      : [
          "Imagine red's filament disappearing. Can you still trace a path from +, through green, and back to −?",
          "Each lamp needs a connection to both supply contacts. Joining one lamp after the other creates one shared path.",
          "Try + to each lamp's left contact, and each lamp's right contact back to −. Then open red's branch to test your design.",
        ];
    setFeedback(hints[Math.min(hint, hints.length - 1)]);
    setHint((value) => value + 1);
  }
  return (
    <PuzzleFrame
      title={single ? "A little light, please" : "The signal keeper's panel"}
      eyebrow={
        single
          ? "Ada's portable lamp · 12 volt practice supply"
          : "Bramble Bay signal works · Service bench"
      }
      onClose={onClose}
    >
      <p className="ap-instruction">
        {single
          ? "Clip the loose contacts together to get the portable lamp glowing."
          : "Wire both lamps so one can keep shining when the other's branch is opened."}{" "}
        <span>
          Choose two brass contacts to attach a lead. Choose them again, or
          select the lead, to remove it.
        </span>
      </p>
      <div className={`ap-board ${single ? "ap-board-single" : ""}`}>
        <span className="ap-screw ap-screw-tl" />
        <span className="ap-screw ap-screw-tr" />
        <span className="ap-screw ap-screw-bl" />
        <span className="ap-screw ap-screw-br" />
        <div className="ap-board-stamp" aria-hidden="true">
          {single
            ? "ADA'S WORKSHOP / MOSTLY RELIABLE"
            : "SIGNALS KEEP GOOD COMPANY"}
        </div>
        {single && (
          <div className="ap-battery" aria-hidden="true">
            <span>+</span>
            <strong>12 V</strong>
            <span>−</span>
          </div>
        )}
        {!single && (
          <>
            <div
              className="ap-supply-badge ap-supply-positive"
              aria-hidden="true"
            >
              +<small>12 V</small>
            </div>
            <div
              className="ap-supply-badge ap-supply-negative"
              aria-hidden="true"
            >
              −<small>return</small>
            </div>
          </>
        )}
        <svg
          className="ap-wires"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {wires.map(([a, b], index) => {
            const start = points[a];
            const end = points[b];
            const bend = start.x === end.x ? 7 : 3 + (index % 3) * 3;
            const path = `M ${start.x} ${start.y} C ${start.x + bend} ${start.y + 12}, ${end.x - bend} ${end.y + 12}, ${end.x} ${end.y}`;
            return (
              <g key={`${a}-${b}`}>
                <path d={path} stroke="#15282a" strokeWidth="2.2" />
                <path
                  d={path}
                  stroke={wireColors[index % wireColors.length]}
                  strokeWidth="1.1"
                />
              </g>
            );
          })}
          <path
            className="ap-filament-wire"
            d={`M 36 ${single ? 31 : 27} H 64`}
          />
          {!single && <path className="ap-filament-wire" d="M 36 72 H 64" />}
        </svg>
        <Bulb
          x={50}
          y={single ? 31 : 27}
          color={single ? "amber" : "red"}
          on={result.lampA.on}
          dim={arrangement.topology === "series"}
          label={single ? "Portable lamp" : "Red signal"}
        />
        {!single && (
          <Bulb
            x={50}
            y={72}
            color="green"
            on={result.lampB.on}
            dim={arrangement.topology === "series"}
            label="Green signal"
          />
        )}
        {terminals.map((terminal) => (
          <button
            key={terminal}
            type="button"
            className={`ap-contact ${selected === terminal ? "is-selected" : ""}`}
            style={at(points[terminal])}
            aria-label={label(terminal)}
            aria-pressed={selected === terminal}
            onClick={() => connect(terminal)}
          >
            <span aria-hidden="true">
              {terminal === "p" ? "+" : terminal === "n" ? "−" : "●"}
            </span>
          </button>
        ))}
        {broken && <span className="ap-break-tag">Red branch open</span>}
        {arrangement.shorted && (
          <span className="ap-trip-tag">Supply protection tripped</span>
        )}
      </div>
      <div className="ap-wire-tray" aria-label="Attached leads">
        {wires.length ? (
          wires.map(([a, b], index) => (
            <button
              type="button"
              key={`${a}-${b}`}
              onClick={() =>
                change(
                  wires.filter((_, i) => i !== index),
                  "Lead unclipped. The practice supply is ready.",
                )
              }
              className="ap-lead-chip"
              aria-label={`Remove lead from ${label(a)} to ${label(b)}`}
            >
              <i
                style={{
                  backgroundColor: wireColors[index % wireColors.length],
                }}
              />
              <span>
                {single
                  ? [a, b]
                      .map((t) =>
                        t === "p"
                          ? "+"
                          : t === "n"
                            ? "−"
                            : t === "a1"
                              ? "lamp L"
                              : "lamp R",
                      )
                      .join(" ↔ ")
                  : `${a.toUpperCase()} ↔ ${b.toUpperCase()}`}
              </span>{" "}
              ×
            </button>
          ))
        ) : (
          <span className="ap-tray-empty">
            Loose leads ready. Pick any two contacts.
          </span>
        )}
      </div>
      <div className="ap-feedback" role="status">
        <span aria-hidden="true">✦</span>
        <p>{feedback}</p>
      </div>
      <div className="ap-controls">
        <div className="ap-secondary-controls">
          <button
            type="button"
            onClick={() => {
              const previous = history.at(-1);
              if (!previous) return;
              setWires(previous);
              setHistory((items) => items.slice(0, -1));
              setSelected(null);
              setBroken(false);
              setPassed(false);
              setFeedback("Last wiring change undone.");
            }}
            disabled={!history.length}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => change([], "Leads unhooked. A fresh start.")}
            disabled={!wires.length}
          >
            Clear leads
          </button>
          <button type="button" onClick={revealHint}>
            Trace hint
          </button>
        </div>
        <button type="button" className="ap-action" onClick={test}>
          {single
            ? "Test lamp"
            : broken
              ? "Restore red branch"
              : "Open red branch"}
        </button>
        {passed && (
          <button
            type="button"
            className="ap-action ap-action-success"
            onClick={onSolve}
          >
            {single ? "Take the glowing lamp →" : "Install this wiring →"}
          </button>
        )}
      </div>
      <p className="ap-model-note">
        Practice model: a protected, ideal 12 V source and identical
        fixed-resistance lamps. Real equipment can behave differently.
      </p>
    </PuzzleFrame>
  );
}

const probeNames: Record<Probe, string> = {
  source: "Supply contacts",
  red: "Red lamp contacts",
  green: "Green lamp contacts",
  feeder: "Feed connector contacts",
};
const feederPoints: Record<Probe, Point> = {
  source: { x: 13, y: 70 },
  feeder: { x: 36, y: 26 },
  red: { x: 70, y: 30 },
  green: { x: 70, y: 69 },
};

function FeederPuzzle({
  onSolve,
  onClose,
  onHint,
  draftKey,
}: {
  onSolve: () => void;
  onClose: () => void;
  onHint?: () => void;
  draftKey?: string;
}) {
  const [draft] = useState(() => parseFeederDraft(readPuzzleDraft(draftKey)));
  const [mode, setMode] = useState<"test" | "repair">(draft?.mode ?? "test");
  const [probed, setProbed] = useState<Probe[]>(draft?.probed ?? []);
  const [reading, setReading] = useState<Probe | null>(draft?.reading ?? null);
  const [repaired, setRepaired] = useState(draft?.repaired ?? false);
  const [openRed, setOpenRed] = useState(draft?.branchOpen ?? false);
  const [passed, setPassed] = useState(draft?.trialComplete ?? false);
  const [hint, setHint] = useState(draft?.hintLevel ?? 0);
  const [feedback, setFeedback] = useState(
    draft
      ? draft.trialComplete
        ? "Your diagnosis, repair, and branch trial are recorded. The ferry is ready for the all-clear."
        : "Your measurements and tools are where you left them. Tock has guarded the cabinet with extreme punctuality."
      : "It worked on the bench. Tock insists the lamps are sulking. The console voltmeter might have a more useful theory.",
  );
  useEffect(() => {
    writePuzzleDraft(draftKey, {
      version: 1,
      kind: "feeder",
      mode,
      probed,
      reading,
      repaired,
      branchOpen: openRed,
      trialComplete: passed,
      hintLevel: hint,
    });
  }, [draftKey, mode, probed, reading, repaired, openRed, passed, hint]);
  const diagnosed = probed.includes("source") && probed.includes("feeder");
  const result = simulateCircuit({
    topology: repaired ? "parallel" : "open",
    voltage: 12,
    resistance: 12,
    brokenLamp: openRed ? "a" : null,
  });
  function voltage(probe: Probe) {
    return probe === "source"
      ? 12
      : probe === "feeder"
        ? repaired
          ? 0
          : 12
        : repaired && !(probe === "red" && openRed)
          ? 12
          : 0;
  }
  function inspect(probe: Probe) {
    if (mode === "repair") {
      if (probe !== "feeder") {
        setFeedback(
          probe === "source"
            ? "The supply doesn't need a jumper across its contacts. That would be a short circuit! Inspect its voltage with the console voltmeter instead."
            : "That socket is intact. Replacing a good lamp's connection won't repair the shared break upstream. Follow the feed back toward the supply.",
        );
        return;
      }
      if (!diagnosed) {
        setFeedback(
          "Check the supply and measure across that loose connection first. A good diagnosis tells you what this repair will change.",
        );
        setMode("test");
        return;
      }
      setRepaired(true);
      setMode("test");
      setFeedback(
        "Clack! Both lamps return. Their separate branches still depend on this shared supply connection. Try opening only the red branch before the ferry relies on them.",
      );
      return;
    }
    setReading(probe);
    setProbed((previous) =>
      previous.includes(probe) ? previous : [...previous, probe],
    );
    const observations: Record<Probe, string> = {
      source:
        "12 V at the supply. Power is available here. Tock quietly cancels requisition 004: ‘a less moody battery’.",
      red: repaired
        ? openRed
          ? "0 V across the red lamp. Its branch switch is open ahead of the lamp, so no current flows through it."
          : "12 V across the red lamp. Its path to the supply is restored."
        : "0 V across the red lamp. This tells us it isn't receiving supply voltage; it does not prove the lamp is faulty.",
      green: repaired
        ? "12 V across green. It has its own complete path, even when the red branch is opened."
        : "0 V across green too. Two dark lamps are a useful clue: look at what their paths share.",
      feeder: repaired
        ? "0 V across the repaired connector. The two sides are now joined by a conducting lead."
        : "12 V across this open connector. One side reaches the supply; the other returns through the lamps. This gap interrupts both paths.",
    };
    setFeedback(observations[probe]);
  }
  return (
    <PuzzleFrame
      title="The trouble they share"
      eyebrow="Lantern room · Installed signal cabinet"
      onClose={onClose}
    >
      <p className="ap-instruction">
        The lamps have separate branches, but both went dark. Find the shared
        fault.
        <span>
          Use the console voltmeter, then choose a pair of contacts. Fit the
          spare jumper where the evidence points.
        </span>
      </p>
      <div className="ap-feeder-layout">
        <div className="ap-board ap-board-feeder">
          <span className="ap-screw ap-screw-tl" />
          <span className="ap-screw ap-screw-tr" />
          <span className="ap-screw ap-screw-bl" />
          <span className="ap-screw ap-screw-br" />
          <svg
            className="ap-wires ap-installed-wires"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="ap-fixed-wire-shadow"
              d="M 13 59 V 26 H 31 M 41 26 H 48 V 30 H 62 M 48 30 V 69 H 62 M 78 30 H 90 V 84 H 13 V 77 M 78 69 H 90"
            />
            <path
              className="ap-fixed-wire"
              d="M 13 59 V 26 H 31 M 41 26 H 48 V 30 H 62 M 48 30 V 69 H 62 M 78 30 H 90 V 84 H 13 V 77 M 78 69 H 90"
            />
            <circle cx="48" cy="30" r="1.5" fill="#eaca88" />
            <circle cx="90" cy="69" r="1.5" fill="#eaca88" />
            {repaired ? (
              <path
                d="M 31 26 Q 36 18 41 26"
                stroke="#ed9257"
                strokeWidth="2"
              />
            ) : (
              <path
                d="M 31 26 L 34 20 M 38 26 H 41"
                stroke="#e6af62"
                strokeWidth="2"
              />
            )}
            {openRed && (
              <path
                d="M 55 27 L 59 33 M 59 27 L 55 33"
                stroke="#213939"
                strokeWidth="3"
              />
            )}
          </svg>
          <div className="ap-fixed-battery" aria-hidden="true">
            <span>+</span>
            <strong>12 V</strong>
            <span>−</span>
          </div>
          <Bulb
            x={70}
            y={30}
            color="red"
            on={result.lampA.on}
            label="Red signal"
          />
          <Bulb
            x={70}
            y={69}
            color="green"
            on={result.lampB.on}
            label="Green signal"
          />
          {(Object.keys(feederPoints) as Probe[]).map((probe) => (
            <button
              type="button"
              key={probe}
              className={`ap-probe-point ${reading === probe ? "is-reading" : ""} ${probe === "feeder" ? "ap-probe-feeder" : ""}`}
              style={at(feederPoints[probe])}
              onClick={() => inspect(probe)}
              aria-label={`${mode === "test" ? "Measure across" : "Try jumper at"} ${probeNames[probe].toLowerCase()}`}
            >
              <span>{mode === "test" ? "⌁" : "+"}</span>
              <small>
                {probe === "source"
                  ? "Supply"
                  : probe === "feeder"
                    ? repaired
                      ? "Joined"
                      : "Connector"
                    : probe === "red"
                      ? "Red contacts"
                      : "Green contacts"}
              </small>
            </button>
          ))}
          {openRed && (
            <span className="ap-break-tag">Red branch switch open</span>
          )}
          <span className="ap-installed-label" aria-hidden="true">
            SHARED FEED → SEPARATE BRANCHES
          </span>
        </div>
        <aside
          className="ap-meter"
          aria-label="Console voltmeter set to DC voltage"
        >
          <div className="ap-meter-top">
            CONSOLE VOLTMETER <span>DC voltage · v. reasonably accurate</span>
          </div>
          <div className="ap-meter-screen" role="status">
            <strong>{reading ? voltage(reading).toFixed(1) : "— —"}</strong>
            <span>V</span>
            <small>
              {reading ? probeNames[reading] : "Select contact pair"}
            </small>
          </div>
          <div className="ap-meter-dial" aria-hidden="true">
            <span>V</span>
          </div>
          <div className="ap-meter-tools">
            <button
              type="button"
              className={mode === "test" ? "is-active" : ""}
              aria-pressed={mode === "test"}
              onClick={() => {
                setMode("test");
                setFeedback(
                  "Console voltmeter set to DC voltage. Choose a pair of contacts on the cabinet to measure the voltage between them.",
                );
              }}
            >
              Use voltmeter
            </button>
            <button
              type="button"
              className={mode === "repair" ? "is-active" : ""}
              aria-pressed={mode === "repair"}
              disabled={repaired}
              onClick={() => {
                setMode("repair");
                setFeedback(
                  "Spare jumper selected. Choose the connection you think needs joining.",
                );
              }}
            >
              Fit spare jumper
            </button>
          </div>
          <p>
            {repaired
              ? "Jumper fitted. Signal circuit restored."
              : `${probed.length} of 4 contact pairs inspected`}
          </p>
        </aside>
      </div>
      <div className="ap-feedback" role="status">
        <span aria-hidden="true">✦</span>
        <p>{feedback}</p>
      </div>
      <div className="ap-controls">
        <button
          type="button"
          className="ap-hint-button"
          onClick={() => {
            onHint?.();
            setHint((level) => Math.min(level + 1, 2));
            setFeedback(
              hint
                ? "Measure the supply, then the loose connector in the shared feed before the branches split. A voltage across an open gap can reveal where the conducting path breaks."
                : "Separate branches can survive a fault in one branch. What connection do both paths still need? Compare measurements before choosing a repair.",
            );
          }}
        >
          Ask Tock for a nudge
        </button>
        {repaired && (
          <button
            type="button"
            className="ap-action"
            onClick={() => {
              setOpenRed(!openRed);
              if (!openRed) {
                setPassed(true);
                setFeedback(
                  "Red goes out; green stays bright. The shared feed is repaired, and the independent branches still do their job. That's a harbor worth coming home to.",
                );
              } else
                setFeedback(
                  "Both signals restored. The ferry is waiting for your all-clear.",
                );
            }}
          >
            {openRed ? "Restore red branch" : "Open red branch"}
          </button>
        )}
        {passed && (
          <button
            type="button"
            className="ap-action ap-action-success"
            onClick={onSolve}
          >
            Give the ferry the all-clear →
          </button>
        )}
      </div>
      <p className="ap-model-note">
        Ideal 12 V model. The console voltmeter measures between each marked
        pair. Branch switches interrupt the wire ahead of a lamp; they do not
        short it.
      </p>
    </PuzzleFrame>
  );
}

export default function AdventurePuzzle({
  puzzle,
  onSolve,
  onClose,
  onHint,
  draftKey,
}: AdventurePuzzleProps) {
  return puzzle === "feeder" ? (
    <FeederPuzzle
      key={`${puzzle}:${draftKey ?? ""}`}
      onSolve={onSolve}
      onClose={onClose}
      onHint={onHint}
      draftKey={draftKey}
    />
  ) : (
    <WiringPuzzle
      key={`${puzzle}:${draftKey ?? ""}`}
      single={puzzle === "lamp"}
      onSolve={onSolve}
      onClose={onClose}
      onHint={onHint}
      draftKey={draftKey}
    />
  );
}
