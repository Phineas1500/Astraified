import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateIcoSphere } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Ray } from "@babylonjs/core/Culling/ray";
// The fixture uses plain glTF 2.0; omit legacy formats and unused extension runtimes.
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { createCourierController } from "./controller";
import {
  stationConfig,
  stationRound,
  experimentReadoutRanges,
  type EpisodeFixture,
  type SiteId as MechanismId,
  type Slot,
} from "./episodes";
import {
  motionSample,
  carriedEvidence,
  stationReading,
  type EpisodeProgress,
  type CarryItem,
} from "./runtime";
import { createMotionStation } from "./motion-station";
import { createExperimentStation } from "./experiment-station";
import { createEvidenceStation } from "./evidence-station";
import { apparatusKit } from "./apparatus-kit";

export interface WorldTarget {
  id: string;
  kind:
    | "npc"
    | "weight"
    | "socket"
    | "crank"
    | "parcel"
    | "postcard"
    | "sign"
    | "discovery"
    | "dial"
    | "evidence-card"
    | "evidence-bin";
  label: string;
  position: Vector3;
  npc?: "moss" | "bea";
  mechanism?: MechanismId;
  item?: CarryItem;
  slot?: Slot;
  card?: string;
  evidenceCard?: string;
  bin?: string;
  discovery?: "workshop-sketch" | "cargo-manifest";
}
export type WindpostWorld = Awaited<ReturnType<typeof createWindpostWorld>>;

