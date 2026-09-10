import { simulateCircuit } from "../domain/circuits";
import { classifyWiring } from "../domain/wiring";
import type { Terminal, Wire } from "../domain/wiring";

export type Probe = "source" | "red" | "green" | "feeder";
export interface WiringDraft {
  version: 1;
  kind: "lamp" | "signals";
  wires: Wire[];
  selected: Terminal | null;
  branchOpen: boolean;
  trialComplete: boolean;
  hintLevel: number;
}
export interface FeederDraft {
  version: 1;
  kind: "feeder";
  mode: "test" | "repair";
  probed: Probe[];
  reading: Probe | null;
  repaired: boolean;
  branchOpen: boolean;
  trialComplete: boolean;
  hintLevel: number;
}
type Draft = WiringDraft | FeederDraft;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const terminals = new Set(["p", "n", "a1", "a2", "b1", "b2"]);
const probes = new Set(["source", "red", "green", "feeder"]);
const MAX_DRAFT_LENGTH = 8_192;

function record(raw: string | null): Record<string, unknown> | null {
  if (!raw || raw.length > MAX_DRAFT_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
function hint(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 3
  );
}

/** Recover evidence only when the saved arrangement can actually pass its trial. */
export function parseWiringDraft(
  raw: string | null,
  kind: "lamp" | "signals",
): WiringDraft | null {
  const value = record(raw);
  if (
    !value ||
    value.version !== 1 ||
    value.kind !== kind ||
    !Array.isArray(value.wires) ||
    value.wires.length > 15 ||
    typeof value.branchOpen !== "boolean" ||
    typeof value.trialComplete !== "boolean" ||
    !hint(value.hintLevel) ||
    (value.selected !== null &&
      (typeof value.selected !== "string" || !terminals.has(value.selected)))
  )
    return null;
  const wires: Wire[] = [];
  const seen = new Set<string>();
  for (const wire of value.wires) {
    if (
      !Array.isArray(wire) ||
      wire.length !== 2 ||
      wire.some(
        (terminal) => typeof terminal !== "string" || !terminals.has(terminal),
      ) ||
      wire[0] === wire[1]
    )
      return null;
    if (
      kind === "lamp" &&
      wire.some((terminal) => terminal === "b1" || terminal === "b2")
    )
      return null;
    const identity = [...wire].sort().join(":");
    if (seen.has(identity)) return null;
    seen.add(identity);
    wires.push([wire[0], wire[1]] as Wire);
  }
  if (kind === "lamp" && (value.selected === "b1" || value.selected === "b2"))
    return null;
  const wiring = classifyWiring(wires, kind === "lamp");
  const tested = simulateCircuit({
    topology: wiring.topology,
    voltage: 12,
    resistance: 12,
    brokenLamp: kind === "signals" ? "a" : null,
  });
  const physicallyPassed =
    !wiring.shorted &&
    (kind === "lamp"
      ? tested.lampA.on
      : wiring.topology === "parallel" && !tested.lampA.on && tested.lampB.on);
  return {
    version: 1,
    kind,
    wires,
    selected: value.selected as Terminal | null,
    branchOpen: kind === "signals" && value.branchOpen,
    trialComplete: value.trialComplete && physicallyPassed,
    hintLevel: value.hintLevel,
  };
}

export function parseFeederDraft(raw: string | null): FeederDraft | null {
  const value = record(raw);
  if (
    !value ||
    value.version !== 1 ||
    value.kind !== "feeder" ||
    typeof value.mode !== "string" ||
    !["test", "repair"].includes(value.mode) ||
    !Array.isArray(value.probed) ||
    value.probed.length > 4 ||
    value.probed.some(
      (probe) => typeof probe !== "string" || !probes.has(probe),
    ) ||
    new Set(value.probed).size !== value.probed.length ||
    (value.reading !== null && !value.probed.includes(value.reading)) ||
    typeof value.repaired !== "boolean" ||
    typeof value.branchOpen !== "boolean" ||
    typeof value.trialComplete !== "boolean" ||
    !hint(value.hintLevel)
  )
    return null;
  const probed = value.probed as Probe[];
  const repaired =
    value.repaired && probed.includes("source") && probed.includes("feeder");
  const tested = simulateCircuit({
    topology: repaired ? "parallel" : "open",
    voltage: 12,
    resistance: 12,
    brokenLamp: "a",
  });
  return {
    version: 1,
    kind: "feeder",
    mode: repaired ? "test" : (value.mode as "test" | "repair"),
    probed,
    reading: value.reading as Probe | null,
    repaired,
    branchOpen: repaired && value.branchOpen,
    trialComplete:
      value.trialComplete && repaired && !tested.lampA.on && tested.lampB.on,
    hintLevel: Math.min(value.hintLevel, 2),
  };
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
export function readPuzzleDraft(
  key?: string,
  storage?: DraftStorage,
): string | null {
  if (!key) return null;
  try {
    return (storage ?? browserStorage())?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
export function writePuzzleDraft(
  key: string | undefined,
  draft: Draft,
  storage?: DraftStorage,
): void {
  if (!key) return;
  try {
    const raw = JSON.stringify(draft);
    if (raw.length <= MAX_DRAFT_LENGTH)
      (storage ?? browserStorage())?.setItem(key, raw);
  } catch {
    /* A full or disabled storage area must not interrupt a puzzle. */
  }
}
export function clearAdventurePuzzleDrafts(storage?: DraftStorage): void {
  for (const kind of ["lamp", "signals", "feeder"] as const) {
    try {
      (storage ?? browserStorage())?.removeItem(
        `astraified:bramble:draft:${kind}`,
      );
    } catch {
      /* Best effort per key. */
    }
  }
}
