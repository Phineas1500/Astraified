import { describe, expect, it } from "vitest";
import {
  createInitialState,
  getHint,
  getHotspots,
  getObjective,
  parseSave,
  transition,
} from "../src/adventure/engine";
import { DISCOVERIES, ITEMS, ROOMS } from "../src/adventure/episode";
import type { AdventureAction, AdventureState } from "../src/adventure/model";

const move = (room: AdventureState["room"]): AdventureAction => ({
  type: "move",
  room,
});
const take = (target: string): AdventureAction => ({
  type: "interact",
  target,
});
const use = (
  item: AdventureState["inventory"][number],
  target: string,
): AdventureAction => ({ type: "interact", item, target });
const physical: AdventureAction[] = [
  move("workshop"),
  { type: "talk", character: "ada" },
  take("casing"),
  move("storeroom"),
  take("cell"),
  use("tester", "bulb"),
  move("workshop"),
  { type: "combine", a: "casing", b: "cell" },
  { type: "solve", puzzle: "lamp" },
  move("signalhouse"),
  use("lamp", "recess"),
];
const records: AdventureAction[] = [
  move("tearoom"),
  take("photograph"),
  move("workshop"),
  take("hook"),
  move("storeroom"),
  take("reel"),
  { type: "combine", a: "hook", b: "reel" },
  use("retriever", "cubby"),
  move("signalhouse"),
  use("photo", "tock"),
  use("record", "tock"),
];
const finale: AdventureAction[] = [
  move("signalhouse"),
  take("panel"),
  { type: "solve", puzzle: "signals" },
  move("storeroom"),
  take("lead"),
  move("lantern"),
  take("feeder"),
  { type: "solve", puzzle: "feeder" },
  move("jetty"),
  take("ferry"),
];
const favor: AdventureAction[] = [
  move("jetty"),
  use("retriever", "planks"),
  move("tearoom"),
  use("keepsake", "pip"),
  move("jetty"),
  use("memento", "button"),
];

function run(
  actions: AdventureAction[],
  state = transition(createInitialState(), { type: "start" }).state,
) {
  const snapshots = [state];
  for (const action of actions) {
    const result = transition(state, action);
    state = result.state;
    snapshots.push(state);
  }
  return { state, snapshots };
}

