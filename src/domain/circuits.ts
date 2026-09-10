import type { Station } from "./types";

export type CircuitTopology =
  "open" | "single" | "single-b" | "series" | "parallel";
export type CircuitGoal = NonNullable<Station["circuit"]>["goal"];

export interface CircuitInput {
  topology: CircuitTopology;
  voltage: number;
  resistance: number;
  /** A failed lamp is an open circuit, not a short circuit. */
  brokenLamp?: "a" | "b" | null;
}

export interface LampState {
  on: boolean;
  current: number;
  power: number;
}

export interface CircuitResult {
  lampA: LampState;
  lampB: LampState;
  totalCurrent: number;
  explanation: string;
}

export const CIRCUIT_ASSUMPTIONS =
  "Ideal constant-voltage source, wires with negligible resistance, and identical fixed-resistance lamps. A broken lamp opens its branch. Brightness is represented by electrical power; real lamps and batteries behave differently.";

function lamp(current: number, resistance: number): LampState {
  const power = current * current * resistance;
  if (!Number.isFinite(current) || !Number.isFinite(power)) {
    throw new RangeError("Circuit values exceed the supported numeric range.");
  }
  return { on: current > 0, current, power };
}

/** Reviewed electrical behavior stays deterministic and independent of generated prose. */
export function simulateCircuit({
  topology,
  voltage,
  resistance,
  brokenLamp = null,
}: CircuitInput): CircuitResult {
  if (!Number.isFinite(voltage) || voltage < 0) {
    throw new RangeError("Voltage must be finite and nonnegative.");
  }
  if (!Number.isFinite(resistance) || resistance <= 0) {
    throw new RangeError("Lamp resistance must be finite and positive.");
  }
  if (
    !["open", "single", "single-b", "series", "parallel"].includes(topology)
  ) {
    throw new TypeError("Unknown circuit topology.");
  }
  if (brokenLamp !== null && brokenLamp !== "a" && brokenLamp !== "b") {
    throw new TypeError("The broken lamp must be A, B, or none.");
  }

  const dark = () => lamp(0, resistance);
  if (topology === "open") {
    return {
      lampA: dark(),
      lampB: dark(),
      totalCurrent: 0,
      explanation:
        "The gap interrupts the conducting loop. Neither lamp carries a steady current.",
    };
  }
  if (voltage === 0) {
    return {
      lampA: dark(),
      lampB: dark(),
      totalCurrent: 0,
      explanation:
        "The source supplies no voltage difference, so no current flows through the lamps.",
    };
  }
  if (topology === "single" || topology === "single-b") {
    const connected = topology === "single" ? "a" : "b";
    const isBroken = brokenLamp === connected;
    const powered = isBroken ? dark() : lamp(voltage / resistance, resistance);
    const lampA = connected === "a" ? powered : dark();
    const lampB = connected === "b" ? powered : dark();
    return {
      lampA,
      lampB,
      totalCurrent: powered.current,
      explanation: isBroken
        ? `Lamp ${connected.toUpperCase()} is open, interrupting its only conducting loop.`
        : `Lamp ${connected.toUpperCase()} completes a loop across the source and receives its full voltage. The other lamp has no voltage across it.`,
    };
  }
  if (topology === "series") {
    if (brokenLamp !== null) {
      return {
        lampA: dark(),
        lampB: dark(),
        totalCurrent: 0,
        explanation: `Lamp ${brokenLamp.toUpperCase()} opens the only path. Both lamps go dark because they share that path.`,
      };
    }
    const current = voltage / resistance / 2;
    return {
      lampA: lamp(current, resistance),
      lampB: lamp(current, resistance),
      totalCurrent: current,
      explanation:
        "Both lamps share one path and carry the same current. Each identical lamp has half the source voltage and one quarter of the power it has alone.",
    };
  }

  const lampA =
    brokenLamp === "a" ? dark() : lamp(voltage / resistance, resistance);
  const lampB =
    brokenLamp === "b" ? dark() : lamp(voltage / resistance, resistance);
  const totalCurrent = lampA.current + lampB.current;
  if (!Number.isFinite(totalCurrent)) {
    throw new RangeError("Circuit values exceed the supported numeric range.");
  }
  return {
    lampA,
    lampB,
    totalCurrent,
    explanation:
      brokenLamp === null
        ? "Each lamp has its own path across the source and receives its full voltage. The source current is the sum of both branch currents."
        : `Lamp ${brokenLamp.toUpperCase()}'s branch is open. The other lamp still has a complete path and keeps the same power with this ideal source.`,
  };
}

/** Arrangement check only; a lit or resilience requirement also needs a simulation. */
export function satisfiesCircuitGoal(
  goal: CircuitGoal,
  topology: CircuitTopology,
): boolean {
  return goal === "closed" ? topology === "single" : goal === topology;
}

/** Checks the actual experiment, including the two-lamp failure trial for parallel. */
export function evaluateCircuitGoal(
  goal: CircuitGoal,
  input: CircuitInput,
): boolean {
  if (!satisfiesCircuitGoal(goal, input.topology)) return false;
  const result = simulateCircuit(input);
  if (goal === "closed") return result.lampA.on;
  if (goal === "series") return result.lampA.on && result.lampB.on;
  if (input.brokenLamp === "a") return !result.lampA.on && result.lampB.on;
  if (input.brokenLamp === "b") return result.lampA.on && !result.lampB.on;
  return false;
}
