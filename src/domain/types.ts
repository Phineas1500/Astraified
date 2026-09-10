export type GameMode = "adventure" | "explore";

export type StationId = "workshop" | "relay" | "beacon";

export interface SourceRecord {
  id: string;
  title: string;
  url?: string;
  /** Extracted source text or an explicitly identified editorial summary. */
  text: string;
  page?: number;
}

export interface Objective {
  id: string;
  title: string;
  sourceIds: string[];
}

export interface Station {
  id: StationId;
  name: string;
  title: string;
  story: string;
  task: string;
  concept: string;
  sourceIds: string[];
  hints: string[];
  kind: "circuit" | "routing";
  circuit?: {
    goal: "closed" | "series" | "parallel";
    voltage: number;
    /** Resistance of each identical ideal resistive lamp, in ohms. */
    resistance: number;
  };
  routing?: {
    nodes: string[];
    /** Paths are undirected; weight is the nonnegative travel cost. */
    edges: { from: string; to: string; weight: number }[];
    start: string;
    end: string;
  };
  check: {
    question: string;
    options: string[];
    /** Zero-based option index. */
    answer: number;
    explanation: string;
  };
}

export interface MissionPackage {
  version: 1;
  id: string;
  title: string;
  subtitle: string;
  topic: string;
  description: string;
  briefing: string;
  estimatedMinutes: number;
  level: string;
  sources: SourceRecord[];
  objectives: Objective[];
  stations: Station[];
  conclusion: string;
  generated: boolean;
  generation?: { model: string; createdAt: string };
}
