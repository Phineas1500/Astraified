import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Curve3 } from "@babylonjs/core/Maths/math.path";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Engine } from "@babylonjs/core/Engines/engine";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateIcoSphere } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateRibbon } from "@babylonjs/core/Meshes/Builders/ribbonBuilder";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Scene } from "@babylonjs/core/scene";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Culling/ray";

const MeshBuilder = {
  CreateBox,
  CreateCylinder,
  CreateIcoSphere,
  CreateTube,
  CreateTorus,
  CreateGround,
  CreateRibbon,
};

export type StationId = "workshop" | "relay" | "beacon";
export type HarborMode = "adventure" | "explore";

export const stationInfo: Record<
  StationId,
  { name: string; anchor: Vector3; position: Vector3 }
> = {
  workshop: {
    name: "The workshop",
    anchor: new Vector3(-3.8, 3.35, -1.6),
    position: new Vector3(-3.8, 1.2, -1.3),
  },
  relay: {
    name: "Harbor relay",
    anchor: new Vector3(0.05, 2.45, -2.3),
    position: new Vector3(0.05, 1.1, -2.3),
  },
  beacon: {
    name: "The lighthouse",
    anchor: new Vector3(3.65, 8.35, 1.25),
    position: new Vector3(3.65, 4.25, 1.25),
  },
};

export interface HarborScene {
  scene: Scene;
  camera: ArcRotateCamera;
  setState: (mode: HarborMode, active: StationId, completed: string[]) => void;
  dispose: () => void;
}

