import { describe, expect, it } from "vitest";
import {
  addToLibrary,
  MAX_LIBRARY_CHARS,
  MAX_SAVED_MISSIONS,
  readSavedLibrary,
} from "../src/domain/library";
import { referenceMission } from "../src/domain/reference";
import type { MissionPackage } from "../src/domain/types";

function generated(id: string): MissionPackage {
  return {
    ...structuredClone(referenceMission),
    id,
    title: `Generated ${id}`,
    generated: true,
    generation: { model: "gpt-6-astra", createdAt: "2026-09-10T15:00:00.000Z" },
  };
}

describe("generated mission library", () => {
  it("migrates the current single saved generated mission even without a library", () => {
    const mission = generated("current");
    expect(readSavedLibrary(null, JSON.stringify(mission))).toEqual([mission]);
    expect(readSavedLibrary("{bad json", JSON.stringify(mission))).toEqual([
      mission,
    ]);
    expect(readSavedLibrary(null, JSON.stringify(referenceMission))).toEqual(
      [],
    );
  });

  it("keeps earlier worlds when playing a new mission or returning to the reference", () => {
    const first = generated("first"),
      second = generated("second");
    const history = addToLibrary(addToLibrary([], first), second);
    expect(history.map((mission) => mission.id)).toEqual(["second", "first"]);
    expect(addToLibrary(history, referenceMission)).toEqual(history);
    expect(
      readSavedLibrary(
        JSON.stringify(history),
        JSON.stringify(referenceMission),
      ),
    ).toEqual(history);
  });

  it("deduplicates by ID, refreshes its package, and promotes the latest play", () => {
    const first = generated("first"),
      second = generated("second");
    const revised = { ...first, title: "Revised first mission" };
    const updated = addToLibrary([second, first], revised);
    expect(updated).toEqual([revised, second]);
    expect(
      readSavedLibrary(
        JSON.stringify([second, first, first]),
        JSON.stringify(revised),
      ),
    ).toEqual(updated);
  });

  it("keeps the ten most recently played valid generated missions", () => {
    let history: MissionPackage[] = [];
    for (let index = 0; index < 12; index++)
      history = addToLibrary(history, generated(`mission-${index}`));
    expect(history).toHaveLength(MAX_SAVED_MISSIONS);
    expect(history.map((mission) => mission.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `mission-${11 - index}`),
    );
  });

  it("skips individual corrupted entries without discarding valid neighbors", () => {
    const first = generated("first"),
      second = generated("second");
    const broken = generated("broken");
    broken.stations[0].circuit!.resistance = 0;
    const raw = JSON.stringify([
      null,
      first,
      { generated: true, title: "Incomplete" },
      broken,
      false,
      referenceMission,
      second,
    ]);
    expect(readSavedLibrary(raw, "{broken-current")).toEqual([first, second]);
  });

  it("ignores unsupported root shapes and oversized raw saves while preserving migration", () => {
    const mission = generated("migration");
    for (const raw of [
      "null",
      "{}",
      "123",
      '"text"',
      "[".repeat(MAX_LIBRARY_CHARS + 1),
    ]) {
      expect(readSavedLibrary(raw)).toEqual([]);
      expect(readSavedLibrary(raw, JSON.stringify(mission))).toEqual([mission]);
    }
  });

  it("does not mutate callers and detaches nested data from returned packages", () => {
    const mission = generated("first");
    const history = [mission];
    const snapshot = structuredClone(history);
    const next = addToLibrary(history, generated("second"));
    expect(history).toEqual(snapshot);
    next[1].sources[0].text = "A different source";
    expect(mission.sources[0].text).toBe(snapshot[0].sources[0].text);
  });

  it("does not throw on circular or malformed in-memory additions", () => {
    const mission = generated("safe");
    const circular = { generated: true } as Record<string, unknown>;
    circular.self = circular;
    expect(
      addToLibrary([mission], circular as unknown as MissionPackage),
    ).toEqual([mission]);
    expect(
      addToLibrary([mission], { generated: true } as MissionPackage),
    ).toEqual([mission]);
  });

  it("always writes a bounded library that its reader can round-trip", () => {
    let history: MissionPackage[] = [];
    for (let index = 0; index < 12; index++)
      history = addToLibrary(history, generated(`bounded-${index}`));
    const raw = JSON.stringify(history);
    expect(raw.length).toBeLessThanOrEqual(MAX_LIBRARY_CHARS);
    expect(readSavedLibrary(raw)).toEqual(history);
  });
});
