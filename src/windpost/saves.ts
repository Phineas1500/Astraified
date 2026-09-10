import { SAVE_KEY, deserialize } from "./model";
import {
  initialProgress,
  validateProgress,
  type EpisodeProgress,
} from "./runtime";
import type { EpisodeFixture } from "./episodes";

export type ProgressStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;
export const progressKey = (episode: EpisodeFixture): string =>
  `astraified:harbor-episodes:v1:${episode.id}:r${episode.revision}`;

export function saveProgress(
  episode: EpisodeFixture,
  state: EpisodeProgress,
  storage: ProgressStorage,
): void {
  const validated = validateProgress(episode, state);
  if (!validated)
    throw new RangeError("Cannot save inconsistent episode progress");
  storage.setItem(
    progressKey(episode),
    JSON.stringify({ version: 1, state: validated }),
  );
}

export function loadProgress(
  episode: EpisodeFixture,
  storage: ProgressStorage,
): EpisodeProgress {
  try {
    const raw = storage.getItem(progressKey(episode));
    if (raw !== null) {
      if (raw.length > 200_000) return initialProgress(episode);
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed) ||
        !("version" in parsed) ||
        parsed.version !== 1 ||
        !("state" in parsed)
      )
        return initialProgress(episode);
      return (
        validateProgress(episode, parsed.state) ?? initialProgress(episode)
      );
    }
    if (episode.id !== "windpost" || episode.revision !== 1)
      return initialProgress(episode);
    const old = storage.getItem(SAVE_KEY);
    if (old === null) return initialProgress(episode);
    const legacy = deserialize(old);
    const base = initialProgress(episode);
    const migrated: EpisodeProgress = {
      ...base,
      metMoss: legacy.metMoss,
      metBea: legacy.metBea,
      bridgeSlot: legacy.bridgeSlot,
      liftSlot: legacy.liftSlot,
      bridgeOpen: legacy.bridgeOpen,
      liftRaised: legacy.liftRaised,
      parcelCollected: legacy.parcelCollected,
      delivered: legacy.delivered,
      carrying: legacy.carrying,
      postcards: [...legacy.postcards],
      discoveries: [...legacy.discoveries],
      postcardReturned: legacy.postcardReturned,
      hints: legacy.hints,
      inputs: {
        bridge: { distance: legacy.bridgeSlot ?? 0 },
        lift: { distance: legacy.liftSlot ?? 0 },
      },
      observations: legacy.observations,
      trials: legacy.trials.map((trial) => ({
        mechanism: trial.mechanism,
        hints: trial.hints,
        evidence: {
          taskId: trial.mechanism,
          inputs: { distance: trial.slot ?? 0 },
          outputs: {
            leftTorque: trial.leftTorqueNm,
            rightTorque: trial.rightTorqueNm,
          },
          passed: trial.balanced,
        },
      })),
    };
    const valid = validateProgress(episode, migrated);
    if (!valid) return initialProgress(episode);
    // Quota/privacy failures must not prevent an otherwise valid recovered playthrough.
    try {
      saveProgress(episode, valid, storage);
    } catch {
      /* Return the recovered state in memory. */
    }
    return valid;
  } catch {
    return initialProgress(episode);
  }
}

export function clearProgress(
  episode: EpisodeFixture,
  storage: ProgressStorage,
): void {
  storage.removeItem(progressKey(episode));
  if (episode.id === "windpost") storage.removeItem(SAVE_KEY);
}
