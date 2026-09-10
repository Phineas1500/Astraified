import { TransformerPuzzle } from "./TransformerPuzzle";
import { LessonMachine } from "./LessonMachine";
import { isLessonMachine } from "./puzzle-adapters";
import type { EpisodePackage, EpisodePuzzleConfig } from "./types";

export default function EpisodePuzzle(props: {
  config: EpisodePuzzleConfig;
  title: string;
  instructions: string;
  draft?: unknown;
  onDraftChange?: (draft: unknown) => void;
  onComplete: (evidence: unknown) => void;
  onClose: () => void;
  sources?: EpisodePackage["sources"];
}) {
  return isLessonMachine(props.config) ? (
    <LessonMachine {...props} config={props.config} />
  ) : (
    <TransformerPuzzle {...props} config={props.config} />
  );
}
