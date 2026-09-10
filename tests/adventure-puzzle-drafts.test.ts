import { describe, expect, it } from "vitest";
import {
  clearAdventurePuzzleDrafts,
  parseFeederDraft,
  parseWiringDraft,
  readPuzzleDraft,
  writePuzzleDraft,
} from "../src/adventure/puzzleDrafts";
import type { FeederDraft, WiringDraft } from "../src/adventure/puzzleDrafts";

const signals: WiringDraft = {
  version: 1,
  kind: "signals",
  wires: [
    ["p", "a1"],
    ["a2", "n"],
    ["p", "b1"],
    ["b2", "n"],
  ],
  selected: "b1",
  branchOpen: false,
  trialComplete: true,
  hintLevel: 2,
};
const feeder: FeederDraft = {
  version: 1,
  kind: "feeder",
  mode: "test",
  probed: ["source", "red", "feeder"],
  reading: "feeder",
  repaired: true,
  branchOpen: true,
  trialComplete: true,
  hintLevel: 1,
};
const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
};

describe("adventure puzzle recovery", () => {
  it("resumes a valid tested arrangement, selection, restored switch, and hints", () => {
    expect(parseWiringDraft(JSON.stringify(signals), "signals")).toEqual(
      signals,
    );
    const untested = { ...signals, trialComplete: false };
    expect(
      parseWiringDraft(JSON.stringify(untested), "signals")?.trialComplete,
    ).toBe(false);
  });
  it("invalidates a saved success after the electrical arrangement no longer passes", () => {
    for (const wires of [
      [],
      [["p", "n"]],
      [
        ["p", "a1"],
        ["a2", "b1"],
        ["b2", "n"],
      ],
      [
        ["p", "b1"],
        ["b2", "n"],
      ],
    ]) {
      expect(
        parseWiringDraft(JSON.stringify({ ...signals, wires }), "signals")
          ?.trialComplete,
      ).toBe(false);
    }
    const lamp = {
      ...signals,
      kind: "lamp",
      wires: [["p", "a1"]],
      selected: null,
    };
    expect(parseWiringDraft(JSON.stringify(lamp), "lamp")?.trialComplete).toBe(
      false,
    );
    expect(
      parseWiringDraft(
        JSON.stringify({
          ...lamp,
          wires: [
            ["p", "a1"],
            ["a2", "n"],
          ],
        }),
        "lamp",
      )?.trialComplete,
    ).toBe(true);
  });
  it("rejects malformed, oversized, wrong-version, and impossible wiring records", () => {
    for (const raw of [
      null,
      "{",
      "[]",
      " ".repeat(8_193),
      JSON.stringify({ ...signals, version: 2 }),
      JSON.stringify({ ...signals, selected: "battery" }),
      JSON.stringify({ ...signals, hintLevel: -1 }),
      JSON.stringify({ ...signals, branchOpen: "yes" }),
    ]) {
      expect(parseWiringDraft(raw, "signals")).toBeNull();
    }
    for (const wires of [
      [["p", "p"]],
      [["p", "unknown"]],
      [
        ["p", "a1"],
        ["a1", "p"],
      ],
      Array(16).fill(["p", "a1"]),
    ]) {
      expect(
        parseWiringDraft(JSON.stringify({ ...signals, wires }), "signals"),
      ).toBeNull();
    }
    expect(parseWiringDraft(JSON.stringify(signals), "lamp")).toBeNull();
  });
  it("preserves feeder diagnosis and trial evidence but cannot restore an unsubstantiated repair", () => {
    expect(parseFeederDraft(JSON.stringify(feeder))).toEqual(feeder);
    const unsupported = parseFeederDraft(
      JSON.stringify({ ...feeder, probed: ["feeder"], reading: "feeder" }),
    );
    expect(unsupported).toMatchObject({
      repaired: false,
      branchOpen: false,
      trialComplete: false,
    });
    expect(
      parseFeederDraft(JSON.stringify({ ...feeder, repaired: false }))
        ?.trialComplete,
    ).toBe(false);
    expect(
      parseFeederDraft(JSON.stringify({ ...feeder, trialComplete: false }))
        ?.trialComplete,
    ).toBe(false);
  });
  it("resumes selected repair mode and inspected pairs before the actual repair", () => {
    const pending: FeederDraft = {
      ...feeder,
      mode: "repair",
      repaired: false,
      branchOpen: false,
      trialComplete: false,
    };
    expect(parseFeederDraft(JSON.stringify(pending))).toEqual(pending);
    for (const invalid of [
      { ...feeder, probed: ["source", "source"] },
      { ...feeder, reading: "green" },
      { ...feeder, mode: ["test"] },
      { ...feeder, probed: ["fault"] },
    ]) {
      expect(parseFeederDraft(JSON.stringify(invalid))).toBeNull();
    }
  });
  it("clears only the three episode draft keys and tolerates denied or full storage", () => {
    const storage = memory();
    for (const kind of ["lamp", "signals", "feeder"])
      storage.setItem(`astraified:bramble:draft:${kind}`, "saved");
    storage.setItem("astraified:mission-library", "keep");
    clearAdventurePuzzleDrafts(storage);
    expect([...storage.data.entries()]).toEqual([
      ["astraified:mission-library", "keep"],
    ]);
    writePuzzleDraft("test", signals, storage);
    expect(
      parseWiringDraft(readPuzzleDraft("test", storage), "signals"),
    ).toEqual(signals);
    const unavailable = {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("full");
      },
      removeItem() {
        throw Error("denied");
      },
    };
    expect(readPuzzleDraft("test", unavailable)).toBeNull();
    expect(() => writePuzzleDraft("test", feeder, unavailable)).not.toThrow();
    expect(() => clearAdventurePuzzleDrafts(unavailable)).not.toThrow();
  });
});
