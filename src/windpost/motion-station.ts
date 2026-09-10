import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import type { WorldTarget } from "./world";

export interface MotionStationPresentation {
  site: "bridge" | "lift";
  title: string;
  itemLabel: string;
  activationLabel: string;
  socketLabels: readonly [string, string, string];
  predictionValues: readonly number[];
  timeMin: number;
  timeMax: number;
  /** The episode runtime evaluates the shared expression; art never supplies a trajectory. */
  sample(time: number): { time: number; position: number; velocity: number };
}
export interface MotionStationReading {
  slot: 1 | 2 | 3 | null;
  carrying: boolean;
  solved: boolean;
  time: number;
  interval: number;
  estimate: number;
  position: number;
  positionBefore: number;
  average: number;
  attempts: number;
}
type Palette = Record<
  | "wood"
  | "woodLight"
  | "teal"
  | "white"
  | "dark"
  | "yellow"
  | "red"
  | "brass"
  | "blue"
  | "stone",
  StandardMaterial
>;

/** Reusable physical timing apparatus for the harbor kit. Simulation outputs are
 * inputs here: replay, marker placement and wheel rotation cannot produce success.
 */
export function createMotionStation(
  scene: Scene,
  presentation: MotionStationPresentation,
  origin: Vector3,
  supplyPosition: Vector3,
  palette: Palette,
  shadows: ShadowGenerator,
) {
  const prefix = `${presentation.site} timing`;
  const meshes: Mesh[] = [];
  const foreground: Mesh[] = [];
  const targets: WorldTarget[] = [];
  const annotations: { mesh: Mesh; title: boolean }[] = [];
  const place = (
    mesh: Mesh,
    material: StandardMaterial,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
    meshes.push(mesh);
    return mesh;
  };
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material = palette.woodLight,
  ) =>
    place(
      CreateBox(`${prefix} ${name}`, { width: w, height: h, depth: d }, scene),
      material,
      x,
      y,
      z,
    );
  const cylinder = (
    name: string,
    h: number,
    radius: number,
    x: number,
    y: number,
    z: number,
    material = palette.brass,
  ) =>
    place(
      CreateCylinder(
        `${prefix} ${name}`,
        { height: h, diameter: radius * 2, tessellation: 16 },
        scene,
      ),
      material,
      x,
      y,
      z,
    );
  const tube = (
    name: string,
    path: Vector3[],
    radius: number,
    material = palette.dark,
  ) =>
    place(
      CreateTube(`${prefix} ${name}`, { path, radius, tessellation: 6 }, scene),
      material,
    );
  const parent = (node: TransformNode, parts: Mesh[]) =>
    parts.forEach((part) => {
      part.parent = node;
    });
  const glow = new StandardMaterial(`${prefix} gate glow`, scene);
  glow.diffuseColor = Color3.FromHexString("#F5C64D").toLinearSpace();
  glow.emissiveColor = glow.diffuseColor.scale(0.45);
  const pulse = new StandardMaterial(`${prefix} gate flash`, scene);
  pulse.diffuseColor = Color3.FromHexString("#A9EDCB").toLinearSpace();
  pulse.emissiveColor = pulse.diffuseColor.scale(0.7);

  const label = (
    name: string,
    initial: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height = 0.32,
    color = "#244E50",
  ) => {
    const texture = new DynamicTexture(
      `${prefix} ${name} text`,
      { width: 768, height: Math.round((768 * height) / width) },
      scene,
      false,
    );
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    const material = new StandardMaterial(`${prefix} ${name} ink`, scene);
    material.diffuseTexture = texture;
    material.diffuseColor = Color3.White();
    material.emissiveColor.set(0.08, 0.08, 0.08);
    material.specularColor.setAll(0);
    material.backFaceCulling = true;
    const mesh = place(
      CreatePlane(`${prefix} ${name}`, { width, height }, scene),
      material,
      x,
      y,
      z,
    );
    // Fixed instrument lettering stays attached to its physical apparatus.
    annotations.push({ mesh, title: name === "station name" });
    shadows.removeShadowCaster(mesh);
    let previous = "";
    const write = (text: string) => {
      if (text === previous) return;
      previous = text;
      const size = texture.getSize();
      ctx.fillStyle = "#FFF1D0";
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fontSize = Math.min(64, Math.floor(size.height * 0.62));
      ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
      while (fontSize > 18 && ctx.measureText(text).width > size.width - 30) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
      }
      ctx.fillText(text, size.width / 2, size.height / 2);
      texture.update();
    };
    write(initial);
    return { mesh, write };
  };
  const signed = (value: number, places = 2) =>
    `${value > 0 ? "+" : ""}${value.toFixed(places)}`;
  const timeText = (value: number) =>
    value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

  // The scale is calculated from samples supplied by the shared evaluator. Every
  // ruler label uses that same metre-to-world mapping, including small windows.
  const samples = Array.from({ length: 81 }, (_, i) =>
    presentation.sample(
      presentation.timeMin +
        ((presentation.timeMax - presentation.timeMin) * i) / 80,
    ),
  );
  const minPosition = Math.min(...samples.map((sample) => sample.position));
  const maxPosition = Math.max(...samples.map((sample) => sample.position));
  if (
    !Number.isFinite(minPosition) ||
    !Number.isFinite(maxPosition) ||
    maxPosition <= minPosition
  )
    throw new Error(
      "Timing station requires a finite, non-stationary trajectory",
    );
  const trackLength = 6.3;
  const trackX = (position: number) =>
    origin.x -
    trackLength / 2 +
    ((position - minPosition) / (maxPosition - minPosition)) * trackLength;
  const trackTop = 0.77;
  const bed = box(
    "cream instrument bed",
    6.94,
    0.17,
    1.08,
    origin.x,
    0.62,
    origin.z,
    palette.white,
  );
  foreground.push(bed);
  for (const x of [-3.08, 3.08])
    for (const z of [-0.37, 0.37])
      box(
        "trestle leg",
        0.14,
        0.62,
        0.14,
        origin.x + x,
        0.31,
        origin.z + z,
        palette.teal,
      );
  for (const z of [-0.27, 0.27])
    tube(
      "polished rail",
      [
        new Vector3(origin.x - 3.35, trackTop, origin.z + z),
        new Vector3(origin.x + 3.35, trackTop, origin.z + z),
      ],
      0.035,
      palette.brass,
    );
  for (let i = 0; i < 18; i++)
    box(
      "rail sleeper",
      0.12,
      0.075,
      0.76,
      origin.x - 3.23 + i * 0.38,
      0.7,
      origin.z,
      palette.wood,
    );
  for (let i = 0; i < 5; i++) {
    const value = minPosition + ((maxPosition - minPosition) * i) / 4;
    const x = trackX(value);
    box(
      "metre ruler tick",
      0.025,
      0.025,
      0.15,
      x,
      0.72,
      origin.z - 0.51,
      palette.dark,
    );
    label(
      `position tick ${i}`,
      `${Number(value.toFixed(2))} m`,
      x,
      0.42,
      origin.z - 0.55,
      0.7,
      0.22,
    );
  }
  const directionArrow = tube(
    "fixed positive direction",
    [
      new Vector3(origin.x - 0.55, 0.12, origin.z + 0.96),
      new Vector3(origin.x + 0.75, 0.12, origin.z + 0.96),
    ],
    0.025,
    palette.teal,
  );
  tube(
    "positive arrowhead",
    [
      new Vector3(origin.x + 0.48, 0.12, origin.z + 0.77),
      new Vector3(origin.x + 0.75, 0.12, origin.z + 0.96),
      new Vector3(origin.x + 0.48, 0.12, origin.z + 1.15),
    ],
    0.025,
    palette.teal,
  );
  directionArrow.metadata = { positiveAxis: "+world-x" };
  label(
    "fixed direction label",
    "+ position →",
    origin.x + 0.1,
    0.24,
    origin.z + 1.24,
    1.62,
    0.3,
  );
  label(
    "station name",
    presentation.title,
    origin.x,
    2.05,
    origin.z + 0.8,
    2.5,
    0.3,
  );
  const clockLabel = label(
    "replay clock",
    "Cart replay",
    origin.x,
    0.59,
    origin.z - 2.305,
    0.96,
    0.23,
  );

  // A little postal cart with a parcel, enamel sides and visibly rotating wheels.
  const cart = new TransformNode(`${prefix} mail cart`, scene);
  const chassis = box(
    "cart chassis",
    0.77,
    0.15,
    0.56,
    0,
    0.99,
    0,
    palette.teal,
  );
  const floor = box(
    "cart bed",
    0.7,
    0.055,
    0.57,
    0,
    1.09,
    0,
    palette.woodLight,
  );
  const parcel = box(
    "cart parcel",
    0.43,
    0.38,
    0.4,
    0.04,
    1.31,
    0,
    palette.yellow,
  );
  const twine = box(
    "cart parcel ribbon",
    0.06,
    0.395,
    0.415,
    0.04,
    1.31,
    0,
    palette.white,
  );
  const address = box(
    "cart parcel address",
    0.22,
    0.12,
    0.012,
    0.05,
    1.33,
    -0.208,
    palette.white,
  );
  parent(cart, [chassis, floor, parcel, twine, address]);
  const wheelRoots: TransformNode[] = [];
  for (const x of [-0.25, 0.25])
    for (const z of [-0.31, 0.31]) {
      const wheelRoot = new TransformNode(`${prefix} wheel hub`, scene);
      wheelRoot.parent = cart;
      wheelRoot.position.set(x, 0.88, z);
      const tire = cylinder("rubber wheel", 0.09, 0.155, 0, 0, 0, palette.dark);
      tire.rotation.x = Math.PI / 2;
      const spoke = box(
        "wheel spoke",
        0.21,
        0.032,
        0.104,
        0,
        0,
        0,
        palette.brass,
      );
      parent(wheelRoot, [tire, spoke]);
      wheelRoots.push(wheelRoot);
    }
  const handrail = tube(
    "cart push handle",
    [
      new Vector3(-0.32, 1.07, -0.25),
      new Vector3(-0.48, 1.42, -0.25),
      new Vector3(-0.48, 1.42, 0.25),
      new Vector3(-0.32, 1.07, 0.25),
    ],
    0.025,
    palette.woodLight,
  );
  handrail.parent = cart;
  foreground.push(
    ...cart
      .getChildMeshes()
      .filter((mesh): mesh is Mesh => mesh instanceof Mesh),
  );

  const beacon = (name: string, side: number) => {
    const root = new TransformNode(`${prefix} ${name}`, scene);
    const foot = cylinder(
      name + " foot",
      0.08,
      0.17,
      0,
      0.7,
      side * 0.59,
      palette.teal,
    );
    const pole = cylinder(
      name + " mast",
      0.8,
      0.035,
      0,
      1.1,
      side * 0.59,
      palette.brass,
    );
    const eye = place(
      CreateSphere(
        `${prefix} ${name} lens`,
        { diameter: 0.19, segments: 12 },
        scene,
      ),
      glow,
      0,
      1.52,
      side * 0.59,
    );
    const antenna = cylinder(
      name + " antenna",
      0.23,
      0.012,
      0,
      1.72,
      side * 0.59,
      palette.dark,
    );
    const beam = tube(
      name + " timing plane",
      [new Vector3(0, 1.03, -0.48), new Vector3(0, 1.03, 0.48)],
      0.012,
      glow,
    );
    parent(root, [foot, pole, eye, antenna, beam]);
    return { root, eye, beam };
  };
  const fixedGate = beacon("target-time marker", 1);
  const earlierGate = beacon("portable earlier marker", -1);
  const fixedLabel = label(
    "target-time label",
    "Target clock",
    origin.x,
    1.57,
    origin.z + 0.65,
    0.66,
    0.16,
  );
  const earlierLabel = label(
    "earlier-time label",
    "Earlier marker",
    origin.x,
    1.38,
    origin.z - 0.68,
    0.78,
    0.16,
  );
  const endpointStart = cylinder(
    "earlier endpoint",
    0.016,
    0.06,
    0,
    0.721,
    origin.z,
    palette.blue,
  );
  const endpointEnd = cylinder(
    "target endpoint",
    0.016,
    0.06,
    0,
    0.722,
    origin.z,
    palette.red,
  );

  // These are electrical calibration docks, not metre-spaced measuring sockets.
  const docks: Mesh[] = [];
  label(
    "window dock legend",
    "TIME WINDOW · seconds",
    origin.x - 2,
    0.12,
    origin.z - 1.7,
    2.35,
    0.18,
  );
  for (const slot of [1, 2, 3] as const) {
    const x = origin.x - slot;
    const pad = cylinder(
      `window ${slot} dock`,
      0.06,
      0.28,
      x,
      0.07,
      origin.z - 1.1,
      palette.teal,
    );
    const rim = place(
      CreateTorus(
        `${prefix} dock ${slot} rim`,
        { diameter: 0.6, thickness: 0.035, tessellation: 24 },
        scene,
      ),
      palette.brass,
      x,
      0.12,
      origin.z - 1.1,
    );
    docks.push(rim);
    pad.metadata = { calibrationWindow: presentation.socketLabels[slot - 1] };
    label(
      `window ${slot} setting`,
      presentation.socketLabels[slot - 1],
      x,
      0.3,
      origin.z - 1.08,
      0.88,
      0.24,
    );
    targets.push({
      id: `${presentation.site}-slot-${slot}`,
      kind: "socket",
      mechanism: presentation.site,
      slot,
      label: `Dock beacon · ${presentation.socketLabels[slot - 1]}`,
      position: new Vector3(x, 0, origin.z - 1.1),
    });
  }
  const supply = new TransformNode(`${prefix} spare timing beacon`, scene);
  supply.position.copyFrom(supplyPosition);
  const supplyParts = [
    cylinder("spare beacon case", 0.43, 0.17, 0, 0.91, 0, palette.blue),
    cylinder("spare beacon aerial", 0.45, 0.018, 0, 1.33, 0, palette.brass),
    place(
      CreateSphere(
        `${prefix} spare beacon lens`,
        { diameter: 0.17, segments: 12 },
        scene,
      ),
      glow,
      0,
      1.1,
      -0.13,
    ),
  ];
  parent(supply, supplyParts);
  cylinder(
    "beacon storage pedestal",
    0.58,
    0.4,
    supplyPosition.x,
    0.29,
    supplyPosition.z,
    palette.stone,
  );
  label(
    "beacon supply",
    presentation.itemLabel,
    supplyPosition.x,
    1.8,
    supplyPosition.z,
    1.7,
    0.3,
  );
  targets.push({
    id: `${presentation.site}-weight`,
    kind: "weight",
    mechanism: presentation.site,
    item: `${presentation.site}-weight`,
    label: `Pick up ${presentation.itemLabel}`,
    position: supplyPosition.clone(),
  });

  const controlStand = box(
    "sample control stand",
    1.05,
    0.78,
    0.38,
    origin.x,
    0.39,
    origin.z - 2.1,
    palette.teal,
  );
  const crank = place(
    CreateTorus(
      `${prefix} sample crank`,
      { diameter: 0.55, thickness: 0.065, tessellation: 24 },
      scene,
    ),
    palette.brass,
    origin.x,
    0.92,
    origin.z - 2.16,
  );
  crank.rotation.x = Math.PI / 2;
  targets.push({
    id: `${presentation.site}-crank`,
    kind: "crank",
    mechanism: presentation.site,
    label: presentation.activationLabel,
    position: new Vector3(origin.x, 0, origin.z - 2.65),
  });
  const dialX = origin.x + 1.68;
  const dialStand = box(
    "prediction stand",
    0.75,
    0.74,
    0.36,
    dialX,
    0.37,
    origin.z - 2.1,
    palette.blue,
  );
  const dialFace = cylinder(
    "signed prediction dial",
    0.08,
    0.26,
    dialX,
    1.04,
    origin.z - 2.1,
    palette.white,
  );
  dialFace.rotation.x = Math.PI / 2;
  const needle = box(
    "prediction dial needle",
    0.025,
    0.2,
    0.025,
    dialX,
    1.08,
    origin.z - 2.16,
    palette.red,
  );
  targets.push({
    id: `${presentation.site}-dial`,
    kind: "dial",
    mechanism: presentation.site,
    label: "Adjust velocity prediction",
    position: new Vector3(dialX, 0, origin.z - 2.65),
  });
  foreground.push(controlStand, dialStand, dialFace);
  // One three-line readout, mounted below the near edge of the rails. Keeping it
  // fixed and below the cart makes oblique views readable without floating text.
  const boardTexture = new DynamicTexture(
    `${prefix} instrument readings`,
    { width: 1024, height: 280 },
    scene,
    false,
  );
  const boardMaterial = new StandardMaterial(
    `${prefix} instrument face`,
    scene,
  );
  boardMaterial.diffuseTexture = boardTexture;
  boardMaterial.specularColor.setAll(0);
  boardMaterial.emissiveColor.setAll(0.1);
  boardMaterial.backFaceCulling = true;
  const board = place(
    CreatePlane(
      `${prefix} instrument board`,
      { width: 2.8, height: 0.765 },
      scene,
    ),
    boardMaterial,
    origin.x + 0.8,
    0.48,
    origin.z - 0.59,
  );
  board.rotation.x = Math.PI / 10;
  annotations.push({ mesh: board, title: false });
  shadows.removeShadowCaster(board);
  const boardFrame = box(
    "instrument frame",
    2.91,
    0.86,
    0.065,
    origin.x + 0.8,
    0.48,
    origin.z - 0.54,
    palette.teal,
  );
  boardFrame.rotation.x = board.rotation.x;
  const writeBoard = (next: MotionStationReading) => {
    const ctx = boardTexture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#FFF1D0";
    ctx.fillRect(0, 0, 1024, 280);
    const rows = [
      [
        next.slot === null ? "PREVIEW AVERAGE" : "AVERAGE",
        `${signed(next.average)} m/s`,
      ],
      [
        "TIME WINDOW",
        `${timeText(next.time - next.interval)} → ${timeText(next.time)} s  (Δt ${timeText(next.interval)} s)`,
      ],
      [
        "YOUR PREDICTION",
        `${next.estimate > 0 ? "+" : ""}${next.estimate} m/s`,
      ],
    ];
    ctx.textBaseline = "middle";
    rows.forEach(([heading, value], index) => {
      const y = 49 + index * 89;
      ctx.fillStyle = "#347C73";
      ctx.font = "bold 30px Trebuchet MS, sans-serif";
      ctx.fillText(heading, 28, y);
      ctx.fillStyle = "#244E50";
      let fontSize = 42;
      ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
      while (fontSize > 26 && ctx.measureText(value).width > 618) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
      }
      ctx.fillText(value, 370, y);
      if (index < 2) {
        ctx.fillStyle = "#D5BF94";
        ctx.fillRect(28, y + 41, 968, 2);
      }
    });
    boardTexture.update();
  };

  let reading: MotionStationReading | null = null;
  let elapsed = 0;
  let lastReplayTime = presentation.timeMin - 0.001;
  let fixedFlash = 0;
  let earlierFlash = 0;
  let lastAttempts = 0;
  const setReading = (next: MotionStationReading) => {
    reading = next;
    supply.setEnabled(next.slot === null && !next.carrying && !next.solved);
    earlierGate.root.setEnabled(true);
    earlierGate.root.getChildMeshes().forEach((mesh) => {
      mesh.visibility = next.slot === null ? 0.3 : 1;
    });
    earlierLabel.mesh.setEnabled(true);
    endpointStart.setEnabled(true);
    const targetX = trackX(next.position);
    const earlierX = trackX(next.positionBefore);
    fixedGate.root.position.set(targetX, 0, origin.z);
    earlierGate.root.position.set(earlierX, 0, origin.z);
    fixedLabel.mesh.position.x = targetX;
    earlierLabel.mesh.position.x = earlierX;
    endpointStart.position.x = earlierX;
    endpointEnd.position.x = targetX;
    fixedLabel.write(`t = ${timeText(next.time)} s`);
    earlierLabel.write(`t = ${timeText(next.time - next.interval)} s`);
    writeBoard(next);
    const dialExtent = Math.max(
      1e-9,
      ...presentation.predictionValues.map(Math.abs),
    );
    needle.rotation.z = (-next.estimate / dialExtent) * 0.9;
    docks.forEach((dock, index) => {
      dock.material = index + 1 === next.slot ? glow : palette.brass;
    });
    if (next.attempts > lastAttempts) {
      elapsed = 0;
      lastReplayTime = presentation.timeMin - 0.001;
    }
    lastAttempts = next.attempts;
  };
  const update = (
    dt: number,
    reducedMotion: boolean,
    enabled: boolean,
    playerPosition: Vector3,
  ) => {
    for (const annotation of annotations) {
      const distance = Math.hypot(
        playerPosition.x - annotation.mesh.position.x,
        playerPosition.z - annotation.mesh.position.z,
      );
      const opacity = annotation.title
        ? Math.max(0, Math.min(1, (19 - distance) / 4))
        : Math.max(0, Math.min(1, (9 - distance) / 2));
      annotation.mesh.visibility = opacity;
      annotation.mesh.setEnabled(opacity > 0);
    }
    if (!reading) return;
    if (enabled && !reducedMotion) elapsed += dt;
    const travelSeconds = 6;
    const cycle = elapsed % (travelSeconds + 0.65);
    const resetting = cycle > travelSeconds + 0.25;
    const t = reducedMotion
      ? reading.time
      : presentation.timeMin +
        Math.min(1, cycle / travelSeconds) *
          (presentation.timeMax - presentation.timeMin);
    const sample = presentation.sample(t);
    const x = trackX(sample.position);
    cart.position.set(x, 0, origin.z);
    cart.setEnabled(!resetting || reducedMotion);
    for (const wheel of wheelRoots)
      wheel.rotation.z = -(x - trackX(samples[0].position)) / 0.155;
    clockLabel.write(
      reducedMotion
        ? `Paused t=${timeText(reading.time)} s`
        : resetting
          ? "Replay reset"
          : `Slow replay ${sample.time.toFixed(2)} s`,
    );
    if (sample.time < lastReplayTime)
      lastReplayTime = presentation.timeMin - 0.001;
    if (lastReplayTime < reading.time && sample.time >= reading.time)
      fixedFlash = 0.25;
    const earlierTime = reading.time - reading.interval;
    if (
      reading.slot !== null &&
      lastReplayTime < earlierTime &&
      sample.time >= earlierTime
    )
      earlierFlash = 0.25;
    lastReplayTime = sample.time;
    fixedFlash = Math.max(0, fixedFlash - dt);
    earlierFlash = Math.max(0, earlierFlash - dt);
    fixedGate.eye.material = fixedFlash > 0 ? pulse : glow;
    fixedGate.beam.material = fixedFlash > 0 ? pulse : glow;
    earlierGate.eye.material = earlierFlash > 0 ? pulse : glow;
    earlierGate.beam.material = earlierFlash > 0 ? pulse : glow;
  };
  return { targets, foreground, setReading, update };
}
