import {
  validateTransformerConfig,
  verifyTransformerEvidence,
  canonicalTransformerEvidence,
} from "../domain/transformers";
import {
  validateLessonMachineConfig,
  verifyLessonMachineEvidence,
  canonicalLessonMachineEvidence,
  type LessonMachineConfig,
} from "../domain/lesson-machines";
import type { EpisodePuzzleConfig } from "./types";

export function isLessonMachine(
  config: EpisodePuzzleConfig,
): config is LessonMachineConfig {
  return config.kind === "simulation" || config.kind === "evidence";
}

export function validatePuzzleConfig(raw: unknown): EpisodePuzzleConfig {
  if (
    raw &&
    typeof raw === "object" &&
    "kind" in raw &&
    (raw.kind === "simulation" || raw.kind === "evidence")
  ) {
    return validateLessonMachineConfig(raw);
  }
  return validateTransformerConfig(raw);
}

export function verifyPuzzleEvidence(
  config: EpisodePuzzleConfig,
  evidence: unknown,
): boolean {
  return isLessonMachine(config)
    ? verifyLessonMachineEvidence(config, evidence)
    : verifyTransformerEvidence(config, evidence);
}

export function canonicalPuzzleEvidence(config: EpisodePuzzleConfig): unknown {
  return isLessonMachine(config)
    ? canonicalLessonMachineEvidence(config)
    : canonicalTransformerEvidence(config);
}
