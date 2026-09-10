import { validateEpisodePackage } from "../episodes/schema";
import { validateEpisodeFixture } from "../windpost/episodes";
import type { GameValidationResult } from "./types";

/** Validates the envelope and the complete format-specific content, without adapting it. */
export function validateGamePackage(raw: unknown): GameValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["A game package must be an object."] };
  }
  const value = raw as Record<string, unknown>;
  if (
    value.version !== 1 ||
    Object.keys(value).some(
      (key) => !["version", "format", "episode"].includes(key),
    )
  ) {
    return { valid: false, errors: ["Unsupported game package envelope."] };
  }
  if (value.format === "point-and-click") {
    const result = validateEpisodePackage(value.episode);
    return result.valid && result.package
      ? {
          valid: true,
          game: {
            version: 1,
            format: "point-and-click",
            episode: result.package,
          },
          errors: [],
        }
      : { valid: false, errors: result.errors };
  }
  if (value.format === "3d") {
    try {
      return {
        valid: true,
        game: {
          version: 1,
          format: "3d",
          episode: validateEpisodeFixture(value.episode),
        },
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error ? error.message : "Invalid 3D episode.",
        ],
      };
    }
  }
  return { valid: false, errors: ["Unsupported game format."] };
}
