import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";

export type ApparatusPalette = Record<
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

/** Shared craft materials and readable, fixed lettering for physical stations. */
export function apparatusKit(
  scene: Scene,
  prefix: string,
  palette: ApparatusPalette,
  shadows: ShadowGenerator,
) {
  const foreground: Mesh[] = [];
  const annotations: { mesh: Mesh; medium: boolean }[] = [];
  function place(
    mesh: Mesh,
    material: StandardMaterial,
    x: number,
    y: number,
    z: number,
    solid = false,
  ) {
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    mesh.checkCollisions = solid;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
    if (solid) mesh.metadata = { cameraBlocker: true };
    return mesh;
  }
  function box(
    name: string,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material = palette.woodLight,
    solid = false,
  ) {
    return place(
      CreateBox(`${prefix} ${name}`, { width, height, depth }, scene),
      material,
      x,
      y,
      z,
      solid,
    );
  }
  function cylinder(
    name: string,
    height: number,
    radius: number,
    x: number,
    y: number,
    z: number,
    material = palette.brass,
  ) {
    return place(
      CreateCylinder(
        `${prefix} ${name}`,
        { height, diameter: radius * 2, tessellation: 20 },
        scene,
      ),
      material,
      x,
      y,
      z,
    );
  }
  function ring(
    name: string,
    diameter: number,
    x: number,
    y: number,
    z: number,
    material = palette.brass,
  ) {
    return place(
      CreateTorus(
        `${prefix} ${name}`,
        { diameter, thickness: 0.04, tessellation: 24 },
        scene,
      ),
      material,
      x,
      y,
      z,
    );
  }
  function panel(
    name: string,
    lines: string[],
    x: number,
    y: number,
    z: number,
    width = 1.8,
    height = 0.5,
    medium = false,
    background = "#FFF1D0",
  ) {
    const texture = new DynamicTexture(
      `${prefix} ${name} lettering`,
      { width: 1024, height: Math.round((1024 * height) / width) },
      scene,
      false,
    );
    const material = new StandardMaterial(`${prefix} ${name} ink`, scene);
    material.diffuseTexture = texture;
    material.specularColor.setAll(0);
    material.emissiveColor.setAll(0.1);
    material.backFaceCulling = false;
    const mesh = place(
      CreatePlane(`${prefix} ${name}`, { width, height }, scene),
      material,
      x,
      y,
      z,
    );
    shadows.removeShadowCaster(mesh);
    annotations.push({ mesh, medium });
    let last = "";
    const write = (next: string[]) => {
      const key = next.join("\n");
      if (last === key) return;
      last = key;
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      const size = texture.getSize();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = "#244E50";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const step = (size.height - 16) / Math.max(1, next.length);
      next.forEach((line, i) => {
        let fontSize = Math.min(96, step * 0.66);
        ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
        while (fontSize > 18 && ctx.measureText(line).width > size.width - 42) {
          fontSize -= 2;
          ctx.font = `bold ${fontSize}px Trebuchet MS, sans-serif`;
        }
        let visibleLine = line;
        while (
          visibleLine.length > 3 &&
          ctx.measureText(visibleLine).width > size.width - 42
        )
          visibleLine = visibleLine.slice(0, -2).trimEnd() + "…";
        ctx.fillText(visibleLine, size.width / 2, 8 + step * (i + 0.5));
      });
      texture.update();
    };
    write(lines);
    return { mesh, write };
  }
  function update(player: Vector3) {
    for (const annotation of annotations) {
      const location = annotation.mesh.getAbsolutePosition();
      const distance = Math.hypot(player.x - location.x, player.z - location.z);
      const opacity = annotation.medium
        ? Math.max(0, Math.min(1, (19 - distance) / 4))
        : Math.max(0, Math.min(1, (9 - distance) / 2));
      annotation.mesh.visibility = opacity;
    }
  }
  return { box, cylinder, ring, panel, foreground, update };
}
