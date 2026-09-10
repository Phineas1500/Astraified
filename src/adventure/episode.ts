import type { Hotspot, ItemId, RoomId } from "./model";

export const CIRCUIT_SOURCE =
  "https://openstax.org/books/college-physics-2e/pages/21-1-resistors-in-series-and-parallel";

export const ROOMS: Record<
  RoomId,
  { name: string; description: string; exits: RoomId[] }
> = {
  jetty: {
    name: "The Jetty",
    description:
      "The last ferry waits beyond the fog. Someone on board is playing a very patient accordion.",
    exits: ["tearoom", "workshop", "signalhouse"],
  },
  tearoom: {
    name: "Pip’s Tea Room",
    description:
      "Warm windows, cold scones, and an excellent view of the harbor’s bad decisions.",
    exits: ["jetty", "storeroom"],
  },
  workshop: {
    name: "Ada’s Workshop",
    description: "Everything has a label. The label maker has three.",
    exits: ["jetty", "storeroom"],
  },
  storeroom: {
    name: "The Store Room",
    description:
      "Spare parts, old records, and a filing system best described as gravity.",
    exits: ["tearoom", "workshop", "signalhouse"],
  },
  signalhouse: {
    name: "The Signal House",
    description:
      "Tock has upgraded the harbor. The harbor would like a second opinion.",
    exits: ["jetty", "storeroom", "lantern"],
  },
  lantern: {
    name: "The Lantern Room",
    description: "Two signals, one waiting ferry, and a very long way down.",
    exits: ["signalhouse"],
  },
};

export const ITEMS: Record<ItemId, { name: string; description: string }> = {
  tester: {
    name: "Continuity tester",
    description:
      "Ada’s pocket tester. On an isolated component, a beep means a conducting path exists between its contacts. Never use this setting on an energized circuit.",
  },
  casing: {
    name: "Lamp casing",
    description:
      "A portable lamp missing its cell and bulb. Two exposed contacts connect the source to the lamp and back again.",
  },
  cell: {
    name: "Battery cartridge",
    description:
      "A checked, low-voltage cartridge with a + terminal and a − terminal. A full conducting loop must connect them through a load.",
  },
  bulb: {
    name: "Spare lamp module",
    description:
      "Its filament looks intact. The two contacts underneath invite a closer test before assembly.",
  },
  "broken-bulb": {
    name: "Cracked lamp module",
    description:
      "A visible gap interrupts the filament. Very convincing as a tiny vase; less convincing as a lamp.",
  },
  hook: {
    name: "Bent hook",
    description:
      "A sturdy hook. Useful for grabbing things; limited by your arm’s frankly disappointing length.",
  },
  reel: {
    name: "Retractable cord",
    description:
      "A long cord on a spring reel. The end has an empty attachment ring.",
  },
  photo: {
    name: "Old harbor photograph",
    description:
      "Two signal lamps shine brightly. A handwritten caption reads: “Before Tock’s renovation. Wiring record: cubby B-12.”",
  },
  record: {
    name: "Repair record B-12",
    description:
      "Tock’s note: “Added backup after the first lamp in the same loop. Fewer wires. More tidy.” The diagram shows one path through both lamps.",
  },
  lead: {
    name: "Insulated jumper lead",
    description:
      "A replacement lead for the training rig’s low-voltage connector. It can bridge an identified gap after the supply is isolated.",
  },
  lamp: {
    name: "Portable lamp",
    description:
      "The completed loop lights a working bulb. A small but thoroughly employable sun.",
  },
  retriever: {
    name: "Hook-and-cord retriever",
    description:
      "The hook is securely attached to the retractable cord. It can retrieve small things from narrow spaces.",
  },
  keepsake: {
    name: "Silver teacup charm",
    description:
      "A tiny teacup engraved “Pip”. Someone has polished the handle with years of worrying it.",
  },
  memento: {
    name: "Pocket harbor",
    description:
      "Pip’s thank-you: a little model ferry in a brass tin. There is a suspiciously crab-shaped latch underneath.",
  },
};

export const DISCOVERIES: Record<
  string,
  { title: string; text: string; sourceUrl?: string }
