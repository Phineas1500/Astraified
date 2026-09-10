import { validateGamePackage } from "./schema";
import { gameIdentity, type GamePackage } from "./types";

export const GAME_LIBRARY_KEY = "astraified:games:library:v1";
export const LEGACY_EPISODE_LIBRARY_KEY = "astraified:episodes:library:v1";
export const MAX_SAVED_GAMES = 6;
export const MAX_GAME_LIBRARY_CHARS = 3_000_000;
const MAX_CANDIDATES = 100;

export function isGeneratedGame(game: GamePackage): boolean {
  return "generated" in game.episode && game.episode.generated === true;
}

function candidates(raw: string | null): unknown[] {
  if (!raw || raw.length > MAX_GAME_LIBRARY_CHARS) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.slice(0, MAX_CANDIDATES) : [];
  } catch {
    return [];
  }
}

function normalize(values: readonly unknown[]): GamePackage[] {
  const games: GamePackage[] = [];
  const seen = new Set<string>();
  let size = 2;
  for (const value of values.slice(0, MAX_CANDIDATES)) {
    try {
      const result = validateGamePackage(value);
      if (!result.valid || !result.game || !isGeneratedGame(result.game))
        continue;
      const key = gameIdentity(result.game);
      if (seen.has(key)) continue;
      const entrySize =
        JSON.stringify(result.game).length + (games.length ? 1 : 0);
      if (size + entrySize > MAX_GAME_LIBRARY_CHARS) continue;
      seen.add(key);
      size += entrySize;
      games.push(result.game);
      if (games.length === MAX_SAVED_GAMES) break;
    } catch {
      // An unreadable entry must not hide the rest of the library.
    }
  }
  return games;
}

/** Old point-and-click packages are wrapped only at this migration boundary. */
export function readGameLibrary(
  raw: string | null,
  legacyRaw: string | null = null,
): GamePackage[] {
  return normalize([
    ...candidates(raw),
    ...candidates(legacyRaw).map((episode) => ({
      version: 1,
      format: "point-and-click",
      episode,
    })),
  ]);
}

/** Authored demos are bundled separately and never consume generated save slots. */
export function addGameToLibrary(
  library: readonly GamePackage[],
  game: GamePackage,
): GamePackage[] {
  if (!isGeneratedGame(game)) return [...library];
  return normalize([game, ...library.slice(0, MAX_CANDIDATES - 1)]);
}
