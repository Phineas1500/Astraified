import { verifyPuzzleEvidence } from "./puzzle-adapters";
import type {
  EpisodeAction,
  EpisodeCondition,
  EpisodePackage,
  EpisodeState,
  EpisodeTransition,
} from "./types";

export function createEpisodeState(pkg: EpisodePackage): EpisodeState {
  return {
    episodeId: pkg.id,
    revision: pkg.revision,
    scene: pkg.startScene,
    inventory: [],
    flags: {},
    discoveries: [],
    solvedPuzzles: [],
    visited: [],
    started: false,
    completed: false,
    hintsUsed: 0,
  };
}

export function matchesEpisodeCondition(
  state: EpisodeState,
  condition: EpisodeCondition,
): boolean {
  if ("all" in condition)
    return condition.all.every((part) => matchesEpisodeCondition(state, part));
  if ("any" in condition)
    return condition.any.some((part) => matchesEpisodeCondition(state, part));
  if ("not" in condition) return !matchesEpisodeCondition(state, condition.not);
  if ("flag" in condition) return state.flags[condition.flag] === true;
  if ("hasItem" in condition)
    return state.inventory.includes(condition.hasItem);
  if ("discovered" in condition)
    return state.discoveries.includes(condition.discovered);
  return state.solvedPuzzles.includes(condition.puzzlePassed);
}

const add = (values: string[], value: string) => {
  if (!values.includes(value)) values.push(value);
};
function cloneState(state: EpisodeState): EpisodeState {
  return {
    ...state,
    inventory: [...state.inventory],
    flags: { ...state.flags },
    discoveries: [...state.discoveries],
    solvedPuzzles: [...state.solvedPuzzles],
    visited: [...state.visited],
  };
}

export function transitionEpisode(
  pkg: EpisodePackage,
  previous: EpisodeState,
  action: EpisodeAction,
): EpisodeTransition {
  const unchanged = (message?: string): EpisodeTransition => ({
    state: previous,
    ...(message ? { message } : {}),
  });
  if (previous.episodeId !== pkg.id || previous.revision !== pkg.revision)
    return unchanged("This save belongs to a different case edition.");
  const state = cloneState(previous);
  const finish = (
    extra: Omit<EpisodeTransition, "state"> = {},
  ): EpisodeTransition => {
    state.completed =
      state.started && matchesEpisodeCondition(state, pkg.completion);
    return { state, ...extra };
  };
  if (action.type === "start") {
    if (state.started) return unchanged();
    state.started = true;
    add(state.visited, state.scene);
    return finish({
      dialogue: { speaker: "Your case", lines: [pkg.briefing] },
    });
  }
  if (!state.started) return unchanged("Begin the case first.");
  if (action.type === "hint") {
    state.hintsUsed += 1;
    const hint = pkg.hints.find((candidate) =>
      matchesEpisodeCondition(state, candidate.when),
    );
    return finish({
      message:
        hint?.text ??
        "Look around, inspect what you have, and follow the evidence in your notebook.",
    });
  }
  if (action.type === "move") {
    if (
      !pkg.scenes
        .find((scene) => scene.id === state.scene)
        ?.exits.includes(action.scene)
    )
      return unchanged("That place is not connected to this room.");
    state.scene = action.scene;
    state.activePuzzle = undefined;
    add(state.visited, action.scene);
    return finish();
  }
  if (action.type === "submitPuzzle") {
    const puzzle = pkg.puzzles.find(
      (candidate) => candidate.id === action.puzzle,
    );
    if (
      !puzzle ||
      state.activePuzzle !== action.puzzle ||
      state.solvedPuzzles.includes(action.puzzle)
    )
      return unchanged("Open this apparatus in the world before testing it.");
    if (!verifyPuzzleEvidence(puzzle.config, action.evidence))
      return unchanged(
        "The apparatus still needs a successful controlled trial.",
      );
    add(state.solvedPuzzles, puzzle.id);
    state.activePuzzle = undefined;
    return finish({
      message: "Your evidence is verified and saved in the case.",
    });
  }
  const scene = pkg.scenes.find((candidate) => candidate.id === state.scene);
  const visible = (target: string) =>
    scene?.hotspots.some(
      (spot) =>
        spot.id === target &&
        (!spot.visibleIf || matchesEpisodeCondition(state, spot.visibleIf)),
    ) ?? false;
  const owned = (target: string) => state.inventory.includes(target);
  if (action.type === "interact" && !visible(action.target))
    return unchanged("You cannot reach that from here.");
  if (action.type === "inspect" && !owned(action.target))
    return unchanged("You have not found that yet.");
  if (action.type === "use" && (!owned(action.item) || !visible(action.target)))
    return unchanged(
      "You need the item in your bag and a target in this room.",
    );
  if (
    action.type === "combine" &&
    (action.item === action.target ||
      !owned(action.item) ||
      !owned(action.target))
  )
    return unchanged("Choose two different things from your bag.");
  const rule = pkg.rules.find((candidate) => {
    const trigger = candidate.trigger;
    const direct =
      trigger.target === action.target &&
      (!("item" in action) || trigger.item === action.item);
    const reverse =
      action.type === "combine" &&
      trigger.target === action.item &&
      trigger.item === action.target;
    return (
      trigger.verb === action.type &&
      (direct || reverse) &&
      (!candidate.when || matchesEpisodeCondition(state, candidate.when))
    );
  });
  if (!rule) {
    const item =
      action.type === "inspect"
        ? pkg.items.find((candidate) => candidate.id === action.target)
        : undefined;
    return unchanged(
      item?.description ??
        "That does not seem to change anything. Try another lead.",
    );
  }
  // The playable interface opens instruments only through local world actions.
  // Reject the entire malformed rule before consuming or granting anything.
  if (
    rule.effects.some((effect) => effect.type === "openPuzzle") &&
    action.type !== "interact" &&
    action.type !== "use"
  )
    return unchanged(
      "This apparatus must be opened through an interaction in the room.",
    );
  let puzzle: string | undefined;
  for (const effect of rule.effects) {
    switch (effect.type) {
      case "grantItem":
        add(state.inventory, effect.item);
        break;
      case "consumeItem":
        state.inventory = state.inventory.filter(
          (item) => item !== effect.item,
        );
        break;
      case "setFlag":
        state.flags[effect.flag] = effect.value;
        break;
      case "discover":
        add(state.discoveries, effect.discovery);
        break;
      case "openPuzzle":
        if (!state.solvedPuzzles.includes(effect.puzzle)) {
          puzzle = effect.puzzle;
          state.activePuzzle = puzzle;
        }
        break;
    }
  }
  return finish({
    ...(rule.dialogue ? { dialogue: rule.dialogue } : {}),
    ...(puzzle ? { puzzle } : {}),
  });
}

