import { describe, expect, it } from "vitest";
import {
  G,
  HISTORY_LIMIT,
  POSTCARD_IDS,
  SAVE_KEY,
  balance,
  deserialize,
  initialState,
  reduceGame,
  serialize,
  torqueNm,
  type GameAction,
  type WindpostState,
} from "../src/windpost/model";

const act = (state: WindpostState, ...actions: GameAction[]) =>
  actions.reduce(reduceGame, state);
const openedBridge = () =>
  act(
    initialState(),
    { type: "talk-moss" },
    { type: "pickup", item: "bridge-weight" },
    { type: "place", mechanism: "bridge", slot: 2 },
    { type: "activate", mechanism: "bridge" },
  );
const raisedLift = () =>
  act(
    openedBridge(),
    { type: "talk-bea" },
    { type: "pickup", item: "lift-weight" },
    { type: "place", mechanism: "lift", slot: 3 },
    { type: "activate", mechanism: "lift" },
  );
const completedDelivery = () =>
  act(raisedLift(), { type: "pickup", item: "parcel" }, { type: "deliver" });
const rawState = (state: unknown, version = 2) =>
  JSON.stringify({ version, state });

describe("Windpost's authored torque puzzles", () => {
  it("uses force in newtons and perpendicular arm in meters, rather than labeling kg·m as torque", () => {
    expect(G).toBe(9.81);
    expect(torqueNm(2, 2)).toBeCloseTo(39.24, 10);
    expect(torqueNm(4, 1)).toBeCloseTo(torqueNm(2, 2), 10);
    expect(balance("bridge", 2)).toEqual({
      leftTorqueNm: 39.24,
      rightTorqueNm: 39.24,
      balanced: true,
      direction: "balanced",
    });
    expect(balance("bridge", 1).direction).toBe("left");
    expect(balance("bridge", 3).direction).toBe("right");
    expect(balance("lift", 2).balanced).toBe(false);
    expect(balance("lift", 3).balanced).toBe(true);
    expect(balance("lift", null).rightTorqueNm).toBe(0);
  });

  it("requires physically placing a weight and operating the mechanism before the route opens", () => {
    const carried = act(
      initialState(),
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
    );
    expect(carried.carrying).toBe("bridge-weight");
    const wrong = act(
      carried,
      { type: "place", mechanism: "bridge", slot: 1 },
      { type: "activate", mechanism: "bridge" },
    );
    expect(wrong.bridgeOpen).toBe(false);
    expect(wrong.trials.at(-1)).toMatchObject({
      mechanism: "bridge",
      slot: 1,
      balanced: false,
      hints: 0,
    });
    const balanced = act(
      wrong,
      { type: "retrieve", mechanism: "bridge" },
      { type: "place", mechanism: "bridge", slot: 2 },
    );
    expect(balanced.bridgeOpen).toBe(false);
    expect(balanced.carrying).toBeNull();
    const opened = reduceGame(balanced, {
      type: "activate",
      mechanism: "bridge",
    });
    expect(opened.bridgeOpen).toBe(true);
    expect(opened.trials.at(-1)).toMatchObject({
      mechanism: "bridge",
      slot: 2,
      balanced: true,
    });
    expect(deserialize(serialize(opened))).toEqual(opened);
  });

  it("transfers the same counterweight to a heavier load with a different required arm", () => {
    const copied = act(
      openedBridge(),
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 2 },
      { type: "activate", mechanism: "lift" },
    );
    expect(copied.bridgeOpen).toBe(true);
    expect(copied.liftRaised).toBe(false);
    expect(copied.trials.at(-1)).toMatchObject({
      mechanism: "lift",
      slot: 2,
      balanced: false,
      leftTorqueNm: 58.86,
      rightTorqueNm: 39.24,
    });
    const solved = act(
      copied,
      { type: "hint" },
      { type: "retrieve", mechanism: "lift" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
    );
    expect(solved.liftRaised).toBe(true);
    expect(solved.trials.at(-1)).toMatchObject({ balanced: true, hints: 1 });
    const carrying = reduceGame(solved, { type: "pickup", item: "parcel" });
    expect(carrying.delivered).toBe(false);
    expect(carrying.parcelCollected).toBe(true);
    const delivered = reduceGame(carrying, { type: "deliver" });
    expect(delivered.delivered).toBe(true);
    expect(delivered.carrying).toBeNull();
    expect(delivered.postcards).toEqual([]);
  });

  it("prevents out-of-order actions and carrying multiple or incorrect items", () => {
    const fresh = initialState();
    for (const action of [
      { type: "talk-bea" },
      { type: "pickup", item: "bridge-weight" },
      { type: "pickup", item: "lift-weight" },
      { type: "pickup", item: "parcel" },
      { type: "activate", mechanism: "bridge" },
      { type: "deliver" },
    ] satisfies GameAction[])
      expect(reduceGame(fresh, action)).toBe(fresh);
    const weight = act(
      fresh,
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
    );
    expect(reduceGame(weight, { type: "pickup", item: "lift-weight" })).toBe(
      weight,
    );
    expect(
      reduceGame(weight, { type: "place", mechanism: "lift", slot: 3 }),
    ).toBe(weight);
    expect(
      reduceGame(weight, {
        type: "place",
        mechanism: "bridge",
        slot: NaN,
      } as GameAction),
    ).toBe(weight);
    expect(
      reduceGame(weight, {
        type: "place",
        mechanism: "bridge",
        slot: 1.5,
      } as unknown as GameAction),
    ).toBe(weight);
    const placed = reduceGame(weight, {
      type: "place",
      mechanism: "bridge",
      slot: 1,
    });
    expect(reduceGame(placed, { type: "pickup", item: "bridge-weight" })).toBe(
      placed,
    );
    expect(weight.bridgeSlot).toBeNull(); // Earlier states are not mutated.
  });

  it("locks solved weights and preserves the bridge and lift after use", () => {
    const solved = raisedLift();
    for (const action of [
      { type: "retrieve", mechanism: "bridge" },
      { type: "retrieve", mechanism: "lift" },
      { type: "pickup", item: "bridge-weight" },
      { type: "pickup", item: "lift-weight" },
      { type: "activate", mechanism: "bridge" },
      { type: "activate", mechanism: "lift" },
    ] satisfies GameAction[])
      expect(reduceGame(solved, action)).toBe(solved);
    const complete = act(
      solved,
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
      { type: "drop" },
    );
    expect(complete.bridgeOpen && complete.liftRaised).toBe(true);
    expect(complete.bridgeSlot).toBe(2);
    expect(complete.liftSlot).toBe(3);
    expect(complete.trials).toHaveLength(2);
  });

  it("returns dropped objects to their source without duplicating them or stranding the parcel", () => {
    const carriedWeight = act(
      initialState(),
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
    );
    const droppedWeight = reduceGame(carriedWeight, { type: "drop" });
    expect(droppedWeight.carrying).toBeNull();
    expect(droppedWeight.bridgeSlot).toBeNull();
    expect(
      reduceGame(droppedWeight, { type: "pickup", item: "bridge-weight" }),
    ).toEqual(carriedWeight);
    const parcel = reduceGame(raisedLift(), { type: "pickup", item: "parcel" });
    const dropped = reduceGame(parcel, { type: "drop" });
    expect(dropped.parcelCollected).toBe(false);
    expect(dropped.liftRaised).toBe(true);
    expect(deserialize(serialize(dropped))).toEqual(dropped);
    expect(reduceGame(dropped, { type: "pickup", item: "parcel" })).toEqual(
      parcel,
    );
  });

  it("keeps optional postcard exploration and hint use separate from mission completion", () => {
    const complete = completedDelivery();
    expect(complete.delivered).toBe(true);
    expect(complete.postcards).toHaveLength(0);
    const allCards = POSTCARD_IDS.reduce(
      (state, id) => reduceGame(state, { type: "postcard", id }),
      complete,
    );
    expect(allCards.postcards).toHaveLength(3);
    expect(
      reduceGame(allCards, { type: "postcard", id: POSTCARD_IDS[0] }),
    ).toBe(allCards);
    expect(reduceGame(allCards, { type: "postcard", id: "invented" })).toBe(
      allCards,
    );
    const hinted = reduceGame(allCards, { type: "hint" });
    expect(hinted.hints).toBe(1);
    expect(hinted.trials.map((trial) => trial.hints)).toEqual([0, 0]);
    expect(deserialize(serialize(hinted))).toEqual(hinted);
  });

  it("rejects nonfinite, negative and unsupported physics parameters", () => {
    for (const invalid of [NaN, Infinity, -Infinity, -1]) {
      expect(() => torqueNm(invalid, 1)).toThrow(RangeError);
      expect(() => torqueNm(2, invalid)).toThrow(RangeError);
    }
    for (const slot of [undefined, NaN, Infinity, 0, -1, 1.5, 4, "2"]) {
      expect(() => balance("bridge", slot as never)).toThrow(RangeError);
    }
    expect(() => balance("other" as never, 1)).toThrow(RangeError);
    expect(torqueNm(0, 5)).toBe(0);
  });
});

