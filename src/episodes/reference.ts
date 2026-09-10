import type {
  EpisodePackage,
  EpisodeRule,
  EpisodeCondition,
  EpisodeEffect,
  EpisodeAction,
  EpisodeBackground,
  EpisodePortrait,
} from "./types";
import {
  createTransformerFixtures,
  createTransformerEvidence,
} from "../domain/transformers";
import { TRANSFORMER_STARTER, TRANSFORMER_SOURCE_URL } from "./starter-source";

const fixtures = createTransformerFixtures();
const has = (hasItem: string): EpisodeCondition => ({ hasItem });
const flag = (flag: string): EpisodeCondition => ({ flag });
const passed = (puzzlePassed: string): EpisodeCondition => ({ puzzlePassed });
const all = (...conditions: EpisodeCondition[]): EpisodeCondition => ({
  all: conditions,
});
const not = (condition: EpisodeCondition): EpisodeCondition => ({
  not: condition,
});
const grant = (item: string): EpisodeEffect => ({ type: "grantItem", item });
const set = (flag: string): EpisodeEffect => ({
  type: "setFlag",
  flag,
  value: true,
});
const discover = (discovery: string): EpisodeEffect => ({
  type: "discover",
  discovery,
});
const open = (puzzle: string): EpisodeEffect => ({
  type: "openPuzzle",
  puzzle,
});
const rule = (
  id: string,
  target: string,
  lines: string[],
  effects: EpisodeEffect[] = [],
  when?: EpisodeCondition,
  verb: EpisodeRule["trigger"]["verb"] = "interact",
  item?: string,
  speaker = "Your field notes",
  portrait?: EpisodePortrait,
): EpisodeRule => ({
  id,
  trigger: { verb, target, ...(item ? { item } : {}) },
  effects,
  ...(when ? { when } : {}),
  dialogue: { speaker, lines, ...(portrait ? { portrait } : {}) },
});
const names = ["dispatch", "cafe", "press", "archive", "relay", "broadcast"];
const object = (
  id: string,
  label: string,
  x: number,
  y: number,
  icon: string,
  visibleIf?: EpisodeCondition,
) => ({
  id,
  label,
  x,
  y,
  w: 13,
  h: 23,
  kind: "object" as const,
  icon,
  ...(visibleIf ? { visibleIf } : {}),
});
const person = (
  id: string,
  label: string,
  portrait: EpisodePortrait,
  x = 65,
) => ({
  id,
  label,
  x,
  y: 34,
  w: 18,
  h: 43,
  kind: "character" as const,
  portrait,
});
const scene = (
  id: string,
  name: string,
  background: EpisodeBackground,
  description: string,
  hotspots: EpisodePackage["scenes"][number]["hotspots"],
) => ({
  id,
  name,
  background,
  description,
  exits: names.filter((n) => n !== id),
  hotspots,
});
const before = (id: string) => not(flag(`${id}-taken`));
const pickup = (id: string, description: string) =>
  rule(
    `take-${id}`,
    id,
    [description],
    [grant(id), set(`${id}-taken`)],
    before(id),
  );
const solve = (puzzle: string): EpisodeAction => ({
  type: "submitPuzzle",
  puzzle,
  evidence: createTransformerEvidence(
    fixtures[puzzle as keyof typeof fixtures],
  ),
});

