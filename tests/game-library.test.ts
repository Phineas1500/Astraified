import { describe, expect, it } from "vitest";
import { TRANSFORMER_REFERENCE } from "../src/episodes/reference";
import {
  WINDPOST_EPISODE,
  MINUTE_MAIL_EPISODE,
} from "../src/windpost/episodes";
import { validateGamePackage } from "../src/games/schema";
import {
  gameIdentity,
  gameRevisionKey,
  type GamePackage,
} from "../src/games/types";
import {
  addGameToLibrary,
  readGameLibrary,
  MAX_GAME_LIBRARY_CHARS,
  MAX_SAVED_GAMES,
} from "../src/games/library";

function generated(
  id: string,
  format: "point-and-click" | "3d" = "point-and-click",
): GamePackage {
  const metadata = {
    id,
    generated: true,
    generation: { model: "fixture", createdAt: "2026-09-10T15:00:00.000Z" },
  };
  if (format === "3d") {
    // A synthetic finite experiment fixture; generated games cannot masquerade
    // as the authored counterweight/timing demos.
    const episode = { ...structuredClone(WINDPOST_EPISODE), ...metadata };
    const config = episode.puzzles[0].config;
    if (config.kind !== "simulation" || config.controls[0].kind !== "choice")
      throw new Error("Expected the test's numeric seed model");
    config.controls[0].options = config.controls[0].options.filter(
      ({ value }) => value !== 1,
    );
    for (const site of ["bridge", "lift"] as const) {
      episode.scene.stations[site] = {
        ...episode.scene.stations[site],
        kind: "experiment",
        socketInput: config.controls[0].id,
        socketValues: [0, 2, 3],
        socketLabels: ["0 m", "2 m", "3 m"],
        readouts: config.outputs.map(({ id, label, unit }) => ({
          id,
          label,
          unit,
          kind: "output",
        })),
      };
    }
    return { version: 1, format, episode };
  }
  return {
    version: 1,
    format,
    episode: { ...structuredClone(TRANSFORMER_REFERENCE), ...metadata },
  };
}

describe("unified game envelope", () => {
  it("validates each player's existing content without translating its format", () => {
    for (const game of [
      generated("case-one"),
      generated("island-one", "3d"),
      { version: 1, format: "3d", episode: MINUTE_MAIL_EPISODE },
    ]) {
      const result = validateGamePackage(game);
      expect(result.errors).toEqual([]);
      expect(result.game).toEqual(game);
    }
  });

  it("rejects unknown formats, versions, cross-format payloads and bare legacy episodes", () => {
    const game = generated("case-one");
    for (const raw of [
      null,
      [],
      {},
      game.episode,
      { ...game, format: "webgl" },
      { ...game, version: 2 },
      { ...game, format: "3d" },
      { ...game, unsafeExtra: true },
    ]) {
      const result = validateGamePackage(raw);
      expect(result.valid).toBe(false);
      expect(result.game).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe("mixed format game library", () => {
  it("migrates old generated point-and-click entries without requiring an envelope or hiding valid neighbors", () => {
    const first = generated("first");
    const second = generated("second");
    const legacy = JSON.stringify([
      first.episode,
      null,
      { title: "Broken" },
      second.episode,
      TRANSFORMER_REFERENCE,
    ]);
    expect(readGameLibrary(null, legacy)).toEqual([first, second]);
    expect(readGameLibrary("{bad json", legacy)).toEqual([first, second]);
  });

  it("keeps 2D and 3D games with the same ID separate and deduplicates revisions within their format", () => {
    const two = generated("same-id");
    const three = generated("same-id", "3d");
    const newer = {
      ...two,
      episode: { ...two.episode, revision: 2, title: "A revised case" },
    } as GamePackage;
    expect(gameIdentity(two)).not.toBe(gameIdentity(three));
    expect(gameRevisionKey(two)).not.toBe(gameRevisionKey(newer));
    const library = addGameToLibrary([three, two], newer);
    expect(library).toEqual([newer, three]);
    expect(
      readGameLibrary(JSON.stringify(library), JSON.stringify([two.episode])),
    ).toEqual(library);
  });

  it("keeps six recent generated games across both formats, with authored demos outside that limit", () => {
    let library: GamePackage[] = [];
    for (let index = 0; index < 8; index++)
      library = addGameToLibrary(
        library,
        generated(`game-${index}`, index % 2 ? "3d" : "point-and-click"),
      );
    expect(library).toHaveLength(MAX_SAVED_GAMES);
    expect(library.map(({ episode }) => episode.id)).toEqual([
      "game-7",
      "game-6",
      "game-5",
      "game-4",
      "game-3",
      "game-2",
    ]);
    const before = structuredClone(library);
    expect(
      addGameToLibrary(library, {
        version: 1,
        format: "3d",
        episode: WINDPOST_EPISODE,
      }),
    ).toEqual(before);
    expect(
      addGameToLibrary(library, {
        version: 1,
        format: "point-and-click",
        episode: TRANSFORMER_REFERENCE,
      }),
    ).toEqual(before);
    expect(library).toEqual(before);
  });

  it("rejects corrupt entries individually and bounds raw parsing while allowing legacy recovery", () => {
    const valid = generated("usable", "3d");
    const invalid = structuredClone(valid);
    invalid.episode.sources = [];
    expect(readGameLibrary(JSON.stringify([invalid, null, valid]))).toEqual([
      valid,
    ]);
    const legacy = generated("legacy");
    const legacyRaw = JSON.stringify([legacy.episode]);
    for (const raw of [
      "{}",
      JSON.stringify("wrong root"),
      " ".repeat(MAX_GAME_LIBRARY_CHARS + 1),
    ]) {
      expect(readGameLibrary(raw, legacyRaw)).toEqual([legacy]);
    }
  });
});
