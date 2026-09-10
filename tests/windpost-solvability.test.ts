import { describe, expect, it } from "vitest";
import {
  initialState,
  reduceGame,
  serialize,
  deserialize,
  type GameAction,
  type WindpostState,
} from "../src/windpost/model";

/**
 * Finite quest-logic proof, not a proof about geometry, navigation, learner
 * strategy, or the mathematical domain of arbitrary generated machines.
 * Hints and repeated attempt details do not gate quest actions. Observations
 * and whether an attempt predated an observation remain in the abstraction,
 * because they affect whether a real initial reading may still be recorded.
 */
function abstractKey(state: WindpostState): string {
  const { hints: _hints, trials, observations, ...quest } = state;
  return JSON.stringify({
    ...quest,
    postcards: [...state.postcards].sort(),
    discoveries: [...state.discoveries].sort(),
    observations: {
      bridge: observations.bridge !== null,
      lift: observations.lift !== null,
    },
    attemptedBeforeObservation: {
      bridge:
        observations.bridge === null &&
        trials.some((trial) => trial.mechanism === "bridge"),
      lift:
        observations.lift === null &&
        trials.some((trial) => trial.mechanism === "lift"),
    },
  });
}

// Includes invalid/out-of-order uses as well as the intended route: the model
// must make unavailable interactions harmless rather than strand the quest.
const ACTIONS: GameAction[] = [
  { type: "talk-moss" },
  { type: "talk-bea" },
  { type: "pickup", item: "bridge-weight" },
  { type: "pickup", item: "lift-weight" },
  { type: "pickup", item: "parcel" },
  { type: "place", mechanism: "bridge", slot: 1 },
  { type: "place", mechanism: "bridge", slot: 2 },
  { type: "place", mechanism: "bridge", slot: 3 },
  { type: "place", mechanism: "lift", slot: 1 },
  { type: "place", mechanism: "lift", slot: 2 },
  { type: "place", mechanism: "lift", slot: 3 },
  { type: "retrieve", mechanism: "bridge" },
  { type: "retrieve", mechanism: "lift" },
  { type: "activate", mechanism: "bridge" },
  { type: "activate", mechanism: "lift" },
  { type: "deliver" },
  { type: "postcard", id: "harbor" },
  { type: "postcard", id: "workshop" },
  { type: "postcard", id: "lookout" },
  { type: "discover", id: "workshop-sketch" },
  { type: "discover", id: "cargo-manifest" },
  { type: "return-postcard" },
  { type: "hint" },
  { type: "drop" },
];

type Node = {
  state: WindpostState;
  predecessor: number | null;
  action: GameAction | null;
};

function witness(nodes: Node[], index: number): string {
  const actions: GameAction[] = [];
  let current: number | null = index;
  while (current !== null) {
    const node: Node = nodes[current];
    if (node.action) actions.push(node.action);
    current = node.predecessor;
  }
  return actions
    .reverse()
    .map((action) => JSON.stringify(action))
    .join(" → ");
}

describe("Windpost finite quest solvability", () => {
  it("keeps a route to delivery from every reachable quest abstraction, regardless of optional actions", () => {
    const first = initialState();
    const nodes: Node[] = [{ state: first, predecessor: null, action: null }];
    const indices = new Map([[abstractKey(first), 0]]);
    const predecessors: number[][] = [[]];
    const delivered: number[] = [];
    const CAP = 50_000;

    for (let cursor = 0; cursor < nodes.length; cursor++) {
      const state = nodes[cursor].state;
      expect(deserialize(serialize(state))).toEqual(state);
      if (state.delivered) delivered.push(cursor);
      const hinted = reduceGame(state, { type: "hint" });
      expect(abstractKey(hinted)).toBe(abstractKey(state));

      for (const action of ACTIONS) {
        const next = reduceGame(state, action);
        const afterHint = reduceGame(hinted, action);
        // Hints cannot enable/disable a quest action or change its quest result.
        expect(afterHint === hinted).toBe(next === state);
        expect(abstractKey(afterHint)).toBe(abstractKey(next));

        if (state.delivered && !next.delivered) {
          throw new Error(
            `Delivery was undone by ${JSON.stringify(action)} after ${witness(nodes, cursor)}`,
          );
        }
        const key = abstractKey(next);
        let destination = indices.get(key);
        if (destination === undefined) {
          if (nodes.length >= CAP) {
            throw new Error(
              `Quest abstraction exceeded ${CAP} states. Check for an unbounded field in abstractKey.`,
            );
          }
          destination = nodes.length;
          indices.set(key, destination);
          nodes.push({ state: next, predecessor: cursor, action });
          predecessors.push([]);
        }
        if (destination !== cursor) predecessors[destination].push(cursor);
      }
    }

    expect(delivered.length).toBeGreaterThan(0);
    // Reverse traversal proves all states can reach some completed state in one
    // graph pass, rather than running a separate search from every state.
    const reachesDelivery = new Set(delivered);
    const reverseQueue = [...delivered];
    for (let cursor = 0; cursor < reverseQueue.length; cursor++) {
      for (const source of predecessors[reverseQueue[cursor]]) {
        if (!reachesDelivery.has(source)) {
          reachesDelivery.add(source);
          reverseQueue.push(source);
        }
      }
    }
    const stranded = nodes.findIndex((_, index) => !reachesDelivery.has(index));
    if (stranded !== -1) {
      throw new Error(
        `Quest state cannot reach delivery. Witness: ${witness(nodes, stranded)}\nState: ${abstractKey(nodes[stranded].state)}`,
      );
    }
    expect(reachesDelivery.size).toBe(nodes.length);
    expect(nodes.some(({ state }) => state.postcardReturned)).toBe(true);
    expect(
      nodes.some(
        ({ state }) =>
          state.delivered &&
          state.postcardReturned &&
          state.postcards.length === 3 &&
          state.discoveries.length === 2,
      ),
    ).toBe(true);
  }, 30_000);
});
