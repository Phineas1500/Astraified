import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { EvidenceRound } from "../domain/lesson-machines";
import { apparatusKit, type ApparatusPalette } from "./apparatus-kit";
import type { WorldTarget } from "./world";

export interface EvidenceStationPresentation {
  site: "bridge" | "lift";
  title: string;
  activationLabel: string;
  round: EvidenceRound;
}

/** A walkable sorting desk and destination crates. Only runtime assignments move
 * cards into crates; the artwork does not contain or evaluate accepted answers. */
export function createEvidenceStation(
  scene: Scene,
  presentation: EvidenceStationPresentation,
  origin: Vector3,
  palette: ApparatusPalette,
  shadows: ShadowGenerator,
) {
  const kit = apparatusKit(
    scene,
    `${presentation.site} evidence`,
    palette,
    shadows,
  );
  const targets: WorldTarget[] = [];
  const { round } = presentation;
  const width = Math.max(4.5, round.cards.length * 0.88 + 0.6);
  const table = kit.box(
    "source sorting desk",
    width,
    0.15,
    0.82,
    origin.x,
    0.86,
    origin.z - 1.65,
    palette.woodLight,
    true,
  );
  kit.foreground.push(table);
  for (const x of [-width / 2 + 0.25, width / 2 - 0.25])
    for (const z of [-0.25, 0.25])
      kit.box(
        "desk leg",
        0.1,
        0.8,
        0.1,
        origin.x + x,
        0.4,
        origin.z - 1.65 + z,
        palette.teal,
      );
  kit.panel(
    "station title",
    [presentation.title],
    origin.x,
    2.35,
    origin.z + 0.9,
    3,
    0.36,
    true,
  );
  kit.panel(
    "desk invitation",
    ["Read a source card · carry it to a crate"],
    origin.x,
    0.53,
    origin.z - 2.08,
    3.4,
    0.28,
  );
  const crateX = (index: number) =>
    origin.x + (index - (round.slots.length - 1) / 2) * 2.1;
  round.slots.forEach((slot, index) => {
    const x = crateX(index),
      z = origin.z + 1;
    const color = [palette.teal, palette.blue, palette.red][index % 3];
    const base = kit.box(
      "crate base",
      1.65,
      0.12,
      1.05,
      x,
      0.13,
      z,
      palette.woodLight,
      true,
    );
    kit.foreground.push(base);
    for (const side of [-1, 1]) {
      kit.box(
        "crate side",
        0.075,
        0.76,
        1.08,
        x + side * 0.8,
        0.52,
        z,
        color,
        true,
      );
      kit.box(
        "crate corner brass",
        0.09,
        0.85,
        0.09,
        x + side * 0.8,
        0.52,
        z - 0.48,
        palette.brass,
      );
    }
    kit.box("crate back", 1.55, 0.7, 0.08, x, 0.49, z + 0.48, color, true);
    // A low front lip keeps each placed card visible and reachable.
    kit.box("crate front lip", 1.55, 0.3, 0.08, x, 0.28, z - 0.5, color, true);
    kit.box(
      "crate placard post",
      0.065,
      1.38,
      0.065,
      x,
      0.9,
      z + 0.46,
      palette.wood,
    );
    kit.panel(
      `destination ${slot.id}`,
      [slot.label],
      x,
      1.53,
      z + 0.42,
      1.6,
      0.3,
    );
    kit.panel(
      `capacity ${slot.id}`,
      [`Space for ${slot.capacity}`],
      x,
      0.29,
      z - 0.553,
      1.25,
      0.18,
    );
    targets.push({
      id: `${presentation.site}-bin-${slot.id}`,
      kind: "evidence-bin",
      mechanism: presentation.site,
      bin: slot.id,
      label: `Place card in ${slot.label}`,
      position: new Vector3(x, 0, z - 0.95),
    });
  });
  const wrapTitle = (text: string) => {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (line && (line + " " + word).length > 26) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines.length <= 3
      ? lines
      : [...lines.slice(0, 2), `${lines[2].slice(0, 23)}…`];
  };
  const cardProps = round.cards.map((card, index) => {
    const x = origin.x + (index - (round.cards.length - 1) / 2) * 0.88;
    const root = new TransformNode(
      `${presentation.site} source card ${card.id}`,
      scene,
    );
    const backing = kit.box(
      "linen folio",
      0.73,
      0.5,
      0.045,
      0,
      0,
      0,
      palette.white,
    );
    backing.parent = root;
    const title = kit.panel(
      `card ${card.id}`,
      [...wrapTitle(`${index + 1}. ${card.label}`), "SOURCE CARD"],
      0,
      0,
      -0.026,
      0.69,
      0.45,
    );
    title.mesh.parent = root;
    const tab = kit.box(
      "source card corner tab",
      0.17,
      0.085,
      0.012,
      0.25,
      0.21,
      -0.037,
      palette.yellow,
    );
    tab.parent = root;
    const target: WorldTarget = {
      id: `${presentation.site}-card-${card.id}`,
      kind: "evidence-card",
      mechanism: presentation.site,
      evidenceCard: card.id,
      label: `Read & carry ${card.label}`,
      position: new Vector3(x, 0, origin.z - 2.25),
    };
    targets.push(target);
    return { root, target, home: new Vector3(x, 1.04, origin.z - 1.64) };
  });
  const stampX = origin.x + 3.2;
  kit.cylinder(
    "checking pedestal",
    0.78,
    0.3,
    stampX,
    0.39,
    origin.z - 1,
    palette.teal,
  );
  kit.box(
    "postal stamp",
    0.65,
    0.13,
    0.45,
    stampX,
    0.84,
    origin.z - 1,
    palette.brass,
  );
  kit.cylinder(
    "stamp handle",
    0.27,
    0.08,
    stampX,
    1.05,
    origin.z - 1,
    palette.red,
  );
  targets.push({
    id: `${presentation.site}-crank`,
    kind: "crank",
    mechanism: presentation.site,
    label: presentation.activationLabel,
    position: new Vector3(stampX, 0, origin.z - 1.7),
  });
  function setReading(
    assignment: (string | null)[],
    carryingCard: string | null,
    solved: boolean,
  ) {
    cardProps.forEach((prop, index) => {
      prop.root.setEnabled(carryingCard !== round.cards[index].id);
      const slot = assignment[index];
      const slotIndex = round.slots.findIndex((entry) => entry.id === slot);
      if (slotIndex < 0) {
        prop.root.position.copyFrom(prop.home);
        prop.root.rotation.set(Math.PI / 3, 0, 0);
        prop.target.position.set(prop.home.x, 0, origin.z - 2.25);
        prop.target.label = `Read & carry ${round.cards[index].label}`;
      } else {
        const members = assignment.flatMap((value, i) =>
          value === slot ? [i] : [],
        );
        const rank = members.indexOf(index);
        const x =
          crateX(slotIndex) +
          (rank - (members.length - 1) / 2) *
            Math.min(0.62, 1.05 / Math.max(1, members.length - 1));
        prop.root.position.set(x, 1.01, origin.z + 0.93 + rank * 0.04);
        prop.root.rotation.set(0.12, 0, 0);
        prop.target.position.set(x, 0, origin.z + 0.02);
        prop.target.label = `Retrieve ${round.cards[index].label}`;
      }
    });
  }
  return {
    targets,
    foreground: kit.foreground,
    setReading,
    update: kit.update,
  };
}
