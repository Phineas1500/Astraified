import { describe, expect, it } from "vitest";
import {
  evaluateCircuitGoal,
  satisfiesCircuitGoal,
  simulateCircuit,
  type CircuitTopology,
} from "../src/domain/circuits";
import { referenceMission } from "../src/domain/reference";
import {
  shortestRoute,
  validateRoute,
  type RoutingGraph,
} from "../src/domain/routing";
import { classifyWiring, type Terminal, type Wire } from "../src/domain/wiring";

describe("ideal resistive lamp circuits", () => {
  const supply = { voltage: 12, resistance: 12 };

  it("a disconnected loop carries no current despite a charged source", () => {
    const result = simulateCircuit({ ...supply, topology: "open" });
    expect(result.totalCurrent).toBe(0);
    expect(result.lampA).toEqual({ on: false, current: 0, power: 0 });
    expect(result.lampB).toEqual({ on: false, current: 0, power: 0 });
  });

  it("a closed single-lamp loop gives the connected lamp the full source voltage", () => {
    const result = simulateCircuit({ ...supply, topology: "single" });
    expect(result.lampA).toEqual({ on: true, current: 1, power: 12 });
    expect(result.lampB.on).toBe(false);
    expect(result.totalCurrent).toBe(1);
  });

  it("two identical series lamps carry the same current at one quarter of the single-lamp power each", () => {
    const single = simulateCircuit({ ...supply, topology: "single" });
    const series = simulateCircuit({ ...supply, topology: "series" });
    expect(series.lampA.current).toBe(0.5);
    expect(series.lampB.current).toBe(series.lampA.current);
    expect(series.totalCurrent).toBe(series.lampA.current);
    expect(series.lampA.power).toBe(single.lampA.power / 4);
    expect(series.lampB.power).toBe(series.lampA.power);
  });

  it.each(["a", "b"] as const)(
    "opening lamp %s interrupts the whole series path",
    (brokenLamp) => {
      const result = simulateCircuit({
        ...supply,
        topology: "series",
        brokenLamp,
      });
      expect(result.totalCurrent).toBe(0);
      expect(result.lampA.on || result.lampB.on).toBe(false);
    },
  );

  it.each(["a", "b"] as const)(
    "opening parallel lamp %s preserves the other lamp’s power",
    (brokenLamp) => {
      const before = simulateCircuit({ ...supply, topology: "parallel" });
      const after = simulateCircuit({
        ...supply,
        topology: "parallel",
        brokenLamp,
      });
      const open = brokenLamp === "a" ? after.lampA : after.lampB;
      const intact = brokenLamp === "a" ? after.lampB : after.lampA;
      expect(open).toEqual({ on: false, current: 0, power: 0 });
      expect(intact.power).toBe(before.lampA.power);
      expect(after.totalCurrent).toBe(before.totalCurrent / 2);
    },
  );

  it.each([
    "open",
    "single",
    "single-b",
    "series",
    "parallel",
  ] as CircuitTopology[])(
    "conserves electrical power for %s circuits",
    (topology) => {
      for (const voltage of [3, 9, 12, 24]) {
        for (const resistance of [2, 12, 37.5]) {
          for (const brokenLamp of [null, "a", "b"] as const) {
            const result = simulateCircuit({
              topology,
              voltage,
              resistance,
              brokenLamp,
            });
            expect(result.lampA.power + result.lampB.power).toBeCloseTo(
              voltage * result.totalCurrent,
              10,
            );
          }
        }
      }
    },
  );

  it("models B-only power without pretending lamp A is connected", () => {
    const result = simulateCircuit({ ...supply, topology: "single-b" });
    expect(result.lampA).toEqual({ on: false, current: 0, power: 0 });
    expect(result.lampB).toEqual({ on: true, current: 1, power: 12 });
    expect(
      simulateCircuit({ ...supply, topology: "single-b", brokenLamp: "a" })
        .lampB.on,
    ).toBe(true);
    expect(
      simulateCircuit({ ...supply, topology: "single-b", brokenLamp: "b" })
        .lampB.on,
    ).toBe(false);
  });

  it("does not light a closed circuit when the source voltage is zero", () => {
    const input = { ...supply, topology: "single" as const, voltage: 0 };
    expect(simulateCircuit(input).lampA.on).toBe(false);
    expect(evaluateCircuitGoal("closed", input)).toBe(false);
  });

  it("requires a successful failure experiment for the resilience goal", () => {
    expect(satisfiesCircuitGoal("parallel", "parallel")).toBe(true);
    expect(
      evaluateCircuitGoal("parallel", { ...supply, topology: "parallel" }),
    ).toBe(false);
    expect(
      evaluateCircuitGoal("parallel", {
        ...supply,
        topology: "parallel",
        brokenLamp: "a",
      }),
    ).toBe(true);
    expect(
      evaluateCircuitGoal("parallel", {
        ...supply,
        topology: "series",
        brokenLamp: "a",
      }),
    ).toBe(false);
    expect(
      evaluateCircuitGoal("series", {
        ...supply,
        topology: "series",
        brokenLamp: "b",
      }),
    ).toBe(false);
  });

  it("rejects invalid source or component values before they become game feedback", () => {
    for (const voltage of [-1, NaN, Infinity]) {
      expect(() =>
        simulateCircuit({ ...supply, topology: "single", voltage }),
      ).toThrow(RangeError);
    }
    for (const resistance of [0, -1, NaN, Infinity]) {
      expect(() =>
        simulateCircuit({ ...supply, topology: "parallel", resistance }),
      ).toThrow(RangeError);
    }
    expect(() =>
      simulateCircuit({
        topology: "parallel",
        voltage: Number.MAX_VALUE,
        resistance: 1,
      }),
    ).toThrow(RangeError);
  });
});

