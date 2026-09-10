import { DISCOVERIES, ITEMS, ROOM_HOTSPOTS, ROOMS } from "./episode";
import type {
  AdventureAction,
  AdventureState,
  Dialogue,
  Hotspot,
  ItemId,
  PuzzleId,
  RoomId,
  TransitionResult,
} from "./model";

const FLAG_IDS = [
  "workshopReady",
  "bulbTested",
  "brokenBulbTested",
  "lampOpened",
  "lampBuilt",
  "junctionSeen",
  "photoSeen",
  "photoPresented",
  "recordRecovered",
  "recordPresented",
  "retrieverBuilt",
  "robotHelp",
  "signalsOpened",
  "signalsFixed",
  "feederOpened",
  "feederFixed",
  "favorAsked",
  "favorDone",
  "mementoOpened",
  "buttonMet",
  "teapotTried",
] as const;
const own = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);
const has = (state: AdventureState, item: ItemId) =>
  state.inventory.includes(item);

export function createInitialState(): AdventureState {
  return {
    version: 1,
    started: false,
    room: "jetty",
    inventory: [],
    flags: {},
    discoveries: [],
    visited: ["jetty"],
    hintsUsed: 0,
    attempts: 0,
    completed: false,
  };
}

export function getHotspots(state: AdventureState): Hotspot[] {
  return ROOM_HOTSPOTS[state.room]
    .filter((spot) => {
      if (spot.item && has(state, spot.item)) return false;
      if (state.flags.lampBuilt && ["casing", "cell", "bulb"].includes(spot.id))
        return false;
      if (state.flags.retrieverBuilt && ["hook", "reel"].includes(spot.id))
        return false;
      if (
        spot.id === "planks" &&
        (has(state, "keepsake") || state.flags.favorDone)
      )
        return false;
      return true;
    })
    .map((spot) => ({ ...spot }));
}

export function getObjective(state: AdventureState): string {
  if (state.completed)
    return state.flags.favorDone
      ? "The ferry is home. Explore the bay and your pocket harbor."
      : "The ferry is home. There may still be someone you can help.";
  if (!state.started) return "Bring the last ferry home.";
  if (state.flags.feederFixed)
    return "Return to the jetty and bring the ferry in.";
  if (state.flags.signalsFixed)
    return "Find out why both signals failed during the handover.";
  if (state.flags.robotHelp)
    return "Give the two signals independent paths to the supply.";
  if (state.flags.junctionSeen && state.flags.recordRecovered)
    return "Compare your evidence with Tock’s account of the repair.";
  if (state.flags.junctionSeen)
    return "Follow the old photograph and find the repair record.";
  if (state.flags.recordRecovered)
    return "Find physical evidence of the installed wiring.";
  return "Investigate the failed signals: follow the records and inspect the installation.";
}

