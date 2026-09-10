import { describe, expect, it } from "vitest";
import {
  AUTHORED_GAMES,
  FEATURED_GAMES,
  isFeaturedGame,
  studioGames,
} from "../src/games/catalog";
import { gameIdentity, type GamePackage } from "../src/games/types";
import { validateGamePackage } from "../src/games/schema";
import { MAX_SAVED_GAMES } from "../src/games/library";

describe("shared studio catalog", () => {
  it("includes the approved completed lessons for a browser without saved games", () => {
    expect(FEATURED_GAMES.map((game) => game.episode.title)).toEqual([
      "Special Delivery, Weighted Carefully",
      "A Word in the Right Place.",
    ]);
    for (const game of FEATURED_GAMES) {
      expect(game.format).toBe("3d");
      expect(validateGamePackage(game).errors).toEqual([]);
      expect(isFeaturedGame(game)).toBe(true);
      expect(Object.keys(game).sort()).toEqual([
        "episode",
        "format",
        "version",
      ]);
    }
    expect(studioGames([])).toEqual([...FEATURED_GAMES, ...AUTHORED_GAMES]);
    expect(isFeaturedGame(AUTHORED_GAMES[0])).toBe(false);
  });

  it("keeps a saved edition instead of showing a second copy of the same game", () => {
    const saved = structuredClone(FEATURED_GAMES[0]);
    saved.episode.revision += 1;
    const result = studioGames([saved]);
    expect(result[0]).toBe(saved);
    expect(
      result.filter((game) => gameIdentity(game) === gameIdentity(saved)),
    ).toEqual([saved]);
  });

  it("keeps all six private save slots, their order, and both formats with matching IDs", () => {
    const saved: GamePackage[] = Array.from(
      { length: MAX_SAVED_GAMES },
      (_, index) => {
        const game = structuredClone(AUTHORED_GAMES[0]);
        game.episode.id = `private-${index}`;
        return game;
      },
    );
    const twoD = structuredClone(
      AUTHORED_GAMES.find((game) => game.format === "point-and-click")!,
    );
    twoD.episode.id = FEATURED_GAMES[0].episode.id;
    saved[0] = twoD;
    const before = structuredClone(saved);
    const result = studioGames(saved);
    expect(saved).toEqual(before);
    expect(result.slice(0, MAX_SAVED_GAMES)).toEqual(saved);
    expect(result).toContain(FEATURED_GAMES[0]);
    expect(result).toHaveLength(
      MAX_SAVED_GAMES + FEATURED_GAMES.length + AUTHORED_GAMES.length,
    );
  });
});
