import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { apparatusKit, type ApparatusPalette } from "./apparatus-kit";
import type { WorldTarget } from "./world";

export interface ExperimentPresentation {
  site: "bridge" | "lift";
  title: string;
  itemLabel: string;
  activationLabel: string;
  socketLabels: readonly string[];
  prediction?: {
    label: string;
    values: number[];
    optionLabels: string[];
    unit: string;
  };
  outputs: {
    id: string;
    label: string;
    unit: string;
    min: number;
    max: number;
  }[];
}

/** Finite experimental bench. Range endpoints come from exhaustive shared-runtime
 * evaluation; each labelled slider displays its actual value on that range. */
export function createExperimentStation(
  scene: Scene,
  presentation: ExperimentPresentation,
  origin: Vector3,
  supplyPosition: Vector3,
  palette: ApparatusPalette,
  shadows: ShadowGenerator,
) {
  const kit = apparatusKit(
    scene,
    `${presentation.site} experiment`,
    palette,
    shadows,
  );
  const targets: WorldTarget[] = [];
  const table = kit.box(
    "measurement bench",
    5.8,
    0.14,
    0.95,
    origin.x,
    0.79,
    origin.z,
    palette.woodLight,
    true,
  );
  kit.foreground.push(table);
  for (const x of [-2.65, 2.65])
    for (const z of [-0.32, 0.32])
      kit.box(
        "bench leg",
        0.12,
        0.73,
        0.12,
        origin.x + x,
        0.37,
        origin.z + z,
        palette.teal,
      );
  kit.panel(
    "station title",
    [presentation.title],
    origin.x,
    2.66,
    origin.z + 0.42,
    3.2,
    0.34,
    true,
  );
  const format = (value: number) => Number(value.toPrecision(4)).toString();
  const gauges = presentation.outputs.map((output, index) => {
    const x = origin.x + (index - (presentation.outputs.length - 1) / 2) * 1.32;
    const rail = kit.box(
      `gauge ${output.id} back`,
      1.15,
      1.36,
      0.07,
      x,
      1.57,
      origin.z + 0.18,
      palette.teal,
    );
    kit.foreground.push(rail);
    kit.box(
      "calibrated gauge track",
      0.035,
      0.94,
      0.04,
      x,
      1.55,
      origin.z + 0.11,
      palette.brass,
    );
    for (const fraction of [0, 0.5, 1]) {
      const value = output.min + (output.max - output.min) * fraction;
      kit.box(
        "calibrated tick",
        0.16,
        0.018,
        0.045,
        x - 0.07,
        1.08 + fraction * 0.94,
        origin.z + 0.075,
        palette.white,
      );
      kit.panel(
        "gauge scale",
        [format(value)],
        x - 0.35,
        1.08 + fraction * 0.94,
        origin.z + 0.07,
        0.43,
        0.15,
      );
    }
    const pointer = kit.box(
      `actual ${output.id} indicator`,
      0.38,
      0.085,
      0.07,
      x,
      1.1,
      origin.z + 0.04,
      palette.yellow,
    );
    const heading = kit.panel(
      `readout ${output.id}`,
      [
        output.label,
        `${format(output.min)} – ${format(output.max)} ${output.unit}`,
      ],
      x,
      2.31,
      origin.z + 0.04,
      1.25,
      0.33,
    );
    const value = kit.panel(
      `value ${output.id}`,
      ["—"],
      x,
      0.99,
      origin.z - 0.49,
      1.22,
      0.2,
    );
    return { pointer, value, output };
  });
  const token = new TransformNode(
    `${presentation.site} experiment cartridge`,
    scene,
  );
  const caseMesh = kit.box(
    "sample case",
    0.42,
    0.5,
    0.34,
    0,
    0,
    0,
    palette.blue,
  );
  const label = kit.panel(
    "sample case tag",
    ["SAMPLE"],
    0,
    0.03,
    -0.176,
    0.36,
    0.16,
  );
  const handle = kit.ring("sample handle", 0.24, 0, 0.3, 0, palette.brass);
  handle.rotation.x = Math.PI / 2;
  for (const part of [caseMesh, label.mesh, handle]) part.parent = token;
  kit.cylinder(
    "sample stand",
    0.7,
    0.36,
    supplyPosition.x,
    0.35,
    supplyPosition.z,
    palette.stone,
  );
  const supplyCaption = kit.panel(
    "sample invitation",
    [presentation.itemLabel],
    supplyPosition.x,
    1.5,
    supplyPosition.z,
    1.8,
    0.28,
  );
  targets.push({
    id: `${presentation.site}-weight`,
    kind: "weight",
    mechanism: presentation.site,
    item: `${presentation.site}-weight`,
    label: `Pick up ${presentation.itemLabel}`,
    position: supplyPosition.clone(),
  });
  const sockets = presentation.socketLabels.map((text, index) => {
    const x = origin.x - (index + 1),
      z = origin.z - 1.2;
    kit.cylinder("sample dock", 0.14, 0.29, x, 0.14, z, palette.teal);
    const ring = kit.ring("sample dock rim", 0.58, x, 0.23, z, palette.brass);
    kit.panel("setting tag", [text], x, 0.5, z - 0.1, 0.91, 0.32);
    targets.push({
      id: `${presentation.site}-slot-${index + 1}`,
      kind: "socket",
      mechanism: presentation.site,
      slot: (index + 1) as 1 | 2 | 3,
      label: `Place ${presentation.itemLabel} · ${text}`,
      position: new Vector3(x, 0, z),
    });
    return ring;
  });
  const checkStand = kit.cylinder(
    "test switch pedestal",
    0.82,
    0.26,
    origin.x,
    0.41,
    origin.z - 2.2,
    palette.teal,
  );
  kit.cylinder(
    "test button",
    0.09,
    0.18,
    origin.x,
    0.87,
    origin.z - 2.2,
    palette.yellow,
  );
  targets.push({
    id: `${presentation.site}-crank`,
    kind: "crank",
    mechanism: presentation.site,
    label: presentation.activationLabel,
    position: new Vector3(origin.x, 0, origin.z - 2.7),
  });
  let dial: ReturnType<typeof kit.panel> | null = null;
  let needle: ReturnType<typeof kit.box> | null = null;
  if (presentation.prediction) {
    const x = origin.x + 1.7,
      z = origin.z - 2.15;
    kit.cylinder("control pedestal", 0.8, 0.23, x, 0.4, z, palette.blue);
    const face = kit.cylinder(
      "control face",
      0.06,
      0.26,
      x,
      1,
      z,
      palette.white,
    );
    face.rotation.x = Math.PI / 2;
    needle = kit.box(
      "control needle",
      0.025,
      0.23,
      0.027,
      x,
      1.07,
      z - 0.06,
      palette.red,
    );
    dial = kit.panel(
      "control setting",
      [presentation.prediction.label],
      x,
      1.47,
      z - 0.08,
      1.7,
      0.32,
    );
    targets.push({
      id: `${presentation.site}-dial`,
      kind: "dial",
      mechanism: presentation.site,
      label: `Adjust ${presentation.prediction.label.toLowerCase()}`,
      position: new Vector3(x, 0, z - 0.6),
    });
  }
  function setReading(next: {
    slot: 1 | 2 | 3 | null;
    carrying: boolean;
    solved: boolean;
    outputs: Record<string, number>;
    prediction?: number;
  }) {
    token.setEnabled(!next.carrying);
    supplyCaption.mesh.setEnabled(
      next.slot === null && !next.carrying && !next.solved,
    );
    if (next.slot === null)
      token.position.set(supplyPosition.x, 1.02, supplyPosition.z);
    else token.position.set(origin.x - next.slot, 0.54, origin.z - 1.2);
    sockets.forEach(
      (socket, index) =>
        (socket.material =
          index + 1 === next.slot ? palette.yellow : palette.brass),
    );
    for (const gauge of gauges) {
      const value = next.outputs[gauge.output.id];
      const range = gauge.output.max - gauge.output.min;
      const fraction = range === 0 ? 0.5 : (value - gauge.output.min) / range;
      gauge.pointer.position.y =
        1.08 + Math.max(0, Math.min(1, fraction)) * 0.94;
      gauge.value.write([`${format(value)} ${gauge.output.unit}`]);
    }
    if (
      dial &&
      needle &&
      presentation.prediction &&
      next.prediction !== undefined
    ) {
      dial.write([
        presentation.prediction.label,
        presentation.prediction.optionLabels[
          presentation.prediction.values.indexOf(next.prediction)
        ] ?? `${format(next.prediction)} ${presentation.prediction.unit}`,
      ]);
      const index = presentation.prediction.values.indexOf(next.prediction);
      needle.rotation.z =
        (index / Math.max(1, presentation.prediction.values.length - 1) - 0.5) *
        -2.2;
    }
  }
  return {
    targets,
    foreground: kit.foreground,
    setReading,
    update: kit.update,
  };
}