/** Hints reflect actual inventory and world state; they never consume a required object. */
export function getHint(state: AdventureState): string {
  if (!state.started)
    return "Captain Wren is waiting at the jetty. Start the case to meet her.";
  if (state.completed) {
    if (state.flags.mementoOpened)
      return "Everything important is home. Button is accepting applications for First Mate.";
    if (state.flags.favorDone)
      return "Inspect Pip’s pocket harbor. Its little crab-shaped latch may interest Button.";
    if (has(state, "keepsake"))
      return "The charm is engraved “Pip”. She is in the tea room.";
    if (has(state, "retriever"))
      return "There is a glint beneath the jetty planks. Your retriever can reach it.";
  }
  if (state.flags.feederFixed)
    return "Captain Wren can bring the ferry in now. Click the ferry at the jetty.";
  if (state.flags.signalsFixed) {
    if (!has(state, "lead"))
      return "Both lamps lost power together. Take the insulated jumper lead from the store room, then inspect the lantern room’s supply console.";
    return "At the lantern room console, test the shared supply and each branch. Find the open connection that both signals depend on.";
  }
  if (state.flags.robotHelp)
    return "Tock has opened the signal-house panel. Give each lamp a separate complete branch across the supply, then test an open branch.";
  if (
    state.flags.junctionSeen &&
    state.flags.photoSeen &&
    state.flags.recordRecovered
  ) {
    if (!state.flags.photoPresented)
      return "Show the old photograph to Tock in the signal house. It establishes the installation before the renovation.";
    if (!state.flags.recordPresented)
      return "Show the B-12 repair record to Tock. Its drawing can be compared with the junction you saw.";
  }
  if (!state.flags.junctionSeen) {
    if (state.flags.lampBuilt)
      return "Use the portable lamp on the dark service recess in the signal house.";
    if (!state.flags.workshopReady)
      return "Ada in the workshop can lend a tester. You can also follow the photograph in Pip’s tea room independently.";
    if (!has(state, "casing"))
      return "The portable-lamp casing is on Ada’s workshop bench. It needs a cell and an intact lamp module.";
    if (!has(state, "cell") || !has(state, "bulb"))
      return "The store room has a battery cartridge and spare lamp modules. Take the intact-looking one and check it with the tester.";
    if (!state.flags.bulbTested)
      return "Select the tester, then the spare lamp module in your inventory. Check for a conducting path before building it into the lamp.";
    return "Combine two of the lamp’s three parts, or inspect Ada’s assembly bench with the casing, cartridge, and tested module in your inventory.";
  }
  if (!state.flags.photoSeen)
    return "Pip’s old harbor photograph has a handwritten caption. Inspect it in the tea room.";
  if (!state.flags.recordRecovered) {
    if (!has(state, "retriever")) {
      if (!has(state, "hook"))
        return "The B-12 card slipped behind a store-room cubby. A hook hangs in Ada’s workshop.";
      if (!has(state, "reel"))
        return "The hook needs more reach. There is a retractable cord in the store room.";
      return "Combine the hook with the retractable cord, then use the retriever on the maintenance cubbies.";
    }
    return "Use your hook-and-cord retriever on the store room’s maintenance cubbies. The photograph identifies B-12.";
  }
  return "Talk to Tock and show the photograph and repair record. The service recess provides the physical evidence.";
}

function validStringArray<T extends string>(
  value: unknown,
  allowed: (id: string) => boolean,
): value is T[] {
  return (
    Array.isArray(value) &&
    value.length <= 80 &&
    value.every((id) => typeof id === "string" && allowed(id)) &&
    new Set(value).size === value.length
  );
}

/** Reject corrupt, incompatible, or internally impossible saves instead of restoring soft locks. */
export function parseSave(raw: string | null): AdventureState | null {
  if (!raw || raw.length > 32_000) return null;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return null;
    const s = candidate as Record<string, unknown>;
    if (
      s.version !== 1 ||
      typeof s.started !== "boolean" ||
      typeof s.completed !== "boolean" ||
      typeof s.room !== "string" ||
      !own(ROOMS, s.room)
    )
      return null;
    if (
      !validStringArray<ItemId>(s.inventory, (id) => own(ITEMS, id)) ||
      !validStringArray<RoomId>(s.visited, (id) => own(ROOMS, id)) ||
      !validStringArray<string>(s.discoveries, (id) => own(DISCOVERIES, id))
    )
      return null;
    if (!s.visited.includes(s.room as RoomId) || !s.visited.includes("jetty"))
      return null;
    if (!s.flags || typeof s.flags !== "object" || Array.isArray(s.flags))
      return null;
    const entries = Object.entries(s.flags);
    if (
      entries.some(
        ([key, value]) =>
          !FLAG_IDS.includes(key as (typeof FLAG_IDS)[number]) ||
          typeof value !== "boolean",
      )
    )
      return null;
    if (
      ![s.hintsUsed, s.attempts].every(
        (n) =>
          typeof n === "number" &&
          Number.isSafeInteger(n) &&
          n >= 0 &&
          n <= 1_000_000,
      )
    )
      return null;
    const state: AdventureState = {
      version: 1,
      started: s.started,
      completed: s.completed,
      room: s.room as RoomId,
      inventory: [...s.inventory],
      visited: [...s.visited],
      discoveries: [...s.discoveries],
      flags: Object.fromEntries(entries),
      hintsUsed: s.hintsUsed as number,
      attempts: s.attempts as number,
    };
    const f = state.flags;
    if (
      !state.started &&
      (state.inventory.length ||
        state.discoveries.length ||
        Object.values(f).some(Boolean) ||
        state.completed ||
        state.room !== "jetty")
    )
      return null;
    if (!!f.workshopReady !== has(state, "tester")) return null;
    if (!!f.photoSeen !== has(state, "photo")) return null;
    if (
      !!f.retrieverBuilt !== has(state, "retriever") ||
      (f.retrieverBuilt && (has(state, "hook") || has(state, "reel")))
    )
      return null;
    if (
      !!f.lampBuilt !== has(state, "lamp") ||
      (f.lampBuilt &&
        (!f.lampOpened ||
          !f.workshopReady ||
          !f.bulbTested ||
          ["casing", "cell", "bulb"].some((item) =>
            has(state, item as ItemId),
          )))
    )
      return null;
    if (
      f.bulbTested &&
      (!f.workshopReady || (!has(state, "bulb") && !f.lampBuilt))
    )
      return null;
    if (f.brokenBulbTested && (!f.workshopReady || !has(state, "broken-bulb")))
      return null;
    if (
      f.lampOpened &&
      (!f.workshopReady ||
        !f.bulbTested ||
        (!f.lampBuilt &&
          !["casing", "cell", "bulb"].every((item) =>
            has(state, item as ItemId),
          )))
    )
      return null;
    if (f.junctionSeen && !f.lampBuilt) return null;
    if (
      !!f.recordRecovered !== has(state, "record") ||
      (f.recordRecovered && (!f.photoSeen || !f.retrieverBuilt))
    )
      return null;
    if (
      (f.photoPresented && !f.photoSeen) ||
      (f.recordPresented && !f.recordRecovered)
    )
      return null;
    if (
      f.robotHelp &&
      (!f.junctionSeen || !f.photoPresented || !f.recordPresented)
    )
      return null;
    if ((f.signalsOpened || f.signalsFixed) && !f.robotHelp) return null;
    if (f.signalsFixed && !f.signalsOpened) return null;
    if (
      (f.feederOpened || f.feederFixed) &&
      (!f.signalsFixed || !has(state, "lead") || !has(state, "tester"))
    )
      return null;
    if (f.feederFixed && !f.feederOpened) return null;
    if (state.completed && !f.feederFixed) return null;
    if (
      !!f.favorDone !== has(state, "memento") ||
      (f.favorDone && (has(state, "keepsake") || !f.retrieverBuilt))
    )
      return null;
    if (has(state, "keepsake") && !f.retrieverBuilt) return null;
    if (f.mementoOpened && !f.favorDone) return null;
    return state;
  } catch {
    return null;
  }
}

