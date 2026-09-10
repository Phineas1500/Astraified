import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  EPISODES,
  stationConfig,
  type EpisodeFixture,
} from "../src/windpost/episodes";
import {
  initialProgress,
  reduceEpisode,
  type EpisodeAction,
  type EpisodeProgress,
} from "../src/windpost/runtime";
import {
  clearProgress,
  loadProgress,
  progressKey,
  saveProgress,
  type ProgressStorage,
} from "../src/windpost/saves";

/**
 * Finite quest-logic proof for these two authored fixtures. It does not prove
 * geometry/navigation, learner strategy, pedagogy, or arbitrary math domains.
 * Every input choice, carry slot, quest latch, discovery, favor and observation
 * is retained. Hints and duplicate attempt details never gate quest actions;
 * attempt presence before an observation is retained because it gates capture.
 * The full concrete representative is saved and replayed at each graph node.
 */
function abstractKey(state: EpisodeProgress): string {
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
        trials.some((t) => t.mechanism === "bridge"),
      lift:
        observations.lift === null &&
        trials.some((t) => t.mechanism === "lift"),
    },
  });
}

function actionsFor(episode: EpisodeFixture): EpisodeAction[] {
  return [
    { type: "talk-moss" },
    { type: "talk-bea" },
    { type: "pickup", item: "bridge-weight" },
    { type: "pickup", item: "lift-weight" },
    { type: "pickup", item: "parcel" },
    ...(["bridge", "lift"] as const).flatMap((mechanism): EpisodeAction[] => [
      ...([1, 2, 3] as const).map((slot): EpisodeAction => ({
        type: "place",
        mechanism,
        slot,
      })),
      { type: "retrieve", mechanism },
      { type: "activate", mechanism },
      { type: "adjust", mechanism },
    ]),
    { type: "deliver" },
    ...episode.story.postcards.map(({ id }): EpisodeAction => ({
      type: "postcard",
      id,
    })),
    ...episode.discoveries.map(({ id }): EpisodeAction => ({
      type: "discover",
      id,
    })),
    { type: "return-postcard" },
    { type: "hint" },
    { type: "drop" },
    // Unknown optional IDs and valid actions used out of order must be harmless.
    { type: "postcard", id: "unknown-postcard" },
    { type: "discover", id: "unknown-discovery" },
  ];
}

function memoryStorage(): ProgressStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

type Node = {
  state: EpisodeProgress;
  predecessor: number | null;
  action: EpisodeAction | null;
};

function witness(nodes: Node[], index: number): string {
  const actions: EpisodeAction[] = [];
  let cursor: number | null = index;
  while (cursor !== null) {
    const node: Node = nodes[cursor];
    if (node.action) actions.push(node.action);
    cursor = node.predecessor;
  }
  return actions
    .reverse()
    .map((action) => JSON.stringify(action))
    .join(" → ");
}

function completedProgress(episode: EpisodeFixture): EpisodeProgress {
  let state = reduceEpisode(episode, initialProgress(episode), {
    type: "talk-moss",
  });
  for (const site of ["bridge", "lift"] as const) {
    if (site === "lift")
      state = reduceEpisode(episode, state, { type: "talk-bea" });
    const binding = episode.scene.stations[site];
    if (!binding.socketInput || !binding.socketValues) {
      throw new Error(
        "These two authored fixtures must retain their physical socket bindings.",
      );
    }
    const task = stationConfig(episode, site).tasks.find(
      (entry) => entry.id === binding.taskId,
    )!;
    const reference = Object.fromEntries(
      task.referenceInputs.map(({ id, value }) => [id, value]),
    );
    const socketValues = binding.socketValues;
    const socketInput = binding.socketInput;
    const slot = ([1, 2, 3] as const).find(
      (value) => socketValues[value - 1] === reference[socketInput],
    )!;
    state = reduceEpisode(episode, state, {
      type: "pickup",
      item: site === "bridge" ? "bridge-weight" : "lift-weight",
    });
    state = reduceEpisode(episode, state, {
      type: "place",
      mechanism: site,
      slot,
    });
    if (binding.prediction) {
      for (
        let i = 0;
        i < binding.prediction.values.length &&
        state.inputs[site][binding.prediction.inputId] !==
          reference[binding.prediction.inputId];
        i++
      ) {
        state = reduceEpisode(episode, state, {
          type: "adjust",
          mechanism: site,
        });
      }
    }
    state = reduceEpisode(episode, state, {
      type: "activate",
      mechanism: site,
    });
  }
  state = reduceEpisode(episode, state, { type: "pickup", item: "parcel" });
  state = reduceEpisode(episode, state, { type: "deliver" });
  for (const card of episode.story.postcards)
    state = reduceEpisode(episode, state, { type: "postcard", id: card.id });
  for (const discovery of episode.discoveries)
    state = reduceEpisode(episode, state, {
      type: "discover",
      id: discovery.id,
    });
  return reduceEpisode(episode, state, { type: "return-postcard" });
}