describe("Bramble Bay adventure", () => {
  it.each(["physical first", "records first"])(
    "completes with %s without a quiz or optional favor",
    (order) => {
      const { state, snapshots } = run([
        ...(order === "physical first"
          ? [...physical, ...records]
          : [...records, ...physical]),
        ...finale,
      ]);
      expect(state.completed).toBe(true);
      expect(state.flags).toMatchObject({
        workshopReady: true,
        lampBuilt: true,
        junctionSeen: true,
        recordRecovered: true,
        photoSeen: true,
        robotHelp: true,
        signalsFixed: true,
        feederFixed: true,
      });
      expect(state.flags.favorDone).not.toBe(true);
      expect(state.attempts).toBe(0);
      expect(state.inventory).toContain("tester");
      expect(state.inventory).toContain("retriever");
      expect(state.inventory).toContain("lead");
      expect(state.discoveries).toEqual(
        expect.arrayContaining([
          "loop",
          "photo",
          "record",
          "junction",
          "diagnosis",
          "parallel",
          "feeder",
          "verified",
        ]),
      );
      for (const snapshot of snapshots)
        expect(parseSave(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );

  it("permits the records lead before acquiring any electrical equipment", () => {
    const { state } = run(records);
    expect(state.flags.recordRecovered).toBe(true);
    expect(state.flags.photoPresented).toBe(true);
    expect(state.flags.recordPresented).toBe(true);
    expect(state.flags.workshopReady).not.toBe(true);
    expect(state.flags.robotHelp).not.toBe(true);
    expect(state.inventory).not.toContain("tester");
  });

  it("requires separate documentary evidence as well as the observed junction", () => {
    const state = run([...physical, ...records.slice(0, -2)]).state;
    const photo = transition(state, use("photo", "tock")).state;
    expect(photo.flags.robotHelp).not.toBe(true);
    expect(transition(photo, take("panel")).puzzle).toBeUndefined();
    const record = transition(photo, use("record", "tock")).state;
    expect(record.flags.robotHelp).toBe(true);
    expect(transition(record, take("panel")).puzzle).toBe("signals");
  });

  it("does not treat the documents or a good component as evidence of unseen physical wiring", () => {
    const beforeJunction = run([...records, ...physical.slice(0, -1)]).state;
    expect(beforeJunction.flags.photoPresented).toBe(true);
    expect(beforeJunction.flags.recordPresented).toBe(true);
    expect(beforeJunction.flags.robotHelp).not.toBe(true);
    expect(
      transition(beforeJunction, use("tester", "tock")).state.flags.robotHelp,
    ).not.toBe(true);
    expect(
      transition(beforeJunction, use("lamp", "recess")).state.flags.robotHelp,
    ).toBe(true);
  });

  it("requires a reference to retrieve the right record and leaves tools reusable", () => {
    const state = run([
      move("workshop"),
      take("hook"),
      move("storeroom"),
      take("reel"),
      { type: "combine", a: "reel", b: "hook" },
    ]).state;
    const guess = transition(state, use("retriever", "cubby"));
    expect(guess.state.flags.recordRecovered).not.toBe(true);
    expect(guess.dialogue?.lines.join(" ")).toMatch(/photograph/i);
    expect(guess.state.inventory).toContain("retriever");
    const found = run(
      [
        move("tearoom"),
        take("photograph"),
        move("storeroom"),
        use("retriever", "cubby"),
      ],
      guess.state,
    ).state;
    expect(found.inventory).toContain("retriever");
    expect(found.inventory).toContain("record");
  });

  it("makes the working component test meaningful and the broken module recoverable", () => {
    let state = run([
      move("workshop"),
      { type: "talk", character: "ada" },
      take("casing"),
      move("storeroom"),
      take("cell"),
      take("bulb"),
      take("broken-bulb"),
      move("workshop"),
    ]).state;
    expect(transition(state, take("workbench")).puzzle).toBeUndefined();
    const badAssembly = transition(state, {
      type: "combine",
      a: "casing",
      b: "broken-bulb",
    });
    expect(badAssembly.state.inventory).toEqual(state.inventory);
    state = transition(state, {
      type: "combine",
      a: "broken-bulb",
      b: "tester",
    }).state;
    expect(state.discoveries).toContain("brokenBulb");
    expect(state.flags.bulbTested).not.toBe(true);
    state = transition(state, {
      type: "combine",
      a: "bulb",
      b: "tester",
    }).state;
    const opened = transition(state, take("workbench"));
    expect(opened.puzzle).toBe("lamp");
    const built = transition(opened.state, {
      type: "solve",
      puzzle: "lamp",
    }).state;
    expect(built.inventory).toEqual(
      expect.arrayContaining(["lamp", "broken-bulb", "tester"]),
    );
    expect(built.inventory).not.toEqual(
      expect.arrayContaining(["casing", "cell", "bulb"]),
    );
    expect(parseSave(JSON.stringify(built))).toEqual(built);
  });

  it("combines the retrieval tool in either item order", () => {
    const state = run([
      move("workshop"),
      take("hook"),
      move("storeroom"),
      take("reel"),
    ]).state;
    const forward = transition(state, {
      type: "combine",
      a: "hook",
      b: "reel",
    }).state;
    const backward = transition(state, {
      type: "combine",
      a: "reel",
      b: "hook",
    }).state;
    expect(forward).toEqual(backward);
    expect(forward.inventory).toContain("retriever");
    expect(forward.inventory).not.toContain("hook");
    expect(forward.inventory).not.toContain("reel");
  });

  it("guards direct puzzle completion, wrong rooms, missing equipment, and final boarding", () => {
    const fresh = run([]).state;
    for (const puzzle of ["lamp", "signals", "feeder"] as const) {
      const result = transition(fresh, { type: "solve", puzzle });
      expect(result.state.completed).toBe(false);
      expect(result.state.attempts).toBe(1);
      expect(Object.values(result.state.flags)).not.toContain(true);
    }
    expect(transition(fresh, take("ferry")).state.completed).toBe(false);
    let state = run([...physical, ...records]).state;
    expect(
      transition(state, { type: "solve", puzzle: "signals" }).state.flags
        .signalsFixed,
    ).not.toBe(true);
    state = transition(state, take("panel")).state;
    expect(
      transition(transition(state, move("jetty")).state, {
        type: "solve",
        puzzle: "signals",
      }).state.flags.signalsFixed,
    ).not.toBe(true);
    state = transition(state, { type: "solve", puzzle: "signals" }).state;
    state = transition(state, move("lantern")).state;
    expect(transition(state, take("feeder")).puzzle).toBeUndefined();
    expect(
      transition(state, { type: "solve", puzzle: "feeder" }).state.flags
        .feederFixed,
    ).not.toBe(true);
    state = run(
      [move("storeroom"), take("lead"), move("lantern")],
      state,
    ).state;
    expect(transition(state, take("feeder")).puzzle).toBe("feeder");
  });

  it.each(["before", "after"])(
    "supports the optional favor and secret %s the ending",
    (when) => {
      const branches = [...records, ...physical];
      const { state, snapshots } = run(
        when === "before"
          ? [...branches, ...favor, ...finale]
          : [...branches, ...finale, ...favor],
      );
      expect(state.completed).toBe(true);
      expect(state.flags.favorDone).toBe(true);
      expect(state.flags.mementoOpened).toBe(true);
      expect(state.inventory).toContain("memento");
      expect(state.inventory).not.toContain("keepsake");
      expect(state.discoveries).toEqual(
        expect.arrayContaining(["favor", "secret"]),
      );
      expect(
        transition(state, {
          type: "inspect",
          item: "memento",
        }).dialogue?.lines.join(" "),
      ).toMatch(/captain/i);
      for (const snapshot of snapshots)
        expect(parseSave(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );

  it("never mutates input state and repeated success cannot duplicate inventory or discoveries", () => {
    const state = run([...physical, ...records, ...finale]).state;
    const before = JSON.stringify(state);
    const again = transition(state, take("ferry"));
    expect(JSON.stringify(state)).toBe(before);
    expect(again.state).toEqual(state);
    const repeated = transition(state, { type: "solve", puzzle: "lamp" }).state;
    expect(repeated).toEqual(state);
    const wrong = transition(state, use("memento", "button")).state;
    expect(wrong.inventory).toEqual(state.inventory);
    expect(wrong.attempts).toBe(state.attempts + 1);
    expect(getHotspots(state)).not.toBe(getHotspots(state));
  });

  it("gives specific playful responses without consuming unrelated items", () => {
    const state = run([
      move("workshop"),
      { type: "talk", character: "ada" },
      take("hook"),
      move("tearoom"),
    ]).state;
    const response = transition(state, use("tester", "teapot"));
    expect(response.dialogue?.lines.join(" ")).toMatch(/patience/);
    expect(response.state.inventory).toEqual(state.inventory);
    const combo = transition(state, {
      type: "combine",
      a: "tester",
      b: "hook",
    });
    expect(combo.state.inventory).toEqual(state.inventory);
    expect(
      transition(state, { type: "talk", character: "tock" }).state.flags
        .robotHelp,
    ).not.toBe(true);
  });

  it("offers state-specific hints while retaining both investigation leads", () => {
    const initial = run([]).state;
    expect(getHint(initial)).toMatch(/Ada.*photograph/);
    const recordsOnly = run(records).state;
    expect(getObjective(recordsOnly)).toMatch(/physical evidence/i);
    expect(getHint(recordsOnly)).toMatch(/Ada/);
    const physicalOnly = run(physical).state;
    expect(getHint(physicalOnly)).toMatch(/photograph/);
    expect(getObjective(physicalOnly)).toMatch(/repair record/i);
    const hinted = transition(physicalOnly, { type: "hint" });
    expect(hinted.state.hintsUsed).toBe(1);
    expect(hinted.state.flags).toEqual(physicalOnly.flags);
    expect(hinted.dialogue?.lines[0]).toBe(getHint(physicalOnly));
  });

  it("keeps all hotspot bounds and data references valid", () => {
    for (const room of Object.keys(ROOMS) as AdventureState["room"][]) {
      const state = { ...createInitialState(), room };
      const hotspots = getHotspots(state);
      expect(new Set(hotspots.map((spot) => spot.id)).size).toBe(
        hotspots.length,
      );
      for (const spot of hotspots) {
        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x + spot.w).toBeLessThanOrEqual(100);
        expect(spot.y + spot.h).toBeLessThanOrEqual(100);
        if (spot.item) expect(ITEMS[spot.item]).toBeDefined();
      }
      for (const destination of ROOMS[room].exits)
        expect(ROOMS[destination]).toBeDefined();
    }
    const state = run([...physical, ...records, ...finale, ...favor]).state;
    for (const discovery of state.discoveries)
      expect(DISCOVERIES[discovery]).toBeDefined();
  });

  it("preserves a path to completion after varied exploratory actions and misplaced tools", () => {
    // Deterministic exploratory traces exercise many orders without claiming an exhaustive state proof.
    let randomState = 0x5eed;
    const random = (max: number) => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState % max;
    };
    const rooms = Object.keys(ROOMS) as AdventureState["room"][];
    for (let trace = 0; trace < 50; trace += 1) {
      let state = run([]).state;
      for (let step = 0; step < 80; step += 1) {
        const choices: AdventureAction[] = [
          move(rooms[random(rooms.length)]),
          { type: "hint" },
        ];
        for (const spot of getHotspots(state)) {
          choices.push(take(spot.id));
          if (state.inventory.length)
            choices.push(
              use(state.inventory[random(state.inventory.length)], spot.id),
            );
        }
        if (state.inventory.length > 1)
          choices.push({
            type: "combine",
            a: state.inventory[random(state.inventory.length)],
            b: state.inventory[random(state.inventory.length)],
          });
        const result = transition(state, choices[random(choices.length)]);
        state = result.state;
        expect(parseSave(JSON.stringify(state))).toEqual(state);
      }
      const continued = run([...physical, ...records, ...finale], state).state;
      expect(continued.completed, `exploration trace ${trace}`).toBe(true);
      expect(parseSave(JSON.stringify(continued))).toEqual(continued);
    }
  });
});

describe("adventure save validation", () => {
  it("accepts the initial state and refuses malformed, incompatible, or oversized inputs", () => {
    expect(parseSave(JSON.stringify(createInitialState()))).toEqual(
      createInitialState(),
    );
    for (const raw of [null, "", "{", "null", "[]", "{}", "x".repeat(32_001)])
      expect(parseSave(raw)).toBeNull();
    const state = run([]).state;
    const corrupt: Record<string, unknown>[] = [
      { version: 2 },
      { room: "moon" },
      { room: "__proto__" },
      { visited: [] },
      { inventory: ["tester", "tester"] },
      { inventory: ["magic-key"] },
      { flags: { signalsFixed: "yes" } },
      { flags: { constructor: true } },
      { flags: { robotHelp: true } },
      { discoveries: ["invented-theorem"] },
      { attempts: -1 },
      { hintsUsed: 1.5 },
      { started: false },
      { completed: true },
      { inventory: ["tester"] },
      { inventory: ["lamp"] },
      { flags: { favorDone: true } },
      { flags: { feederFixed: true } },
    ];
    for (const change of corrupt)
      expect(
        parseSave(JSON.stringify({ ...state, ...change })),
        JSON.stringify(change),
      ).toBeNull();
  });

  it("rejects a save that loses a critical reusable object after its acquisition", () => {
    const state = run([...physical, ...records, ...finale]).state;
    for (const item of [
      "tester",
      "lamp",
      "retriever",
      "photo",
      "record",
      "lead",
    ]) {
      expect(
        parseSave(
          JSON.stringify({
            ...state,
            inventory: state.inventory.filter(
              (candidate) => candidate !== item,
            ),
          }),
        ),
      ).toBeNull();
    }
  });

  it("restarts cleanly and ignores interaction while the case has not started", () => {
    const completed = run([...physical, ...records, ...finale]).state;
    expect(transition(completed, { type: "restart" }).state).toEqual(
      createInitialState(),
    );
    expect(transition(createInitialState(), move("workshop")).state).toEqual(
      createInitialState(),
    );
    expect(
      transition(createInitialState(), take("casing")).state.inventory,
    ).toEqual([]);
  });
});
