export type RoomId =
  "jetty" | "tearoom" | "workshop" | "storeroom" | "signalhouse" | "lantern";
export type ItemId =
  | "tester"
  | "casing"
  | "cell"
  | "bulb"
  | "broken-bulb"
  | "hook"
  | "reel"
  | "photo"
  | "record"
  | "lead"
  | "lamp"
  | "retriever"
  | "keepsake"
  | "memento";
export type PuzzleId = "lamp" | "signals" | "feeder";

export interface AdventureState {
  version: 1;
  started: boolean;
  room: RoomId;
  inventory: ItemId[];
  flags: Record<string, boolean>;
  discoveries: string[];
  visited: RoomId[];
  hintsUsed: number;
  attempts: number;
  completed: boolean;
}

export type AdventureAction =
  | { type: "start" }
  | { type: "move"; room: RoomId }
  | { type: "interact"; target: string; item?: ItemId }
  | { type: "combine"; a: ItemId; b: ItemId }
  | { type: "inspect"; item: ItemId }
  | { type: "talk"; character: string; choice?: string }
  | { type: "solve"; puzzle: PuzzleId }
  | { type: "hint" }
  | { type: "restart" };

export interface Dialogue {
  speaker: string;
  lines: string[];
  choices?: { id: string; label: string }[];
}

export interface TransitionResult {
  state: AdventureState;
  dialogue?: Dialogue;
  puzzle?: PuzzleId;
  sound?: "pickup" | "success" | "wrong" | "talk" | "door";
}

/** Bounds use percentages, with x/y at the top-left of the rectangle. */
export interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "character" | "object" | "exit";
  character?: string;
  item?: ItemId;
}

export type State = AdventureState;
export type Action = AdventureAction;
