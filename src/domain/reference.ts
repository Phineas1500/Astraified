import type { MissionPackage } from "./types";

export const referenceMission: MissionPackage = {
  version: 1,
  id: "harbor-lights-v1",
  title: "The Night the Lighthouse Went Dark",
  subtitle: "A small harbor. A big blackout. Three repairs before nightfall.",
  topic: "Electric circuits",
  description:
    "Investigate a storm-battered harbor and bring its lighthouse back to life. Build circuits, follow the evidence, and make the beacon resilient.",
  briefing:
    "The first festival boats are on their way, but the harbor has gone dark. Keeper Iona has traced the trouble to three stations. Her repair robot, Pip, admits to “tidying up” the wiring. Start in the workshop, test your ideas, and give the boats a light to follow.",
  estimatedMinutes: 15,
  level: "High school · introductory physics",
  generated: false,
  sources: [
    {
      id: "openstax-simple",
      title: "OpenStax · Ohm’s law and simple circuits",
      url: "https://openstax.org/books/college-physics-2e/pages/20-2-ohms-law-resistance-and-simple-circuits",
      text: "Editorial summary: A simple steady-current circuit needs a complete conducting path. For an ohmic resistor, I = V/R: current increases with voltage and decreases with resistance. The mission uses an ideal voltage source and fixed-resistance lamps to make these relationships visible.",
    },
    {
      id: "openstax-series-parallel",
      title: "OpenStax · Resistors in series and parallel",
      url: "https://openstax.org/books/college-physics-2e/pages/21-1-resistors-in-series-and-parallel",
      text: "Editorial summary: Series resistors share the same current, and their resistances add. Parallel branches connect across the same source voltage, and their currents add at the source. Opening one parallel branch leaves the others connected. Resistor power can be calculated as P = I²R or P = V²/R.",
    },
  ],
  objectives: [
    {
      id: "complete-loop",
      title:
        "Restore a complete conducting loop and explain why a gap stops current.",
      sourceIds: ["openstax-simple"],
    },
    {
      id: "shared-path",
      title:
        "Predict how two identical series lamps share voltage and compare their power with one lamp.",
      sourceIds: ["openstax-series-parallel"],
    },
    {
      id: "independent-branches",
      title:
        "Build independent parallel branches and explain why one open lamp does not extinguish the other.",
      sourceIds: ["openstax-series-parallel"],
    },
  ],
  stations: [
    {
      id: "workshop",
      name: "The workshop",
      title: "A light to work by",
      story:
        "“I left a tiny gap for the electricity to rest,” says Pip. Iona hands you the tester. “Start with the bench lamp. Follow its path all the way back to the battery.”",
      task: "Restore the bench lamp by connecting one lamp in a complete loop. Run the test, then explain what the gap changed.",
      concept: "A complete loop",
      sourceIds: ["openstax-simple"],
      hints: [
        "A battery can provide a voltage difference, but a break in the path still stops steady current.",
        "Trace a route from one battery terminal, through lamp A, and back to the other terminal.",
        "Connect battery positive to lamp A’s left terminal, then lamp A’s right terminal to battery negative. Predict what will happen, then test the circuit.",
      ],
      kind: "circuit",
      circuit: { goal: "closed", voltage: 12, resistance: 12 },
      check: {
        question:
          "A torch has a good battery and an intact bulb, but its switch is open. What would closing the switch change?",
        options: [
          "It would increase the battery’s voltage.",
          "It would complete the conducting path so current can flow.",
          "It would remove the bulb’s resistance.",
        ],
        answer: 1,
        explanation:
          "Closing the switch completes the loop. The battery voltage and bulb resistance do not need to change for current to begin flowing.",
      },
    },
    {
      id: "relay",
      name: "The relay house",
      title: "The case of the dim lamps",
      story:
        "Two inspection lamps used to shine brightly. Pip put them in a single neat chain. Iona wants you to recreate that wiring so you can discover what made them dim.",
      task: "Connect both identical lamps in one series path. Test the circuit and compare each lamp’s power with the workshop lamp.",
      concept: "One path, shared voltage",
      sourceIds: ["openstax-simple", "openstax-series-parallel"],
      hints: [
        "A series circuit has one path through both lamps, one after the other.",
        "Two 12 Ω lamps in series give 24 Ω total resistance. With 12 V, the current is 0.5 A.",
        "Connect battery positive to A’s left terminal, A’s right to B’s left, and B’s right to battery negative. Test with neither lamp open. Each lamp dissipates 3 W, compared with the workshop lamp’s 12 W.",
      ],
      kind: "circuit",
      circuit: { goal: "series", voltage: 12, resistance: 12 },
      check: {
        question:
          "Two identical resistive lamps share one series path across an ideal battery. If one lamp opens, what happens to the other?",
        options: [
          "It gets brighter because there is one less working lamp.",
          "It stays at the same brightness.",
          "It goes dark because the only path is interrupted.",
        ],
        answer: 2,
        explanation:
          "The current has only one path through both lamps. An open lamp breaks that path for the whole series circuit.",
      },
    },
    {
      id: "beacon",
      name: "The lighthouse",
      title: "One light must stay on",
      story:
        "Fog is rolling in. The lighthouse needs two lamps, and at least one must keep working if the other opens. “Independent paths,” Iona murmurs. Pip takes a very serious note.",
      task: "Give both beacon lamps independent parallel branches. Run a failure test with one lamp open and keep the other shining.",
      concept: "Independent branches",
      sourceIds: ["openstax-series-parallel"],
      hints: [
        "Both lamps need their own complete route across the battery.",
        "In parallel, the branches split and rejoin. Breaking one branch leaves the other path intact.",
        "Connect each lamp’s left terminal to battery positive and each right terminal to battery negative. Open lamp A or B, then run the test. The other lamp should still receive 12 V and dissipate 12 W.",
      ],
      kind: "circuit",
      circuit: { goal: "parallel", voltage: 12, resistance: 12 },
      check: {
        question:
          "An aquarium pump and a light have separate parallel branches across an ideal power supply. Switching the light off leaves the pump…",
        options: [
          "Operating with the same supply voltage, because its branch remains complete.",
          "Off, because every branch must be closed for any current to flow.",
          "At twice the voltage, because it receives the light’s unused voltage.",
        ],
        answer: 0,
        explanation:
          "The pump is still connected across the same two supply terminals. Opening the light’s branch reduces total source current but does not change the pump’s voltage in this ideal model.",
      },
    },
  ],
  conclusion:
    "The beacon sweeps across the harbor, and the first boat answers with a flash. Pip has crossed “leave electricity a resting gap” out of the maintenance manual. You restored a complete loop, investigated a shared series path, and protected the beacon with independent branches. Your notebook keeps the evidence; a new circuit is your next chance to apply it.",
};
