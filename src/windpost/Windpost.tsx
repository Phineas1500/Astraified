import { useEffect, useRef, useState, type ReactNode } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import {
  BookOpen,
  Volume2,
  VolumeX,
  Pause,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Package,
  Mail,
  RotateCcw,
  Compass,
  Check,
  Feather,
} from "lucide-react";
import {
  createWindpostWorld,
  type WindpostWorld,
  type WorldTarget,
} from "./world";
import {
  EPISODES,
  WINDPOST_EPISODE,
  type EpisodeFixture,
  stationRound,
  stationConfig,
} from "./episodes";
import {
  initialProgress,
  carriedEvidence,
  reduceEpisode,
  questGoal,
  dialogueFor,
  hintFor,
  stationReading,
  discoveryReply,
  type EpisodeAction,
} from "./runtime";
import { loadProgress, saveProgress, clearProgress } from "./saves";
import { createPostAudio } from "./audio";
import { FieldNotes, SourceLink } from "./FieldNotes";
import "./windpost.css";
import { formatStationReading } from "./readout-format";

type Modal =
  "journal" | "pause" | "finish" | "moss" | "bea" | "discovery" | "card" | null;
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="wp-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="wp-dialog-close">
        <button
          className="wp-close"
          aria-label="Close dialogue"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function selectedEpisode() {
  return (
    EPISODES.find((episode) => episode.id === window.location.hash.slice(1)) ??
    WINDPOST_EPISODE
  );
}

function EpisodeChoices({
  episode,
  onSelect,
}: {
  episode: EpisodeFixture;
  onSelect(episode: EpisodeFixture): void;
}) {
  return (
    <nav className="wp-episode-choices" aria-label="Choose an adventure">
      {EPISODES.map((entry, index) => (
        <button
          key={entry.id}
          aria-pressed={entry.id === episode.id}
          onClick={() => onSelect(entry)}
        >
          <span className="wp-episode-number">0{index + 1}</span>
          <span>{entry.title}</span>
          {entry.id === episode.id && <Check size={15} />}
        </button>
      ))}
    </nav>
  );
}

