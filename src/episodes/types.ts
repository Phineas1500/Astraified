import type { SourceRecord } from "../domain/types";
import type { TransformerConfig } from "../domain/transformers";

/** Closed data language: no generated code, expressions, or callbacks. */
export type EpisodeCondition =
  | { all: EpisodeCondition[] }
  | { any: EpisodeCondition[] }
  | { not: EpisodeCondition }
  | { flag: string }
  | { hasItem: string }
  | { discovered: string }
  | { puzzlePassed: string };

export type EpisodeEffect =
  | { type: "grantItem"; item: string }
  | { type: "consumeItem"; item: string }
  | { type: "setFlag"; flag: string; value: boolean }
  | { type: "discover"; discovery: string }
  | { type: "openPuzzle"; puzzle: string };

export type EpisodePortrait = "wren" | "ada" | "pip" | "tock" | "button";
export type EpisodeBackground =
  "jetty" | "tearoom" | "workshop" | "storeroom" | "signalhouse" | "lantern";
export interface EpisodeDialogue {
  speaker: string;
  portrait?: EpisodePortrait;
  lines: string[];
}
export interface EpisodeHotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "character" | "object";
  portrait?: EpisodePortrait;
  icon?: string;
  visibleIf?: EpisodeCondition;
}
export interface EpisodeScene {
  id: string;
  name: string;
  description: string;
  background: EpisodeBackground;
  exits: string[];
  hotspots: EpisodeHotspot[];
}
export interface EpisodeRule {
  id: string;
  trigger: {
    verb: "inspect" | "interact" | "use" | "combine";
    target: string;
    item?: string;
  };
  when?: EpisodeCondition;
  effects: EpisodeEffect[];
  dialogue?: EpisodeDialogue;
}
export interface EpisodePackage {
  version: 1;
  id: string;
  revision: number;
  title: string;
  subtitle: string;
  description: string;
  briefing: string;
  ending: string;
  level: string;
  generated: boolean;
  generation?: { model: string; createdAt: string };
  sources: SourceRecord[];
  objectives: { id: string; title: string; sourceIds: string[] }[];
  scenes: EpisodeScene[];
  startScene: string;
  items: { id: string; name: string; description: string; icon: string }[];
  discoveries: {
    id: string;
    title: string;
    text: string;
    sourceIds: string[];
  }[];
  puzzles: {
    id: string;
    title: string;
    instructions: string;
    objectiveId: string;
    sourceIds: string[];
    config: TransformerConfig;
  }[];
  rules: EpisodeRule[];
  hints: { when: EpisodeCondition; text: string }[];
  completion: EpisodeCondition;
  /** This route uses real reviewed-adapter evidence, never a success override. */
  referenceSolution: EpisodeAction[];
}
export type EpisodeAction =
  | { type: "start" }
  | { type: "move"; scene: string }
  | { type: "interact"; target: string }
  | { type: "use"; item: string; target: string }
  | { type: "combine"; item: string; target: string }
  | { type: "inspect"; target: string }
  | { type: "submitPuzzle"; puzzle: string; evidence: unknown }
  | { type: "hint" };
export interface EpisodeState {
  episodeId: string;
  revision: number;
  scene: string;
  inventory: string[];
  flags: Record<string, boolean>;
  discoveries: string[];
  solvedPuzzles: string[];
  visited: string[];
  started: boolean;
  completed: boolean;
  hintsUsed: number;
  /** Persisted apparatus context; success is accepted only for this opened puzzle. */
  activePuzzle?: string;
}
export interface EpisodeTransition {
  state: EpisodeState;
  dialogue?: EpisodeDialogue;
  puzzle?: string;
  message?: string;
}
export interface EpisodeValidationResult {
  valid: boolean;
  package?: EpisodePackage;
  errors: string[];
  /** Number of distinct states visited in the bounded proof of solvability. */
  exploredStates?: number;
}