/** Authored fixture geometry. Rendering reads the quest model; animation cannot solve a puzzle. */
export async function createWindpostWorld(
  engine: Engine,
  canvas: HTMLCanvasElement,
  episode: EpisodeFixture,
  initial: EpisodeProgress,
  callbacks: {
    target(target: WorldTarget | null): void;
    ready(): void;
    respawn?(): void;
  },
) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.72, 0.86, 0.91, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.72, 0.86, 0.91);
  scene.fogDensity = 0.01;
  scene.collisionsEnabled = true;
  scene.imageProcessingConfiguration.exposure = 1.03;
  scene.imageProcessingConfiguration.contrast = 1.08;
  const sky = new HemisphericLight(
    "soft ocean sky",
    new Vector3(0, 1, 0),
    scene,
  );
  sky.intensity = 0.65;
  sky.groundColor = Color3.FromHexString("#687A62");
  const sun = new DirectionalLight(
    "late afternoon sun",
    new Vector3(-0.6, -1, 0.4),
    scene,
  );
  sun.position.set(25, 40, -20);
  sun.intensity = 0.95;
  sun.diffuse = Color3.FromHexString("#FFF1CE");
  sun.autoCalcShadowZBounds = true;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 100;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.darkness = 0.25;
  shadows.bias = 0.002;
  shadows.normalBias = 0.035;
  const mat = (name: string, hex: string, glow = 0) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
    m.specularColor.set(0.035, 0.035, 0.035);
    m.emissiveColor = m.diffuseColor.scale(glow);
    return m;
  };
  const m = {
    grass: mat("soft meadow", "#A7BC70"),
    grass2: mat("clover", "#80A66B"),
    sand: mat("warm footpaths", "#E4CEA0"),
    chalk: mat("cream chalk cliffs", "#D9CCA8"),
    stone: mat("chalk shadow", "#A9BBA6"),
    dark: mat("deep pine", "#244E50"),
    wood: mat("cedar", "#AC7654"),
    woodLight: mat("honey cedar", "#DBAC71"),
    teal: mat("painted sea green", "#347C73"),
    yellow: mat("post yellow", "#F5C64D"),
    red: mat("berry red", "#B96177"),
    white: mat("paper and whitewash", "#FFF1D0"),
    water: mat("blue lagoon", "#379CBA"),
    blue: mat("mail blue", "#558EA0"),
    brass: mat("brass weight", "#D99D44"),
    leaf: mat("evergreen canopy", "#458973"),
    pink: mat("foxglove", "#D293B2"),
    cream: mat("foam", "#B8E4DE"),
  };
  const foregroundProps: Mesh[] = [];
  m.water.specularColor.set(0.28, 0.38, 0.4);
  m.water.specularPower = 64;
  const place = (
    mesh: Mesh,
    material: StandardMaterial,
    x: number,
    y: number,
    z: number,
    collide = false,
    cast = true,
  ) => {
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.receiveShadows = true;
    mesh.checkCollisions = collide;
    mesh.isPickable = collide;
    mesh.metadata = { cameraBlocker: collide };
    if (cast) shadows.addShadowCaster(mesh);
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
    material = m.wood,
    collide = false,
  ) =>
    place(
      CreateBox(name, { width: w, height: h, depth: d }, scene),
      material,
      x,
      y,
      z,
      collide,
    );
  const sphere = (
    name: string,
    radius: number,
    x: number,
    y: number,
    z: number,
    material = m.leaf,
  ) =>
    place(
      CreateIcoSphere(name, { radius, subdivisions: 2, flat: true }, scene),
      material,
      x,
      y,
      z,
    );
  const cylinder = (
    name: string,
    height: number,
    radius: number,
    x: number,
    y: number,
    z: number,
    material = m.wood,
    collide = false,
  ) =>
    place(
      CreateCylinder(
        name,
        { height, diameter: radius * 2, tessellation: 12 },
        scene,
      ),
      material,
      x,
      y,
      z,
      collide,
    );
  const tube = (
    name: string,
    points: Vector3[],
    radius: number,
    material = m.woodLight,
  ) =>
    place(
      CreateTube(name, { path: points, radius, tessellation: 6 }, scene),
      material,
      0,
      0,
      0,
    );

  const label = (
    name: string,
    text: string,
    x: number,
    y: number,
    z: number,
    width = 1.5,
    color = "#244E50",
    background = "#FFF1D0",
  ) => {
    const tex = new DynamicTexture(
      name + " lettering",
      { width: 512, height: 160 },
      scene,
      false,
    );
    tex.hasAlpha = true;
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 160);
    let fontSize = 62;
    ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
    while (fontSize > 22 && ctx.measureText(text).width > 484) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 82);
    tex.update();
    const material = mat(name + " ink", "#FFFFFF");
    material.diffuseTexture = tex;
    material.useAlphaFromDiffuseTexture = true;
    material.emissiveColor.set(0.18, 0.18, 0.18);
    material.backFaceCulling = false;
    const mesh = place(
      CreatePlane(name, { width, height: (width * 160) / 512 }, scene),
      material,
      x,
      y,
      z,
      false,
      false,
    );
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    return mesh;
  };

  function island(name: string, outline: number[][]) {
    const positions = [
      0,
      0,
      outline.reduce((s, p) => s + p[1], 0) / outline.length,
    ];
    outline.forEach(([x, z]) => positions.push(x, 0, z));
    const indices: number[] = [];
    for (let i = 0; i < outline.length; i++)
      indices.push(0, i + 1, ((i + 1) % outline.length) + 1);
    const top = new Mesh(name + " meadow", scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    data.applyToMesh(top);
    place(top, m.grass, 0, 0, 0, true, false);
    const sidePos: number[] = [];
    const sideIdx: number[] = [];
    outline.forEach(([x, z], i) => {
      const [nx, nz] = outline[(i + 1) % outline.length];
      const k = sidePos.length / 3;
      sidePos.push(x, 0, z, nx, 0, nz, nx * 0.93, -4.1, nz, x * 0.93, -4.1, z);
      sideIdx.push(k, k + 2, k + 1, k, k + 3, k + 2);
    });
    const cliff = new Mesh(name + " cliffs", scene);
    const sd = new VertexData();
    sd.positions = sidePos;
    sd.indices = sideIdx;
    const sn: number[] = [];
    VertexData.ComputeNormals(sidePos, sideIdx, sn);
    sd.normals = sn;
    sd.applyToMesh(cliff);
    place(cliff, m.chalk, 0, 0, 0);
    outline.forEach(([x, z], i) => {
      const rock = sphere(name + " cliff fold " + i, 1.5, x, -2.4, z, m.stone);
      rock.scaling.set(0.8, 1.4, 0.8);
    });
  }
  island("Moss landing", [
    [-13, -13],
    [-5, -16],
    [7, -14],
    [13, -7],
    [12, 3],
    [6, 10],
    [-5, 10],
    [-13, 4],
  ]);
  island("Post island", [
    [-7, 18],
    [6, 18],
    [12, 23],
    [12, 32],
    [5, 38],
    [-6, 38],
    [-12, 31],
    [-12, 24],
  ]);
  place(
    CreateGround("open sea", { width: 1200, height: 1200 }, scene),
    m.water,
    0,
    -2.5,
    0,
    false,
    false,
  );
  // The walking route is authored as broad connected ribbons of sand.
  function path(points: number[][], width: number) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const part = box(
        "worn footpath",
        width,
        0.025,
        Math.hypot(dx, dz) + width * 0.55,
        (a[0] + b[0]) / 2,
        0.02,
        (a[1] + b[1]) / 2,
        m.sand,
      );
      part.rotation.y = Math.atan2(dx, dz);
      part.receiveShadows = true;
      cylinder(
        "path round join",
        0.025,
        width * 0.52,
        b[0],
        0.02,
        b[1],
        m.sand,
      );
    }
  }
  path(
    [
      [0, -11],
      [0, -3],
      [0, 4],
      [0, 10],
    ],
    2.5,
  );
  path(
    [
      [0, 1],
      [-5, 2],
      [-9, 2],
    ],
    1.8,
  );
  path(
    [
      [0, 18],
      [0, 22],
      [5, 23],
      [8, 27],
      [4, 32],
      [-3, 32],
    ],
    2.2,
  );
  path(
    [
      [0, 22],
      [-5, 25],
      [-8, 31],
    ],
    1.7,
  );

  function tree(x: number, z: number, scale = 1) {
    cylinder(
      "rounded pine trunk",
      3 * scale,
      0.22 * scale,
      x,
      1.5 * scale,
      z,
      m.wood,
      true,
    );
    for (let j = 0; j < 3; j++) {
      const canopy = sphere(
        "cloud pine",
        1.5 * scale,
        x + (j - 1) * 0.48 * scale,
        (3 + j * 0.28) * scale,
        z + (j % 2) * 0.38 * scale,
        j === 1 ? m.teal : m.leaf,
      );
      canopy.scaling.set(1, 0.72, 1);
    }
  }
  [
    [-9, -9, 1.2],
    [7, -8, 1.25],
    [10, -3, 1],
    [-11, -3, 0.9],
    [8, 5, 0.8],
    [-9, 29, 1.25],
    [8, 33, 1.1],
    [-6, 35, 0.9],
    [10, 25, 0.85],
  ].forEach(([x, z, s]) => tree(x, z, s));
  // Rounded shrubs and flower clusters frame paths without making invisible walls.
  let seed = 7823;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 105; i++) {
    const far = i > 55;
    const x = (random() - 0.5) * (far ? 18 : 21);
    const z = far ? 21 + random() * 14 : -12 + random() * 19;
    if (
      Math.abs(x) < 2.3 ||
      (!far && z > 0 && x < 0) ||
      (far && z < 28 && x > 0 && x < 9)
    )
      continue;
    const stem = cylinder(
      "meadow sprig",
      0.24 + random() * 0.2,
      0.025,
      x,
      0.14,
      z,
      m.grass2,
    );
    if (i % 3 === 0) {
      const flower = sphere(
        "small meadow flower",
        0.12,
        x,
        stem.position.y * 2,
        z,
        i % 2 ? m.pink : m.white,
      );
      flower.scaling.y = 0.5;
    } else {
      const shrub = sphere(
        "clover cushion",
        0.3 + random() * 0.22,
        x,
        0.17,
        z,
        m.grass2,
      );
      shrub.scaling.y = 0.6;
    }
  }
  // Ocean landmarks remain well beyond the playable shore.
  for (let i = 0; i < 11; i++) {
    const x = (i % 2 ? 1 : -1) * (26 + random() * 45),
      z = -15 + random() * 100;
    const rock = sphere(
      "distant sea stack",
      3 + random() * 5,
      x,
      -3,
      z,
      m.stone,
    );
    rock.scaling.y = 1.8;
  }
  const clouds: TransformNode[] = [];
  for (let i = 0; i < 8; i++) {
    const root = new TransformNode("cotton cloud", scene);
    root.position.set(-60 + i * 20, 18 + random() * 7, 25 + random() * 65);
    for (let j = 0; j < 3; j++) {
      const c = sphere("cloud puff", 3, 0, 0, 0, m.white);
      c.parent = root;
      c.position.set(j * 3, Math.sin(j) * 0.5, 0);
      c.scaling.set(1, 0.35, 0.65);
      c.receiveShadows = false;
      shadows.removeShadowCaster(c);
    }
    clouds.push(root);
  }
  const waves: Mesh[] = [];
  for (let i = 0; i < 30; i++) {
    const x = (random() - 0.5) * 90,
      z = (random() - 0.5) * 100;
    const w = box(
      "sunlit ripple",
      1 + random() * 3,
      0.025,
      0.065,
      x,
      -2.46,
      z,
      m.cream,
    );
    shadows.removeShadowCaster(w);
    waves.push(w);
  }

  function house(x: number, z: number) {
    const base = cylinder(
      "posthouse plaster",
      3.8,
      2.1,
      x,
      1.9,
      z,
      m.white,
      true,
    );
    const roof = place(
      CreateCylinder(
        "posthouse blue roof",
        {
          height: 1.6,
          diameterTop: 0.5,
          diameterBottom: 5.4,
          tessellation: 10,
        },
        scene,
      ),
      m.teal,
      x,
      4.6,
      z,
    );
    const door = box(
      "round mailroom door",
      1.1,
      2,
      0.12,
      x,
      1,
      z - 2.1,
      m.wood,
    );
    box("door lintel", 1.4, 0.18, 0.25, x, 2.12, z - 2.2, m.woodLight);
    cylinder(
      "door handle",
      0.1,
      0.08,
      x + 0.3,
      1,
      z - 2.23,
      m.brass,
    ).rotation.x = Math.PI / 2;
    for (const dx of [-1.3, 1.3]) {
      const window = box(
        "posthouse window",
        0.7,
        0.9,
        0.15,
        x + dx,
        2.15,
        z - 1.72,
        m.blue,
      );
      box("window sill", 0.9, 0.1, 0.3, x + dx, 1.66, z - 1.8, m.woodLight);
    }
    cylinder("weather mast", 2, 0.08, x, 6, z, m.woodLight);
    const flag = box(
      "post pennant",
      1.2,
      0.55,
      0.06,
      x + 0.6,
      6.7,
      z,
      m.yellow,
    );
    label("posthouse sign", episode.title, x, 3.15, z - 2.2, 2.1);
    return { base, roof, door, flag };
  }
  const posthouse = house(-3, 35);
  // A returned letter earns a small, permanent thank-you pennant over the door.
  const returnedMailPennant = new TransformNode("returned mail pennant", scene);
  returnedMailPennant.position.set(-3, 2.48, 32.72);
  const pennantCloth = box(
    "posthouse thank-you cloth",
    0.92,
    0.48,
    0.04,
    0,
    0,
    0,
    m.yellow,
  );
  pennantCloth.parent = returnedMailPennant;
  const pennantRod = cylinder(
    "posthouse pennant brass rod",
    1.04,
    0.025,
    0,
    0.28,
    0,
    m.brass,
  );
  pennantRod.rotation.z = Math.PI / 2;
  pennantRod.parent = returnedMailPennant;
  const envelope = box(
    "pennant stitched envelope",
    0.48,
    0.28,
    0.015,
    0,
    0,
    -0.03,
    m.white,
  );
  envelope.parent = returnedMailPennant;
  const envelopeSeam = tube(
    "pennant envelope flap",
    [
      new Vector3(-0.22, 0.12, -0.042),
      new Vector3(0, -0.025, -0.042),
      new Vector3(0.22, 0.12, -0.042),
    ],
    0.014,
    m.teal,
  );
  envelopeSeam.parent = returnedMailPennant;
  // Workshop canopy, toolbench, dock and oversized stationery establish place.
  [-8.5, -4.5].forEach((x) => {
    cylinder("workshop mast", 3, 0.1, x, 1.5, -5, m.wood, true);
    cylinder("workshop mast", 3, 0.1, x, 1.5, -8, m.wood, true);
  });
  const awning = box(
    "striped workshop canopy",
    4.8,
    0.16,
    3.8,
    -6.5,
    3,
    -6.5,
    m.yellow,
  );
  awning.rotation.z = -0.04;
  for (let i = 0; i < 5; i++)
    box(
      "canopy stripe",
      0.45,
      0.02,
      3.85,
      -8.3 + i * 0.9,
      3.1,
      -6.5,
      m.white,
    ).rotation.z = -0.04;
  box("workbench", 2.8, 0.16, 1.1, -6.5, 1.05, -7, m.woodLight, true);
  [-7.5, -5.5].forEach((x) =>
    box("bench leg", 0.18, 1, 0.8, x, 0.5, -7, m.wood),
  );
  for (let i = 0; i < 3; i++)
    box("wrapped parcel", 0.5, 0.4, 0.45, -7.3 + i * 0.7, 1.34, -7, m.red);
  for (let i = 0; i < 10; i++)
    box(
      "arrival dock plank",
      3,
      0.13,
      0.38,
      0,
      -0.02,
      -11 - i * 0.45,
      m.woodLight,
    );
  for (const x of [-1.5, 1.5])
    for (const z of [-11, -15])
      cylinder("dock mooring", 1.4, 0.12, x, -0.2, z, m.wood);
  const buoy = sphere("red harbor buoy", 0.65, -5, -2, -17, m.red);
  cylinder("buoy aerial", 1, 0.045, -5, -1.5, -17, m.dark);
  // A curved stepping-stone detour leads to an optional postcard.
  [
    [9, 0],
    [11, 1.5],
    [12.7, 3],
    [13.7, 5],
  ].forEach(([x, z], i) =>
    cylinder("stepping stone", 1.0, 1.0, x, -0.45 + i * 0.12, z, m.chalk, true),
  );

  const targets: WorldTarget[] = [];
  const addTarget = (target: WorldTarget) => {
    targets.push(target);
    return target;
  };
  // Optional discoveries are physical papers with readable authored diagrams.
  // Their light easels have no collision volume, keeping both travel routes open.
  const discoveryProps = new Map<
    NonNullable<WorldTarget["discovery"]>,
    { seal: Mesh; caption: Mesh }
  >();
  function discoveryDisplay(
    id: "workshop-sketch" | "cargo-manifest",
    x: number,
    z: number,
  ) {
    const sketch = id === "workshop-sketch";
    const site: MechanismId = sketch ? "bridge" : "lift";
    const binding = episode.scene.stations[site];
    const discovery = episode.discoveries.find((entry) => entry.id === id)!;
    const faceZ = z - 0.065;
    const frame = box(
      id + " timber frame",
      1.92,
      1.22,
      0.11,
      x,
      1.21,
      z,
      m.woodLight,
    );
    for (const offset of [-0.68, 0.68]) {
      box(id + " easel leg", 0.085, 1.05, 0.1, x + offset, 0.525, z, m.teal);
      box(
        id + " low foot",
        0.22,
        0.08,
        0.6,
        x + offset,
        0.04,
        z + 0.15,
        m.wood,
      );
    }
    box(id + " paper ledge", 2.04, 0.075, 0.27, x, 0.59, z - 0.025, m.teal);
    const tex = new DynamicTexture(
      id + " authored page",
      { width: 768, height: 448 },
      scene,
      false,
    );
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#FFF1D0";
    ctx.fillRect(0, 0, 768, 448);
    ctx.strokeStyle = "#DFCCA5";
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, 738, 418);
    ctx.textAlign = "left";
    ctx.fillStyle = "#244E50";
    const fitText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      size: number,
    ) => {
      ctx.font = `bold ${size}px Trebuchet MS, sans-serif`;
      while (size > 20 && ctx.measureText(text).width > maxWidth) {
        size -= 1;
        ctx.font = `bold ${size}px Trebuchet MS, sans-serif`;
      }
      ctx.fillText(text, x, y);
    };
    fitText(discovery.title.toUpperCase(), 40, 70, 687, 43);
    ctx.font = "24px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#347C73";
    fitText(`${episode.title} · field notes`, 41, 111, 687, 24);
    ctx.strokeStyle = "#D5BF94";
    ctx.beginPath();
    ctx.moveTo(40, 135);
    ctx.lineTo(727, 135);
    ctx.stroke();
    if (binding.kind === "evidence-crates" || binding.kind === "experiment") {
      ctx.fillStyle = "#244E50";
      ctx.font = "28px Trebuchet MS, sans-serif";
      const words = discovery.text.split(/\s+/);
      let line = "",
        row = 182;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 672 && line) {
          ctx.fillText(line, 43, row);
          row += 37;
          line = word;
          if (row > 367) {
            line = "";
            break;
          }
        } else line = next;
      }
      if (line) ctx.fillText(line, 43, row);
      ctx.fillStyle = "#347C73";
      fitText("FIELD COPY · Read the complete note with E", 43, 405, 680, 22);
    } else if (binding.kind === "timing-gates") {
      // This paper samples the same shared expression as its real cart, including
      // interior turning points. It does not infer motion from an episode name.
      const motion = binding.motion!;
      const samples = Array.from({ length: 81 }, (_, i) =>
        motionSample(
          episode,
          site,
          motion.timeMin + ((motion.timeMax - motion.timeMin) * i) / 80,
        ),
      );
      const min = Math.min(...samples.map((sample) => sample.position));
      const max = Math.max(...samples.map((sample) => sample.position));
      const px = (time: number) =>
        115 +
        ((time - motion.timeMin) / (motion.timeMax - motion.timeMin)) * 550;
      const py = (position: number) =>
        287 - ((position - min) / (max - min)) * 119;
      ctx.strokeStyle = "#ACBEAC";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const position = min + ((max - min) * i) / 2;
        ctx.beginPath();
        ctx.moveTo(112, py(position));
        ctx.lineTo(672, py(position));
        ctx.stroke();
        ctx.fillStyle = "#347C73";
        ctx.font = "20px Trebuchet MS, sans-serif";
        ctx.fillText(`${Number(position.toFixed(2))} m`, 42, py(position) + 7);
      }
      ctx.strokeStyle = "#244E50";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(115, 160);
      ctx.lineTo(115, 292);
      ctx.lineTo(683, 292);
      ctx.stroke();
      ctx.strokeStyle = "#347C73";
      ctx.lineWidth = 6;
      ctx.beginPath();
      samples.forEach((sample, i) => {
        if (i === 0) ctx.moveTo(px(sample.time), py(sample.position));
        else ctx.lineTo(px(sample.time), py(sample.position));
      });
      ctx.stroke();
      // The checkpoint and earlier mark match the default one-second preview.
      const reading = stationReading(episode, initial, site);
      const targetTime = Number(reading.inputs[motion.timeInput]);
      const interval = Number(reading.inputs[binding.socketInput]);
      for (const [time, color] of [
        [targetTime - interval, "#557FAB"],
        [targetTime, "#B96177"],
      ] as const) {
        const sample = motionSample(episode, site, time);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px(time), py(sample.position), 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#244E50";
      ctx.font = "bold 20px Trebuchet MS, sans-serif";
      ctx.fillText(`${motion.timeMin} s`, 112, 319);
      ctx.fillText(`${motion.timeMax} s`, 642, 319);
      ctx.fillText("time →", 350, 319);
      // The fixture supplies the educational caption; the diagram supplies its
      // physical context. Longer notes remain available through the E action.
      const words = discovery.text.split(/\s+/);
      ctx.font = "24px Trebuchet MS, sans-serif";
      let line = "";
      let row = 355;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 681 && line) {
          ctx.fillText(line, 43, row);
          row += 30;
          line = word;
          if (row > 415) {
            line = "";
            break;
          }
        } else line = next;
      }
      if (line) ctx.fillText(line, 43, row);
    } else if (sketch) {
      // A force, its pivot and the distance between them are visual, not a
      // printed answer to either of the mission's socket puzzles.
      ctx.lineWidth = 13;
      ctx.strokeStyle = "#AC7654";
      ctx.beginPath();
      ctx.moveTo(91, 255);
      ctx.lineTo(655, 255);
      ctx.stroke();
      ctx.fillStyle = "#347C73";
      ctx.beginPath();
      ctx.moveTo(514, 260);
      ctx.lineTo(550, 326);
      ctx.lineTo(478, 326);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#D99D44";
      ctx.fillRect(120, 199, 70, 51);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#244E50";
      ctx.beginPath();
      ctx.moveTo(153, 178);
      ctx.lineTo(153, 226);
      ctx.moveTo(141, 212);
      ctx.lineTo(153, 226);
      ctx.lineTo(165, 212);
      ctx.stroke();
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(156, 303);
      ctx.lineTo(454, 303);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "bold 24px Trebuchet MS, sans-serif";
      ctx.fillStyle = "#244E50";
      ctx.fillText("weight", 111, 173);
      ctx.fillText("reach", 268, 337);
      ctx.fillText("pivot", 558, 314);
      ctx.font = "bold 29px Trebuchet MS, sans-serif";
      ctx.fillText("Same weight. A longer reach.", 43, 394);
    } else {
      ctx.font = "bold 27px Trebuchet MS, sans-serif";
      ctx.fillStyle = "#244E50";
      const task = stationConfig(episode, site).tasks.find(
        (entry) => entry.id === binding.taskId,
      )!;
      const constants = Object.fromEntries(
        task.constants.map((entry) => [entry.id, entry.value]),
      );
      for (const [row, heading, value] of [
        [199, "DELIVERY", `${episode.story.npcNames.moss}'s parcel`],
        [259, "LOAD", `${constants.fixedMass} kg at ${constants.fixedArm} m`],
        [319, "WEIGHT", `${constants.counterMass} kg counterweight`],
      ] as const) {
        ctx.font = "bold 27px Trebuchet MS, sans-serif";
        ctx.fillStyle = "#347C73";
        ctx.fillText(heading, 43, row);
        ctx.font = "bold 24px Trebuchet MS, sans-serif";
        ctx.fillStyle = "#244E50";
        ctx.fillText(value, 285, row);
      }
      ctx.strokeStyle = "#B96177";
      ctx.lineWidth = 4;
      ctx.strokeRect(520, 350, 187, 56);
      ctx.fillStyle = "#B96177";
      ctx.font = "bold 24px Trebuchet MS, sans-serif";
      ctx.fillText("KEEP DRY", 545, 387);
    }
    tex.update();
    const paperMaterial = mat(id + " paper", "#FFFFFF");
    paperMaterial.diffuseTexture = tex;
    paperMaterial.emissiveColor.set(0.06, 0.06, 0.06);
    paperMaterial.backFaceCulling = false;
    const frontPaper = place(
      CreatePlane(
        id + " readable paper",
        { width: 1.76, height: 1.027 },
        scene,
      ),
      paperMaterial,
      x,
      1.21,
      faceZ,
      false,
      false,
    );
    const reversePaper = place(
      CreatePlane(
        id + " readable reverse",
        { width: 1.76, height: 1.027 },
        scene,
      ),
      paperMaterial,
      x,
      1.21,
      z + 0.065,
      false,
      false,
    );
    reversePaper.rotation.y = Math.PI;
    foregroundProps.push(frame, frontPaper, reversePaper);
    // Brass clips and rolled spare paper give each display a little history.
    for (const offset of [-0.6, 0.6])
      box(
        id + " paper clip",
        0.095,
        0.12,
        0.055,
        x + offset,
        1.7,
        faceZ - 0.02,
        m.brass,
      );
    const scroll = cylinder(
      id + " rolled paper",
      0.42,
      0.07,
      x - 0.7,
      0.69,
      z - 0.08,
      m.white,
    );
    scroll.rotation.z = Math.PI / 2;
    const seal = sphere(
      id + " unread ribbon seal",
      0.075,
      x + 0.82,
      1.68,
      faceZ - 0.055,
      m.yellow,
    );
    const caption = label(
      id + " small caption",
      discovery.title,
      x,
      2.07,
      z,
      1.38,
    );
    discoveryProps.set(id, { seal, caption });
    addTarget({
      id,
      kind: "discovery",
      discovery: id,
      label: `Read ${discovery.title}`,
      position: new Vector3(x, 0, z - 0.8),
    });
  }
  discoveryDisplay("workshop-sketch", -7, -3);
  discoveryDisplay("cargo-manifest", 6, 28);
  const npcRoots: Record<string, TransformNode> = {};
  for (const [id, x, z] of [
    ["moss", 2, 0],
    ["bea", -3, 31.2],
  ] as const) {
    const root = new TransformNode(id + " character", scene);
    root.position.set(x, 0, z);
    npcRoots[id] = root;
    const collider = cylinder(
      id + " personal space",
      1.45,
      0.4,
      x,
      0.725,
      z,
      m.dark,
      true,
    );
    collider.isVisible = false;
    label(
      id + " name",
      episode.story.npcNames[id],
      x,
      2.25,
      z,
      0.95,
      "#FFF1D0",
      "#276E65",
    );
    addTarget({
      id,
      kind: "npc",
      npc: id,
      label: "Talk to " + episode.story.npcNames[id],
      position: new Vector3(x, 0, z),
    });
  }

  // The bridge lifts about its shoreline hinge; the repaired latch makes it a permanent route.
  const bridgePivot = new TransformNode("bridge hinge", scene);
  bridgePivot.position.set(0, 0, 9.7);
  const farBridgePivot = new TransformNode("far bridge hinge", scene);
  farBridgePivot.position.set(0, 0, 18.6);
  const bridgeDecks: Mesh[] = [];
  for (const [pivot, sign] of [
    [bridgePivot, 1],
    [farBridgePivot, -1],
  ] as const) {
    const deck = box(
      "walkable bridge",
      3,
      0.22,
      4.52,
      0,
      -0.12,
      sign * 2.225,
      m.wood,
      true,
    );
    deck.parent = pivot;
    bridgeDecks.push(deck);
    for (let i = 0; i < 11; i++) {
      const plank = box(
        "bridge plank",
        3.2,
        0.12,
        0.35,
        0,
        0.02,
        sign * (0.1 + i * 0.43),
        m.woodLight,
      );
      plank.parent = pivot;
    }
    for (const x of [-1.6, 1.6]) {
      for (let j = 0; j < 3; j++) {
        const post = cylinder(
          "bridge rail post",
          1.0,
          0.075,
          x,
          0.5,
          sign * j * 2.16,
          m.wood,
        );
        post.parent = pivot;
      }
      const rope = tube(
        "bridge hand rope",
        [
          new Vector3(x, 0.85, 0),
          new Vector3(x, 0.78, sign * 2.2),
          new Vector3(x, 0.85, sign * 4.4),
        ],
        0.042,
      );
      rope.parent = pivot;
    }
  }
  bridgePivot.rotation.x = initial.bridgeOpen ? 0 : -0.9;
  farBridgePivot.rotation.x = initial.bridgeOpen ? 0 : 0.9;
  const bridgeBlock = box(
    "raised bridge safety collision",
    3.25,
    2,
    0.4,
    0,
    1,
    9.8,
    m.wood,
    true,
  );
  bridgeBlock.isVisible = false;
  const bridgeBanner = label(
    "bridge direction",
    episode.scene.stations.lift.title,
    2.4,
    1.75,
    8.7,
    2,
  );
  cylinder("direction signpost", 1.8, 0.06, 2.4, 0.9, 8.7, m.wood);

  const mechanisms: Partial<
    Record<
      MechanismId,
      {
        beam: TransformNode;
        weight: Mesh;
        hand: TransformNode;
        sockets: Mesh[];
      }
    >
  > = {};
  const groundWeights: Partial<Record<MechanismId, Mesh>> = {};
  const motionStations: Partial<
    Record<MechanismId, ReturnType<typeof createMotionStation>>
  > = {};
  const experiments: Partial<
    Record<MechanismId, ReturnType<typeof createExperimentStation>>
  > = {};
  const evidenceStations: Partial<
    Record<MechanismId, ReturnType<typeof createEvidenceStation>>
  > = {};
  const readings = {} as Record<MechanismId, ReturnType<typeof stationReading>>;
  function mechanism(
    id: MechanismId,
    x: number,
    z: number,
    weightX: number,
    weightZ: number,
  ) {
    const binding = episode.scene.stations[id];
    if (binding.kind !== "counterweight")
      throw new Error("Counterweight station expected");
    const task = stationConfig(episode, id).tasks.find(
      (task) => task.id === binding.taskId,
    )!;
    const constants = Object.fromEntries(
      task.constants.map((entry) => [entry.id, entry.value]),
    );
    const fulcrum = place(
      CreateCylinder(
        id + " fulcrum",
        {
          height: 1.1,
          diameterTop: 0.15,
          diameterBottom: 0.9,
          tessellation: 3,
        },
        scene,
      ),
      m.teal,
      x,
      0.55,
      z,
    );
    fulcrum.rotation.y = Math.PI / 2;
    const beam = new TransformNode(id + " balancing beam", scene);
    beam.position.set(x, 1.1, z);
    const arm = box(id + " lever arm", 4.65, 0.15, 0.26, -1, 0, 0, m.woodLight);
    arm.parent = beam;
    const heavy = box(
      id + " fixed load",
      0.64,
      id === "bridge" ? 0.55 : 0.8,
      0.64,
      1,
      0.36,
      0,
      m.red,
    );
    heavy.parent = beam;
    foregroundProps.push(arm, heavy, fulcrum);
    label(id + " fixed mass", `${constants.fixedMass} kg`, x + 1, 2, z, 0.85);
    const sockets: Mesh[] = [];
    for (const slot of [1, 2, 3] as const) {
      const socket = place(
        CreateTorus(
          id + " socket " + slot,
          { diameter: 0.48, thickness: 0.065, tessellation: 20 },
          scene,
        ),
        m.brass,
        -slot,
        0.14,
        0,
      );
      socket.parent = beam;
      sockets.push(socket);
      const footprint = cylinder(
        id + " ground mark " + slot,
        0.025,
        0.38,
        x - slot,
        0.04,
        z - 1.05,
        m.white,
      );
      label(
        id + " distance " + slot,
        binding.socketLabels[slot - 1],
        x - slot,
        0.43,
        z - 1.05,
        0.66,
      );
      addTarget({
        id: id + "-slot-" + slot,
        kind: "socket",
        mechanism: id,
        slot,
        label: `Place ${binding.itemLabel} · ${binding.socketLabels[slot - 1]}`,
        position: new Vector3(x - slot, 0, z - 1.1),
      });
    }
    const weight = cylinder(
      id + " placed counterweight",
      0.5,
      0.23,
      0,
      0.38,
      0,
      m.brass,
    );
    weight.parent = beam;
    foregroundProps.push(weight);
    const handle = place(
      CreateTorus(
        id + " weight handle",
        { diameter: 0.28, thickness: 0.05, tessellation: 16 },
        scene,
      ),
      m.dark,
      0,
      0.38,
      0,
    );
    handle.parent = weight;
    handle.rotation.x = Math.PI / 2;
    const ground = cylinder(
      id + " spare weight",
      0.5,
      0.23,
      weightX,
      0.9,
      weightZ,
      m.brass,
    );
    const gh = place(
      CreateTorus(
        id + " spare handle",
        { diameter: 0.28, thickness: 0.05, tessellation: 16 },
        scene,
      ),
      m.dark,
      0,
      0.36,
      0,
    );
    gh.parent = ground;
    gh.rotation.x = Math.PI / 2;
    cylinder(
      id + " weight pedestal",
      0.6,
      0.5,
      weightX,
      0.3,
      weightZ,
      m.stone,
      true,
    );
    label(
      id + " spare mass",
      `${constants.counterMass} kg`,
      weightX,
      1.65,
      weightZ,
      0.85,
    );
    groundWeights[id] = ground;
    addTarget({
      id: id + "-weight",
      kind: "weight",
      item: (id + "-weight") as CarryItem,
      mechanism: id,
      label: `Pick up ${binding.itemLabel}`,
      position: new Vector3(weightX, 0, weightZ),
    });
    cylinder(id + " crank stand", 0.9, 0.13, x, 0.45, z - 2.25, m.teal, true);
    const hand = new TransformNode(id + " crank wheel root", scene);
    hand.position.set(x, 1, z - 2.25);
    const wheel = place(
      CreateTorus(
        id + " brass crank",
        { diameter: 0.65, thickness: 0.085, tessellation: 24 },
        scene,
      ),
      m.brass,
      0,
      0,
      0,
    );
    wheel.parent = hand;
    wheel.rotation.x = Math.PI / 2;
    const spoke = box(id + " crank spoke", 0.55, 0.06, 0.06, 0, 0, 0, m.brass);
    spoke.parent = hand;
    label(id + " crank sign", binding.title, x, 0.75, z - 2.65, 1.55);
    addTarget({
      id: id + "-crank",
      kind: "crank",
      mechanism: id,
      label: binding.activationLabel,
      position: new Vector3(x, 0, z - 2.65),
    });
    mechanisms[id] = { beam, weight, hand, sockets };
  }
  for (const [site, x, z, supplyX, supplyZ] of [
    ["bridge", -5, 5, -9, 0],
    ["lift", 4.8, 25, 8, 20.5],
  ] as const) {
    const binding = episode.scene.stations[site];
    if (binding.kind === "counterweight")
      mechanism(site, x, z, supplyX, supplyZ);
    else if (binding.kind === "evidence-crates") {
      const station = createEvidenceStation(
        scene,
        {
          site,
          title: binding.title,
          activationLabel: binding.activationLabel,
          round: stationRound(episode, site),
        },
        new Vector3(x, 0, z),
        m,
        shadows,
      );
      evidenceStations[site] = station;
      station.targets.forEach(addTarget);
      foregroundProps.push(...station.foreground);
    } else if (binding.kind === "experiment") {
      const config = stationConfig(episode, site),
        ranges = experimentReadoutRanges(episode, site);
      const station = createExperimentStation(
        scene,
        {
          site,
          title: binding.title,
          itemLabel: binding.itemLabel,
          activationLabel: binding.activationLabel,
          socketLabels: binding.socketLabels,
          prediction: binding.prediction
            ? {
                ...binding.prediction,
                label: config.controls.find(
                  (control) => control.id === binding.prediction!.inputId,
                )!.label,
                optionLabels: (() => {
                  const control = config.controls.find(
                    (control) => control.id === binding.prediction!.inputId,
                  )!;
                  return control.kind === "choice"
                    ? binding.prediction!.values.map(
                        (value) =>
                          control.options.find(
                            (option) => option.value === value,
                          )!.label,
                      )
                    : [];
                })(),
              }
            : undefined,
          outputs: config.outputs.map((output) => ({
            id: output.id,
            label: output.label,
            unit: output.unit,
            ...ranges[output.id],
          })),
        },
        new Vector3(x, 0, z),
        new Vector3(supplyX, 0, supplyZ),
        m,
        shadows,
      );
      experiments[site] = station;
      station.targets.forEach(addTarget);
      foregroundProps.push(...station.foreground);
    } else {
      const motion = binding.motion!;
      const station = createMotionStation(
        scene,
        {
          site,
          title: binding.title,
          itemLabel: binding.itemLabel,
          activationLabel: binding.activationLabel,
          socketLabels: binding.socketLabels,
          predictionValues: binding.prediction!.values,
          timeMin: motion.timeMin,
          timeMax: motion.timeMax,
          sample: (time) => motionSample(episode, site, time),
        },
        new Vector3(x, 0, z),
        new Vector3(supplyX, 0, supplyZ),
        m,
        shadows,
      );
      motionStations[site] = station;
      station.targets.forEach(addTarget);
      foregroundProps.push(...station.foreground);
    }
  }
  // A cargo cage rises from the sheltered cove onto a reachable landing.
  const liftPlatform = new TransformNode("cargo elevator", scene);
  liftPlatform.position.set(-4, -2.2, 16.9);
  const liftFloor = box(
    "cargo cage floor",
    2.5,
    0.2,
    2.5,
    0,
    0,
    0,
    m.woodLight,
  );
  liftFloor.parent = liftPlatform;
  for (const x of [-1.1, 1.1]) {
    const post = cylinder("cargo cage post", 2, 0.07, x, 1, 0.9, m.wood);
    post.parent = liftPlatform;
  }
  const liftHeader = box(
    "cargo cage header",
    2.5,
    0.14,
    0.16,
    0,
    2,
    0.9,
    m.teal,
  );
  liftHeader.parent = liftPlatform;
  const parcel = box("Moss parcel", 0.75, 0.65, 0.62, 0, 0.45, 0, m.yellow);
  parcel.parent = liftPlatform;
  const parcelBand = box("parcel twine", 0.08, 0.67, 0.65, 0, 0.45, 0, m.white);
  parcelBand.parent = liftPlatform;
  const tag = box(
    "parcel address label",
    0.4,
    0.2,
    0.015,
    0,
    0.5,
    -0.319,
    m.white,
  );
  tag.parent = liftPlatform;
  for (const x of [-5.5, -2.5]) {
    cylinder("cargo lift mast", 5, 0.12, x, 1.2, 18, m.wood, true);
    tube(
      "cargo lift cable",
      [
        new Vector3(x, 3.7, 18),
        new Vector3(x, 3.7, 16.9),
        new Vector3(x, -2, 16.9),
      ],
      0.025,
      m.dark,
    );
  }
  box("cargo lift crossbar", 3.6, 0.2, 0.2, -4, 3.6, 18, m.teal);
  addTarget({
    id: "parcel",
    kind: "parcel",
    item: "parcel",
    label: `Collect ${episode.story.npcNames.moss}’s parcel`,
    position: new Vector3(-4, 0, 18.6),
  });
  const postcards: Record<string, Mesh> = {};
  for (const [id, x, z] of [
    ["harbor", 13.7, 5],
    ["workshop", -6.5, -6],
    ["lookout", 7.5, 35.3],
  ] as const) {
    const card = box(id + " postcard", 0.45, 0.32, 0.045, x, 0.8, z, m.white);
    card.rotation.z = -0.15;
    const stamp = box(id + " postcard stamp", 0.11, 0.1, 0.02, 0, 0, 0, m.red);
    stamp.parent = card;
    stamp.position.set(0.12, 0.07, -0.03);
    postcards[id] = card;
    addTarget({
      id: "postcard-" + id,
      kind: "postcard",
      card: id,
      label: `Find postcard · ${episode.story.postcards.find((card) => card.id === id)?.title ?? "Island postcard"}`,
      position: new Vector3(x, 0, z),
    });
  }
  label(
    "welcome sign",
    `${episode.story.npcNames.moss} landing`,
    3,
    1.8,
    -7.5,
    2,
  );
  cylinder("welcome post", 1.7, 0.06, 3, 0.85, -7.5, m.wood);

  const courierVisual = new TransformNode("Piper visual", scene);
  const controller = createCourierController(
    scene,
    canvas,
    courierVisual,
    new Vector3(0, 0.01, -7),
  );
  // Assets are original Blender exports. A useful loading error is surfaced by the caller.
  const animated: Record<string, AnimationGroup[]> = {};
  await Promise.all(
    ["piper", "moss", "bea"].map(async (id) => {
      const loaded = await ImportMeshAsync(
        "/models/windpost/" + id + ".glb",
        scene,
      );
      const root = loaded.meshes[0];
      root.parent = id === "piper" ? courierVisual : npcRoots[id];
      loaded.meshes.forEach((mesh) => {
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.receiveShadows = true;
        shadows.addShadowCaster(mesh);
      });
      animated[id] = loaded.animationGroups;
      loaded.animationGroups.forEach((g) => g.stop());
      const idle = loaded.animationGroups.find((g) =>
        g.name.toLowerCase().includes("idle"),
      );
      idle?.start(true);
    }),
  );
  const carried = new TransformNode("carried item socket", scene);
  carried.parent = courierVisual;
  carried.position.set(0, 0.86, 0.38);
  const carryWeight = cylinder("weight in wings", 0.48, 0.24, 0, 0, 0, m.brass);
  carryWeight.parent = carried;
  const carryBeacon = new TransformNode("timing beacon in wings", scene);
  carryBeacon.parent = carried;
  const carriedCase = cylinder(
    "carried beacon case",
    0.4,
    0.18,
    0,
    0,
    0,
    m.blue,
  );
  const carriedAerial = cylinder(
    "carried beacon aerial",
    0.36,
    0.018,
    0,
    0.38,
    0,
    m.brass,
  );
  const carriedLens = sphere(
    "carried beacon lens",
    0.085,
    0,
    0.11,
    -0.16,
    m.yellow,
  );
  for (const part of [carriedCase, carriedAerial, carriedLens])
    part.parent = carryBeacon;
  const carryCartridge = box(
    "sample cartridge in wings",
    0.45,
    0.5,
    0.35,
    0,
    0,
    0,
    m.blue,
  );
  carryCartridge.parent = carried;
  const cartridgeTag = box(
    "carried sample tag",
    0.3,
    0.15,
    0.012,
    0,
    0.04,
    -0.182,
    m.white,
  );
  cartridgeTag.parent = carryCartridge;
  const carryFolio = box(
    "source folio in wings",
    0.7,
    0.48,
    0.06,
    0,
    0,
    0,
    m.white,
  );
  carryFolio.parent = carried;
  const carriedKit = apparatusKit(scene, "carried source card", m, shadows);
  const carriedTitle = carriedKit.panel(
    "title",
    ["SOURCE CARD"],
    0,
    0,
    -0.035,
    0.65,
    0.4,
  );
  carriedTitle.mesh.parent = carryFolio;
  const carryParcel = box("parcel in wings", 0.75, 0.6, 0.6, 0, 0, 0, m.yellow);
  carryParcel.parent = carried;
  const cpRibbon = box(
    "carried parcel twine",
    0.07,
    0.62,
    0.62,
    0,
    0,
    0,
    m.white,
  );
  cpRibbon.parent = carryParcel;
  const ring = place(
    CreateTorus(
      "interaction halo",
      { diameter: 1.25, thickness: 0.035, tessellation: 32 },
      scene,
    ),
    m.yellow,
    0,
    0.06,
    0,
    false,
    false,
  );

  let state = initial,
    enabled = true,
    reducedMotion = false,
    clock = 0,
    lastTarget = "",
    animName = "",
    sample = 0;
  function setState(next: EpisodeProgress) {
    state = next;
    controller.setCarrying(!!state.carrying);
    for (const id of ["bridge", "lift"] as const) {
      const slot = id === "bridge" ? state.bridgeSlot : state.liftSlot;
      const binding = episode.scene.stations[id];
      const reading = stationReading(episode, state, id);
      readings[id] = reading;
      if (binding.kind === "counterweight") {
        mechanisms[id]!.weight.setEnabled(slot !== null);
        mechanisms[id]!.weight.position.x = -(slot ?? 1);
        groundWeights[id]!.setEnabled(
          slot === null && state.carrying !== id + "-weight",
        );
      } else if (binding.kind === "evidence-crates") {
        const card = carriedEvidence(state);
        evidenceStations[id]!.setReading(
          state.assignments[id],
          card?.site === id ? card.cardId : null,
          id === "bridge" ? state.bridgeOpen : state.liftRaised,
        );
      } else if (binding.kind === "experiment") {
        experiments[id]!.setReading({
          slot,
          carrying: state.carrying === id + "-weight",
          solved: id === "bridge" ? state.bridgeOpen : state.liftRaised,
          outputs: reading.outputs,
          prediction: binding.prediction
            ? reading.inputs[binding.prediction.inputId]
            : undefined,
        });
      } else {
        motionStations[id]!.setReading({
          slot,
          carrying: state.carrying === id + "-weight",
          solved: id === "bridge" ? state.bridgeOpen : state.liftRaised,
          time: reading.inputs[binding.motion!.timeInput],
          interval: reading.inputs[binding.socketInput],
          estimate: reading.inputs[binding.prediction!.inputId],
          position: reading.outputs.position,
          positionBefore: reading.outputs.positionBefore,
          average: reading.outputs.average,
          attempts: state.trials.filter((trial) => trial.mechanism === id)
            .length,
        });
      }
    }
    const carriedSite =
      state.carrying === "bridge-weight"
        ? "bridge"
        : state.carrying === "lift-weight"
          ? "lift"
          : null;
    carryWeight.setEnabled(
      carriedSite !== null &&
        episode.scene.stations[carriedSite].kind === "counterweight",
    );
    carryBeacon.setEnabled(
      carriedSite !== null &&
        episode.scene.stations[carriedSite].kind === "timing-gates",
    );
    carryCartridge.setEnabled(
      carriedSite !== null &&
        episode.scene.stations[carriedSite].kind === "experiment",
    );
    const sourceCard = carriedEvidence(state);
    carryFolio.setEnabled(sourceCard !== null);
    if (sourceCard) {
      const card = stationRound(episode, sourceCard.site).cards.find(
        (entry) => entry.id === sourceCard.cardId,
      )!;
      carriedTitle.write([card.label, "SOURCE CARD"]);
    }
    carryParcel.setEnabled(state.carrying === "parcel");
    parcel.setEnabled(
      state.liftRaised && !state.parcelCollected && !state.delivered,
    );
    parcelBand.setEnabled(parcel.isEnabled());
    tag.setEnabled(parcel.isEnabled());
    Object.entries(postcards).forEach(([id, mesh]) =>
      mesh.setEnabled(!state.postcards.includes(id)),
    );
    for (const [id, props] of discoveryProps) {
      props.seal.setEnabled(!state.discoveries.includes(id));
      props.caption.setEnabled(!state.discoveries.includes(id));
    }
    returnedMailPennant.setEnabled(state.postcardReturned);
  }
  setState(initial);
  function available(t: WorldTarget) {
    if (t.kind === "evidence-card" || t.kind === "evidence-bin") {
      const site = t.mechanism!;
      const unlocked =
        state.metMoss &&
        (site === "bridge"
          ? !state.bridgeOpen
          : state.bridgeOpen && state.metBea && !state.liftRaised);
      if (!unlocked) return false;
      if (t.kind === "evidence-card") return !state.carrying;
      return carriedEvidence(state)?.site === site;
    }
    if (t.kind === "weight")
      return (
        !state.carrying &&
        (t.mechanism === "bridge"
          ? state.metMoss && state.bridgeSlot === null && !state.bridgeOpen
          : state.metBea &&
            state.bridgeOpen &&
            state.liftSlot === null &&
            !state.liftRaised)
      );
    if (t.kind === "socket")
      return (
        !(t.mechanism === "bridge" ? state.bridgeOpen : state.liftRaised) &&
        (state.carrying === t.mechanism + "-weight" ||
          (!state.carrying &&
            (t.mechanism === "bridge" ? state.bridgeSlot : state.liftSlot) ===
              t.slot))
      );
    if (t.kind === "dial")
      return (
        !!t.mechanism &&
        !!episode.scene.stations[t.mechanism].prediction &&
        (t.mechanism === "bridge"
          ? !state.bridgeOpen
          : state.bridgeOpen && !state.liftRaised)
      );
    if (t.kind === "crank")
      return t.mechanism === "bridge"
        ? !state.bridgeOpen
        : state.bridgeOpen && !state.liftRaised;
    if (t.kind === "parcel")
      return (
        state.liftRaised &&
        !state.parcelCollected &&
        !state.delivered &&
        !state.carrying
      );
    if (t.kind === "postcard") return !state.postcards.includes(t.card!);
    if (t.kind === "discovery")
      return (
        !!t.discovery &&
        !state.discoveries.includes(t.discovery) &&
        (t.discovery !== "cargo-manifest" || state.bridgeOpen)
      );
    return true;
  }
  function update(dt: number) {
    clock += dt;
    controller.update(dt);
    // Large workshop props become translucent only while they obscure the courier.
    const eye = controller.camera.position,
      look = controller.position.add(new Vector3(0, 1, 0)).subtract(eye);
    const sight = new Ray(eye, look.normalizeToNew(), look.length());
    for (const prop of foregroundProps) {
      prop.computeWorldMatrix(true);
      const hit = sight.intersectsMesh(prop, false);
      prop.visibility =
        hit.hit && hit.distance < sight.length - 0.35 ? 0.22 : 1;
    }
    const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
    bridgePivot.rotation.x +=
      ((state.bridgeOpen ? 0 : -0.9) - bridgePivot.rotation.x) * ease;
    farBridgePivot.rotation.x = -bridgePivot.rotation.x;
    const bridgeReady =
      state.bridgeOpen && Math.abs(bridgePivot.rotation.x) < 0.035;
    bridgeDecks.forEach((deck) => (deck.checkCollisions = bridgeReady));
    bridgeBlock.setEnabled(!bridgeReady);
    liftPlatform.position.y +=
      ((state.liftRaised ? 0 : -2.2) - liftPlatform.position.y) * ease;
    for (const id of ["bridge", "lift"] as const) {
      if (episode.scene.stations[id].kind === "counterweight") {
        const reading = readings[id];
        const angle = reading.passed
          ? 0
          : reading.outputs.leftTorque > reading.outputs.rightTorque
            ? -0.17
            : 0.17;
        const beam = mechanisms[id]!.beam;
        beam.rotation.z += (angle - beam.rotation.z) * ease;
      } else if (episode.scene.stations[id].kind === "evidence-crates")
        evidenceStations[id]!.update(controller.position);
      else if (episode.scene.stations[id].kind === "experiment")
        experiments[id]!.update(controller.position);
      else
        motionStations[id]!.update(
          dt,
          reducedMotion,
          enabled,
          controller.position,
        );
    }
    if (!reducedMotion) {
      clouds.forEach((c) => (c.position.x += dt * 0.04));
      waves.forEach((w, i) => {
        w.position.y = -2.45 + Math.sin(clock * 0.7 + i) * 0.025;
      });
      buoy.position.y = -2 + Math.sin(clock) * 0.12;
      posthouse.flag.rotation.y = Math.sin(clock * 2) * 0.09;
      returnedMailPennant.rotation.y = Math.sin(clock * 1.7) * 0.065;
    }
    let best: WorldTarget | null = null,
      distance = Infinity;
    if (enabled)
      for (const t of targets) {
        if (!available(t)) continue;
        const d = Vector3.Distance(controller.position, t.position);
        const max = t.kind === "npc" ? 2.25 : t.kind === "socket" ? 1.1 : 1.7;
        if (d < max && d < distance) {
          best = t;
          distance = d;
        }
      }
    ring.setEnabled(!!best);
    if (best) {
      ring.position.set(best.position.x, 0.06, best.position.z);
    }
    const identity = best?.id ?? "";
    if (lastTarget !== identity) {
      lastTarget = identity;
      callbacks.target(best);
    }
    for (const [id, root] of Object.entries(npcRoots)) {
      const delta = controller.position.subtract(root.position);
      if (delta.length() < 5) root.rotation.y = Math.atan2(delta.x, delta.z);
    }
    const desired = !enabled
      ? "idle"
      : !controller.grounded
        ? "jump"
        : state.carrying
          ? controller.moving
            ? "carry_walk"
            : "carry"
          : controller.moving
            ? "walk"
            : "idle";
    if (desired !== animName) {
      animName = desired;
      const groups = animated.piper;
      groups.forEach((g) => g.stop());
      (
        groups.find((g) => g.name.toLowerCase() === desired) ??
        groups.find((g) => g.name.toLowerCase().includes("idle"))
      )?.start(desired !== "jump");
    }
    if (!reducedMotion) {
      Object.values(postcards).forEach((c, i) => {
        c.position.y = 0.8 + Math.sin(clock * 2 + i) * 0.09;
        c.rotation.y = clock * 0.4;
      });
    }
    sample += dt;
    if (sample > 0.25) {
      sample = 0;
      canvas.dataset.position = [
        controller.position.x,
        controller.position.y,
        controller.position.z,
      ]
        .map((n) => n.toFixed(2))
        .join(",");
      canvas.dataset.grounded = String(controller.grounded);
      canvas.dataset.nearby = identity;
      canvas.dataset.fps = engine.getFps().toFixed(0);
    }
  }
  callbacks.ready();
  return {
    scene,
    controller,
    update,
    setState,
    setEnabled(value: boolean) {
      enabled = value;
      controller.setEnabled(value);
      if (!value) {
        lastTarget = "";
        ring.setEnabled(false);
        callbacks.target(null);
      }
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      controller.setReducedMotion(value);
    },
    dispose() {
      controller.dispose();
      scene.dispose();
    },
  };
}