export function transition(
  previous: AdventureState,
  action: AdventureAction,
): TransitionResult {
  if (action.type === "restart") return { state: createInitialState() };
  const state: AdventureState = {
    ...previous,
    flags: { ...previous.flags },
    inventory: [...previous.inventory],
    visited: [...previous.visited],
    discoveries: [...previous.discoveries],
  };
  const say = (
    speaker: string,
    lines: string | string[],
    extra: Partial<Omit<TransitionResult, "state" | "dialogue">> = {},
    choices?: Dialogue["choices"],
  ): TransitionResult => ({
    state,
    dialogue: {
      speaker,
      lines: typeof lines === "string" ? [lines] : lines,
      ...(choices ? { choices } : {}),
    },
    sound: "talk",
    ...extra,
  });
  const wrong = (line: string, speaker = "You") => {
    state.attempts += 1;
    return say(speaker, line, { sound: "wrong" });
  };
  const give = (item: ItemId) => {
    if (!has(state, item)) state.inventory.push(item);
  };
  const remove = (...items: ItemId[]) => {
    state.inventory = state.inventory.filter((item) => !items.includes(item));
  };
  const discover = (id: string) => {
    if (!state.discoveries.includes(id)) state.discoveries.push(id);
  };
  const readyRobot = (): boolean => {
    if (
      state.flags.junctionSeen &&
      state.flags.photoPresented &&
      state.flags.recordPresented &&
      !state.flags.robotHelp
    ) {
      state.flags.robotHelp = true;
      discover("diagnosis");
      return true;
    }
    return false;
  };
  const openPuzzle = (puzzle: PuzzleId): TransitionResult => {
    if (puzzle === "lamp") {
      if (state.flags.lampBuilt)
        return say(
          "Ada",
          "Your portable lamp is already working. Find somewhere dark and put it to work.",
        );
      if (state.room !== "workshop")
        return say(
          "You",
          "These parts belong together. Ada’s assembly bench will hold them steady.",
        );
      if (!state.flags.workshopReady)
        return say(
          "Ada",
          "Talk to me before borrowing the bench. I have a tester and a very small speech.",
        );
      if (
        !["casing", "cell", "bulb"].every((item) => has(state, item as ItemId))
      )
        return say(
          "Ada",
          "The casing needs a battery cartridge and a working lamp module. Check the store room for both.",
        );
      if (!state.flags.bulbTested)
        return say(
          "Ada",
          "First check the spare module with your tester, while it is disconnected. A good component is a good place to start.",
        );
      state.flags.lampOpened = true;
    }
    if (puzzle === "signals") {
      if (state.flags.signalsFixed)
        return say(
          "Tock",
          state.flags.feederFixed
            ? "Independent branches verified. I have also independently apologized."
            : "The new branches passed their test, but both lamps went out during handover. Check the shared supply in the lantern room.",
        );
      if (!state.flags.robotHelp || state.room !== "signalhouse")
        return say(
          "Tock",
          "The service hatch stays shut until we establish what changed. Show me the old photograph and the repair record, and inspect the wiring in that dark recess.",
        );
      state.flags.signalsOpened = true;
    }
    if (puzzle === "feeder") {
      if (state.flags.feederFixed)
        return say(
          "You",
          "The shared connection is repaired and the branch test passed. Captain Wren can bring the ferry in.",
        );
      if (!state.flags.signalsFixed || state.room !== "lantern")
        return say(
          "You",
          "This is the shared supply console. First investigate the installation with Tock downstairs.",
        );
      if (!has(state, "tester"))
        return say("You", "I need Ada’s tester to trace this failure.");
      if (!has(state, "lead"))
        return say(
          "You",
          "I should collect the insulated jumper lead from the store room before opening the repair console.",
        );
      state.flags.feederOpened = true;
    }
    return { state, puzzle, sound: "door" };
  };
  const testBulb = (item: "bulb" | "broken-bulb"): TransitionResult => {
    if (!has(state, "tester"))
      return wrong(
        "Ada has a tester in her workshop. Looking confident is not a measurement.",
      );
    give(item);
    if (item === "bulb") {
      state.flags.bulbTested = true;
      discover("testedBulb");
      return say(
        "Tester",
        [
          "Beep! The isolated spare module has a conducting path between its contacts.",
          "This module is suitable for the portable lamp. The battery and casing will still need to complete the rest of the loop.",
        ],
        { sound: "success" },
      );
    }
    state.flags.brokenBulbTested = true;
    discover("brokenBulb");
    return say("Tester", [
      "No beep. The filament has a gap, so this module cannot complete a path.",
      "You keep it. Perhaps the harbor needs a very small vase.",
    ]);
  };
  const present = (character: string, item: ItemId): TransitionResult => {
    if (character === "tock" && item === "photo") {
      state.flags.photoPresented = true;
      if (readyRobot())
        return say(
          "Tock",
          [
            "The photograph, the record, and the junction agree. My backup depended on the original lamp.",
            "I can reach the overhead latch. You design the new connections; I shall provide the long arms and the constructive embarrassment.",
          ],
          { sound: "success" },
        );
      return say("Tock", [
        "Both lights worked before my renovation. That is… historically inconvenient.",
        state.flags.recordPresented
          ? "We still need physical evidence. The service recess is too dark to inspect without a portable lamp."
          : "The photo names cubby B-12. My repair record should explain what I changed.",
      ]);
    }
    if (character === "tock" && item === "record") {
      state.flags.recordPresented = true;
      if (readyRobot())
        return say(
          "Tock",
          [
            "One path through both lamps. If the first opens, the “backup” loses its path too.",
            "You have the evidence. I will open the service hatch and hold the overhead cable while you connect independent branches.",
          ],
          { sound: "success" },
        );
      return say("Tock", [
        "Yes, that is my drawing. I was quite proud of saving wire.",
        !state.flags.photoPresented
          ? "Show me the old photograph as well. We should establish what worked before the change."
          : "Can you check the actual junction in the service recess? We should compare my drawing with what is really there.",
      ]);
    }
    if (character === "pip" && item === "keepsake") {
      remove("keepsake");
      give("memento");
      state.flags.favorDone = true;
      discover("favor");
      return say(
        "Pip",
        [
          "My little teacup! I thought the tide had swallowed it.",
          "Take this pocket harbor. I made it for someone who brings things home. Mind the latch underneath; Button has been eyeing it professionally.",
        ],
        { sound: "success" },
      );
    }
    if (character === "button" && item === "memento") {
      state.flags.mementoOpened = true;
      discover("secret");
      return say(
        "Button",
        [
          "Click. Click-click. TA-DA.",
          "Button opens the crab-shaped latch. A tiny captain’s cap pops up beside a painted berth marked “BUTTON”. He has promoted himself.",
        ],
        { sound: "success" },
      );
    }
    if (character === "ada" && item === "broken-bulb")
      return say(
        "Ada",
        "That gap is why it cannot conduct. Keep it for comparison. Or put one extremely small flower in it.",
      );
    if (character === "tock" && item === "lamp")
      return say(
        "Tock",
        "A successful loop! I recommend shining it into the service recess. I do not recommend shining it directly at my embarrassment sensor.",
      );
    if (character === "pip" && item === "photo")
      return say(
        "Pip",
        "That was before Tock’s renovation. The caption tells you which wiring record to find: B-12. I label my memories. Saves time.",
      );
    if (character === "button")
      return say(
        "Button",
        item === "broken-bulb"
          ? "Button peers into the broken lamp module. He declines the studio apartment."
          : "Button inspects your offering, then points one claw toward the glint beneath the jetty planks. A professional stays on task.",
      );
    const names: Record<string, string> = {
      wren: "Captain Wren",
      pip: "Pip",
      ada: "Ada",
      tock: "Tock",
    };
    return say(
      names[character] ?? "You",
      item === "tester"
        ? "Useful equipment. Try it on an isolated lamp module, or use it at the supply console."
        : `I admire your commitment to ${ITEMS[item].name.toLowerCase()}. I do not currently have a use for it.`,
    );
  };

  if (action.type === "start") {
    if (state.started) return { state };
    state.started = true;
    discover("briefing");
    discover("assumptions");
    return say("Captain Wren", [
      "The last ferry is waiting in the fog. Its passengers have started an accordion club. We must act.",
      "One signal flickered, then both went dark. Tock calls the second one a “backup”.",
      "Ada has tools. Pip saw the lights before the renovation. Have a look around—I’ll keep the ferry clear of the rocks.",
    ]);
  }
  if (!state.started) return { state };
  if (action.type === "move") {
    if (!own(ROOMS, action.room))
      return wrong("That place is not on the harbor map.");
    state.room = action.room;
    if (!state.visited.includes(action.room)) state.visited.push(action.room);
    return { state, sound: "door" };
  }
  if (action.type === "hint") {
    state.hintsUsed += 1;
    return say("Field notebook", getHint(state));
  }
  if (action.type === "inspect") {
    if (!has(state, action.item))
      return wrong("I should find that object before inspecting it.");
    if (action.item === "memento")
      return say(
        "You",
        state.flags.mementoOpened
          ? "Button’s secret captain’s cap springs up. The tiny ferry gives a celebratory wobble."
          : [
              ITEMS.memento.description,
              "Button is down at the jetty. He seems unusually qualified to open this.",
            ],
      );
    if (action.item === "photo") discover("photo");
    if (action.item === "record") discover("record");
    return say(ITEMS[action.item].name, ITEMS[action.item].description);
  }
  if (action.type === "combine") {
    if (!has(state, action.a) || !has(state, action.b))
      return wrong(
        "Both objects need to be in my inventory. Nothing has been used up.",
      );
    if (action.a === action.b)
      return say("You", "It is already very well combined with itself.");
    const pair = [action.a, action.b];
    if (pair.includes("tester") && pair.includes("bulb"))
      return testBulb("bulb");
    if (pair.includes("tester") && pair.includes("broken-bulb"))
      return testBulb("broken-bulb");
    if (pair.includes("hook") && pair.includes("reel")) {
      remove("hook", "reel");
      give("retriever");
      state.flags.retrieverBuilt = true;
      return say(
        "You",
        [
          "The hook clips securely to the retractable cord.",
          "Excellent. An arm extension with absolutely no elbow obligations.",
        ],
        { sound: "success" },
      );
    }
    if (pair.every((item) => ["casing", "cell", "bulb"].includes(item)))
      return openPuzzle("lamp");
    if (
      pair.includes("broken-bulb") &&
      (pair.includes("casing") || pair.includes("cell"))
    )
      return wrong(
        "The cracked filament leaves a gap. No arrangement of the other parts will mend that module.",
      );
    if (pair.includes("photo") && pair.includes("record"))
      return say(
        "You",
        "The photograph shows the earlier working installation. The record documents Tock’s change. Show each to Tock and compare them with the actual junction.",
      );
    return wrong(
      `The ${ITEMS[action.a].name.toLowerCase()} and ${ITEMS[action.b].name.toLowerCase()} remain two excellent, separate objects.`,
    );
  }
  if (action.type === "solve") {
    const requirements: Record<PuzzleId, boolean> = {
      lamp:
        state.room === "workshop" &&
        !!state.flags.lampOpened &&
        !!state.flags.workshopReady &&
        !!state.flags.bulbTested &&
        ["casing", "cell", "bulb"].every((item) => has(state, item as ItemId)),
      signals:
        state.room === "signalhouse" &&
        !!state.flags.signalsOpened &&
        !!state.flags.robotHelp &&
        !!state.flags.junctionSeen &&
        !!state.flags.photoPresented &&
        !!state.flags.recordPresented,
      feeder:
        state.room === "lantern" &&
        !!state.flags.feederOpened &&
        !!state.flags.signalsFixed &&
        has(state, "tester") &&
        has(state, "lead"),
    };
    const completedFlag: Record<PuzzleId, string> = {
      lamp: "lampBuilt",
      signals: "signalsFixed",
      feeder: "feederFixed",
    };
    if (!own(requirements, action.puzzle))
      return wrong("There is no such apparatus in this case.");
    if (state.flags[completedFlag[action.puzzle]]) return { state };
    if (!requirements[action.puzzle])
      return wrong(
        "The apparatus is not ready. Investigate the needed evidence and open the actual mechanism first.",
      );
    state.flags[completedFlag[action.puzzle]] = true;
    if (action.puzzle === "lamp") {
      remove("casing", "cell", "bulb");
      give("lamp");
      discover("loop");
      return say(
        "Ada",
        [
          "A complete path through the lamp and back to the source. Look at it shine!",
          "Take your portable lamp to Tock’s dark service recess. Knowing a component works is useful; seeing how it is connected is the next question.",
        ],
        { sound: "success" },
      );
    }
    if (action.puzzle === "signals") {
      discover("parallel");
      return say(
        "Tock",
        [
          "Each lamp has its own branch. Open one, and the other keeps shining. That is a backup worth the name.",
          "Initiating handover… clunk. Oh. Both lamps are dark again.",
          "The branches were just tested. Check what they still share: the supply console in the lantern room. I will stay here and refrain from improving anything.",
        ],
        { sound: "success" },
      );
    }
    discover("feeder");
    discover("verified");
    return say(
      "Captain Wren · radio",
      [
        "Both signals are back! And one stays lit when the other branch opens.",
        "A shared supply fault—different from one failed lamp. Good catch.",
        "Come back to the jetty. There is a ferry full of people who would like to applaud you, and possibly recruit you to their accordion club.",
      ],
      { sound: "success" },
    );
  }
  if (action.type === "talk") {
    if (!getHotspots(state).some((spot) => spot.character === action.character))
      return wrong("I need to be in the same room to talk to them.");
    const c = action.character;
    if (c === "ada") {
      if (!state.flags.workshopReady) {
        give("tester");
        state.flags.workshopReady = true;
        discover("loop");
        return say(
          "Ada",
          [
            "Take this tester. On an isolated lamp module, a beep means there is a conducting path between its two contacts.",
            "A working lamp still needs a complete loop from one source terminal, through the lamp, and back to the other. A single wire is an ambitious beginning, not a circuit.",
            "My portable-lamp casing is yours. Find a cartridge and good module in the store room, test the module, then assemble it here.",
          ],
          { sound: "pickup" },
        );
      }
      if (action.choice === "loop")
        return say(
          "Ada",
          "Think of tracing a continuous route: one source terminal → lamp → other source terminal. If your finger reaches a gap, current cannot complete that path. The assembly bench lets you try it.",
        );
      if (action.choice === "gossip")
        return say(
          "Ada",
          "Tock once alphabetized my screws by the sound they make when dropped. I still cannot find “plink”.",
        );
      return say(
        "Ada",
        state.flags.lampBuilt
          ? "You have made a light. Now use it to find something worth knowing."
          : "Test the spare module, gather the three lamp parts, and bring them to the bench.",
        {},
        [
          { id: "loop", label: "Explain the complete loop." },
          { id: "gossip", label: "Has Tock always been this helpful?" },
        ],
      );
    }
    if (c === "wren") {
      if (state.completed)
        return say("Captain Wren", [
          "The ferry is home. Tock is checking the wiring; Pip is making tea. For once, everyone has the right job.",
          state.flags.favorDone
            ? "And Pip says you brought back something she thought was gone for good. That matters too."
            : "Pip keeps checking her empty charm chain. There may be one smaller rescue left.",
        ]);
      return say(
        "Captain Wren",
        state.flags.feederFixed
          ? "The signals look steady. Click the ferry and we will bring her in."
          : [
              "The first lamp flickered. Then both went dark. A “backup” should have helped, shouldn’t it?",
              "Ada has tools; Pip has an old photograph. Tock is in the signal house, supervising the problem.",
            ],
      );
    }
    if (c === "pip") {
      if (action.choice === "favor") {
        state.flags.favorAsked = true;
        return say("Pip", [
          "I lost my silver teacup charm on the jetty. It slipped between the planks.",
          "It is probably caught just beneath them. If you find something with a little reach… well. I would be grateful.",
        ]);
      }
      if (action.choice === "lights")
        return say(
          "Pip",
          "Both lamps worked before Tock added his backup. The photograph on the wall has the old wiring-record number on it. Take it. Just bring the harbor back in one piece.",
        );
      return say(
        "Pip",
        state.flags.favorDone
          ? "Your table is reserved indefinitely. So is Button’s saucer."
          : "The tea is hot, the harbor is dark, and my lucky charm is missing. A mixed evening.",
        {},
        [
          { id: "lights", label: "What did you see before the lights failed?" },
          ...(!state.flags.favorDone
            ? [{ id: "favor", label: "You lost something?" }]
            : []),
        ],
      );
    }
    if (c === "tock") {
      if (state.flags.robotHelp)
        return say(
          "Tock",
          state.flags.signalsFixed
            ? "Check the shared supply console upstairs. Parallel lamp branches still need their connection to the source."
            : "Service hatch open. I will handle the overhead cable. You can give each lamp its own path through the panel.",
        );
      if (action.choice === "backup")
        return say(
          "Tock",
          "I placed the backup after the first lamp. In the same loop. Very tidy. Why are you making that face? My drawing is in store-room cubby B-12.",
        );
      if (action.choice === "recess")
        return say(
          "Tock",
          "The actual junction is in the recess to my left. It is dark. My night vision is currently scheduled for a future version. A portable lamp would help.",
        );
      return say(
        "Tock",
        "The lights are temporarily engaged in darkness. Please present evidence before initiating criticism.",
        {},
        [
          { id: "backup", label: "How did you install the backup?" },
          { id: "recess", label: "Where can I inspect the wiring?" },
        ],
      );
    }
    if (c === "button") {
      state.flags.buttonMet = true;
      return say("Button", [
        "Click-click. Click.",
        state.flags.favorDone
          ? "Button looks at your pocket harbor, then holds out one very qualified claw."
          : "Button points under the jetty planks. Something small glints below. He is either helping or requesting a submarine.",
      ]);
    }
  }
  if (action.type === "interact") {
    const spot = getHotspots(state).find(
      (candidate) => candidate.id === action.target,
    );
    if (!spot)
      return wrong(
        "That object is not here, or you have already collected it.",
      );
    if (action.item && !has(state, action.item))
      return wrong("I need that object in my inventory first.");
    if (spot.kind === "character" && spot.character)
      return action.item
        ? present(spot.character, action.item)
        : transition(state, { type: "talk", character: spot.character });
    if (action.item === "tester" && ["bulb", "broken-bulb"].includes(spot.id))
      return testBulb(spot.id as "bulb" | "broken-bulb");
    if (spot.id === "recess") {
      if (state.flags.junctionSeen)
        return say(
          "You",
          "The junction shows one path through both lamps. It matches the series arrangement in Tock’s repair drawing.",
        );
      if (action.item !== "lamp")
        return say(
          "You",
          "It is too dark to see the wires. The portable lamp Ada mentioned could illuminate the recess.",
        );
      state.flags.junctionSeen = true;
      discover("junction");
      const helped = readyRobot();
      return say(
        helped ? "Tock" : "You",
        [
          "The light reveals a single path: supply → first lamp → second lamp → return. An open lamp interrupts the path through both.",
          helped
            ? "That matches the evidence you showed me. I will open the service hatch. Let us make this backup independent."
            : "This is physical evidence. Compare it with the old photograph and repair record, and show those to Tock.",
        ],
        { sound: "success" },
      );
    }
    if (spot.id === "cubby") {
      if (state.flags.recordRecovered)
        return say(
          "You",
          "The B-12 repair record is safely in your inventory. Gravity’s filing privileges have been revoked.",
        );
      if (!state.flags.photoSeen)
        return say(
          "You",
          "Dozens of maintenance cubbies. A photograph or dated reference could identify the one we need.",
        );
      if (action.item !== "retriever")
        return say(
          "You",
          "B-12, just as the photograph said. The card has slipped behind the cubby. A hook with a long cord could fish it out.",
        );
      give("record");
      state.flags.recordRecovered = true;
      discover("record");
      return say(
        "You",
        [
          "The retriever catches the B-12 repair card. It says: “Added backup after the first lamp in the same loop.”",
          "Tock has drawn one path through both lamps. This is worth showing him alongside the photograph.",
        ],
        { sound: "pickup" },
      );
    }
    if (spot.id === "planks") {
      if (action.item !== "retriever")
        return say(
          "You",
          "A silver teacup charm is caught beneath the planks. Too far for fingers; a hook on a cord could reach it.",
        );
      give("keepsake");
      return say(
        "You",
        "The hook lifts a tiny silver teacup. “Pip” is engraved on the bottom. Button politely declines all credit, with a rather credit-seeking bow.",
        { sound: "pickup" },
      );
    }
    if (spot.id === "workbench")
      return !action.item ||
        ["casing", "cell", "bulb", "tester"].includes(action.item)
        ? openPuzzle("lamp")
        : wrong(
            "The bench is for the portable lamp. Its casing, cartridge, and tested module belong here.",
          );
    if (spot.id === "panel")
      return !action.item ||
        ["tester", "lead", "record", "photo"].includes(action.item)
        ? openPuzzle("signals")
        : wrong(
            "The signal panel needs new connections, not this object. Tock can open it once the evidence is clear.",
          );
    if (spot.id === "feeder")
      return !action.item || ["tester", "lead"].includes(action.item)
        ? openPuzzle("feeder")
        : wrong(
            "Use the console’s measurements to locate the shared interruption. The tester and jumper lead are the useful tools here.",
          );
    if (spot.id === "ferry") {
      if (action.item)
        return say(
          "Captain Wren",
          "Please do not throw useful equipment at the ferry. The accordion club is easily encouraged.",
        );
      if (!state.flags.feederFixed)
        return say(
          "Captain Wren",
          "I am keeping her clear until we have dependable signals. Find what failed and verify the repair.",
        );
      if (state.completed)
        return say(
          "Captain Wren",
          "All passengers safely ashore. The accordion club has moved to the tea room. Nobody tell Pip I said that.",
        );
      state.completed = true;
      return say(
        "Captain Wren",
        [
          "The ferry glides between the steady lights and settles against the jetty. Every passenger is safely home.",
          "Tock has crossed out “backup” and written “independent branch”. Ada is pretending not to smile.",
          state.flags.favorDone
            ? "Pip touches her recovered charm. “A good night for bringing things home,” she says."
            : "Pip opens the tea room for everyone. Button appoints himself Assistant Biscuit Inspector.",
          "Case closed. You can keep exploring—and your notebook keeps the evidence, including the sources behind the circuits.",
        ],
        { sound: "success" },
      );
    }
    if (spot.id === "window")
      return say(
        "You",
        state.flags.feederFixed
          ? "Both signal lamps shine. Each has its own branch; both still rely on the restored shared supply."
          : state.flags.signalsFixed
            ? "Both lamps went dark together after the handover. Their separate branches were just verified. What do they still share?"
            : "The two signal lamps are dark. Their wiring runs to Tock’s panel downstairs.",
      );
    if (spot.id === "teapot") {
      state.flags.teapotTried = true;
      return say(
        "Pip",
        action.item === "tester"
          ? "The teapot is not an isolated circuit component. Its continuity with my patience is uncertain."
          : "That is my whistling teapot. It knows one note and feels very strongly about it.",
      );
    }
    if (spot.item) {
      if (action.item)
        return wrong(
          "That object does not help here. Inspect the part, take it, or use the tester on an isolated lamp module.",
        );
      give(spot.item);
      if (spot.item === "photo") {
        state.flags.photoSeen = true;
        discover("photo");
      }
      return say(ITEMS[spot.item].name, ITEMS[spot.item].description, {
        sound: "pickup",
      });
    }
  }
  return { state };
}
