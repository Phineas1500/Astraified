import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { createCourierController } from "../src/windpost/controller";

/** Real Babylon collision/picking, with DOM events but no WebGL or asset loading.
 * Updating matrices reproduces the part of a rendered frame that movement and
 * camera-relative input depend on; shader compilation is deliberately unnecessary.
 */
describe("Windpost third-person movement", () => {
  let dom: JSDOM;
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let scene: Scene;
  let material: StandardMaterial;
  let controller: ReturnType<typeof createCourierController>;

  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      controller.update(1 / 60);
      scene.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
      controller.camera.getViewMatrix(true);
    }
  };
  const key = (value: string, repeat = false) => {
    dom.window.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: value, repeat }),
    );
  };
  const release = (value: string) => {
    dom.window.dispatchEvent(
      new dom.window.KeyboardEvent("keyup", { key: value }),
    );
  };
  const planarDistance = (a: Vector3, b: Vector3) =>
    Math.hypot(a.x - b.x, a.z - b.z);
  const wall = (z: number) => {
    const mesh = CreateBox(
      "invisible world collider",
      { width: 9, height: 4, depth: 0.4 },
      scene,
    );
    mesh.position.set(0, 2, z);
    mesh.material = material;
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.checkCollisions = true;
    return mesh;
  };

  beforeEach(() => {
    dom = new JSDOM('<canvas tabindex="0"></canvas><button>Journal</button>');
    Object.defineProperty(dom.window, "matchMedia", {
      value: () => ({ matches: false }),
    });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    canvas = dom.window.document.querySelector("canvas")!;
    engine = new NullEngine();
    scene = new Scene(engine);
    // A material enables Babylon's triangle-level ray intersection, including
    // picked positions and surface normals, rather than a bounding-box fallback.
    material = new StandardMaterial("collision fixture material", scene);
    const floor = CreateBox(
      "floor",
      { width: 30, height: 2, depth: 30 },
      scene,
    );
    floor.position.y = -1;
    floor.material = material;
    floor.checkCollisions = true;
    controller = createCourierController(
      scene,
      canvas,
      new TransformNode("courier visual", scene),
      new Vector3(0, 0.15, 0),
    );
    tick(30);
  });

  afterEach(() => {
    controller?.dispose();
    scene?.dispose();
    engine?.dispose();
    dom?.window.close();
    vi.unstubAllGlobals();
  });

  it("settles its feet on the ground and walks relative to the camera", () => {
    expect(controller.grounded).toBe(true);
    expect(Math.abs(controller.position.y)).toBeLessThan(0.03);
    canvas.focus();
    key("r");
    tick(57); // Turn the camera about a quarter turn, then let the chase settle.
    release("r");
    tick(30);
    const start = controller.position.clone();
    controller.setTouchMove(0, 1);
    tick(60);
    expect(controller.position.x - start.x).toBeGreaterThan(2.8);
    expect(Math.abs(controller.position.z - start.z)).toBeLessThan(0.8);
    expect(controller.moving).toBe(true);
    expect(controller.grounded).toBe(true);
  });

  it("stops at invisible world colliders instead of walking through them", () => {
    wall(5);
    controller.setTouchMove(0, 1);
    tick(150);
    expect(controller.position.z).toBeGreaterThan(4.1);
    expect(controller.position.z).toBeLessThan(4.52);
    expect(controller.grounded).toBe(true);
    expect(controller.moving).toBe(false);
  });

  it("jumps above the floor and lands, including a buffered jump just before landing", () => {
    controller.jump();
    let apex = 0;
    let previousY = controller.position.y;
    let buffered = false;
    for (let i = 0; i < 90; i++) {
      tick();
      apex = Math.max(apex, controller.position.y);
      if (
        !controller.grounded &&
        controller.position.y < previousY &&
        controller.position.y < 0.2
      ) {
        controller.jump();
        buffered = true;
        break;
      }
      previousY = controller.position.y;
    }
    expect(apex).toBeGreaterThan(0.8);
    expect(buffered).toBe(true);
    let secondApex = 0;
    for (let i = 0; i < 30; i++) {
      tick();
      secondApex = Math.max(secondApex, controller.position.y);
    }
    expect(secondApex).toBeGreaterThan(0.75);
    tick(60);
    expect(controller.grounded).toBe(true);
    expect(Math.abs(controller.position.y)).toBeLessThan(0.03);
  });

  it("allows a forgiving jump immediately after leaving an edge", () => {
    controller.position.set(0, 0.01, 14.7);
    tick(2);
    controller.setTouchMove(0, 1);
    for (let i = 0; i < 30 && controller.grounded; i++) tick();
    expect(controller.grounded).toBe(false);
    const departureY = controller.position.y;
    controller.jump();
    tick(6);
    expect(controller.position.y - departureY).toBeGreaterThan(0.3);
  });

  it("releases held movement on blur and freezes movement when a modal disables play", () => {
    canvas.focus();
    key("w");
    tick(12);
    const moved = controller.position.clone();
    expect(moved.z).toBeGreaterThan(0.3);
    canvas.blur();
    tick(20);
    expect(planarDistance(controller.position, moved)).toBeLessThan(0.001);
    canvas.focus();
    key("w");
    tick(5);
    controller.setEnabled(false);
    const paused = controller.position.clone();
    key("v");
    controller.jump();
    tick(30);
    expect(controller.position.equals(paused)).toBe(true);
    expect(controller.autoWalking).toBe(false);
    controller.setEnabled(true);
    dom.window.document.querySelector("button")!.focus();
    key("w");
    tick(20);
    expect(planarDistance(controller.position, paused)).toBeLessThan(0.001);
  });

  it("toggles optional auto-walk without repeats, and preserves it when jumping", () => {
    canvas.focus();
    key("v");
    expect(controller.autoWalking).toBe(true);
    key("v", true);
    expect(controller.autoWalking).toBe(true);
    tick(20);
    expect(controller.position.z).toBeGreaterThan(0.7);
    key(" ");
    expect(controller.autoWalking).toBe(true);
    tick(8);
    expect(controller.position.y).toBeGreaterThan(0.4);
    key("v");
    expect(controller.autoWalking).toBe(false);
  });

  it("cancels auto-walk for manual direction, touch, blur, disabled play and respawn", () => {
    canvas.focus();
    key("v");
    key("ArrowLeft");
    expect(controller.autoWalking).toBe(false);
    release("ArrowLeft");
    key("v");
    controller.setTouchMove(0, 0);
    expect(controller.autoWalking).toBe(false);
    key("v");
    canvas.blur();
    expect(controller.autoWalking).toBe(false);
    canvas.focus();
    key("v");
    controller.setEnabled(false);
    expect(controller.autoWalking).toBe(false);
    controller.setEnabled(true);
    key("v");
    controller.respawn();
    expect(controller.autoWalking).toBe(false);
  });

  it("recovers from the water with inputs cleared and pulls the camera in before an obstruction", () => {
    canvas.focus();
    key("v");
    controller.position.set(3, -4, 8);
    tick();
    expect(controller.autoWalking).toBe(false);
    expect(Math.abs(controller.position.x)).toBeLessThan(0.001);
    expect(Math.abs(controller.position.z)).toBeLessThan(0.001);
    tick(30);
    expect(controller.grounded).toBe(true);
    wall(-2);
    controller.setReducedMotion(true);
    tick(2);
    // Near wall face is z=-1.8; the camera must stay on the courier's side.
    expect(controller.camera.position.z).toBeGreaterThan(-1.8);
    expect(controller.camera.position.z).toBeLessThan(-0.5);
  });
});
