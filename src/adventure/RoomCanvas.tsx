import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { RoomId } from "./model";

const roomIds: RoomId[] = [
  "jetty",
  "tearoom",
  "workshop",
  "storeroom",
  "signalhouse",
  "lantern",
];

/** Phaser owns the world layer. Semantic React controls align to its fixed viewport. */
export default function RoomCanvas({
  room,
  complete,
}: {
  room: RoomId;
  complete: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<Phaser.Game | null>(null);
  const snapshot = useRef({ room, complete });
  snapshot.current = { room, complete };
  useEffect(() => {
    if (!host.current) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    class HarborScene extends Phaser.Scene {
      background?: Phaser.GameObjects.Image;
      beam?: Phaser.GameObjects.Graphics;
      currentRoom?: RoomId;
      ambient?: Phaser.GameObjects.Container;
      constructor() {
        super("harbor");
      }
      preload() {
        for (const id of roomIds) this.load.image(id, `/adventure/${id}.png`);
      }
      create() {
        this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
        this.paint(snapshot.current.room, snapshot.current.complete);
        this.game.events.on("room-change", this.paint, this);
        this.events.once("shutdown", () =>
          this.game.events.off("room-change", this.paint, this),
        );
      }
      paint(next: RoomId, finished: boolean) {
        if (this.currentRoom !== next) {
          this.currentRoom = next;
          this.background?.destroy();
          if (this.textures.exists(next)) {
            this.background = this.add
              .image(0, 0, next)
              .setOrigin(0)
              .setDisplaySize(1600, 900)
              .setDepth(0);
            if (!reduced) {
              this.background.setAlpha(0.3);
              this.tweens.add({
                targets: this.background,
                alpha: 1,
                duration: 400,
              });
            }
          }
          this.ambient?.destroy(true);
          this.ambient = this.add.container(0, 0).setDepth(2);
          if (!reduced) {
            const outdoors = next === "jetty";
            for (let i = 0; i < (outdoors ? 16 : 9); i++) {
              const dot = this.add.circle(
                100 + Math.random() * 1400,
                150 + Math.random() * 590,
                1 + Math.random() * 2,
                outdoors ? 0xf6d28c : 0xffe5aa,
                0.25,
              );
              this.ambient.add(dot);
              this.tweens.add({
                targets: dot,
                y: dot.y - 40 - Math.random() * 50,
                alpha: { from: 0, to: 0.45 },
                duration: 4000 + Math.random() * 5000,
                delay: Math.random() * 3000,
                repeat: -1,
                yoyo: true,
              });
            }
          }
        }
        this.beam?.destroy();
        if (finished && next === "jetty") {
          this.beam = this.add.graphics().setDepth(1);
          this.beam.fillStyle(0xffe9b0, 0.17);
          this.beam.fillTriangle(1480, 151, 580, 420, 510, 210);
          this.beam.fillStyle(0xfff7c7, 0.9);
          this.beam.fillCircle(1480, 151, 9);
          if (!reduced)
            this.tweens.add({
              targets: this.beam,
              alpha: { from: 0.3, to: 1 },
              duration: 2600,
              yoyo: true,
              repeat: -1,
            });
        }
      }
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 1600,
      height: 900,
      transparent: true,
      backgroundColor: "rgba(0,0,0,0)",
      scene: HarborScene,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true },
      fps: { target: 30 },
    });
    world.current = game;
    return () => {
      world.current = null;
      game.destroy(true);
    };
  }, []);
  useEffect(() => {
    world.current?.events.emit("room-change", room, complete);
  }, [room, complete]);
  return (
    <div
      className="adv-canvas"
      ref={host}
      aria-hidden="true"
      style={{ backgroundImage: `url(/adventure/${room}.png)` }}
    />
  );
}
