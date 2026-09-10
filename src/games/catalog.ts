import { TRANSFORMER_REFERENCE } from "../episodes/reference";
import { EPISODES } from "../windpost/episodes";
import specialDelivery from "./featured/special-delivery-weighted-carefully.json";
import wordInTheRightPlace from "./featured/a-word-in-the-right-place.json";
import { validateGamePackage } from "./schema";
import { gameIdentity, type GamePackage } from "./types";

function featuredGame(raw: unknown): GamePackage {
  const result = validateGamePackage(raw);
  if (!result.valid || !result.game)
    throw new Error(`Invalid featured adventure: ${result.errors.join("; ")}`);
  return result.game;
}

// Deliberately published examples only. Private generation checkpoints and
// browser libraries are never discovered or exported by this catalog.
export const FEATURED_GAMES: readonly GamePackage[] = [
  featuredGame(specialDelivery),
  featuredGame(wordInTheRightPlace),
];
export const AUTHORED_GAMES: readonly GamePackage[] = [
  ...EPISODES.map((episode): GamePackage => ({
    version: 1,
    format: "3d",
    episode,
  })),
  { version: 1, format: "point-and-click", episode: TRANSFORMER_REFERENCE },
];

export function isFeaturedGame(game: GamePackage): boolean {
  return FEATURED_GAMES.some(
    (featured) => gameIdentity(featured) === gameIdentity(game),
  );
}

/** Presentation only: published games do not consume private save slots. */
export function studioGames(saved: readonly GamePackage[]): GamePackage[] {
  const seen = new Set<string>();
  return [...saved, ...FEATURED_GAMES, ...AUTHORED_GAMES].filter((game) => {
    const id = gameIdentity(game);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