export function Windpost() {
  const [episode, setEpisode] = useState(selectedEpisode);
  useEffect(() => {
    const change = () => setEpisode(selectedEpisode());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${episode.title} · Astraified`;
  }, [episode]);
  function select(next: EpisodeFixture) {
    if (next.id === episode.id) return;
    window.history.replaceState(null, "", `#${next.id}`);
    setEpisode(next);
  }
  return (
    <div className="wp-standalone">
      <EpisodeGame
        key={`${episode.id}:${episode.revision}`}
        episode={episode}
        onSelect={select}
      />
    </div>
  );
}

export interface EpisodePlayerProps {
  /** A validated authored or source-generated fixture supplied by the host. */
  episode: EpisodeFixture;
  /** Return to the host library without changing its URL or saved selection. */
  onHome?: () => void;
}

/** Embeddable player: navigation and document metadata remain with the host. */
export function EpisodePlayer({ episode, onHome }: EpisodePlayerProps) {
  const [retry, setRetry] = useState(0);
  return (
    <EpisodeGame
      key={`${episode.id}:${episode.revision}:${retry}`}
      episode={episode}
      onHome={onHome}
      onRetry={() => setRetry((value) => value + 1)}
    />
  );
}

function EpisodeGame({
  episode,
  onSelect,
  onHome,
  onRetry,
}: EpisodePlayerProps & {
  onSelect?(episode: EpisodeFixture): void;
  onRetry?(): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    world = useRef<WindpostWorld | null>(null);
  const [game, setGame] = useState(() => {
      try {
        return loadProgress(episode, localStorage);
      } catch {
        return initialProgress(episode);
      }
    }),
    gameRef = useRef(game);
  const [target, setTarget] = useState<WorldTarget | null>(null),
    targetRef = useRef<WorldTarget | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [started, setStarted] = useState(false);
  const [modal, setModal] = useState<Modal>(null),
    [line, setLine] = useState("");
  const [discovery, setDiscovery] = useState<string | null>(null);
  const [inspectedCard, setInspectedCard] = useState<{
    site: "bridge" | "lift";
    cardId: string;
  } | null>(null);
  const [notice, setNotice] = useState(""),
    [saveWarning, setSaveWarning] = useState(false);
  const [sound, setSound] = useState(false),
    [reduced, setReduced] = useState(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const [showTouch, setShowTouch] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  );
  const audio = useRef<ReturnType<typeof createPostAudio> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactRef = useRef<() => void>(() => {}),
    modalRef = useRef(modal);
  modalRef.current = modal;

  function tell(text: string) {
    setNotice(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 6500);
  }
  function dispatch(action: EpisodeAction) {
    const next = reduceEpisode(episode, gameRef.current, action);
    gameRef.current = next;
    setGame(next);
    world.current?.setState(next);
    try {
      saveProgress(episode, next, localStorage);
      setSaveWarning(false);
    } catch {
      setSaveWarning(true);
    }
    return next;
  }
  function closeModal() {
    setModal(null);
    requestAnimationFrame(() => canvas.current?.focus());
  }
  function openNpc(npc: "moss" | "bea") {
    const words = dialogueFor(episode, npc, gameRef.current);
    setLine(words.line);
    dispatch({ type: npc === "moss" ? "talk-moss" : "talk-bea" });
    setModal(npc);
    audio.current?.play("talk");
  }
  function interact() {
    const t = targetRef.current;
    if (!t || modalRef.current) return;
    if (t.kind === "npc") {
      openNpc(t.npc!);
      return;
    }
    if (t.kind === "evidence-card") {
      const site = t.mechanism!,
        cardId = t.evidenceCard!;
      const round = stationRound(episode, site),
        index = round.cards.findIndex((card) => card.id === cardId);
      const before = gameRef.current;
      const next = dispatch({
        type: before.assignments[site][index] ? "retrieve-card" : "pickup-card",
        mechanism: site,
        cardId,
      });
      if (next === before) return;
      setInspectedCard({ site, cardId });
      setModal("card");
      audio.current?.play("pickup");
      return;
    } else if (t.kind === "evidence-bin") {
      const before = gameRef.current;
      const next = dispatch({
        type: "place-card",
        mechanism: t.mechanism!,
        slotId: t.bin!,
      });
      if (next === before) {
        tell(
          "That crate is full. Retrieve a card to make room, or choose another crate.",
        );
        return;
      }
      audio.current?.play("place");
      tell(episode.scene.stations[t.mechanism!].placementFeedback);
    } else if (t.kind === "weight" || t.kind === "parcel") {
      const before = gameRef.current,
        next = dispatch({ type: "pickup", item: t.item! });
      if (next === before) {
        tell(
          t.mechanism === "bridge"
            ? "Say hello to Moss first."
            : "Bea can tell you about this delivery.",
        );
        return;
      }
      audio.current?.play("pickup");
      const observed =
        t.mechanism &&
        !before.observations[t.mechanism] &&
        next.observations[t.mechanism];
      tell(
        t.item === "parcel"
          ? `Addressed to ${episode.story.npcNames.moss}. Let’s take it home.`
          : observed
            ? episode.scene.stations[t.mechanism!].baselineFeedback
            : `Carry the ${episode.scene.stations[t.mechanism!].itemLabel.toLowerCase()} to a marked post.`,
      );
    } else if (t.kind === "socket") {
      const site = t.mechanism!,
        binding = episode.scene.stations[site];
      if (binding.kind === "evidence-crates") return;
      if (gameRef.current.carrying) {
        const before = gameRef.current;
        const next = dispatch({
          type: "place",
          mechanism: site,
          slot: t.slot!,
        });
        if (next === before) return;
        audio.current?.play("place");
        const reading = stationReading(episode, next, site);
        const values = binding.readouts
          .slice(0, binding.kind === "experiment" ? 4 : 2)
          .map(
            (entry) =>
              `${entry.label}: ${formatStationReading((entry.kind === "input" ? reading.inputs : reading.outputs)[entry.id], binding.kind)} ${entry.unit}`,
          )
          .join(" · ");
        tell(
          `${values}. ${binding.kind === "experiment" ? "Test the experiment when you are ready." : binding.placementFeedback}`,
        );
      } else {
        const before = gameRef.current;
        const next = dispatch({ type: "retrieve", mechanism: site });
        if (next === before) return;
        audio.current?.play("pickup");
        tell(`${binding.itemLabel} in hand. Try another post.`);
      }
    } else if (t.kind === "dial") {
      const site = t.mechanism!,
        binding = episode.scene.stations[site];
      const before = gameRef.current;
      const next = dispatch({ type: "adjust", mechanism: site });
      if (next === before || !binding.prediction) return;
      audio.current?.play("place");
      const value = next.inputs[site][binding.prediction.inputId];
      const control = stationConfig(episode, site).controls.find(
        (entry) => entry.id === binding.prediction!.inputId,
      );
      const option =
        control?.kind === "choice"
          ? control.options.find((entry) => entry.value === value)?.label
          : undefined;
      tell(
        `${t.label.replace(/^Adjust /, "")}: ${option ?? `${value} ${binding.prediction.unit}`}. Turn again to cycle the choices, or test the arrangement.`,
      );
    } else if (t.kind === "crank") {
      const before = gameRef.current,
        next = dispatch({ type: "activate", mechanism: t.mechanism! });
      if (next === before) {
        tell(
          t.mechanism === "bridge"
            ? "Moss knows how this catch works."
            : "Talk to Bea at the posthouse first.",
        );
        return;
      }
      const success =
        t.mechanism === "bridge" ? next.bridgeOpen : next.liftRaised;
      audio.current?.play(success ? "success" : "miss");
      tell(
        success
          ? `${episode.scene.stations[t.mechanism!].successFeedback} ${t.mechanism === "bridge" ? episode.story.goals.crossing : episode.story.goals.collect}`
          : episode.scene.stations[t.mechanism!].failureFeedback,
      );
    } else if (t.kind === "discovery" && t.discovery) {
      dispatch({ type: "discover", id: t.discovery });
      setDiscovery(t.discovery);
      setModal("discovery");
      audio.current?.play("talk");
      return;
    } else if (t.kind === "postcard") {
      dispatch({ type: "postcard", id: t.card! });
      audio.current?.play("pickup");
      tell(
        episode.story.postcards.find((card) => card.id === t.card)?.text ??
          "A postcard for your collection.",
      );
    }
    canvas.current?.focus();
  }
  interactRef.current = interact;

  useEffect(() => {
    let cancelled = false,
      instance: WindpostWorld | null = null;
    const engine = new Engine(canvas.current!, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
    });
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    audio.current = createPostAudio();
    createWindpostWorld(engine, canvas.current!, episode, gameRef.current, {
      target(next) {
        if (!cancelled) {
          targetRef.current = next;
          setTarget(next);
        }
      },
      ready() {},
    })
      .then((value) => {
        if (cancelled) {
          value.dispose();
          engine.dispose();
          return;
        }
        instance = value;
        world.current = value;
        value.setEnabled(started && !modalRef.current);
        value.setReducedMotion(reduced);
        setReady(true);
        engine.runRenderLoop(() => {
          value.update(Math.min(engine.getDeltaTime() / 1000, 0.05));
          value.scene.render();
        });
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.current!);
    const key = (event: KeyboardEvent) => {
      if (document.activeElement !== canvas.current || modalRef.current) return;
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (!event.repeat) interactRef.current();
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        setModal("journal");
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setModal("pause");
      }
      if (event.key.toLowerCase() === "x" && gameRef.current.carrying) {
        event.preventDefault();
        dispatch({ type: "drop" });
        tell("Returned safely to its stand.");
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      observer.disconnect();
      window.removeEventListener("keydown", key);
      engine.stopRenderLoop();
      instance?.dispose();
      engine.dispose();
      world.current = null;
      audio.current?.dispose();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    world.current?.setEnabled(started && !modal);
  }, [started, modal, ready]);
  useEffect(() => {
    world.current?.setReducedMotion(reduced);
  }, [reduced, ready]);
  useEffect(() => {
    audio.current?.setEnabled(sound);
  }, [sound, ready]);

  const title = !game.metMoss
    ? "A first delivery"
    : !game.bridgeOpen
      ? episode.scene.stations.bridge.title
      : !game.metBea
        ? "Across the canal"
        : !game.liftRaised
          ? episode.scene.stations.lift.title
          : !game.delivered
            ? "Special delivery"
            : "A route brought back to life";
  const heldEvidence = carriedEvidence(game);
  const heldCard = heldEvidence
    ? stationRound(episode, heldEvidence.site).cards.find(
        (card) => card.id === heldEvidence.cardId,
      )
    : null;
  const viewedCard = inspectedCard
    ? stationRound(episode, inspectedCard.site).cards.find(
        (card) => card.id === inspectedCard.cardId,
      )
    : null;
  const foundDiscovery = episode.discoveries.find(
    (entry) => entry.id === discovery,
  );
  let prompt = target?.label ?? "";
  if (target?.kind === "socket" && !game.carrying)
    prompt = `Pick up ${episode.scene.stations[target.mechanism!].itemLabel.toLowerCase()}`;
  if (target?.npc === "moss" && game.carrying === "parcel")
    prompt = `Deliver the parcel to ${episode.story.npcNames.moss}`;
  const nearbySite =
    target?.mechanism &&
    ["socket", "crank", "dial", "evidence-card", "evidence-bin"].includes(
      target.kind,
    )
      ? target.mechanism
      : null;
  const nearbyBinding = nearbySite ? episode.scene.stations[nearbySite] : null;
  const nearbyReading = nearbySite
    ? stationReading(episode, game, nearbySite)
    : null;
  const moveTouch = (x: number, y: number) =>
    world.current?.controller.setTouchMove(x, y);
  function touchButton(label: string, icon: ReactNode, x: number, y: number) {
    return (
      <button
        aria-label={label}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTouch(x, y);
        }}
        onPointerUp={() => moveTouch(0, 0)}
        onPointerCancel={() => moveTouch(0, 0)}
        onLostPointerCapture={() => moveTouch(0, 0)}
      >
        {icon}
      </button>
    );
  }

  return (
    <section
      className={"wp-game" + (showTouch ? " wp-touch-enabled" : "")}
      aria-label={`${episode.title} 3D adventure`}
    >
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label={`${episode.title} 3D world. Use W A S D or arrow keys to move, Space to jump, E to interact. Drag to look around.`}
      />
      {!started && (
        <div className="wp-opening">
          <div className="wp-brand">
            <Feather size={17} /> Astraified
          </div>
          {onSelect && <EpisodeChoices episode={episode} onSelect={onSelect} />}
          {onHome && (
            <button className="wp-home" onClick={onHome}>
              <ArrowLeft size={16} /> Return to library
            </button>
          )}
          <h1>{episode.title}</h1>
          <p>{episode.subtitle}</p>
          {error ? (
            <div className="wp-load-error">
              <p>The island couldn’t load. {error}</p>
              <button onClick={onRetry ?? (() => window.location.reload())}>
                Try loading again
              </button>
            </div>
          ) : (
            <button
              className="wp-primary wp-start"
              disabled={!ready}
              onClick={() => {
                setStarted(true);
                canvas.current?.focus();
              }}
            >
              {ready
                ? game.metMoss
                  ? "Continue delivery"
                  : "Start delivery"
                : "Packing your satchel…"}{" "}
              <ArrowRight size={19} />
            </button>
          )}
          <span className="wp-opening-help">
            Walk, jump, meet the locals. Take the scenic route.
          </span>
        </div>
      )}
      {started && (
        <>
          <div
            className="wp-headsup"
            tabIndex={0}
            aria-label="Current objective and station readings"
          >
            <header className="wp-quest">
              <span className="wp-quest-icon">
                <Mail size={23} />
              </span>
              <div>
                <h1>{title}</h1>
                <p>{questGoal(episode, game)}</p>
              </div>
            </header>
            {!modal && nearbyBinding && nearbyReading && (
              <aside
                className="wp-instrument"
                aria-label={`${nearbyBinding.title} measurements`}
              >
                <strong>{nearbyBinding.title}</strong>
                <span>
                  {nearbyBinding.kind === "evidence-crates"
                    ? `${game.assignments[nearbySite!].filter(Boolean).length} of ${stationRound(episode, nearbySite!).cards.length} source cards sorted`
                    : (nearbyBinding.socketLabels[
                        nearbyBinding.socketValues.indexOf(
                          nearbyReading.inputs[nearbyBinding.socketInput],
                        )
                      ] ?? "Starting arrangement")}
                </span>
                <dl>
                  {nearbyBinding.readouts
                    .slice(0, nearbyBinding.kind === "experiment" ? 4 : 2)
                    .map((entry) => (
                      <div key={entry.id}>
                        <dt>{entry.label}</dt>
                        <dd>
                          {formatStationReading(
                            (entry.kind === "input"
                              ? nearbyReading.inputs
                              : nearbyReading.outputs)[entry.id],
                            nearbyBinding.kind,
                          )}{" "}
                          <small>{entry.unit}</small>
                        </dd>
                      </div>
                    ))}
                </dl>
              </aside>
            )}
          </div>
          <nav className="wp-tools" aria-label="Game tools">
            <button
              onClick={() => setModal("journal")}
              aria-label="Open field notes"
            >
              <BookOpen size={21} />
              <span>Field notes</span>
            </button>
            <button
              onClick={() => {
                setSound((v) => !v);
                canvas.current?.focus();
              }}
              aria-label={sound ? "Mute sound" : "Enable sound"}
            >
              {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              onClick={() => setModal("pause")}
              aria-label="Pause and controls"
            >
              <Pause size={20} />
            </button>
          </nav>
          {!modal && target && (
            <button className="wp-interact" onClick={interact}>
              <kbd>E</kbd>
              {prompt}
            </button>
          )}
          {notice && !modal && (
            <div className="wp-notice" role="status">
              {notice}
            </div>
          )}
          <div className="wp-pocket">
            <span>
              <Mail size={17} />
              {game.postcards.length}/3 postcards
            </span>
            {game.carrying && (
              <span className="wp-carried">
                <Package size={20} />
                {heldCard ? (
                  <button
                    className="wp-carried-card"
                    onClick={() => {
                      setInspectedCard(heldEvidence);
                      setModal("card");
                    }}
                  >
                    {heldCard.label} · Read
                  </button>
                ) : game.carrying === "parcel" ? (
                  `${episode.story.npcNames.moss}’s parcel`
                ) : (
                  episode.scene.stations[
                    game.carrying === "bridge-weight" ? "bridge" : "lift"
                  ].itemLabel
                )}
                <button
                  title="Return item to its stand"
                  onClick={() => {
                    dispatch({ type: "drop" });
                    tell("Returned safely to its stand.");
                    canvas.current?.focus();
                  }}
                >
                  Put back <kbd>X</kbd>
                </button>
              </span>
            )}
          </div>
          <footer className="wp-controls">
            <span>
              <kbd>W A S D</kbd> move
            </span>
            <span>
              <kbd>Space</kbd> jump
            </span>
            <span>Drag to look</span>
            <span>
              <kbd>F</kbd> center camera
            </span>
          </footer>
          {saveWarning && (
            <div className="wp-save-warning" role="status">
              Progress works for this visit, but this browser could not save it.
            </div>
          )}
          {showTouch && !modal && (
            <div className="wp-touch">
              <div className="wp-dpad">
                {touchButton("Move forward", <ArrowUp />, 0, 1)}
                {touchButton("Move left", <ArrowLeft />, -1, 0)}
                {touchButton("Move backward", <ArrowDown />, 0, -1)}
                {touchButton("Move right", <ArrowRight />, 1, 0)}
              </div>
              <button onClick={() => world.current?.controller.jump()}>
                Jump
              </button>
            </div>
          )}
        </>
      )}
      {(modal === "moss" || modal === "bea") && (
        <Dialog
          title={"Talk to " + (modal === "moss" ? "Moss" : "Bea")}
          onClose={closeModal}
        >
          <div className={"wp-speaker " + modal}>
            <span>{modal === "moss" ? "M" : "B"}</span>
            <div>
              <small>
                {modal === "moss" ? "Landing keeper" : "Postmaster"}
              </small>
              <h2>{modal === "moss" ? "Moss" : "Bea"}</h2>
            </div>
          </div>
          <p className="wp-dialogue-line">{line}</p>
          <div className="wp-choices">
            {modal === "moss" && game.carrying === "parcel" ? (
              <button
                className="wp-primary"
                onClick={() => {
                  dispatch({ type: "deliver" });
                  audio.current?.play("finish");
                  setModal("finish");
                }}
              >
                Here’s your parcel. <Package size={18} />
              </button>
            ) : (
              <button className="wp-primary" onClick={closeModal}>
                {game.delivered
                  ? "See you around."
                  : game.bridgeOpen
                    ? modal === "bea"
                      ? "I’ll take care of it."
                      : "I’m on my way."
                    : "Let me try."}
              </button>
            )}
            {!game.delivered && (
              <button
                onClick={() => {
                  const next = dispatch({ type: "hint" });
                  setLine(hintFor(episode, next));
                }}
              >
                A little nudge?
              </button>
            )}
            {discoveryReply(episode, modal, game) && (
              <button
                onClick={() => setLine(discoveryReply(episode, modal, game)!)}
              >
                About{" "}
                {episode.discoveries
                  .find(
                    (entry) =>
                      entry.id ===
                      (modal === "moss" ? "workshop-sketch" : "cargo-manifest"),
                  )
                  ?.title.toLowerCase()}
                …
              </button>
            )}
            {modal === "bea" &&
              game.postcards.includes(episode.story.favor.postcardId) &&
              !game.postcardReturned && (
                <button
                  onClick={() => {
                    const next = dispatch({ type: "return-postcard" });
                    if (next.postcardReturned) {
                      setLine(episode.story.favor.thanks);
                      audio.current?.play("success");
                    }
                  }}
                >
                  {episode.story.favor.prompt} <Mail size={17} />
                </button>
              )}
            <button
              onClick={() =>
                setLine(
                  modal === "moss"
                    ? "Bea writes the weather report. I read it to the boats. Between us, I think the boats mostly come for the biscuits."
                    : "Every parcel gets a stamp. Every courier gets a cup of tea. The gulls keep applying for both.",
                )
              }
            >
              How’s island life?
            </button>
          </div>
        </Dialog>
      )}
      {modal === "card" && viewedCard && inspectedCard && (
        <Dialog title={viewedCard.label} onClose={closeModal}>
          <span className="wp-note-eyebrow">
            <BookOpen size={16} /> Source card · in your hands
          </span>
          <h2>{viewedCard.label}</h2>
          <p className="wp-dialogue-line">{viewedCard.text}</p>
          <div className="wp-source-links">
            {viewedCard.sourceIds.map((id) => (
              <SourceLink key={id} episode={episode} id={id} />
            ))}
          </div>
          <p className="wp-muted">
            {stationRound(episode, inspectedCard.site).prompt}
          </p>
          <div className="wp-card-destinations">
            {stationRound(episode, inspectedCard.site).slots.map((slot) => (
              <div key={slot.id}>
                <strong>{slot.label}</strong>
                <p>{slot.description}</p>
              </div>
            ))}
          </div>
          <div className="wp-choices">
            <button className="wp-primary" onClick={closeModal}>
              Carry it to a crate <Package size={17} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === "discovery" && foundDiscovery && (
        <Dialog title={foundDiscovery.title} onClose={closeModal}>
          <span className="wp-note-eyebrow">
            <BookOpen size={16} /> Noted in your journal
          </span>
          <h2>{foundDiscovery.title}</h2>
          <p className="wp-dialogue-line">{foundDiscovery.text}</p>
          <p className="wp-muted">
            {discovery === "workshop-sketch"
              ? "Moss might have something to say about this sketch."
              : "Bea can tell you what changed on this delivery."}
          </p>
          <div className="wp-source-links">
            {foundDiscovery.sourceIds.map((id) => (
              <SourceLink key={id} episode={episode} id={id} />
            ))}
          </div>
          <div className="wp-choices">
            <button className="wp-primary" onClick={closeModal}>
              Keep exploring
            </button>
            <button onClick={() => setModal("journal")}>
              Read my field notes
            </button>
          </div>
        </Dialog>
      )}
      {modal === "journal" && (
        <Dialog title="Field notes" onClose={closeModal}>
          <FieldNotes episode={episode} game={game} onClose={closeModal} />
        </Dialog>
      )}
      {modal === "pause" && (
        <Dialog title="Pause and controls" onClose={closeModal}>
          <h2>A moment ashore</h2>
          <p>The delivery can wait. Each adventure saves separately.</p>
          {onSelect && <EpisodeChoices episode={episode} onSelect={onSelect} />}
          {onHome && (
            <button className="wp-home" onClick={onHome}>
              <ArrowLeft size={16} /> Return to library
            </button>
          )}
          <dl className="wp-control-list">
            <dt>Move</dt>
            <dd>W A S D or arrow keys</dd>
            <dt>Run</dt>
            <dd>Hold Shift</dd>
            <dt>Walk automatically</dt>
            <dd>V to start / stop; steer the camera</dd>
            <dt>Jump</dt>
            <dd>Space</dd>
            <dt>Talk / handle objects</dt>
            <dd>E, or the on-screen prompt</dd>
            <dt>Look around</dt>
            <dd>Drag, or Q / R</dd>
            <dt>Center camera</dt>
            <dd>F</dd>
            <dt>Put an item back</dt>
            <dd>X</dd>
            <dt>Field notes</dt>
            <dd>B</dd>
          </dl>
          <label className="wp-setting">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => setReduced(e.target.checked)}
            />{" "}
            {episode.scene.stations.bridge.motion
              ? "Reduced motion · pause cart replay"
              : "Reduced camera and scenery motion"}
          </label>
          <label className="wp-setting">
            <input
              type="checkbox"
              checked={showTouch}
              onChange={(e) => setShowTouch(e.target.checked)}
            />{" "}
            Show touch controls
          </label>
          <div className="wp-choices">
            <button className="wp-primary" onClick={closeModal}>
              Keep exploring
            </button>
            <button
              onClick={() => {
                world.current?.controller.respawn();
                closeModal();
                tell("Back at Moss landing, with your progress safe.");
              }}
            >
              <Compass size={17} /> Return to landing
            </button>
          </div>
          <details>
            <summary>Start a new delivery</summary>
            <p>
              This clears {episode.title}’s delivery, discoveries, postcards and
              experiment notes. Your other adventure stays saved.
            </p>
            <button
              onClick={() => {
                const next = initialProgress(episode);
                gameRef.current = next;
                setGame(next);
                world.current?.setState(next);
                world.current?.controller.respawn();
                try {
                  clearProgress(episode, localStorage);
                  setSaveWarning(false);
                } catch {
                  setSaveWarning(true);
                }
                closeModal();
              }}
            >
              <RotateCcw size={16} /> Restart {episode.title}
            </button>
          </details>
        </Dialog>
      )}
      {modal === "finish" && (
        <Dialog title="Delivery complete" onClose={closeModal}>
          <div className="wp-finish-stamp">
            <Mail size={38} />
            <Check size={24} />
          </div>
          <h2>Good things find a way.</h2>
          <p className="wp-dialogue-line">{episode.ending}</p>
          <p className="wp-muted">Moss, now putting the kettle on</p>
          <div className="wp-delivery-receipt">
            <span>One parcel, safely home.</span>
            <span>Two routes working again.</span>
            <span>{game.postcards.length} of 3 postcards found.</span>
            {game.postcardReturned && (
              <span>Moss’s postcard delivered to Bea, too.</span>
            )}
          </div>
          <p>{episode.objectives[0].claim}</p>
          <div className="wp-choices">
            <button className="wp-primary" onClick={closeModal}>
              Take the scenic route
            </button>
            <button onClick={() => setModal("journal")}>
              Look at my field notes
            </button>
            {onHome && (
              <button onClick={onHome}>
                <ArrowLeft size={16} /> Return to library
              </button>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