export const TRANSFORMER_REFERENCE: EpisodePackage = {
  version: 1,
  id: "mixed-up-messages",
  revision: 1,
  title: "The Case of the Mixed-Up Messages",
  subtitle: "A perfect rehearsal. A very peculiar broadcast.",
  description:
    "Someone has taught the harbor announcer to be confidently wrong. Follow two leads, repair its curious machinery, and discover what it has been hiding.",
  briefing:
    "“Report to the teapot immediately.” That is the third announcement this morning, and Captain Wren is beginning to take it personally. The new message machine passed every rehearsal. Find out why the live broadcasts make no sense.",
  ending:
    "The evening announcement rings across the bay: “Tea for the captain. A quiet evening for everyone else.” Wren salutes the teapot anyway. Tock removes “Chief of Tomorrow” from his nameplate and carefully replaces it with “Mostly Present.”",
  level: "High school / introductory college",
  generated: false,
  sources: [
    {
      id: "transformer-notes",
      title:
        "Transformer starter notes · editorial summary of Vaswani et al., sections 3.1–3.5",
      url: TRANSFORMER_SOURCE_URL,
      text: TRANSFORMER_STARTER,
    },
  ],
  objectives: [
    {
      id: "order",
      title: "Distinguish a token’s identity from its position in a sequence.",
      sourceIds: ["transformer-notes"],
    },
    {
      id: "mixture",
      title: "Trace how query/key comparisons weight a mixture of values.",
      sourceIds: ["transformer-notes"],
    },
    {
      id: "visibility",
      title: "Diagnose future-information leakage in causal self-attention.",
      sourceIds: ["transformer-notes"],
    },
  ],
  startScene: "dispatch",
  scenes: [
    scene(
      "dispatch",
      "The Dispatch Jetty",
      "jetty",
      "An announcement tube politely demands that the sea report for inspection.",
      [
        person("wren", "Captain Wren", "wren"),
        object(
          "dispatch-slip",
          "The original dispatch slip",
          23,
          56,
          "paper",
          before("dispatch-slip"),
        ),
        object("broadcast-bell", "The broadcast bell", 44, 57, "radio"),
      ],
    ),
    scene(
      "cafe",
      "Pip’s Listening Room",
      "tearoom",
      "Pip has put the teapot in charge until somebody sorts this out.",
      [
        person("pip", "Pip", "pip"),
        object("cord", "A spool of cord", 28, 57, "thread", before("cord")),
        object(
          "muddled-report",
          "A muddled maintenance report",
          46,
          60,
          "paper",
          before("muddled-report"),
        ),
      ],
    ),
    scene(
      "press",
      "The Print Workshop",
      "workshop",
      "Every machine has a label. Today, several labels have the wrong machine.",
      [
        person("ada", "Ada", "ada"),
        object(
          "magnet",
          "A horseshoe magnet",
          20,
          51,
          "magnet",
          before("magnet"),
        ),
        object("position-rail", "The position rail", 40, 56, "machine"),
      ],
    ),
    scene(
      "archive",
      "The Small Archive",
      "storeroom",
      "Alphabetical by smell. Tock says he is still refining the system.",
      [
        object("cabinet", "The narrow cabinet slot", 71, 46, "archive"),
        object(
          "cartridge",
          "A sealed reference cartridge",
          29,
          50,
          "cartridge",
          before("cartridge"),
        ),
        object(
          "lost-ticket",
          "A little ticket under a crate",
          48,
          70,
          "ticket",
          before("lost-ticket"),
        ),
      ],
    ),
    scene(
      "relay",
      "The Attention Room",
      "signalhouse",
      "The machine has three inputs. Tock has labelled all of them “probably this one.”",
      [
        person("tock", "Tock", "tock"),
        object(
          "attention-bench",
          "The attention mixing bench",
          23,
          49,
          "machine",
        ),
      ],
    ),
    scene(
      "broadcast",
      "The Broadcast Loft",
      "lantern",
      "A stack of perfect rehearsal tapes waits beside an entirely silent loudspeaker.",
      [
        object("rehearsal", "The rehearsal machine", 25, 54, "tape"),
        object("shutters", "The visibility shutters", 64, 53, "shutter"),
      ],
    ),
  ],
  items: [
    {
      id: "dispatch-slip",
      name: "Original dispatch",
      description:
        "Pip sends tea to Wren. The received announcement says Wren sends Pip to tea. The same tokens have traded places.",
      icon: "paper",
    },
    {
      id: "cord",
      name: "Spool of cord",
      description:
        "Pip uses this to keep tea bags from escaping. Long enough to reach behind a cabinet.",
      icon: "thread",
    },
    {
      id: "magnet",
      name: "Horseshoe magnet",
      description:
        "It attracts metal and, according to Ada, occasionally compliments.",
      icon: "magnet",
    },
    {
      id: "retriever",
      name: "Magnetic retriever",
      description:
        "The magnet is tied securely to the cord. A narrow slot should be no trouble now.",
      icon: "hook",
    },
    {
      id: "comb",
      name: "Registration comb",
      description:
        "A brass part that belongs in the position rail. Its teeth make the slots distinct.",
      icon: "comb",
    },
    {
      id: "muddled-report",
      name: "Maintenance report",
      description:
        "The operator substituted “the best matching key” for “the mixture of values.” Ada has circled this sentence three times.",
      icon: "record",
    },
    {
      id: "cartridge",
      name: "Reference cartridge",
      description:
        "Small illustrative query, key and value vectors, with a working numerical trace. These are demonstration values, not learned meanings of words.",
      icon: "cartridge",
    },
    {
      id: "lost-ticket",
      name: "Lost listening ticket",
      description:
        "Admit one small puffin. Seat: beside the person you like best.",
      icon: "ticket",
    },
    {
      id: "keepsake",
      name: "Pocket announcer",
      description:
        "Pip’s tiny announcement booth. It is certified to make no useful announcements whatsoever.",
      icon: "gift",
    },
  ],
  discoveries: [
    {
      id: "sequence-clue",
      title: "The same pieces, a different order",
      text: "The dispatch and received strip contain the same tokens in a different sequence. The damaged position rail is worth investigating.",
      sourceIds: ["transformer-notes"],
    },
    {
      id: "mixture-clue",
      title: "A match is not the message",
      text: "The repair record confuses a matching key with the information carried by its value. Compare the reference cartridge with the mixing bench.",
      sourceIds: ["transformer-notes"],
    },
    {
      id: "rehearsal-clue",
      title: "Tomorrow was already on the tape",
      text: "The rehearsal used complete sequences. Earlier outputs could depend on later inputs. The live broadcast cannot provide those future inputs.",
      sourceIds: ["transformer-notes"],
    },
    {
      id: "kindness",
      title: "A seat beside someone you like",
      text: "Pip found the ticket he had saved for his oldest friend. Not every worthwhile discovery belongs to the lesson.",
      sourceIds: [],
    },
  ],
  puzzles: [
    {
      id: "position",
      title: "The position rail",
      instructions:
        "Restore the rail, then compare the same token at different positions. Try a changed order before you install the repair.",
      objectiveId: "order",
      sourceIds: ["transformer-notes"],
      config: fixtures.position,
    },
    {
      id: "attention",
      title: "The attention mixing bench",
      instructions:
        "Trace the comparison into the mixture. Test what happens when the values change while the query and keys stay fixed.",
      objectiveId: "mixture",
      sourceIds: ["transformer-notes"],
      config: fixtures.attention,
    },
    {
      id: "causal",
      title: "The visibility shutters",
      instructions:
        "Earlier outputs must not depend on later inputs. Test a changed future and make sure permitted context can still contribute.",
      objectiveId: "visibility",
      sourceIds: ["transformer-notes"],
      config: fixtures.causal,
    },
  ],
  rules: [
    pickup(
      "dispatch-slip",
      "Wren’s original dispatch. The order is clear, even if the announcer disagrees.",
    ),
    pickup(
      "cord",
      "You coil the cord. Pip asks you to return any tea bags attached to it.",
    ),
    pickup("magnet", "The magnet joins your bag with a reassuring clink."),
    pickup(
      "muddled-report",
      "A report written with enormous confidence and rather little testing.",
    ),
    pickup(
      "cartridge",
      "A reference cartridge with a complete worked trace. Its seal says “Please compare the numbers.”",
    ),
    pickup(
      "lost-ticket",
      "A small listening ticket has slipped beneath the crate.",
    ),
    rule(
      "intro-wren",
      "wren",
      [
        "I was told to report to the teapot. I reported. It said nothing.",
        "Ada is investigating the print workshop. Tock is defending his maintenance record. I suggest speaking to both.",
      ],
      [],
      undefined,
      "interact",
      undefined,
      "Captain Wren",
      "wren",
    ),
    rule(
      "intro-pip",
      "pip",
      [
        "I have been promoted to “tea recipient.” Apparently Wren is sending me to myself.",
        "Take the cord and the maintenance report. If you see a little listening ticket, I would be grateful.",
      ],
      [],
      undefined,
      "interact",
      undefined,
      "Pip",
      "pip",
    ),
    rule(
      "intro-ada",
      "ada",
      [
        "The registration comb fell behind the archive cabinet. It is brass-plated steel, so a magnet will reach it if you can lower one into the slot.",
        "Bring the original dispatch to the position rail. We need to compare what was sent with what arrived.",
      ],
      [],
      undefined,
      "interact",
      undefined,
      "Ada",
      "ada",
    ),
    rule(
      "intro-tock",
      "tock",
      [
        "The machine achieved perfect rehearsal scores. I have ordered a larger nameplate.",
        "The reference cartridge is in the archive. The report at Pip’s explains my extremely minor improvement.",
      ],
      [],
      undefined,
      "interact",
      undefined,
      "Tock",
      "tock",
    ),
    rule(
      "read-dispatch",
      "dispatch-slip",
      [
        "The original and received strips use the same pieces in different orders.",
      ],
      [discover("sequence-clue")],
      has("dispatch-slip"),
      "inspect",
    ),
    rule(
      "read-report",
      "muddled-report",
      [
        "“Choose the best key and send it onwards.” The reference says to mix the VALUES. These are different operations.",
      ],
      [discover("mixture-clue")],
      has("muddled-report"),
      "inspect",
    ),
    rule(
      "tie-retriever",
      "cord",
      ["Magnet, meet cord. A modest invention with a promising future."],
      [
        grant("retriever"),
        { type: "consumeItem", item: "magnet" },
        { type: "consumeItem", item: "cord" },
      ],
      all(has("magnet"), has("cord")),
      "combine",
      "magnet",
    ),
    rule(
      "retrieve-comb",
      "cabinet",
      [
        "The magnet catches something. Slowly, a registration comb rises through the slot.",
      ],
      [grant("comb"), set("comb-recovered")],
      all(has("retriever"), not(flag("comb-recovered"))),
      "use",
      "retriever",
    ),
    rule("inspect-cabinet", "cabinet", [
      "Something metal is just visible through the slot. Your fingers will not fit.",
    ]),
    rule(
      "open-position",
      "position-rail",
      [
        "The comb fits, and the original dispatch gives you a comparison to test.",
      ],
      [open("position")],
      all(has("comb"), has("dispatch-slip")),
    ),
    rule("position-needs", "position-rail", [
      "The rail is missing a registration comb. Bring it and the original dispatch slip.",
    ]),
    rule(
      "open-attention",
      "attention-bench",
      [
        "The cartridge clicks into place. The report gives you a specific fault to investigate.",
      ],
      [open("attention")],
      all(has("cartridge"), has("muddled-report")),
    ),
    rule("attention-needs", "attention-bench", [
      "You need the archive’s reference cartridge and Pip’s maintenance report before changing these connections.",
    ]),
    rule(
      "run-rehearsal",
      "rehearsal",
      [
        "The rehearsal is perfect. Tock begins measuring his new nameplate.",
        "Then you turn over the tape. Every future token was already filled in. The machine was allowed to peek.",
        "The live transmission needs a different visibility rule. Investigate the shutters with a changed sequence.",
      ],
      [set("rehearsal-run"), discover("rehearsal-clue")],
      all(passed("position"), passed("attention")),
    ),
    rule("rehearsal-needs", "rehearsal", [
      "Both the position rail and attention bench must work before the rehearsal tells you anything useful.",
    ]),
    rule(
      "open-causal",
      "shutters",
      [
        "Open the right view of the past. Keep tomorrow out of this position’s computation.",
      ],
      [open("causal")],
      flag("rehearsal-run"),
    ),
    rule("shutters-needs", "shutters", [
      "First run the rehearsal. Its diagnostic tape may explain what these shutters should hide.",
    ]),
    rule(
      "release-broadcast",
      "broadcast-bell",
      [
        "A quiet click. A clear announcement. For once, nobody is being summoned by a teapot.",
      ],
      [set("broadcast-sent")],
      all(passed("position"), passed("attention"), passed("causal")),
    ),
    rule("bell-wait", "broadcast-bell", [
      "Wren rests a paw on the bell. “Let’s test the repairs before we announce anything else.”",
    ]),
    rule(
      "return-ticket",
      "pip",
      [
        "You found it! My friend always sits beside the loudspeaker.",
        "Take this pocket announcer. Its only talent is being delightfully unhelpful.",
      ],
      [
        grant("keepsake"),
        { type: "consumeItem", item: "lost-ticket" },
        discover("kindness"),
      ],
      has("lost-ticket"),
      "use",
      "lost-ticket",
      "Pip",
      "pip",
    ),
  ],
  hints: [
    {
      when: all(passed("causal"), not(flag("broadcast-sent"))),
      text: "The repairs passed. Wren is waiting beside the broadcast bell on the jetty.",
    },
    {
      when: all(flag("rehearsal-run"), not(passed("causal"))),
      text: "The shutters in the loft control which input positions can contribute. Compare a changed future.",
    },
    {
      when: all(
        passed("position"),
        passed("attention"),
        not(flag("rehearsal-run")),
      ),
      text: "Both investigations are ready. Run the rehearsal machine in the broadcast loft.",
    },
    {
      when: all(has("comb"), has("dispatch-slip"), not(passed("position"))),
      text: "The workshop’s position rail can now be tested with the comb and original dispatch.",
    },
    {
      when: all(has("retriever"), not(has("comb"))),
      text: "Try your magnetic retriever on the narrow cabinet slot in the archive.",
    },
    {
      when: all(
        has("cartridge"),
        has("muddled-report"),
        not(passed("attention")),
      ),
      text: "The attention bench needs the reference cartridge and maintenance report you are carrying.",
    },
    {
      when: { all: [] },
      text: "Speak with Ada in the workshop and Pip in the listening room. Two leads can be followed in either order.",
    },
  ],
  completion: flag("broadcast-sent"),
  referenceSolution: [
    { type: "start" },
    { type: "interact", target: "dispatch-slip" },
    { type: "move", scene: "cafe" },
    { type: "interact", target: "cord" },
    { type: "interact", target: "muddled-report" },
    { type: "move", scene: "press" },
    { type: "interact", target: "magnet" },
    { type: "combine", item: "magnet", target: "cord" },
    { type: "move", scene: "archive" },
    { type: "use", item: "retriever", target: "cabinet" },
    { type: "interact", target: "cartridge" },
    { type: "move", scene: "press" },
    { type: "interact", target: "position-rail" },
    solve("position"),
    { type: "move", scene: "relay" },
    { type: "interact", target: "attention-bench" },
    solve("attention"),
    { type: "move", scene: "broadcast" },
    { type: "interact", target: "rehearsal" },
    { type: "interact", target: "shutters" },
    solve("causal"),
    { type: "move", scene: "dispatch" },
    { type: "interact", target: "broadcast-bell" },
  ],
};