> = {
  briefing: {
    title: "Two lights went dark",
    text: "Captain Wren saw the first lamp flicker, then both signals went out. The ferry needs reliable signals before it can enter.",
  },
  loop: {
    title: "A way out and a way back",
    text: "A lamp needs a complete conducting path from one source terminal, through the lamp, back to the other terminal. A gap anywhere in that path stops current.",
    sourceUrl: CIRCUIT_SOURCE,
  },
  testedBulb: {
    title: "The spare module conducts",
    text: "The isolated spare lamp module passes the continuity check. That supports an intact path through this component; it does not prove the whole installation is connected.",
  },
  brokenBulb: {
    title: "The cracked module has a gap",
    text: "The isolated cracked module does not conduct through its filament. A charged battery cannot make current cross this gap.",
  },
  photo: {
    title: "Before the renovation",
    text: "Pip’s photograph shows both signals working before Tock’s changes. Its caption identifies wiring record B-12 in the store room.",
  },
  record: {
    title: "Tock’s tidy shortcut",
    text: "Record B-12 shows the “backup” was added after the first lamp in the same path. Two lamps do not automatically make independent signals.",
  },
  junction: {
    title: "One shared lamp path",
    text: "The service recess reveals a single route through lamp A and then lamp B. An open lamp branch interrupts both in this series arrangement.",
    sourceUrl: CIRCUIT_SOURCE,
  },
  diagnosis: {
    title: "A backup that depended on the original",
    text: "The physical wiring and Tock’s record agree: both lamps depended on one conducting path. Tock will help reroute the circuit now that the change is documented.",
  },
  parallel: {
    title: "Two independent branches",
    text: "Each lamp now has its own complete branch across the source. Opening one lamp branch leaves the other operating in this ideal circuit.",
    sourceUrl: CIRCUIT_SOURCE,
  },
  feeder: {
    title: "Independent branches still share a source",
    text: "Both lamps failed together despite separate branches. The shared feeder connection was open. Parallel branches do not protect against a failure that disconnects their shared supply.",
    sourceUrl: CIRCUIT_SOURCE,
  },
  verified: {
    title: "The changed case passes",
    text: "After repairing the shared feeder, both lamps work. Opening one lamp branch leaves the other lit. This distinguishes a shared supply fault from an individual branch fault.",
    sourceUrl: CIRCUIT_SOURCE,
  },
  assumptions: {
    title: "About this circuit model",
    text: "The apparatus uses a fixed-voltage, low-voltage source, ideal wires, and equal resistive lamps. Real lamps, cells, and wiring can behave differently. The game’s pocket tester is used only on isolated components.",
    sourceUrl: CIRCUIT_SOURCE,
  },
  favor: {
    title: "Something small brought home",
    text: "Pip’s lost charm was caught beneath the jetty. Returning it earned a pocket harbor—and considerably better tea privileges.",
  },
  secret: {
    title: "Button’s secret berth",
    text: "The model harbor has a hidden compartment for a tiny crab captain. Button approves of this career progression.",
  },
};

const character = (
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Hotspot => ({ id, character: id, label, x, y, w, h, kind: "character" });
const object = (
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  item?: ItemId,
): Hotspot => ({
  id,
  label,
  x,
  y,
  w,
  h,
  kind: "object",
  ...(item ? { item } : {}),
});

/** Interactive assets stay separate from the room paintings. */
export const ROOM_HOTSPOTS: Record<RoomId, Hotspot[]> = {
  jetty: [
    character("wren", "Captain Wren", 18, 34, 19, 44),
    object("ferry", "The waiting ferry", 42, 24, 12, 13),
    character("button", "Button", 47, 73, 8, 10),
    object("planks", "A glint beneath the planks", 72, 74, 12, 9),
  ],
  tearoom: [
    character("pip", "Pip", 59, 38, 17, 36),
    object("photograph", "The old harbor photograph", 22, 34, 16, 20, "photo"),
    object("teapot", "A very opinionated teapot", 37, 64, 11, 12),
  ],
  workshop: [
    character("ada", "Ada", 66, 31, 19, 45),
    object("workbench", "The assembly bench", 31, 49, 27, 27),
    object("casing", "Portable-lamp casing", 15, 64, 12, 13, "casing"),
    object("hook", "A bent hook", 14, 36, 10, 15, "hook"),
  ],
  storeroom: [
    object("cell", "Battery cartridge", 14, 41, 12, 14, "cell"),
    object("bulb", "Spare lamp module", 34, 37, 11, 16, "bulb"),
    object("broken-bulb", "Cracked lamp module", 53, 38, 11, 16, "broken-bulb"),
    object("reel", "Retractable cord", 17, 68, 12, 12, "reel"),
    object("cubby", "The maintenance cubbies", 73, 40, 15, 22),
    object("lead", "Insulated jumper lead", 48, 69, 15, 11, "lead"),
  ],
  signalhouse: [
    character("tock", "Tock", 66, 35, 19, 43),
    object("recess", "The dark service recess", 13, 46, 19, 29),
    object("panel", "Signal wiring panel", 37, 37, 23, 28),
  ],
  lantern: [
    object("feeder", "The supply console", 22, 51, 33, 25),
    object("window", "The harbor signals", 62, 34, 25, 25),
  ],
};
