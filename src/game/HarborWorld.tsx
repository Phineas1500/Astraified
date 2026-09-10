import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
  createHarborScene,
  stationInfo,
  type HarborMode,
  type HarborScene,
  type StationId,
} from "./harborScene";

export interface HarborWorldProps {
  mode: HarborMode;
  activeStation: StationId;
  completedStations: string[];
  onSelectStation: (id: StationId) => void;
  muted?: boolean;
}

const ids: StationId[] = ["workshop", "relay", "beacon"];

export function HarborWorld({
  mode,
  activeStation,
  completedStations,
  onSelectStation,
  muted = true,
}: HarborWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<HarborScene | null>(null);
  const buttonRefs = useRef<
    Partial<Record<StationId, HTMLButtonElement | null>>
  >({});
  const callbackRef = useRef(onSelectStation);
  callbackRef.current = onSelectStation;
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine | undefined;
    let world: HarborScene | undefined;
    let observer: ResizeObserver | undefined;
    try {
      engine = new Engine(
        canvas,
        true,
        { preserveDrawingBuffer: true, stencil: true, antialias: true },
        true,
      );
      engine.setHardwareScalingLevel(
        Math.max(1, window.devicePixelRatio / 1.5),
      );
      world = createHarborScene(engine, canvas, (id) =>
        callbackRef.current(id),
      );
      worldRef.current = world;
      const currentEngine = engine;
      const currentWorld = world;
      engine.runRenderLoop(() => {
        currentWorld.scene.render();
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const viewport = currentWorld.camera.viewport.toGlobal(width, height);
        for (const id of ids) {
          const button = buttonRefs.current[id];
          if (!button) continue;
          const point = Vector3.Project(
            stationInfo[id].anchor,
            Matrix.Identity(),
            currentWorld.scene.getTransformMatrix(),
            viewport,
          );
          button.style.left = `${point.x}px`;
          button.style.top = `${point.y}px`;
          button.style.visibility =
            point.z > 0 &&
            point.z < 1 &&
            point.x > 35 &&
            point.x < width - 35 &&
            point.y > 20 &&
            point.y < height - 35
              ? "visible"
              : "hidden";
        }
      });
      observer = new ResizeObserver(() => currentEngine.resize());
      observer.observe(canvas);
      setReady(true);
    } catch (cause) {
      console.error(
        "Astraified could not initialize the harbor renderer.",
        cause,
      );
      setError(true);
    }
    return () => {
      observer?.disconnect();
      worldRef.current = null;
      engine?.stopRenderLoop();
      world?.dispose();
      engine?.dispose();
    };
  }, []);

  useEffect(() => {
    worldRef.current?.setState(mode, activeStation, completedStations);
  }, [mode, activeStation, completedStations, ready]);

  useEffect(() => {
    if (muted || typeof AudioContext === "undefined") return;
    // Soft filtered noise, slowly swelling like water against the harbor wall.
    // Audio begins only after the user enables it; no downloaded recording is used.
    const context = new AudioContext();
    const buffer = context.createBuffer(
      1,
      context.sampleRate * 6,
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.035) / 1.035;
      samples[i] = previous * 3.2;
    }
    const water = context.createBufferSource();
    water.buffer = buffer;
    water.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 720;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 100;
    const volume = context.createGain();
    volume.gain.value = 0.16;
    const swell = context.createOscillator();
    swell.frequency.value = 0.11;
    const swellDepth = context.createGain();
    swellDepth.gain.value = 0.09;
    swell.connect(swellDepth).connect(volume.gain);
    water
      .connect(lowpass)
      .connect(highpass)
      .connect(volume)
      .connect(context.destination);
    water.start();
    swell.start();
    void context.resume().catch(() => {
      /* Browser autoplay policy may require another gesture. */
    });
    return () => {
      water.stop();
      swell.stop();
      void context.close();
    };
  }, [muted]);

  return (
    <div
      className="harbor-world"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 360,
        overflow: "hidden",
        background: "#112c35",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="A miniature harbor with a workshop, electrical relay, and lighthouse. Use the station buttons to explore."
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          outline: "none",
          touchAction: mode === "explore" ? "none" : "pan-y",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg,rgba(10,27,35,.16),transparent 25%,transparent 72%,rgba(7,26,32,.5))",
        }}
      />
      {ready &&
        !error &&
        ids.map((id, index) => {
          const complete = completedStations.includes(id);
          const selected = activeStation === id;
          return (
            <button
              key={id}
              ref={(element) => {
                buttonRefs.current[id] = element;
              }}
              type="button"
              className={`world-hotspot${selected ? " is-active" : ""}${complete ? " is-complete" : ""}`}
              data-station={id}
              onClick={() => onSelectStation(id)}
              aria-label={`${stationInfo[id].name}${complete ? ", restored" : ""}`}
              aria-pressed={selected}
              style={{
                position: "absolute",
                transform: "translate(-50%, -100%)",
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: `1px solid ${selected ? "rgba(247,208,132,.8)" : "rgba(208,226,218,.25)"}`,
                background: selected
                  ? "rgba(245,226,185,.96)"
                  : "rgba(16,42,48,.92)",
                color: selected ? "#233c3b" : "#f4eee0",
                borderRadius: 24,
                padding: "8px 12px 8px 8px",
                fontSize: 11,
                fontWeight: 650,
                letterSpacing: ".01em",
                boxShadow: "0 5px 20px #041e2840",
                cursor: "pointer",
                whiteSpace: "nowrap",
                backdropFilter: "blur(8px)",
                transition: "background 180ms,border-color 180ms",
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 21,
                  height: 21,
                  borderRadius: "50%",
                  background: complete
                    ? "#5e9070"
                    : selected
                      ? "#c08547"
                      : "#416068",
                  color: "#fff8e7",
                  fontSize: 10,
                }}
              >
                {complete ? "✓" : `0${index + 1}`}
              </span>
              {stationInfo[id].name}
            </button>
          );
        })}
      {!ready && !error && (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#e5e1cf",
            fontSize: 13,
          }}
        >
          Opening the harbor…
        </div>
      )}
      {error && (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#f0e6d1",
            padding: 32,
            textAlign: "center",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 36 }}>⌁</span>
          <strong>The harbor needs WebGL to appear.</strong>
          <span style={{ maxWidth: 340, lineHeight: 1.6 }}>
            You can still repair the lighthouse using the station controls and
            circuit experiments.
          </span>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {ids.map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => onSelectStation(id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #647f77",
                  color: "#f0e6d1",
                  background: "#254947",
                  cursor: "pointer",
                }}
              >
                {stationInfo[id].name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default HarborWorld;
