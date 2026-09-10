import type { EpisodePackage } from "../episodes/types";
import type { EpisodeFixture } from "../windpost/episodes";

/** Host/library envelope; each player keeps its existing content contract. */
export type GameFormat = "point-and-click" | "3d";
export type GamePackage =
  | { version: 1; format: "point-and-click"; episode: EpisodePackage }
  | { version: 1; format: "3d"; episode: EpisodeFixture };

export interface GameValidationResult {
  valid: boolean;
  game?: GamePackage;
  errors: string[];
}

export function gameIdentity(game: GamePackage): string {
  return `${game.format}:${game.episode.id}`;
}

export function gameRevisionKey(game: GamePackage): string {
  return `${gameIdentity(game)}:r${game.episode.revision}`;
}
