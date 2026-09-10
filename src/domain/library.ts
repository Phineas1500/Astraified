import { parseSavedMission } from "./storage";
import type { MissionPackage } from "./types";

export const LIBRARY_STORAGE_KEY = "astraified:library";
export const MAX_SAVED_MISSIONS = 10;
export const MAX_LIBRARY_CHARS = 2_000_000;
const MAX_CANDIDATES = 100;

/** Validate and copy each package; keep most-recent-first order and whole missions. */
function normalizeLibrary(candidates: readonly unknown[]): MissionPackage[] {
  const result: MissionPackage[] = [];
  const seen = new Set<string>();
  let serializedSize = 2; // JSON array brackets.
  for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
    try {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        !(candidate as { generated?: unknown }).generated
      )
        continue;
      const raw = JSON.stringify(candidate);
      const mission = parseSavedMission(raw);
      if (!mission?.generated || seen.has(mission.id)) continue;
      const size = JSON.stringify(mission).length + (result.length ? 1 : 0);
      if (serializedSize + size > MAX_LIBRARY_CHARS) continue;
      result.push(mission);
      seen.add(mission.id);
      serializedSize += size;
      if (result.length === MAX_SAVED_MISSIONS) break;
    } catch {
      // A corrupt entry must not hide otherwise usable saved worlds.
    }
  }
  return result;
}

/**
 * Read the generated-world history and migrate the previous single current save.
 * Stored arrays are ordered most recently played first, not by model timestamps.
 */
export function readSavedLibrary(
  raw: string | null,
  currentRaw: string | null = null,
): MissionPackage[] {
  let candidates: unknown[] = [];
  if (raw && raw.length <= MAX_LIBRARY_CHARS) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) candidates = parsed;
    } catch {
      // Still attempt migration from a valid current save below.
    }
  }
  const current = parseSavedMission(currentRaw);
  if (current?.generated)
    candidates = [current, ...candidates.slice(0, MAX_CANDIDATES - 1)];
  return normalizeLibrary(candidates);
}

/**
 * Remember a played generated mission without mutating either argument.
 * Playing the bundled reference preserves the generated history unchanged.
 * Persist the returned array with JSON.stringify under LIBRARY_STORAGE_KEY.
 */
export function addToLibrary(
  missions: readonly MissionPackage[],
  mission: MissionPackage,
): MissionPackage[] {
  return normalizeLibrary([mission, ...missions.slice(0, MAX_CANDIDATES - 1)]);
}
