import { z } from "zod";
import {
  evidenceConfigSchema,
  simulationConfigSchema,
} from "../src/domain/lesson-machines";

/** Provider-only sentence endings prevent fitting a limit by clipping the text. */
export const generationSentence = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(
      /[.!?…]["'”’»)\]}]*\s*$/,
      "End with complete sentence punctuation; never truncate a sentence.",
    )
    .describe(
      `Write 1–2 COMPLETE short sentences, ending with sentence punctuation. Aim well below ${max} characters. Simplify the wording to fit; never truncate a sentence.`,
    );

// Generation uses a smaller teaching surface than the saved-game format. Derive
// these schemas from the runtime contract so older, richer lessons still load.
const simulation = simulationConfigSchema.shape;
const [numberControl, choiceControl, toggleControl] =
  simulation.controls.element.options;

const simpleChoiceControlSchema = choiceControl
  .extend({
    label: choiceControl.shape.label.max(60),
    options: z
      .array(
        choiceControl.shape.options.element
          .extend({
            label: choiceControl.shape.options.element.shape.label.max(60),
          })
          .strict(),
      )
      .min(2)
      .max(3),
  })
  .strict();

const simpleControlSchema = z.discriminatedUnion("kind", [
  numberControl.extend({ label: numberControl.shape.label.max(60) }).strict(),
  simpleChoiceControlSchema,
  toggleControl
    .extend({
      label: toggleControl.shape.label.max(60),
      offLabel: toggleControl.shape.offLabel.max(60),
      onLabel: toggleControl.shape.onLabel.max(60),
    })
    .strict(),
]);

const simpleOutputSchema = simulation.outputs.element
  .extend({ label: simulation.outputs.element.shape.label.max(60) })
  .strict();
const task = simulation.tasks.element.shape;
const simpleTaskSchema = simulation.tasks.element
  .extend({
    title: task.title.max(60),
    prompt: generationSentence(360),
    initialInputs: task.initialInputs.length(1),
    referenceInputs: task.referenceInputs.length(1),
    successFeedback: generationSentence(240),
    failureFeedback: generationSentence(240),
  })
  .strict();

export const simpleLessonSimulationSchema = simulationConfigSchema
  .extend({
    briefing: generationSentence(400),
    modelNotes: generationSentence(1000),
    controls: z.array(simpleControlSchema).length(1),
    outputs: z.array(simpleOutputSchema).min(1).max(2),
    tasks: z.array(simpleTaskSchema).length(2),
  })
  .strict();

const evidence = evidenceConfigSchema.shape;
const round = evidence.rounds.element.shape;
const card = round.cards.element.shape;
const slot = round.slots.element.shape;
const simpleRoundSchema = evidence.rounds.element
  .extend({
    title: round.title.max(60),
    prompt: generationSentence(360),
    cards: z
      .array(
        round.cards.element
          .extend({
            label: card.label.max(60),
            text: generationSentence(220),
            explanation: generationSentence(260),
          })
          .strict(),
      )
      .length(3),
    slots: z
      .array(
        round.slots.element
          .extend({
            label: slot.label.max(60),
            description: generationSentence(180),
          })
          .strict(),
      )
      .length(2),
    acceptedAssignments: z
      .array(round.acceptedAssignments.element.length(3))
      .min(1)
      .max(12),
    successFeedback: generationSentence(240),
    failureFeedback: generationSentence(240),
  })
  .strict();

export const simpleLessonEvidenceSchema = evidenceConfigSchema
  .extend({
    briefing: generationSentence(400),
    modelNotes: generationSentence(1000),
    rounds: z.array(simpleRoundSchema).length(2),
  })
  .strict();

/** Point-and-click may use one numeric, choice, or toggle control. */
export const simpleLessonMachineSchema = z.discriminatedUnion("kind", [
  simpleLessonSimulationSchema,
  simpleLessonEvidenceSchema,
]);

/** The harbor represents one control as three physical, labelled settings. */
export const simpleHarborSimulationSchema = simpleLessonSimulationSchema
  .extend({
    controls: z
      .array(
        simpleChoiceControlSchema
          .extend({
            options: simpleChoiceControlSchema.shape.options.length(3),
          })
          .strict(),
      )
      .length(1),
    outputs: z
      .array(simpleOutputSchema.extend({ derivativeWrt: z.null() }).strict())
      .min(1)
      .max(2),
    plots: simulation.plots.length(0),
  })
  .strict();

export const simpleHarborMachineSchema = z.discriminatedUnion("kind", [
  simpleHarborSimulationSchema,
  simpleLessonEvidenceSchema,
]);