describe("free-form wire connectivity", () => {
  const reverse = (wires: Wire[]): Wire[] =>
    wires.map(([from, to]) => [to, from]);
  const aSingle: Wire[] = [
    ["p", "a1"],
    ["a2", "n"],
  ];
  const series: Wire[] = [
    ["p", "a1"],
    ["a2", "b1"],
    ["b2", "n"],
  ];
  const parallel: Wire[] = [
    ["p", "a1"],
    ["a1", "b1"],
    ["b2", "a2"],
    ["a2", "n"],
  ];

  it("recognizes single, series, and parallel independently of wire entry direction", () => {
    for (const [wires, topology] of [
      [aSingle, "single"],
      [series, "series"],
      [parallel, "parallel"],
    ] as const) {
      expect(classifyWiring(wires, false)).toMatchObject({
        topology,
        shorted: false,
      });
      expect(classifyWiring(reverse(wires).reverse(), false)).toMatchObject({
        topology,
        shorted: false,
      });
    }
  });

  it("recognizes series after reversing either lamp or swapping the lamp order", () => {
    const arrangements: Wire[][] = [
      [
        ["p", "a2"],
        ["a1", "b1"],
        ["b2", "n"],
      ],
      [
        ["p", "a1"],
        ["a2", "b2"],
        ["b1", "n"],
      ],
      [
        ["p", "b1"],
        ["b2", "a1"],
        ["a2", "n"],
      ],
      [
        ["n", "b2"],
        ["b1", "a2"],
        ["a1", "p"],
      ],
    ];
    for (const wires of arrangements)
      expect(classifyWiring(wires, false).topology).toBe("series");
  });

  it("classifies shared junctions, redundant wires, and reversed lamp orientations", () => {
    const wires: Wire[] = [
      ["p", "a2"],
      ["a2", "b1"],
      ["p", "b1"],
      ["n", "b2"],
      ["b2", "a1"],
    ];
    expect(classifyWiring(wires, false).topology).toBe("parallel");
    expect(classifyWiring([...wires, ["a2", "p"]], false).topology).toBe(
      "parallel",
    );
  });

  it("detects a supply short even through several intermediate wire junctions", () => {
    expect(classifyWiring([["p", "n"]], false).shorted).toBe(true);
    expect(
      classifyWiring([...series, ["a1", "a2"], ["b1", "b2"]], false),
    ).toMatchObject({ topology: "open", shorted: true });
    expect(classifyWiring([...parallel, ["a1", "a2"]], false).shorted).toBe(
      true,
    );
  });

  it("models a bypassed lamp as off while the other receives the source voltage", () => {
    const wires: Wire[] = [...series, ["a1", "a2"]];
    const result = classifyWiring(wires, false);
    expect(result).toMatchObject({ topology: "single-b", shorted: false });
    const simulation = simulateCircuit({
      topology: result.topology,
      voltage: 12,
      resistance: 12,
    });
    expect(simulation.lampA.power).toBe(0);
    expect(simulation.lampB.power).toBe(12);
  });

  it("does not mistake dangling branches, unattached loops, or only one source connection for closed circuits", () => {
    const openWires: Wire[][] = [
      [],
      [["p", "a1"]],
      [
        ["p", "a1"],
        ["a2", "b1"],
      ],
      [
        ["a1", "b1"],
        ["a2", "b2"],
      ],
      [
        ["p", "a1"],
        ["a2", "p"],
      ],
    ];
    for (const wires of openWires)
      expect(classifyWiring(wires, false)).toMatchObject({
        topology: "open",
        shorted: false,
      });
    expect(classifyWiring([...aSingle, ["p", "b1"]], false).topology).toBe(
      "single",
    );
  });

  it("omits lamp B from the single-lamp station", () => {
    expect(classifyWiring(aSingle, true).topology).toBe("single");
    expect(classifyWiring(series, true).topology).toBe("open");
    expect(
      classifyWiring(
        [
          ["p", "b1"],
          ["b2", "n"],
        ],
        true,
      ).topology,
    ).toBe("open");
  });

  it("rejects malformed wires instead of interpreting them as meaningful electrical connections", () => {
    expect(() => classifyWiring([["p", "p"]], false)).toThrow(TypeError);
    expect(() => classifyWiring([["p", "unknown" as Terminal]], false)).toThrow(
      TypeError,
    );
    expect(() => classifyWiring([["p"] as unknown as Wire], false)).toThrow(
      TypeError,
    );
  });
});

