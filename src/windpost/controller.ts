import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Collisions/collisionCoordinator";

/** A compact third-person controller. Position is always the courier's feet.
 * Rendering, character animation groups and interactions belong to the caller.
 */
export function createCourierController(
  scene: Scene,
  canvas: HTMLCanvasElement,
  visual: TransformNode,
  spawn: Vector3,
): {
  camera: UniversalCamera;
  body: Mesh;
  readonly position: Vector3;
  update(dt: number): void;
  setEnabled(enabled: boolean): void;
  setCarrying(carrying: boolean): void;
  setReducedMotion(value: boolean): void;
  /** Camera-relative: positive x is right; positive y is forward. */
  setTouchMove(x: number, y: number): void;
  jump(): void;
  recenter(): void;
  respawn(): void;
  dispose(): void;
  readonly moving: boolean;
  readonly grounded: boolean;
  readonly autoWalking: boolean;
} {
  const home = spawn.clone();
  const originalParent = visual.parent;
  const body = CreateBox(
    "courier / movement collider",
    { width: 0.6, height: 1.5, depth: 0.6 },
    scene,
  );
  body.isVisible = false;
  body.isPickable = false;
  body.checkCollisions = true;
  body.ellipsoid.set(0.3, 0.74, 0.3);
  body.ellipsoidOffset.set(0, 0.75, 0);
  body.position.copyFrom(home);
  body.metadata = { courierBody: true };
  visual.parent = body;
  visual.position.setAll(0);
  scene.collisionsEnabled = true;

  const camera = new UniversalCamera(
    "courier / shoulder camera",
    home.add(new Vector3(0, 2.7, -6)),
    scene,
  );
  camera.inputs.clear();
  camera.minZ = 0.07;
  camera.maxZ = 240;
  camera.fov = 0.8;
  camera.inertia = 0;
  scene.activeCamera = camera;

  const UP = new Vector3(0, 1, 0);
  const DOWN = new Vector3(0, -1, 0);
  const horizontalVelocity = Vector3.Zero();
  const smoothTarget = home.add(new Vector3(0, 1.05, 0));
  const held = new Set<string>();
  const manualMovementKeys = new Set([
    "w",
    "a",
    "s",
    "d",
    "arrowup",
    "arrowleft",
    "arrowdown",
    "arrowright",
  ]);
  const movementKeys = new Set([
    ...manualMovementKeys,
    "shift",
    " ",
    "q",
    "r",
    "f",
    "v",
  ]);
  let enabled = true;
  let carrying = false;
  let reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let touchX = 0;
  let touchY = 0;
  let verticalVelocity = 0;
  let coyote = 0;
  let jumpBuffer = 0;
  let grounded = false;
  let moving = false;
  let autoWalking = false;
  let cameraYaw = 0;
  let cameraPitch = 0.27;
  let cameraDistance = 6.2;
  let cameraSnap = true;
  let pointer: { id: number; x: number; y: number } | null = null;
  let disposed = false;

  const isWorldCollider = (mesh: AbstractMesh) =>
    mesh !== body &&
    !mesh.isDescendantOf(body) &&
    mesh.isEnabled() &&
    mesh.checkCollisions;
  const isCameraBlocker = (mesh: AbstractMesh) =>
    mesh !== body &&
    !mesh.isDescendantOf(body) &&
    mesh.isEnabled() &&
    (mesh.checkCollisions || mesh.metadata?.cameraBlocker === true);
  const groundProbe = () => {
    const ray = new Ray(body.position.add(new Vector3(0, 0.22, 0)), DOWN, 0.43);
    const hit = scene.pickWithRay(ray, isWorldCollider, false);
    const normal = hit?.getNormal(true, false);
    if (!hit?.hit || !hit.pickedPoint || !normal || normal.y < 0.55)
      return null;
    return { y: hit.pickedPoint.y, gap: body.position.y - hit.pickedPoint.y };
  };

  const clearInput = () => {
    held.clear();
    touchX = 0;
    touchY = 0;
    horizontalVelocity.setAll(0);
    jumpBuffer = 0;
    moving = false;
    autoWalking = false;
    pointer = null;
  };
  const jump = () => {
    if (enabled && !disposed) jumpBuffer = 0.15;
  };
  const recenter = () => {
    cameraYaw = visual.rotation.y;
    cameraPitch = 0.27;
    if (reducedMotion) cameraSnap = true;
  };
  const respawn = () => {
    clearInput();
    body.position.copyFrom(home);
    verticalVelocity = 0;
    grounded = false;
    coyote = 0;
    cameraYaw = 0;
    cameraPitch = 0.27;
    visual.rotation.y = 0;
    smoothTarget.copyFrom(home).addInPlace(new Vector3(0, 1.05, 0));
    cameraSnap = true;
  };

  const keyDown = (event: KeyboardEvent) => {
    if (
      !enabled ||
      document.activeElement !== canvas ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    const key = event.key.toLowerCase();
    if (!movementKeys.has(key)) return;
    event.preventDefault();
    held.add(key);
    if (manualMovementKeys.has(key)) autoWalking = false;
    if (!event.repeat && key === "v") autoWalking = !autoWalking;
    if (!event.repeat && key === " ") jump();
    if (!event.repeat && key === "f") recenter();
  };
  const keyUp = (event: KeyboardEvent) => {
    held.delete(event.key.toLowerCase());
  };
  const pointerDown = (event: PointerEvent) => {
    if (
      !enabled ||
      (event.pointerType === "mouse" &&
        event.button !== 0 &&
        event.button !== 2)
    )
      return;
    canvas.focus({ preventScroll: true });
    event.preventDefault();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!enabled || pointer?.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    cameraYaw += dx * 0.0055;
    cameraPitch = Math.max(0.08, Math.min(0.75, cameraPitch + dy * 0.004));
  };
  const pointerUp = (event: PointerEvent) => {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
  };
  const wheel = (event: WheelEvent) => {
    if (!enabled) return;
    event.preventDefault();
    cameraDistance = Math.max(
      4.8,
      Math.min(7.4, cameraDistance + event.deltaY * 0.003),
    );
  };
  const contextMenu = (event: Event) => {
    if (enabled) event.preventDefault();
  };
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", clearInput);
  canvas.addEventListener("blur", clearInput);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("lostpointercapture", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("contextmenu", contextMenu);

  const movementInput = () => {
    let x = touchX;
    let y = touchY + (autoWalking ? 1 : 0);
    if (held.has("w") || held.has("arrowup")) y += 1;
    if (held.has("s") || held.has("arrowdown")) y -= 1;
    if (held.has("d") || held.has("arrowright")) x += 1;
    if (held.has("a") || held.has("arrowleft")) x -= 1;
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude < 0.08) return Vector3.Zero();
    const forward = camera.getTarget().subtract(camera.position);
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001)
      forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    forward.normalize();
    const right = Vector3.Cross(UP, forward).normalize();
    return forward
      .scale(y)
      .addInPlace(right.scale(x))
      .normalize()
      .scaleInPlace(magnitude);
  };

  // Three rays approximate the camera's near-plane width. Obstruction shortening
  // is immediate, while coming back out from a wall is smoothed with the chase.
  const obstructedEye = (target: Vector3, eye: Vector3) => {
    const direction = eye.subtract(target);
    const distance = direction.length();
    if (distance < 0.001) return eye;
    direction.scaleInPlace(1 / distance);
    const right = Vector3.Cross(UP, direction).normalize().scale(0.18);
    let clearDistance = distance;
    for (const side of [-1, 0, 1]) {
      const origin = target.add(right.scale(side));
      const hit = scene.pickWithRay(
        new Ray(origin, direction, distance + 0.18),
        isCameraBlocker,
        false,
      );
      if (hit?.hit)
        clearDistance = Math.min(
          clearDistance,
          Math.max(0.16, hit.distance - 0.22),
        );
    }
    return target.add(direction.scale(clearDistance));
  };
  const updateCamera = (dt: number) => {
    const target = body.position.add(new Vector3(0, 1.05, 0));
    const blend = cameraSnap || reducedMotion ? 1 : 1 - Math.exp(-dt * 11);
    Vector3.LerpToRef(smoothTarget, target, blend, smoothTarget);
    const horizontalDistance = Math.cos(cameraPitch) * cameraDistance;
    const ideal = smoothTarget.add(
      new Vector3(
        -Math.sin(cameraYaw) * horizontalDistance,
        Math.sin(cameraPitch) * cameraDistance,
        -Math.cos(cameraYaw) * horizontalDistance,
      ),
    );
    const desired = obstructedEye(smoothTarget, ideal);
    const chaseBlend = cameraSnap || reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
    const candidate = Vector3.Lerp(camera.position, desired, chaseBlend);
    camera.position.copyFrom(obstructedEye(smoothTarget, candidate));
    camera.setTarget(smoothTarget);
    cameraSnap = false;
  };
  updateCamera(0);

  const update = (elapsed: number) => {
    if (disposed || !Number.isFinite(elapsed) || elapsed < 0) return;
    const dt = Math.min(elapsed, 0.1);
    if (!enabled) {
      moving = false;
      return;
    }
    if (held.has("q")) cameraYaw -= dt * 1.65;
    if (held.has("r")) cameraYaw += dt * 1.65;
    const input = movementInput();
    const inputMagnitude = input.length();
    const speed = carrying
      ? held.has("shift")
        ? 4.25
        : 3.15
      : held.has("shift")
        ? 5.35
        : 3.8;
    const desiredVelocity = input.scale(speed);
    const acceleration =
      inputMagnitude > 0.05 ? (grounded ? 16 : 7) : grounded ? 21 : 4;
    Vector3.LerpToRef(
      horizontalVelocity,
      desiredVelocity,
      1 - Math.exp(-dt * acceleration),
      horizontalVelocity,
    );
    if (horizontalVelocity.lengthSquared() < 0.0025)
      horizontalVelocity.setAll(0);
    const beforeFrame = body.position.clone();
    // Short substeps keep collision and jump timing comfortable after a slow frame.
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      const ground = groundProbe();
      grounded =
        verticalVelocity <= 0.1 &&
        Boolean(ground && ground.gap >= -0.055 && ground.gap <= 0.065);
      if (grounded) {
        coyote = 0.12;
        if (ground && ground.gap < 0.01) body.position.y = ground.y + 0.01;
        verticalVelocity = -0.4;
      } else coyote = Math.max(0, coyote - step);
      if (jumpBuffer > 0 && coyote > 0) {
        verticalVelocity = carrying ? 5.7 : 6.4;
        jumpBuffer = 0;
        coyote = 0;
        grounded = false;
      }
      jumpBuffer = Math.max(0, jumpBuffer - step);
      verticalVelocity = Math.max(-22, verticalVelocity - 19.5 * step);
      const beforeY = body.position.y;
      body.moveWithCollisions(
        new Vector3(
          horizontalVelocity.x * step,
          verticalVelocity * step,
          horizontalVelocity.z * step,
        ),
      );
      const actualY = body.position.y - beforeY;
      if (verticalVelocity > 0 && actualY < verticalVelocity * step * 0.25)
        verticalVelocity = 0;
      const landed = groundProbe();
      if (
        verticalVelocity <= 0 &&
        landed &&
        landed.gap >= -0.055 &&
        landed.gap <= 0.075
      ) {
        grounded = true;
        coyote = 0.12;
        verticalVelocity = -0.4;
      }
      if (body.position.y < -3) {
        respawn();
        break;
      }
    }
    const dx = body.position.x - beforeFrame.x;
    const dz = body.position.z - beforeFrame.z;
    moving = inputMagnitude > 0.05 && Math.hypot(dx, dz) > dt * 0.12;
    if (inputMagnitude > 0.05) {
      const heading = Math.atan2(input.x, input.z);
      const difference = Math.atan2(
        Math.sin(heading - visual.rotation.y),
        Math.cos(heading - visual.rotation.y),
      );
      visual.rotation.y += difference * (1 - Math.exp(-dt * 16));
    }
    updateCamera(dt);
  };

  return {
    camera,
    body,
    get position() {
      return body.position;
    },
    get moving() {
      return moving;
    },
    get grounded() {
      return grounded;
    },
    get autoWalking() {
      return autoWalking;
    },
    update,
    setEnabled(value) {
      enabled = value;
      if (!value) clearInput();
    },
    setCarrying(value) {
      carrying = value;
    },
    setReducedMotion(value) {
      reducedMotion = value;
      if (value) cameraSnap = true;
    },
    setTouchMove(x, y) {
      autoWalking = false;
      if (!enabled) return;
      touchX = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
      touchY = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
    },
    jump,
    recenter,
    respawn,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInput();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearInput);
      canvas.removeEventListener("blur", clearInput);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("lostpointercapture", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("contextmenu", contextMenu);
      // The caller owns the imported character and its animation groups.
      visual.parent = originalParent;
      camera.dispose();
      body.dispose();
    },
  };
}
