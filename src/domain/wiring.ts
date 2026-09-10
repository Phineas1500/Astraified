import type { CircuitTopology } from "./circuits";

export type Terminal = "p" | "n" | "a1" | "a2" | "b1" | "b2";
export type Wire = [Terminal, Terminal];
export interface WiringResult {
  topology: CircuitTopology;
  shorted: boolean;
  feedback: string;
}

const TERMINALS: Terminal[] = ["p", "n", "a1", "a2", "b1", "b2"];

/**
 * Classifies electrical connectivity, irrespective of wire layout, orientation,
 * or intermediate junctions. Wires are ideal conductors; each lamp is a resistor.
 * singleLamp omits resistor B (its terminal labels may still act as wire junctions).
 */
export function classifyWiring(
  wires: Wire[],
  singleLamp: boolean,
): WiringResult {
  const parents = new Map<Terminal, Terminal>(
    TERMINALS.map((terminal) => [terminal, terminal]),
  );
  const find = (terminal: Terminal): Terminal => {
    const parent = parents.get(terminal)!;
    if (parent !== terminal) parents.set(terminal, find(parent));
    return parents.get(terminal)!;
  };
  for (const wire of wires) {
    if (
      !Array.isArray(wire) ||
      wire.length !== 2 ||
      !parents.has(wire[0]) ||
      !parents.has(wire[1])
    ) {
      throw new TypeError("Every wire must connect two known terminals.");
    }
    if (wire[0] === wire[1])
      throw new TypeError("A wire must join two different terminals.");
    parents.set(find(wire[0]), find(wire[1]));
  }

  const p = find("p");
  const n = find("n");
  if (p === n) {
    return {
      topology: "open",
      shorted: true,
      feedback:
        "The supply terminals are joined by wire without a lamp between them: a short circuit. Disconnect that bypass before testing. The ideal model does not calculate a finite short-circuit current.",
    };
  }

  const a: [Terminal, Terminal] = [find("a1"), find("a2")];
  const b: [Terminal, Terminal] = [find("b1"), find("b2")];
  const joins = (
    edge: [Terminal, Terminal],
    first: Terminal,
    second: Terminal,
  ): boolean =>
    first !== second &&
    ((edge[0] === first && edge[1] === second) ||
      (edge[0] === second && edge[1] === first));
  const aAcross = joins(a, p, n);
  const bAcross = !singleLamp && joins(b, p, n);
  if (aAcross && bAcross) {
    return {
      topology: "parallel",
      shorted: false,
      feedback:
        "Each lamp connects across the supply terminals on its own branch. This is a parallel circuit.",
    };
  }
  if (aAcross || bAcross) {
    return {
      topology: aAcross ? "single" : "single-b",
      shorted: false,
      feedback: `Lamp ${aAcross ? "A" : "B"} has a complete loop across the source.${singleLamp ? "" : " The other lamp has no voltage across it."}`,
    };
  }

  if (!singleLamp) {
    const junctions = new Set(TERMINALS.map(find));
    for (const middle of junctions) {
      if (middle === p || middle === n) continue;
      if (
        (joins(a, p, middle) && joins(b, middle, n)) ||
        (joins(b, p, middle) && joins(a, middle, n))
      ) {
        return {
          topology: "series",
          shorted: false,
          feedback:
            "One complete path passes through both lamps in turn. This is a series circuit.",
        };
      }
    }
  }
  return {
    topology: "open",
    shorted: false,
    feedback:
      "There is no complete path from one supply terminal, through a lamp, and back to the other. Trace the connections and find the gap.",
  };
}