describe("reference mission source and progression integrity", () => {
  it("every objective and station resolves to actual educational source text", () => {
    const sources = new Map(
      referenceMission.sources.map((source) => [source.id, source]),
    );
    expect(sources.size).toBe(referenceMission.sources.length);
    for (const item of [
      ...referenceMission.objectives,
      ...referenceMission.stations,
    ]) {
      expect(item.sourceIds.length).toBeGreaterThan(0);
      for (const id of item.sourceIds) {
        expect(sources.get(id)?.text.length).toBeGreaterThan(30);
        expect(sources.get(id)?.url).toMatch(/^https:\/\/openstax\.org\//);
      }
    }
    expect(referenceMission.generated).toBe(false);
  });

  it("has three achievable experiments and complete explanation checks", () => {
    expect(referenceMission.stations.map((station) => station.id)).toEqual([
      "workshop",
      "relay",
      "beacon",
    ]);
    expect(
      referenceMission.stations.map((station) => station.circuit?.goal),
    ).toEqual(["closed", "series", "parallel"]);
    for (const station of referenceMission.stations) {
      expect(station.hints).toHaveLength(3);
      expect(station.check.options[station.check.answer]).toBeTruthy();
      expect(station.check.explanation.length).toBeGreaterThan(30);
      const circuit = station.circuit!;
      const topology = circuit.goal === "closed" ? "single" : circuit.goal;
      expect(
        evaluateCircuitGoal(circuit.goal, {
          topology,
          voltage: circuit.voltage,
          resistance: circuit.resistance,
          brokenLamp: topology === "parallel" ? "b" : null,
        }),
      ).toBe(true);
    }
  });
});

describe("weighted route experiments", () => {
  const graph: RoutingGraph = {
    nodes: ["Dock", "Market", "Bridge", "Tower"],
    edges: [
      { from: "Dock", to: "Tower", weight: 12 },
      { from: "Dock", to: "Market", weight: 2 },
      { from: "Market", to: "Bridge", weight: 2 },
      { from: "Bridge", to: "Tower", weight: 3 },
      { from: "Market", to: "Tower", weight: 7 },
    ],
    start: "Dock",
    end: "Tower",
  };

  it("chooses lowest total cost rather than the fewest hops", () => {
    expect(shortestRoute(graph)).toEqual({
      path: ["Dock", "Market", "Bridge", "Tower"],
      cost: 7,
    });
    expect(validateRoute(graph, ["Dock", "Tower"])).toMatchObject({
      valid: true,
      optimal: false,
      cost: 12,
      optimalCost: 7,
    });
    expect(
      validateRoute(graph, ["Dock", "Market", "Bridge", "Tower"]),
    ).toMatchObject({ valid: true, optimal: true, cost: 7 });
  });

  it("treats each map path as traversable in either direction", () => {
    const reversed = { ...graph, start: "Tower", end: "Dock" };
    expect(shortestRoute(reversed)?.cost).toBe(7);
    expect(
      validateRoute(reversed, ["Tower", "Bridge", "Market", "Dock"]).optimal,
    ).toBe(true);
  });

  it("rejects teleporting, unfinished paths, and the wrong starting point", () => {
    for (const path of [
      [],
      ["Dock", "Bridge", "Tower"],
      ["Dock", "Market"],
      ["Market", "Tower"],
    ]) {
      expect(validateRoute(graph, path).valid).toBe(false);
    }
  });

  it("accepts equivalent optimal routes, including zero-cost edges", () => {
    const ties: RoutingGraph = {
      nodes: ["A", "B", "C", "D"],
      edges: [
        { from: "A", to: "B", weight: 0 },
        { from: "B", to: "D", weight: 2 },
        { from: "A", to: "C", weight: 1 },
        { from: "C", to: "D", weight: 1 },
      ],
      start: "A",
      end: "D",
    };
    expect(validateRoute(ties, ["A", "B", "D"]).optimal).toBe(true);
    expect(validateRoute(ties, ["A", "C", "D"]).optimal).toBe(true);
  });

  it("returns no route for disconnected destinations and a zero-cost route to the starting point", () => {
    expect(
      shortestRoute({ nodes: ["A", "B"], edges: [], start: "A", end: "B" }),
    ).toBeNull();
    expect(
      shortestRoute({ nodes: ["A"], edges: [], start: "A", end: "A" }),
    ).toEqual({ path: ["A"], cost: 0 });
  });

  it("rejects graph values that would invalidate shortest-path reasoning", () => {
    expect(() =>
      shortestRoute({
        ...graph,
        edges: [{ from: "Dock", to: "Tower", weight: -2 }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      shortestRoute({
        ...graph,
        edges: [{ from: "Dock", to: "Unknown", weight: 2 }],
      }),
    ).toThrow(TypeError);
    expect(() =>
      shortestRoute({
        ...graph,
        edges: [...graph.edges, { from: "Tower", to: "Dock", weight: 5 }],
      }),
    ).toThrow(TypeError);
  });
});