// This miniature is original procedural art. Its deliberately simple geometry
// keeps the same world available on integrated GPUs and without asset services.
export function createHarborScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  onSelect: (id: StationId) => void,
): HarborScene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.043, 0.105, 0.14, 1);
  scene.ambientColor = new Color3(0.33, 0.42, 0.5);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.009;
  scene.fogColor = new Color3(0.07, 0.17, 0.21);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const camera = new ArcRotateCamera(
    "harbor-camera",
    -Math.PI / 2.8,
    1.06,
    23,
    new Vector3(0, 2.2, -0.1),
    scene,
  );
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 28;
  camera.lowerBetaLimit = 0.5;
  camera.upperBetaLimit = 1.32;
  camera.panningSensibility = 0;
  camera.wheelPrecision = 30;
  camera.minZ = 0.1;
  camera.maxZ = 180;
  camera.fov = 0.73;
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  scene.activeCamera = camera;
  const hemi = new HemisphericLight("sky-fill", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;
  hemi.diffuse = new Color3(0.63, 0.77, 0.95);
  hemi.groundColor = new Color3(0.24, 0.27, 0.35);
  const sun = new DirectionalLight(
    "last-sunlight",
    new Vector3(-0.7, -1.4, 0.6),
    scene,
  );
  sun.position = new Vector3(12, 20, -10);
  sun.intensity = 2.4;
  sun.diffuse = new Color3(1, 0.77, 0.55);
  const shadows = new ShadowGenerator(2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 24;
  shadows.darkness = 0.22;
  const glow = new GlowLayer("warm-lights", scene, { blurKernelSize: 48 });
  glow.intensity = 0.5;

  const material = (name: string, hex: string, emission = 0) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    if (emission) m.emissiveColor = m.diffuseColor.scale(emission);
    return m;
  };
  const mats = {
    cliff: material("basalt / blue slate", "#355365"),
    cliffLight: material("basalt / cut face", "#52717A"),
    grass: material("island / sage", "#789276"),
    grassDark: material("island / moss", "#526E5C"),
    path: material("paths / sand", "#BDAD88"),
    ivory: material("paint / warm ivory", "#E9D8AF"),
    coral: material("roof / coral", "#CF6652"),
    coralLight: material("roof / vermilion edge", "#E58463"),
    teal: material("paint / oxidized teal", "#408E8B"),
    tealDark: material("paint / deep teal", "#244E59"),
    brass: material("metal / aged brass", "#A98950"),
    metal: material("metal / charcoal", "#233D4C"),
    wood: material("wood / cedar", "#987152"),
    woodLight: material("wood / edge", "#BF9672"),
    glass: material("windows / lamplight", "#FFCC76", 0.85),
    darkGlass: material("windows / sleeping", "#284758", 0.12),
    pink: material("wildflowers / rose", "#DBABAB"),
    tree: material("needles / green", "#3A6C63"),
    treeLight: material("needles / mist", "#639178"),
    cream: material("sails / cotton", "#EEE2BC"),
    signal: material("signal / restored", "#A8E6B0", 0.8),
  };
  const objects: Mesh[] = [];
  const mesh = (
    m: Mesh,
    mat: StandardMaterial,
    x = 0,
    y = 0,
    z = 0,
    cast = true,
  ) => {
    m.material = mat;
    m.position.set(x, y, z);
    m.receiveShadows = true;
    m.isPickable = false;
    if (cast) shadows.addShadowCaster(m);
    objects.push(m);
    return m;
  };
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
  ) =>
    mesh(
      MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene),
      mat,
      x,
      y,
      z,
    );
  const cylinder = (
    name: string,
    h: number,
    top: number,
    bottom: number,
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
    tessellation = 16,
  ) =>
    mesh(
      MeshBuilder.CreateCylinder(
        name,
        { height: h, diameterTop: top, diameterBottom: bottom, tessellation },
        scene,
      ),
      mat,
      x,
      y,
      z,
    );
  const sphere = (
    name: string,
    diameter: number,
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
  ) =>
    mesh(
      MeshBuilder.CreateIcoSphere(
        name,
        { radius: diameter / 2, subdivisions: 1, flat: true },
        scene,
      ),
      mat,
      x,
      y,
      z,
    );
  const line = (
    name: string,
    a: Vector3,
    b: Vector3,
    radius: number,
    mat: StandardMaterial,
  ) =>
    mesh(
      MeshBuilder.CreateTube(
        name,
        { path: [a, b], radius, tessellation: 6 },
        scene,
      ),
      mat,
    );
  const torus = (
    name: string,
    diameter: number,
    thickness: number,
    mat: StandardMaterial,
    x: number,
    y: number,
    z: number,
  ) =>
    mesh(
      MeshBuilder.CreateTorus(
        name,
        { diameter, thickness, tessellation: 32 },
        scene,
      ),
      mat,
      x,
      y,
      z,
    );
  const stationMeshes: Record<StationId, Mesh[]> = {
    workshop: [],
    relay: [],
    beacon: [],
  };
  const markStation = (id: StationId, start: number) => {
    for (const m of objects.slice(start)) {
      m.isPickable = true;
      m.metadata = { station: id };
      stationMeshes[id].push(m);
    }
  };
  // Soft rippling ocean. Rendering is local, deterministic, and texture-free.
  const water = MeshBuilder.CreateGround(
    "open-water",
    { width: 180, height: 180 },
    scene,
  );
  water.position.y = -0.66;
  water.isPickable = false;
  const waterMaterial = new ShaderMaterial(
    "tidal-water",
    scene,
    {
      vertexSource:
        "precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 p; void main(){p=position; gl_Position=worldViewProjection*vec4(position,1.0);}",
      fragmentSource:
        "precision highp float; varying vec3 p; uniform float time; void main(){float waves=sin(p.x*2.0+p.z*.5+time*.7)*sin(p.z*2.8-time*.45); float crest=smoothstep(.89,1.,waves); float d=length(p.xz); vec3 c=mix(vec3(.085,.235,.27),vec3(.10,.30,.32),sin(p.z*.18)*.5+.5); c+=vec3(.11,.19,.18)*crest*.35; c=mix(c,vec3(.045,.12,.16),smoothstep(18.,65.,d)); gl_FragColor=vec4(c,1.);}",
    },
    { attributes: ["position"], uniforms: ["worldViewProjection", "time"] },
  );
  water.material = waterMaterial;
  // Shoreline and the faceted island create a readable silhouette at every angle.
  const shore = cylinder(
    "shallow-water",
    0.06,
    17,
    17,
    material("shore / turquoise", "#2E6C70"),
    0,
    -0.6,
    0,
    48,
  );
  shore.scaling.z = 0.7;
  const islandBase = cylinder(
    "island / lower stone",
    1.8,
    14.5,
    10.2,
    mats.cliff,
    0,
    -0.2,
    0,
    12,
  );
  islandBase.scaling.z = 0.73;
  islandBase.rotation.y = 0.12;
  const islandTop = cylinder(
    "island / meadow",
    0.32,
    14.2,
    14.7,
    mats.grass,
    0,
    0.65,
    0,
    12,
  );
  islandTop.scaling.z = 0.73;
  islandTop.rotation.y = 0.12;
  let rngSeed = 7429;
  const random = () => {
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };
  for (let i = 0; i < 29; i++) {
    const angle = (i / 29) * Math.PI * 2;
    const rock = sphere(
      `shore-rock-${i}`,
      0.65 + random() * 1.4,
      i % 3 ? mats.cliff : mats.cliffLight,
      Math.cos(angle) * (6.6 + random() * 0.6),
      -0.15 + random() * 0.5,
      Math.sin(angle) * 4.7,
    );
    rock.scaling.set(1.2, 0.8 + random() * 1.1, 0.8);
    rock.rotation.set(random(), random(), random());
  }
  const pathPoints = Curve3.CreateCatmullRomSpline(
    [
      new Vector3(-3.7, 0.84, -4.7),
      new Vector3(-3.2, 0.84, -3.3),
      new Vector3(-3.5, 0.84, -1.7),
      new Vector3(-1.55, 0.84, -0.65),
      new Vector3(0.2, 0.84, -1),
      new Vector3(2.2, 0.84, -0.2),
      new Vector3(3.5, 0.84, 1.25),
    ],
    7,
    false,
  ).getPoints();
  const edges = [-1, 1].map((side) =>
    pathPoints.map((p, i) => {
      const direction = pathPoints[Math.min(i + 1, pathPoints.length - 1)]
        .subtract(pathPoints[Math.max(i - 1, 0)])
        .normalize();
      return p.add(
        new Vector3(direction.z * side * 0.39, 0, -direction.x * side * 0.39),
      );
    }),
  );
  mesh(
    MeshBuilder.CreateRibbon(
      "sandstone-footpath",
      { pathArray: edges, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    ),
    mats.path,
  );
  for (let i = 2; i < pathPoints.length; i += 5) {
    const p = pathPoints[i];
    const stone = cylinder(
      `path-paver-${i}`,
      0.03,
      0.33,
      0.33,
      mats.ivory,
      p.x,
      0.867,
      p.z,
      6,
    );
    stone.scaling.z = 0.55;
    stone.rotation.y = i;
  }
  // A tiny cedar pier and a moored sailboat establish arrival and scale.
  for (let i = 0; i < 15; i++)
    box(
      `pier-plank-${i}`,
      1.45,
      0.13,
      0.23,
      i % 4 ? mats.wood : mats.woodLight,
      -3.8,
      0.02,
      -4.65 - i * 0.25,
    );
  for (const x of [-4.47, -3.13])
    for (const z of [-5, -6.8, -8.1]) {
      cylinder("pier-piling", 1.5, 0.13, 0.19, mats.wood, x, -0.26, z, 8);
      cylinder("pier-cap", 0.08, 0.22, 0.22, mats.woodLight, x, 0.51, z, 8);
    }
  const boat = new TransformNode("tidebound-boat", scene);
  const hull = sphere("boat / hull", 1, mats.coral, -5.25, -0.17, -6.5);
  hull.scaling.set(0.93, 0.48, 2.4);
  hull.parent = boat;
  const hullInside = sphere("boat / inside", 1, mats.wood, -5.25, -0.015, -6.5);
  hullInside.scaling.set(0.74, 0.2, 1.93);
  hullInside.parent = boat;
  const mast = cylinder(
    "boat / mast",
    2.35,
    0.04,
    0.075,
    mats.woodLight,
    -5.25,
    1.1,
    -6.5,
    8,
  );
  mast.parent = boat;
  const sail = new Mesh("boat / linen sail", scene);
  const sailData = new VertexData();
  sailData.positions = [
    -5.19, 0.22, -6.5, -5.19, 2.13, -6.5, -5.19, 0.35, -5.28,
  ];
  sailData.indices = [0, 1, 2, 2, 1, 0];
  sailData.normals = [1, 0, 0, 1, 0, 0, 1, 0, 0];
  sailData.applyToMesh(sail);
  mesh(sail, mats.cream);
  sail.parent = boat;
  const rope = line(
    "boat / mooring",
    new Vector3(-4.47, 0.5, -6.8),
    new Vector3(-5.22, 0.03, -7.2),
    0.025,
    mats.cream,
  );
  rope.parent = boat;

  // Workshop: hand-built facade, gabled metal roof, apron, crates and warm windows.
  const workshopStart = objects.length;
  box(
    "workshop / foundation",
    3.15,
    0.3,
    2.65,
    mats.cliffLight,
    -3.8,
    0.96,
    -0.55,
  );
  box("workshop / walls", 2.95, 1.9, 2.45, mats.ivory, -3.8, 1.99, -0.55);
  box("workshop / lower paint", 2.98, 0.55, 2.48, mats.teal, -3.8, 1.37, -0.55);
  for (const side of [-1, 1]) {
    const roof = box(
      "workshop / pitched roof",
      1.96,
      0.18,
      2.85,
      mats.coral,
      -3.8 + side * 0.83,
      3.18,
      -0.55,
    );
    roof.rotation.z = -side * 0.44;
    for (let i = 0; i < 7; i++) {
      const seam = box(
        "workshop / roof seam",
        1.99,
        0.04,
        0.04,
        mats.coralLight,
        -3.8 + side * 0.83,
        3.3,
        -1.82 + i * 0.42,
      );
      seam.rotation.z = -side * 0.44;
    }
  }
  for (const z of [-1.79, 0.69]) {
    const gable = new Mesh("workshop / gable wall", scene);
    const data = new VertexData();
    data.positions = [-5.28, 2.94, z, -2.32, 2.94, z, -3.8, 3.59, z];
    data.indices = [0, 1, 2, 2, 1, 0];
    data.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1];
    data.applyToMesh(gable);
    mesh(gable, mats.ivory);
  }
  cylinder(
    "workshop / chimney",
    0.8,
    0.25,
    0.25,
    mats.metal,
    -4.47,
    3.75,
    0.25,
    8,
  );
  cylinder(
    "workshop / chimney hat",
    0.13,
    0.48,
    0.48,
    mats.metal,
    -4.47,
    4.2,
    0.25,
    8,
  );
  box(
    "workshop / door frame",
    0.86,
    1.65,
    0.1,
    mats.woodLight,
    -3.35,
    1.86,
    -1.81,
  );
  box(
    "workshop / blue door",
    0.66,
    1.51,
    0.12,
    mats.tealDark,
    -3.35,
    1.79,
    -1.88,
  );
  sphere("workshop / doorknob", 0.09, mats.brass, -3.12, 1.8, -1.96);
  box(
    "workshop / window frame",
    0.99,
    0.86,
    0.12,
    mats.woodLight,
    -4.55,
    2.15,
    -1.81,
  );
  box("workshop / window", 0.8, 0.65, 0.14, mats.glass, -4.55, 2.15, -1.89);
  box(
    "workshop / window mullion",
    0.045,
    0.68,
    0.03,
    mats.cream,
    -4.55,
    2.15,
    -1.98,
  );
  box(
    "workshop / window transom",
    0.84,
    0.045,
    0.03,
    mats.cream,
    -4.55,
    2.15,
    -1.98,
  );
  const roundWindow = cylinder(
    "workshop / attic round window",
    0.14,
    0.49,
    0.49,
    mats.glass,
    -3.8,
    3.14,
    -1.82,
    24,
  );
  roundWindow.rotation.x = Math.PI / 2;
  const roundFrame = torus(
    "workshop / attic round trim",
    0.58,
    0.08,
    mats.cream,
    -3.8,
    3.14,
    -1.93,
  );
  roundFrame.rotation.x = Math.PI / 2;
  box("workshop / doorstep", 1.15, 0.18, 0.6, mats.path, -3.35, 0.97, -2.05);
  box(
    "workshop / side table",
    0.75,
    0.08,
    1.3,
    mats.woodLight,
    -5.67,
    1.45,
    -0.15,
  );
  for (const z of [-0.65, 0.35])
    box("workshop / table leg", 0.09, 0.63, 0.09, mats.wood, -5.67, 1.12, z);
  cylinder(
    "workshop / copper coil",
    0.37,
    0.32,
    0.32,
    mats.brass,
    -5.67,
    1.68,
    -0.3,
    12,
  );
  for (let i = 0; i < 3; i++)
    box(
      "workshop / supply crate",
      0.52,
      0.5,
      0.52,
      mats.wood,
      -5.6 + (i % 2) * 0.57,
      1.08 + Math.floor(i / 2) * 0.52,
      -2.2,
    );
  markStation("workshop", workshopStart);

  // A readable repair bot, Nori, waiting beside the workshop.
  const bot = new TransformNode("Nori / repair companion", scene);
  const botPieces = objects.length;
  box("Nori / body", 0.4, 0.48, 0.31, mats.teal, -2.3, 1.28, -2.37);
  box("Nori / head", 0.51, 0.35, 0.38, mats.ivory, -2.3, 1.73, -2.37);
  box("Nori / screen", 0.4, 0.19, 0.03, mats.metal, -2.3, 1.73, -2.58);
  for (const x of [-2.4, -2.2])
    sphere("Nori / friendly eye", 0.065, mats.glass, x, 1.74, -2.61);
  for (const x of [-2.45, -2.15]) {
    box("Nori / foot", 0.12, 0.19, 0.21, mats.metal, x, 0.94, -2.42);
    const arm = box(
      "Nori / arm",
      0.1,
      0.34,
      0.12,
      mats.brass,
      x + (x < -2.3 ? -0.16 : 0.16),
      1.34,
      -2.37,
    );
    arm.rotation.z = x < -2.3 ? -0.25 : 0.55;
  }
  line(
    "Nori / antenna",
    new Vector3(-2.3, 1.93, -2.37),
    new Vector3(-2.3, 2.11, -2.37),
    0.02,
    mats.metal,
  );
  sphere("Nori / antenna light", 0.075, mats.coralLight, -2.3, 2.13, -2.37);
  for (const m of objects.slice(botPieces)) m.parent = bot;

  const relayStart = objects.length;
  box("relay / stone pad", 1.72, 0.14, 1.2, mats.path, 0.05, 0.9, -2.3);
  box("relay / cabinet", 1.16, 1.33, 0.63, mats.teal, 0.05, 1.6, -2.3);
  box("relay / cabinet top", 1.36, 0.14, 0.88, mats.coral, 0.05, 2.31, -2.3);
  box(
    "relay / inset panel",
    0.93,
    0.85,
    0.045,
    mats.tealDark,
    0.05,
    1.72,
    -2.64,
  );
  for (const x of [-0.23, 0.27]) {
    const dial = cylinder(
      "relay / gauge",
      0.05,
      0.27,
      0.27,
      mats.cream,
      x,
      1.96,
      -2.69,
      20,
    );
    dial.rotation.x = Math.PI / 2;
    const needle = box(
      "relay / dial needle",
      0.026,
      0.115,
      0.025,
      mats.coral,
      x,
      1.96,
      -2.74,
    );
    needle.rotation.z = -0.7;
    box("relay / toggle plate", 0.22, 0.24, 0.045, mats.brass, x, 1.54, -2.68);
    box("relay / toggle", 0.06, 0.16, 0.12, mats.metal, x, 1.57, -2.76);
  }
  for (const x of [-0.39, 0.49])
    cylinder(
      "relay / insulator",
      0.27,
      0.14,
      0.14,
      mats.cream,
      x,
      2.51,
      -2.3,
      12,
    );
  markStation("relay", relayStart);

  // The tower's structural model and the Blender-generated detail asset share
  // the same local origin. The tower remains complete if loading is interrupted.
  const lighthouseStart = objects.length;
  const tx = 3.65,
    tz = 1.25;
  cylinder(
    "lighthouse / raised plinth",
    0.34,
    2.8,
    3.05,
    mats.cliffLight,
    tx,
    1.0,
    tz,
    12,
  );
  cylinder(
    "lighthouse / lower skirt",
    0.26,
    2.04,
    2.2,
    mats.ivory,
    tx,
    1.29,
    tz,
    24,
  );
  cylinder(
    "lighthouse / ivory tower",
    4.8,
    1.25,
    1.98,
    mats.ivory,
    tx,
    3.77,
    tz,
    24,
  );
  cylinder(
    "lighthouse / lower coral band",
    0.5,
    1.84,
    1.92,
    mats.coral,
    tx,
    2.0,
    tz,
    24,
  );
  cylinder(
    "lighthouse / middle coral band",
    0.48,
    1.51,
    1.59,
    mats.coral,
    tx,
    4.15,
    tz,
    24,
  );
  cylinder(
    "lighthouse / top trim",
    0.2,
    1.64,
    1.64,
    mats.coral,
    tx,
    6.21,
    tz,
    24,
  );
  cylinder(
    "lighthouse / balcony",
    0.18,
    2.48,
    2.35,
    mats.cream,
    tx,
    6.34,
    tz,
    24,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    cylinder(
      "lighthouse / balcony baluster",
      0.48,
      0.043,
      0.043,
      mats.metal,
      tx + Math.cos(a) * 1.08,
      6.62,
      tz + Math.sin(a) * 1.08,
      6,
    );
  }
  torus("lighthouse / balcony handrail", 2.18, 0.065, mats.metal, tx, 6.88, tz);
  cylinder(
    "lighthouse / lantern base",
    0.13,
    1.62,
    1.62,
    mats.brass,
    tx,
    6.5,
    tz,
    12,
  );
  const lanternGlass = cylinder(
    "lighthouse / lantern room",
    0.94,
    1.31,
    1.31,
    mats.darkGlass,
    tx,
    7.02,
    tz,
    12,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(
      "lighthouse / lantern frame",
      1,
      0.048,
      0.048,
      mats.brass,
      tx + Math.cos(a) * 0.68,
      7.02,
      tz + Math.sin(a) * 0.68,
      6,
    );
  }
  cylinder(
    "lighthouse / roof eave",
    0.16,
    1.96,
    1.96,
    mats.coral,
    tx,
    7.58,
    tz,
    24,
  );
  cylinder(
    "lighthouse / conical cap",
    0.7,
    0.12,
    1.91,
    mats.coral,
    tx,
    7.99,
    tz,
    24,
  );
  cylinder(
    "lighthouse / finial",
    0.38,
    0.035,
    0.06,
    mats.brass,
    tx,
    8.47,
    tz,
    8,
  );
  sphere("lighthouse / finial ornament", 0.13, mats.brass, tx, 8.52, tz);
  const entryAngle = -0.5;
  const entry = box(
    "lighthouse / door",
    0.59,
    1.11,
    0.15,
    mats.tealDark,
    tx + Math.sin(entryAngle) * 0.93,
    1.94,
    tz - Math.cos(entryAngle) * 0.93,
  );
  entry.rotation.y = -entryAngle;
  for (const y of [3.15, 5.35]) {
    const opening = box(
      "lighthouse / slit window",
      0.27,
      0.58,
      0.075,
      mats.glass,
      tx + 0.25,
      y,
      tz - (0.94 - (y - 1.4) * 0.07),
    );
    opening.rotation.y = -0.15;
  }
  markStation("beacon", lighthouseStart);
  const beamMaterial = material("beacon / atmospheric beam", "#FFE3A4", 0.85);
  beamMaterial.alpha = 0.1;
  beamMaterial.disableLighting = true;
  beamMaterial.backFaceCulling = false;
  const beamPivot = new TransformNode("beacon / sweep", scene);
  beamPivot.position.set(tx, 7.05, tz);
  const beam = cylinder(
    "beacon / cone of light",
    20,
    0.06,
    6.7,
    beamMaterial,
    0,
    0,
    0,
    48,
  );
  beam.parent = beamPivot;
  beam.position.set(0, 0, -10);
  beam.rotation.x = Math.PI / 2;
  beam.isVisible = false;
  beam.receiveShadows = false;
  const beaconLight = new PointLight(
    "beacon / heart",
    new Vector3(tx, 7.05, tz),
    scene,
  );
  beaconLight.diffuse = new Color3(1, 0.75, 0.34);
  beaconLight.intensity = 0;
  beaconLight.range = 14;

  // The cable route physically connects the three learning stations.
  const cablePaths = [
    [
      new Vector3(-2.3, 1, -1.1),
      new Vector3(-1.3, 1, -1.5),
      new Vector3(-0.5, 1, -1.9),
      new Vector3(0.05, 1, -2.3),
    ],
    [
      new Vector3(0.5, 0.92, -2.3),
      new Vector3(1.7, 0.92, -1.75),
      new Vector3(2.8, 0.92, -0.9),
      new Vector3(3.4, 1, 1),
    ],
  ];
  const cables = cablePaths.map((points, i) => {
    const cable = mesh(
      MeshBuilder.CreateTube(
        `power-route-${i}`,
        {
          path: Curve3.CreateCatmullRomSpline(points, 10).getPoints(),
          radius: 0.045,
          tessellation: 8,
        },
        scene,
      ),
      mats.metal,
    );
    return cable;
  });
  const lampLights: PointLight[] = [];
  for (const [x, z] of [
    [-2.2, -0.35],
    [1.65, -0.6],
    [4.7, 2.6],
  ]) {
    cylinder("path / lamp post", 1.48, 0.07, 0.09, mats.metal, x, 1.58, z, 8);
    box("path / lantern", 0.27, 0.34, 0.27, mats.glass, x, 2.34, z);
    cylinder("path / lantern roof", 0.17, 0, 0.48, mats.metal, x, 2.59, z, 4);
    const light = new PointLight(
      "path / warm pool",
      new Vector3(x, 2.25, z),
      scene,
    );
    light.diffuse = new Color3(1, 0.62, 0.3);
    light.intensity = 0.55;
    light.range = 4;
    lampLights.push(light);
  }
  // Pines, shore grass and flower clusters soften the angular structures.
  for (const [x, z, scale] of [
    [-5, 2.1, 1.0],
    [-3.4, 2.8, 1.3],
    [-1.5, 3.5, 0.95],
    [0.2, 3.1, 1.2],
    [5.2, -0.6, 0.82],
    [5.7, 2.2, 0.9],
    [-6.0, 0.6, 0.65],
  ]) {
    cylinder("pine / trunk", 1.1 * scale, 0.13, 0.22, mats.wood, x, 1.25, z, 7);
    for (let j = 0; j < 3; j++)
      cylinder(
        "pine / foliage",
        1.18 * scale,
        0,
        (1.4 - j * 0.29) * scale,
        j === 1 ? mats.treeLight : mats.tree,
        x,
        1.63 * scale + j * 0.55 * scale,
        z,
        7,
      );
  }
  for (let i = 0; i < 45; i++) {
    const a = random() * Math.PI * 2,
      r = 3.4 + random() * 2.4;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.7;
    if (z < -1.3 && x > -5.5 && x < 2) continue;
    const bush = sphere(
      "ground / moss",
      0.3 + random() * 0.45,
      mats.grassDark,
      x,
      0.91,
      z,
    );
    bush.scaling.y = 0.6;
    if (i % 3 === 0)
      for (let j = 0; j < 3; j++) {
        const fx = x + (random() - 0.5) * 0.3,
          fz = z + (random() - 0.5) * 0.3;
        cylinder(
          "ground / flower stem",
          0.22,
          0.013,
          0.013,
          mats.tree,
          fx,
          1.03,
          fz,
          4,
        );
        sphere(
          "ground / flower",
          0.12,
          i % 2 ? mats.pink : mats.cream,
          fx,
          1.17,
          fz,
        );
      }
  }
  // Festival bunting runs from the workshop to a harbor post.
  const buntingPath = Curve3.CreateQuadraticBezier(
    new Vector3(-2.3, 3.0, -1.7),
    new Vector3(-0.8, 2.0, -1.5),
    new Vector3(1.0, 2.9, -1.1),
    24,
  ).getPoints();
  mesh(
    MeshBuilder.CreateTube(
      "festival / bunting cord",
      { path: buntingPath, radius: 0.014, tessellation: 4 },
      scene,
    ),
    mats.cream,
  );
  cylinder(
    "festival / flag pole",
    2.2,
    0.06,
    0.09,
    mats.wood,
    1,
    1.87,
    -1.1,
    8,
  );
  for (let i = 2; i < buntingPath.length - 1; i += 3) {
    const p = buntingPath[i];
    const flag = new Mesh("festival / pennant", scene);
    const data = new VertexData();
    data.positions = [-0.13, 0, 0, 0.13, 0, 0, 0, -0.28, 0];
    data.indices = [0, 1, 2, 2, 1, 0];
    data.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1];
    data.applyToMesh(flag);
    mesh(flag, [mats.coralLight, mats.cream, mats.teal][i % 3], p.x, p.y, p.z);
  }
  // Foam marks around the shore. Their tiny bobbing motion follows the tide.
  const foamMat = material("water / foam", "#8DBBB1", 0.1);
  for (let i = 0; i < 19; i++) {
    const a = (i / 19) * Math.PI * 2;
    const r = 7.5 + (i % 3) * 0.5;
    const foam = box(
      "tide / foam",
      0.38 + (i % 4) * 0.2,
      0.013,
      0.055,
      foamMat,
      Math.cos(a) * r,
      -0.56,
      Math.sin(a) * r * 0.77,
    );
    foam.rotation.y = -a;
  }
  // A small, original telescope is optionally replaced with a Blender asset.
  const telescopePlaceholder = new TransformNode(
    "observatory / procedural telescope",
    scene,
  );
  const telescopeStart = objects.length;
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3])
    line(
      "telescope / tripod",
      new Vector3(1.1, 1.74, 1.9),
      new Vector3(1.1 + Math.cos(a) * 0.4, 0.87, 1.9 + Math.sin(a) * 0.4),
      0.042,
      mats.woodLight,
    );
  const scope = cylinder(
    "telescope / barrel",
    1.05,
    0.24,
    0.3,
    mats.brass,
    1.1,
    1.89,
    1.9,
    16,
  );
  scope.rotation.z = 0.99;
  scope.rotation.x = 0.4;
  for (const m of objects.slice(telescopeStart))
    m.parent = telescopePlaceholder;

  let currentMode: HarborMode = "adventure";
  let active: StationId = "workshop";
  let completed: string[] = [];
  let cameraGoal: {
    target: Vector3;
    radius: number;
    alpha: number;
    beta: number;
  } | null = null;
  const adventureTarget = new Vector3(-0.2, 2.2, -0.35);
  const handlePick = scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERTAP) return;
    const id = info.pickInfo?.pickedMesh?.metadata?.station as
      StationId | undefined;
    if (id) onSelect(id);
  });
  const resizeObserver = new ResizeObserver(() => {
    const isNarrow = canvas.clientWidth < 700;
    if (currentMode === "adventure") {
      cameraGoal = {
        target: adventureTarget.clone(),
        radius: isNarrow ? 29 : 23,
        alpha: -Math.PI / 2.8,
        beta: 1.06,
      };
    }
  });
  resizeObserver.observe(canvas);
  const start = performance.now();
  scene.onBeforeRenderObservable.add(() => {
    const t = (performance.now() - start) / 1000;
    waterMaterial.setFloat("time", reduced ? 0 : t);
    if (!reduced) {
      boat.position.y = Math.sin(t * 0.7) * 0.055;
      boat.rotation.z = Math.sin(t * 0.5) * 0.008;
      bot.position.y = Math.sin(t * 1.4) * 0.015;
      beamPivot.rotation.y = t * 0.18;
      lampLights.forEach((l, i) => {
        l.intensity = 0.5 + Math.sin(t * 1.5 + i) * 0.035;
      });
    }
    if (cameraGoal) {
      const amount = reduced ? 1 : Math.min(1, engine.getDeltaTime() * 0.004);
      camera.target = Vector3.Lerp(camera.target, cameraGoal.target, amount);
      camera.radius += (cameraGoal.radius - camera.radius) * amount;
      camera.alpha += (cameraGoal.alpha - camera.alpha) * amount;
      camera.beta += (cameraGoal.beta - camera.beta) * amount;
      if (
        Vector3.Distance(camera.target, cameraGoal.target) < 0.015 &&
        Math.abs(camera.radius - cameraGoal.radius) < 0.015
      )
        cameraGoal = null;
    }
  });
  const setState = (
    mode: HarborMode,
    nextActive: StationId,
    nextCompleted: string[],
  ) => {
    const changed = mode !== currentMode || nextActive !== active;
    currentMode = mode;
    active = nextActive;
    completed = nextCompleted;
    if (mode === "explore") camera.attachControl(canvas, true);
    else camera.detachControl();
    if (changed || !cameraGoal) {
      cameraGoal =
        mode === "adventure"
          ? {
              target: adventureTarget.clone(),
              radius: canvas.clientWidth < 700 ? 29 : 23,
              alpha: -Math.PI / 2.8,
              beta: 1.06,
            }
          : {
              target: stationInfo[active].position.clone(),
              radius: active === "beacon" ? 18 : 12,
              alpha: active === "beacon" ? -1.12 : -1.45,
              beta: 1.07,
            };
    }
    const lit = completed.includes("beacon");
    lanternGlass.material = lit ? mats.glass : mats.darkGlass;
    beam.isVisible = lit;
    beaconLight.intensity = lit ? 2.5 : 0;
    cables[0].material = completed.includes("workshop")
      ? mats.signal
      : mats.metal;
    cables[1].material = completed.includes("relay") ? mats.signal : mats.metal;
  };
  setState("adventure", "workshop", []);
  // This optional local asset is authored by scripts/blender/build_harbor_props.py.
  // Dynamic import keeps asset failure isolated from the playable scene.
  void import("@babylonjs/loaders/glTF/2.0/glTFLoader")
    .then(async () => {
      const { SceneLoader } =
        await import("@babylonjs/core/Loading/sceneLoader");
      if (scene.isDisposed) return;
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "/models/",
        "harbor-telescope.glb",
        scene,
      );
      if (scene.isDisposed) return;
      const assetPlacement = new TransformNode(
        "observatory / Blender telescope placement",
        scene,
      );
      assetPlacement.position.set(1.1, 0.85, 1.9);
      assetPlacement.scaling.setAll(0.72);
      assetPlacement.rotation.y = -0.4;
      // Preserve the glTF loader's root handedness conversion.
      result.meshes[0].parent = assetPlacement;
      result.meshes.forEach((m) => {
        m.isPickable = false;
        m.receiveShadows = true;
        shadows.addShadowCaster(m);
      });
      telescopePlaceholder.setEnabled(false);
    })
    .catch(() => {
      /* Procedural telescope remains available. */
    });
  void import("@babylonjs/loaders/glTF/2.0/glTFLoader")
    .then(async () => {
      const { SceneLoader } =
        await import("@babylonjs/core/Loading/sceneLoader");
      if (scene.isDisposed) return;
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "/models/",
        "harbor-lighthouse.glb",
        scene,
      );
      if (scene.isDisposed) return;
      result.meshes[0].position.set(tx, 0, tz);
      result.meshes.forEach((m) => {
        m.isPickable = true;
        m.metadata = { station: "beacon" };
        m.receiveShadows = true;
        shadows.addShadowCaster(m);
      });
      // The emissive lantern remains controlled by the deterministic game state.
      stationMeshes.beacon.forEach((m) => {
        if (m !== lanternGlass) m.setEnabled(false);
      });
    })
    .catch(() => {
      /* Procedural lighthouse remains available. */
    });

  return {
    scene,
    camera,
    setState,
    dispose: () => {
      resizeObserver.disconnect();
      scene.onPointerObservable.remove(handlePick);
      scene.dispose();
    },
  };
}