describe("authored harbor episode finite quest solvability", () => {
  for (const episode of EPISODES) {
    it(`${episode.id}: every reachable quest abstraction can finish and survives a save roundtrip`, () => {
      const first = initialProgress(episode);
      const nodes: Node[] = [{ state: first, predecessor: null, action: null }];
      const indices = new Map([[abstractKey(first), 0]]);
      const predecessors: number[][] = [[]];
      const delivered: number[] = [];
      const actions = actionsFor(episode);
      const storage = memoryStorage();
      const CAP = 50_000;
      const seenPredictionValues = {
        bridge: new Set<number>(),
        lift: new Set<number>(),
      };

      for (let cursor = 0; cursor < nodes.length; cursor++) {
        const state = nodes[cursor].state;
        const fail = (reason: string): never => {
          throw new Error(
            `${episode.id}: ${reason}\nWitness: ${witness(nodes, cursor)}\nState: ${abstractKey(state)}`,
          );
        };
        try {
          saveProgress(episode, state, storage);
          if (!isDeepStrictEqual(loadProgress(episode, storage), state))
            fail("Save roundtrip changed reachable progress");
        } catch (error) {
          fail(`Save rejected reachable progress: ${String(error)}`);
        }
        if (state.delivered) {
          delivered.push(cursor);
        }
        for (const site of ["bridge", "lift"] as const) {
          const prediction = episode.scene.stations[site].prediction;
          if (prediction)
            seenPredictionValues[site].add(
              state.inputs[site][prediction.inputId],
            );
        }
        const hinted = reduceEpisode(episode, state, { type: "hint" });
        const saturated = { ...state, hints: 999 };
        if (abstractKey(hinted) !== abstractKey(state))
          fail("A hint changed quest state");

        for (const action of actions) {
          const next = reduceEpisode(episode, state, action);
          const key = abstractKey(next);
          for (const variant of [hinted, saturated]) {
            const afterHint = reduceEpisode(episode, variant, action);
            if (
              (afterHint === variant) !== (next === state) ||
              abstractKey(afterHint) !== key
            ) {
              fail(
                `Hints changed the availability or result of ${JSON.stringify(action)}`,
              );
            }
          }
          if (state.delivered && !next.delivered)
            fail(`Delivery undone by ${JSON.stringify(action)}`);
          let destination = indices.get(key);
          if (destination === undefined) {
            if (nodes.length >= CAP)
              fail(
                `Abstraction exceeded ${CAP} states; check unbounded fields`,
              );
            destination = nodes.length;
            indices.set(key, destination);
            nodes.push({ state: next, predecessor: cursor, action });
            predecessors.push([]);
          }
          if (destination !== cursor) predecessors[destination].push(cursor);
        }
      }

      expect(delivered.length).toBeGreaterThan(0);
      // One reverse traversal covers all destinations, rather than solving from
      // every node independently. Self loops need no reverse edge.
      const reachesDelivery = new Set(delivered);
      const queue = [...delivered];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        for (const source of predecessors[queue[cursor]]) {
          if (!reachesDelivery.has(source)) {
            reachesDelivery.add(source);
            queue.push(source);
          }
        }
      }
      const stranded = nodes.findIndex(
        (_, index) => !reachesDelivery.has(index),
      );
      if (stranded !== -1) {
        throw new Error(
          `${episode.id}: stranded state\nWitness: ${witness(nodes, stranded)}\nState: ${abstractKey(nodes[stranded].state)}`,
        );
      }
      expect(reachesDelivery.size).toBe(nodes.length);
      expect(
        nodes.some(
          ({ state }) =>
            state.delivered &&
            state.postcardReturned &&
            state.postcards.length === episode.story.postcards.length &&
            state.discoveries.length === episode.discoveries.length,
        ),
      ).toBe(true);
      for (const site of ["bridge", "lift"] as const) {
        const prediction = episode.scene.stations[site].prediction;
        if (prediction)
          expect([...seenPredictionValues[site]].sort()).toEqual(
            [...prediction.values].sort(),
          );
      }
      console.info(
        `${episode.id}: ${nodes.length} reachable abstractions, ${delivered.length} completed; every state has a path to delivery.`,
      );
    }, 120_000);
  }

  it("keeps both completed saves isolated across switches, clears, revisions, and misplaced payloads", () => {
    expect(EPISODES).toHaveLength(2);
    const [first, second] = EPISODES;
    const firstComplete = completedProgress(first);
    const secondComplete = completedProgress(second);
    expect(firstComplete?.delivered).toBe(true);
    expect(secondComplete?.delivered).toBe(true);
    const storage = memoryStorage();
    expect(progressKey(first)).not.toBe(progressKey(second));

    saveProgress(first, firstComplete, storage);
    expect(loadProgress(second, storage)).toEqual(initialProgress(second));
    saveProgress(second, secondComplete, storage);
    expect(loadProgress(first, storage)).toEqual(firstComplete);
    expect(loadProgress(second, storage)).toEqual(secondComplete);
    expect(() =>
      reduceEpisode(second, firstComplete, { type: "talk-moss" }),
    ).toThrow();
    expect(() => saveProgress(second, firstComplete, storage)).toThrow();

    const laterRevision = { ...first, revision: first.revision + 1 };
    expect(progressKey(laterRevision)).not.toBe(progressKey(first));
    expect(loadProgress(laterRevision, storage)).toEqual(
      initialProgress(laterRevision),
    );
    clearProgress(first, storage);
    expect(loadProgress(first, storage)).toEqual(initialProgress(first));
    expect(loadProgress(second, storage)).toEqual(secondComplete);

    storage.setItem(progressKey(first), storage.getItem(progressKey(second))!);
    expect(loadProgress(first, storage)).toEqual(initialProgress(first));
    expect(loadProgress(second, storage)).toEqual(secondComplete);
  });
});
