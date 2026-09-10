import { describe, expect, it } from "vitest";
import { referenceMission } from "../src/domain/reference";
import { parseSavedMission, parseSavedProgress } from "../src/domain/storage";
import type { MissionPackage } from "../src/domain/types";

const clone = (): MissionPackage => structuredClone(referenceMission);
const restore = (mission: unknown) =>
  parseSavedMission(JSON.stringify(mission));

function routeMission(): MissionPackage {
  const mission = clone();
  for (const station of mission.stations) {
    station.kind = "routing";
    delete station.circuit;
    station.routing = {
      nodes: ["Dock", "Gate", "Tower"],
      edges: [
        { from: "Dock", to: "Gate", weight: 2 },
        { from: "Gate", to: "Tower", weight: 3 },
        { from: "Dock", to: "Tower", weight: 9 },
      ],
      start: "Dock",
      end: "Tower",
    };
  }
  return mission;
}

describe("saved mission recovery", () => {
  it("restores the reference and a generated mission as complete valid packages", () => {
    expect(restore(referenceMission)).toEqual(referenceMission);
    const generated = clone();
    generated.generated = true;
    generated.generation = {
      model: "gpt-6-astra",
      createdAt: "2026-09-10T15:00:00.000Z",
    };
    expect(restore(generated)).toEqual(generated);
  });

  it("rejects incomplete saves that would crash the UI on render", () => {
    for (const raw of [
      null,
      "",
      "{",
      "[]",
      JSON.stringify({ version: 1, stations: [null, null, null], sources: [] }),
    ]) {
      expect(parseSavedMission(raw)).toBeNull();
    }
    const missingObjectives = { ...clone(), objectives: undefined };
    expect(restore(missingObjectives)).toBeNull();
    const missingCheck = clone();
    delete (missingCheck.stations[0] as unknown as Record<string, unknown>)
      .check;
    expect(restore(missingCheck)).toBeNull();
  });

  it("rejects wrong station ordering and invalid numerical or assessment values", () => {
    const mutations: ((mission: MissionPackage) => void)[] = [
      (mission) => {
        mission.stations.reverse();
      },
      (mission) => {
        mission.stations[1]!.id = "workshop";
      },
      (mission) => {
        mission.stations[0]!.circuit!.resistance = 0;
      },
      (mission) => {
        mission.stations[0]!.circuit!.voltage = 1e20;
      },
      (mission) => {
        mission.stations[0]!.circuit!.goal = "parallel";
      },
      (mission) => {
        mission.stations[0]!.check.answer = 3;
      },
      (mission) => {
        mission.stations[0]!.hints = [];
      },
      (mission) => {
        mission.title = "x".repeat(181);
      },
      (mission) => {
        mission.generated = true;
      },
    ];
    for (const mutate of mutations) {
      const mission = clone();
      mutate(mission);
      expect(restore(mission)).toBeNull();
    }
  });

  it("requires real, distinct source references and safe source links", () => {
    const mutations: ((mission: MissionPackage) => void)[] = [
      (mission) => {
        mission.objectives[0]!.sourceIds = ["missing"];
      },
      (mission) => {
        mission.stations[2]!.sourceIds = [];
      },
      (mission) => {
        mission.sources[1]!.id = mission.sources[0]!.id;
      },
      (mission) => {
        mission.sources[0]!.url = "javascript:alert(1)";
      },
      (mission) => {
        mission.sources[0]!.url = "data:text/html,<h1>Source</h1>";
      },
      (mission) => {
        mission.sources[0]!.url = "https://user:password@example.com/";
      },
    ];
    for (const mutate of mutations) {
      const mission = clone();
      mutate(mission);
      expect(restore(mission)).toBeNull();
    }
  });

  it("restores connected small routes and rejects broken graph invariants", () => {
    expect(restore(routeMission())).toEqual(routeMission());
    const mutations: ((mission: MissionPackage) => void)[] = [
      (mission) => {
        mission.stations[0]!.routing!.nodes.push("Island");
      },
      (mission) => {
        mission.stations[0]!.routing!.edges.push({
          from: "Tower",
          to: "Dock",
          weight: 5,
        });
      },
      (mission) => {
        mission.stations[0]!.routing!.edges[0]!.to = "Missing";
      },
      (mission) => {
        mission.stations[0]!.routing!.edges[0]!.weight = -1;
      },
      (mission) => {
        mission.stations[0]!.routing!.edges[0]!.to = "Dock";
      },
      (mission) => {
        mission.stations[0]!.routing!.start = "Tower";
      },
      (mission) => {
        mission.stations[0]!.routing!.end = "Missing";
      },
    ];
    for (const mutate of mutations) {
      const mission = routeMission();
      mutate(mission);
      expect(restore(mission)).toBeNull();
    }
  });

  it("rejects oversized saves before parsing nested content", () => {
    expect(parseSavedMission(" ".repeat(512_001))).toBeNull();
  });
});

describe("saved progress normalization", () => {
  it("does not let duplicate or invented completions mark the whole mission finished", () => {
    const progress = parseSavedProgress(
      JSON.stringify({
        completed: ["workshop", "workshop", "workshop", "invented"],
        assisted: [],
        attempts: 3,
        hints: 0,
      }),
      referenceMission,
    );
    expect(progress.completed).toEqual(["workshop"]);
  });

  it("requires a completed prefix but preserves assistance at unfinished stations", () => {
    const progress = parseSavedProgress(
      JSON.stringify({
        completed: ["beacon", "workshop"],
        assisted: ["relay", "relay", "not-a-station"],
        attempts: 2,
        hints: 1,
      }),
      referenceMission,
    );
    expect(progress).toEqual({
      completed: ["workshop"],
      assisted: ["relay"],
      attempts: 2,
      hints: 1,
    });
  });

  it("restores all completed stations in mission order", () => {
    const progress = parseSavedProgress(
      JSON.stringify({
        completed: ["beacon", "relay", "workshop"],
        assisted: ["beacon"],
        attempts: 12,
        hints: 2,
      }),
      referenceMission,
    );
    expect(progress.completed).toEqual(["workshop", "relay", "beacon"]);
  });

  it("sanitizes invalid counts without discarding otherwise valid saved work", () => {
    for (const counter of [-1, 1.5, "4", null, Number.MAX_SAFE_INTEGER + 1]) {
      const progress = parseSavedProgress(
        JSON.stringify({
          completed: ["workshop"],
          assisted: [],
          attempts: counter,
          hints: counter,
        }),
        referenceMission,
      );
      expect(progress).toEqual({
        completed: ["workshop"],
        assisted: [],
        attempts: 0,
        hints: 0,
      });
    }
  });

  it("returns a fresh empty progress object for absent or corrupt saves", () => {
    const blank = { completed: [], assisted: [], attempts: 0, hints: 0 };
    for (const raw of [
      null,
      "",
      "broken json",
      "null",
      "[]",
      "5",
      " ".repeat(16_001),
    ]) {
      expect(parseSavedProgress(raw, referenceMission)).toEqual(blank);
    }
    const one = parseSavedProgress(null, referenceMission);
    one.completed.push("workshop");
    expect(parseSavedProgress(null, referenceMission)).toEqual(blank);
  });
});