/** Strict restoration rejects stale editions and impossible identifiers; it never repairs by granting progress. */
export function parseEpisodeSave(
  pkg: EpisodePackage,
  raw: unknown,
): EpisodeState | null {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const data = value as Record<string, unknown>;
    const keys = [
      "episodeId",
      "revision",
      "scene",
      "inventory",
      "flags",
      "discoveries",
      "solvedPuzzles",
      "visited",
      "started",
      "completed",
      "hintsUsed",
      "activePuzzle",
    ];
    if (Object.keys(data).some((key) => !keys.includes(key))) return null;
    if (
      data.episodeId !== pkg.id ||
      data.revision !== pkg.revision ||
      typeof data.scene !== "string"
    )
      return null;
    const scenes = pkg.scenes.map((scene) => scene.id);
    const puzzles = pkg.puzzles.map((puzzle) => puzzle.id);
    if (!scenes.includes(data.scene)) return null;
    const ids = (input: unknown, allowed: string[]) =>
      Array.isArray(input) &&
      input.length <= allowed.length &&
      input.every((id) => typeof id === "string" && allowed.includes(id)) &&
      new Set(input).size === input.length;
    if (
      !ids(
        data.inventory,
        pkg.items.map((item) => item.id),
      ) ||
      !ids(
        data.discoveries,
        pkg.discoveries.map((discovery) => discovery.id),
      ) ||
      !ids(data.solvedPuzzles, puzzles) ||
      !ids(data.visited, scenes)
    )
      return null;
    if (
      !data.flags ||
      typeof data.flags !== "object" ||
      Array.isArray(data.flags)
    )
      return null;
    const flagNames = new Set(
      pkg.rules.flatMap((rule) =>
        rule.effects.flatMap((effect) =>
          effect.type === "setFlag" ? [effect.flag] : [],
        ),
      ),
    );
    if (
      Object.entries(data.flags).some(
        ([key, val]) => !flagNames.has(key) || typeof val !== "boolean",
      )
    )
      return null;
    if (
      typeof data.started !== "boolean" ||
      typeof data.completed !== "boolean" ||
      !Number.isSafeInteger(data.hintsUsed) ||
      (data.hintsUsed as number) < 0 ||
      (data.hintsUsed as number) > 1_000_000
    )
      return null;
    if (
      data.activePuzzle !== undefined &&
      (typeof data.activePuzzle !== "string" ||
        !puzzles.includes(data.activePuzzle) ||
        (data.solvedPuzzles as string[]).includes(data.activePuzzle))
    )
      return null;
    const state = data as unknown as EpisodeState;
    if (
      state.completed !==
      (state.started && matchesEpisodeCondition(state, pkg.completion))
    )
      return null;
    if (
      state.completed &&
      pkg.objectives.some(
        (objective) =>
          !pkg.puzzles.some(
            (puzzle) =>
              puzzle.objectiveId === objective.id &&
              state.solvedPuzzles.includes(puzzle.id),
          ),
      )
    )
      return null;
    if (state.started && !state.visited.includes(state.scene)) return null;
    if (
      !state.started &&
      (state.scene !== pkg.startScene ||
        state.visited.length ||
        state.inventory.length ||
        state.discoveries.length ||
        state.solvedPuzzles.length ||
        Object.keys(state.flags).length ||
        state.hintsUsed ||
        state.activePuzzle)
    )
      return null;
    if (
      state.activePuzzle &&
      !pkg.rules.some(
        (rule) =>
          rule.effects.some(
            (effect) =>
              effect.type === "openPuzzle" &&
              effect.puzzle === state.activePuzzle,
          ) &&
          (rule.trigger.verb === "interact" || rule.trigger.verb === "use") &&
          pkg.scenes
            .find((scene) => scene.id === state.scene)
            ?.hotspots.some((spot) => spot.id === rule.trigger.target),
      )
    )
      return null;
    return cloneState(state);
  } catch {
    return null;
  }
}