describe("Windpost save recovery", () => {
  it("round-trips every meaningful quest/carry state with a separate versioned key", () => {
    expect(SAVE_KEY).toBe("astraified:windpost:authored-v1");
    expect(SAVE_KEY).not.toBe("astraified:first-light:authored-v1");
    let state = initialState();
    const actions: GameAction[] = [
      { type: "talk-moss" },
      { type: "pickup", item: "bridge-weight" },
      { type: "place", mechanism: "bridge", slot: 1 },
      { type: "activate", mechanism: "bridge" },
      { type: "retrieve", mechanism: "bridge" },
      { type: "place", mechanism: "bridge", slot: 2 },
      { type: "activate", mechanism: "bridge" },
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
      { type: "pickup", item: "parcel" },
      { type: "drop" },
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    ];
    expect(deserialize(serialize(state))).toEqual(state);
    for (const action of actions) {
      state = reduceGame(state, action);
      expect(deserialize(serialize(state))).toEqual(state);
    }
    expect(state.delivered).toBe(true);
  });

  it("retains earlier latch evidence when later failures exceed bounded history", () => {
    let state = act(
      openedBridge(),
      { type: "talk-bea" },
      { type: "pickup", item: "lift-weight" },
      { type: "place", mechanism: "lift", slot: 2 },
    );
    const original = state.trials[0];
    for (let index = 0; index < HISTORY_LIMIT * 3; index += 1)
      state = reduceGame(state, { type: "activate", mechanism: "lift" });
    expect(state.trials).toHaveLength(HISTORY_LIMIT);
    expect(state.trials[0]).toEqual(original);
    expect(deserialize(serialize(state))).toEqual(state);
    state = act(
      state,
      { type: "retrieve", mechanism: "lift" },
      { type: "place", mechanism: "lift", slot: 3 },
      { type: "activate", mechanism: "lift" },
      { type: "pickup", item: "parcel" },
      { type: "deliver" },
    );
    expect(state.trials).toHaveLength(HISTORY_LIMIT);
    expect(
      state.trials
        .filter((trial) => trial.balanced)
        .map((trial) => trial.mechanism),
    ).toEqual(["bridge", "lift"]);
    expect(deserialize(serialize(state)).delivered).toBe(true);
  });

  it("rejects malformed containers, numeric values, booleans and invented collections", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "{",
      "[]",
      "null",
      "{}",
      "x".repeat(100_001),
      rawState(initialState(), 3),
    ])
      expect(deserialize(raw)).toEqual(initialState());
    const valid = completedDelivery();
    const corruptions: unknown[] = [
      { ...valid, metMoss: 1 },
      { ...valid, delivered: "true" },
      { ...valid, bridgeSlot: 2.5 },
      { ...valid, bridgeSlot: "2" },
      { ...valid, liftSlot: Infinity },
      { ...valid, hints: 0.5 },
      { ...valid, hints: -1 },
      { ...valid, hints: 1000 },
      { ...valid, carrying: "a-new-item" },
      { ...valid, postcards: ["invented"] },
      { ...valid, postcards: ["harbor", "harbor"] },
      { ...valid, postcards: null },
      { ...valid, trials: [null] },
      {
        ...valid,
        trials: valid.trials.map((trial) => ({ ...trial, hints: 0.5 })),
      },
      {
        ...valid,
        trials: valid.trials.map((trial) => ({ ...trial, balanced: "true" })),
      },
      {
        ...valid,
        trials: valid.trials.map((trial) => ({ ...trial, rightTorqueNm: 0 })),
      },
    ];
    for (const corrupted of corruptions)
      expect(deserialize(rawState(corrupted))).toEqual(initialState());
    expect(
      deserialize(rawState(valid).replace('"hints":0', '"hints":1e400')),
    ).toEqual(initialState());
  });

  it("rejects impossible carrying, order, missing or fabricated solve evidence", () => {
    const opened = openedBridge();
    const lifted = raisedLift();
    const complete = completedDelivery();
    const inconsistent: WindpostState[] = [
      { ...opened, trials: [] },
      { ...opened, bridgeSlot: 1 },
      { ...opened, carrying: "bridge-weight" },
      { ...opened, metMoss: false },
      { ...initialState(), metBea: true },
      { ...initialState(), carrying: "bridge-weight" },
      { ...initialState(), liftSlot: 3 },
      { ...lifted, trials: lifted.trials.slice(1) },
      { ...lifted, trials: [...lifted.trials].reverse() },
      { ...lifted, liftRaised: false },
      { ...lifted, carrying: "lift-weight" },
      { ...lifted, parcelCollected: true },
      { ...lifted, carrying: "parcel", parcelCollected: false },
      { ...complete, liftRaised: false },
      { ...complete, carrying: "parcel" },
      {
        ...complete,
        trials: [lifted.trials[0], { ...lifted.trials[1], slot: 2 }],
      },
    ];
    for (const state of inconsistent) {
      expect(deserialize(rawState(state))).toEqual(initialState());
      expect(() => serialize(state)).toThrow(RangeError);
    }
  });
});
