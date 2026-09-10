import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Eye,
  Hand,
  HelpCircle,
  Map,
  MousePointer2,
  RotateCcw,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  createInitialState,
  getHotspots,
  getObjective,
  parseSave,
  transition,
} from "./adventure/engine";
import { DISCOVERIES, ITEMS, ROOMS, CIRCUIT_SOURCE } from "./adventure/episode";
import type {
  AdventureAction,
  AdventureState,
  Dialogue,
  Hotspot,
  ItemId,
  PuzzleId,
  RoomId,
} from "./adventure/model";
import PocketHarbor from "./adventure/PocketHarbor";
import AdventurePuzzle, {
  clearAdventurePuzzleDrafts,
} from "./adventure/AdventurePuzzle";
import { Character } from "./adventure/Character";
import { ItemArt } from "./adventure/ItemArt";
import { SceneProp } from "./adventure/SceneProp";
import { playCue } from "./adventure/audio";
import { Modal } from "./components/Modal";
import "./adventure/adventure.css";
const LegacyApp = lazy(() => import("./App"));
const EpisodeStudio = lazy(() => import("./EpisodeStudio"));
const RoomCanvas = lazy(() => import("./adventure/RoomCanvas"));
const SAVE_KEY = "astraified:bramble-bay:v1";
const roomList = Object.keys(ROOMS) as RoomId[];
const portrait: Record<string, string> = {
  "Captain Wren": "wren",
  Wren: "wren",
  Pip: "pip",
  Ada: "ada",
  Tock: "tock",
  Button: "button",
};
function initial() {
  try {
    const saved = parseSave(localStorage.getItem(SAVE_KEY));
    if (!saved?.started) clearAdventurePuzzleDrafts();
    return saved || createInitialState();
  } catch {
    return createInitialState();
  }
}

export default function AdventureApp() {
  const [state, setState] = useState<AdventureState>(initial);
  const [screen, setScreen] = useState<"cover" | "game" | "legacy" | "studio">("cover");
  const [selected, setSelected] = useState<ItemId | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [line, setLine] = useState(0);
  const [talkTarget, setTalkTarget] = useState("");
  const [puzzle, setPuzzle] = useState<PuzzleId | null>(null);
  const [panel, setPanel] = useState<
    "map" | "notebook" | "settings" | "restart" | "ending" | "memento" | null
  >(null);
  const [notebookTab, setNotebookTab] = useState<"notes" | "sources">("notes");
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("astraified:bramble:muted") === "true";
    } catch {
      return true;
    }
  });
  const [showHotspots, setShowHotspots] = useState(false);
  const [hover, setHover] = useState("");
  const [toast, setToast] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [endingShown, setEndingShown] = useState(false);
  const [giftPending, setGiftPending] = useState(false);
  const [dialogueHeight, setDialogueHeight] = useState(200);
  const dialogueRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const sound = useCallback(
    (cue: Parameters<typeof playCue>[0]) => {
      if (!muted) playCue(cue);
    },
    [muted],
  );
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [state]);
  useEffect(() => {
    try {
      localStorage.setItem("astraified:bramble:muted", String(muted));
    } catch {}
  }, [muted]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3700);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setHover("");
    setShowHotspots(false);
  }, [state.room]);
  useEffect(() => {
    const last = Math.max(0, Math.floor((state.inventory.length - 1) / 8));
    if (inventoryPage > last) setInventoryPage(last);
  }, [state.inventory.length, inventoryPage]);
  const dialogueOpen = !!dialogue;
  useEffect(() => {
    const element = dialogueRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setDialogueHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [dialogueOpen]);
  useEffect(() => {
    if (dialogueOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogueRef.current?.focus();
    } else {
      const frame = requestAnimationFrame(() => {
        const previous = previousFocus.current;
        if (
          previous?.isConnected &&
          previous !== document.body &&
          !previous.closest("[inert]")
        )
          previous.focus();
        else
          document
            .querySelector<HTMLButtonElement>(
              ".adv-world-interactions:not([inert]) .adv-hotspot",
            )
            ?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [dialogueOpen]);
  useEffect(() => {
    if (dialogue && !dialogueRef.current?.contains(document.activeElement))
      dialogueRef.current?.focus();
  }, [dialogue]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (screen !== "game" || panel || puzzle) return;
      if (e.key === "Tab" && dialogue) {
        const buttons = Array.from(
          dialogueRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialogueRef.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialogueRef.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.key === "Escape") {
        closeDialogue();
        setSelected(null);
        setShowHotspots(false);
      }
      if (
        (e.key === " " || e.key === "Enter") &&
        document.activeElement === dialogueRef.current
      ) {
        e.preventDefault();
        advance();
      }
      if (e.key.toLowerCase() === "h" && !dialogue) setShowHotspots(true);
    }
    function release(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "h") setShowHotspots(false);
    }
    window.addEventListener("keydown", keys);
    window.addEventListener("keyup", release);
    return () => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener("keyup", release);
    };
  });
  function dispatch(action: AdventureAction) {
    const result = transition(state, action);
    setState(result.state);
    if (result.sound) sound(result.sound);
    if (result.dialogue) {
      setDialogue(result.dialogue);
      setLine(0);
    } else setDialogue(null);
    if (result.puzzle) {
      setPuzzle(result.puzzle);
      setDialogue(null);
    }
    const added = result.state.inventory.filter(
      (item) => !state.inventory.includes(item),
    );
    if (added.length) {
      setToast(`${ITEMS[added[0]].name} added to your bag`);
      setInventoryPage(Math.floor((result.state.inventory.length - 1) / 8));
    }
    if (!state.completed && result.state.completed) {
      setToast("The ferry is coming home.");
      setEndingShown(false);
      sound("finish");
    }
    if ((!state.flags.favorDone && result.state.flags.favorDone) || (!state.flags.mementoOpened && result.state.flags.mementoOpened)) setGiftPending(true);
    if (action.type === 'inspect' && action.item === 'memento' && state.inventory.includes('memento')) {
      setDialogue(null);
      setPanel('memento');
    }
    return result;
  }
  function closeDialogue() {
    setDialogue(null);
    if (giftPending) {
      setGiftPending(false);
      setPanel('memento');
    } else if (state.completed && !endingShown) {
      setPanel("ending");
      setEndingShown(true);
    }
  }
  function advance() {
    if (!dialogue) return;
    if (line < dialogue.lines.length - 1) {
      setLine((n) => n + 1);
      sound("click");
    } else if (!dialogue.choices?.length) closeDialogue();
  }
  function start() {
    setScreen("game");
    setEndingShown(state.completed);
    if (!state.started) dispatch({ type: "start" });
    else sound("door");
  }
  function move(room: RoomId) {
    setSelected(null);
    setPanel(null);
    setTalkTarget("");
    dispatch({ type: "move", room });
  }
  function interact(spot: Hotspot) {
    if (dialogue) return;
    setTalkTarget(spot.character || "");
    if (spot.kind === "character" && !selected)
      dispatch({ type: "talk", character: spot.character || spot.id });
    else
      dispatch({
        type: "interact",
        target: spot.id,
        ...(selected ? { item: selected } : {}),
      });
    setSelected(null);
  }
  function pickItem(item: ItemId) {
    if (dialogue) return;
    if (selected === item) {
      setSelected(null);
      return;
    }
    if (selected) {
      dispatch({ type: "combine", a: selected, b: item });
      setSelected(null);
    } else {
      setSelected(item);
      sound("click");
    }
  }
  function restart() {
    clearAdventurePuzzleDrafts();
    dispatch({ type: "restart" });
    setPanel(null);
    setSelected(null);
    setPuzzle(null);
    setEndingShown(false);
    setGiftPending(false);
    setScreen("cover");
  }
  const hotspots = getHotspots(state),
    room = ROOMS[state.room];
  const roomDescription = state.completed && state.room === 'jetty'
    ? 'Warm lights. A ferry safely home. One last accordion encore, for the road.'
    : state.flags.feederFixed && state.room === 'lantern'
      ? 'The signals glow steadily. Below, the harbor begins to feel like home again.'
      : room.description;
  const inventory = state.inventory.slice(
    inventoryPage * 8,
    inventoryPage * 8 + 8,
  );
  const completedNotes = state.discoveries
    .map((id) => ({ id, ...DISCOVERIES[id] }))
    .filter((note) => !!note.title);
  const progressSummary = state.completed
    ? "Case closed"
    : state.flags.signalsFixed
      ? "The handover"
      : state.flags.robotHelp
        ? "The repair"
        : "The investigation";
  const dialogCharacter = dialogue ? portrait[dialogue.speaker] : undefined;

  if (screen === "studio")
    return (
      <Suspense fallback={<div className="adv-loading">Opening the adventure studio…</div>}>
        <EpisodeStudio onBack={() => setScreen("cover")} />
      </Suspense>
    );
  if (screen === "legacy")
    return (
      <div className="adv-legacy">
        <button className="adv-return" onClick={() => setScreen("cover")}>
          <ArrowLeft size={16} /> Back to Bramble Bay
        </button>
        <div className="adv-legacy-note">
          Source studio · Existing circuit and route experiments. The new
          adventure format starts with the Bramble Bay case.
        </div>
        <Suspense
          fallback={
            <div className="adv-loading">Opening your source studio…</div>
          }
        >
          <LegacyApp />
        </Suspense>
      </div>
    );
  return (
    <div className={`adv-app ${screen === "cover" ? "adv-at-cover" : ""}`}>
      <header className="adv-topbar" inert={!!dialogue || !!panel || !!puzzle}>
        <button
          className="adv-brand"
          onClick={() => {
            setScreen("cover");
            setPanel(null);
            setPuzzle(null);
            setDialogue(null);
          }}
          aria-label="Astraified home"
        >
          <span className="adv-brand-star">✦</span>astraified
          <span className="adv-brand-dot">.</span>
        </button>
        <span className="adv-header-title">
          {screen === "game"
            ? "The Last Light at Bramble Bay"
            : "A little curiosity goes a long way."}
        </span>
        <div className="adv-top-actions">
          {screen === "cover" ? (
            <>
              <button
                className="adv-studio-link"
                onClick={() => setScreen("studio")}
              >
                <Sparkles size={16} /> Create an adventure <ArrowRight size={14} />
              </button>
              <button
                className="adv-studio-link"
                onClick={() => setScreen("legacy")}
              >
                Earlier experiments
              </button>
            </>
          ) : (
            <>
              <span className={`adv-save ${saveFailed ? "is-warning" : ""}`}>
                <span />
                {saveFailed ? "Save unavailable" : "Saved on this device"}
              </span>
              <button
                className="adv-icon-button"
                aria-label="Settings"
                onClick={() => setPanel("settings")}
              >
                <Settings2 size={18} />
              </button>
            </>
          )}
        </div>
      </header>
      {screen === "cover" ? (
        <main className="adv-cover">
          <div className="adv-cover-art" />
          <div className="adv-cover-shade" />
          <div className="adv-cover-copy">
            <span className="adv-case-tag">
              <Compass size={17} /> A Bramble Bay mystery
            </span>
            <h1>
              The last light
              <br />
              at Bramble Bay
            </h1>
            <p>
              A stranded ferry. A suspicious repair.
              <br />A very certain robot.
            </p>
            <p className="adv-cover-invitation">
              Pack your curiosity. The harbor needs a hand.
            </p>
            <button className="adv-begin" onClick={start}>
              {state.started
                ? state.completed
                  ? "Revisit Bramble Bay"
                  : "Continue the case"
                : "Begin the case"}
              <ArrowRight size={22} />
            </button>
            <div className="adv-cover-meta">
              <MousePointer2 size={15} />
              <span>Point & click adventure</span>
              <span className="adv-meta-dot" />
              <span>Take your time</span>
            </div>
            {state.started && (
              <button
                className="adv-new-case"
                onClick={() => setPanel("restart")}
              >
                <RotateCcw size={13} /> Start a fresh case
              </button>
            )}
          </div>
          <div className="adv-cover-cast">
            <Character id="wren" />
            <div className="adv-cover-crab">
              <Character id="button" />
            </div>
            <div className="adv-cover-bubble">
              “I hope you’re better with wires
              <br />
              than I am with waiting.”
            </div>
          </div>
          <div className="adv-cover-bottom">
            <span>Explore the bay. Follow a hunch. Bring everyone home.</span>
            <button
              onClick={() => {
                setNotebookTab("sources");
                setPanel("notebook");
              }}
            >
              <BookOpen size={15} /> The ideas behind the mystery
            </button>
          </div>
        </main>
      ) : (
        <main className="adv-play">
          <div className="adv-game-wrap">
            <div
            className={`adv-scene ${selected ? "has-selected-item" : ""} ${showHotspots ? "show-hotspots" : ""}`}
            style={{'--adv-dialogue-height': `${dialogueHeight}px`} as CSSProperties}
            >
              <Suspense fallback={<div className="adv-canvas" style={{backgroundImage:`url(/adventure/${state.room}.png)`}}/>}>
                <RoomCanvas room={state.room} complete={state.completed} />
              </Suspense>
              <div className="adv-scene-vignette" />
              <div className="adv-location">
                <span className="adv-location-pin">
                  <Compass size={15} />
                </span>
                <div>
                  <h1>{room.name}</h1>
                  <span>{progressSummary}</span>
                </div>
              </div>
              <div
                className="adv-scene-tools"
                inert={!!dialogue || !!panel || !!puzzle}
              >
                <button
                  aria-label="Map of Bramble Bay"
                  onClick={() => setPanel("map")}
                >
                  <Map size={21} />
                  <span>Map</span>
                </button>
                <button
                  aria-label="Field notebook"
                  onClick={() => {
                    setNotebookTab("notes");
                    setPanel("notebook");
                  }}
                >
                  <BookOpen size={21} />
                  <span>Notes</span>
                  {state.discoveries.length > 0 && <i />}
                </button>
              </div>
              <div
                className="adv-world-interactions"
                aria-label={`Explore ${room.name}`}
                inert={!!dialogue || !!panel || !!puzzle}
              >
                {hotspots.map((spot) => (
                  <button
                    key={spot.id}
                    className={`adv-hotspot is-${spot.kind} prop-${spot.id} ${selected ? "is-using" : ""}`}
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      width: `${spot.w}%`,
                      height: `${spot.h}%`,
                    }}
                    aria-label={`${selected ? `Use ${ITEMS[selected].name} on ` : ""}${spot.label}`}
                    onClick={() => interact(spot)}
                    onMouseEnter={() => setHover(spot.label)}
                    onMouseLeave={() => setHover("")}
                    onFocus={() => setHover(spot.label)}
                    onBlur={() => setHover("")}
                  >
                    {spot.kind === "character" ? (
                      <Character id={spot.character || spot.id} />
                    ) : spot.item ? (
                      <ItemArt item={spot.item} />
                    ) : (
                      <SceneProp
                        id={spot.id}
                        open={state.flags.robotHelp}
                        lit={
                          spot.id === "recess"
                            ? state.flags.junctionSeen
                            : state.flags.feederFixed
                        }
                      />
                    )}
                    <span className="adv-hotspot-marker">
                      {spot.kind === "character" ? (
                        <span>…</span>
                      ) : (
                        <Hand size={14} />
                      )}
                    </span>
                    <span className="adv-hotspot-label">{spot.label}</span>
                  </button>
                ))}
              </div>
              {state.completed && state.room === "jetty" && (
                <div className="adv-arrival" aria-hidden="true">
                  <svg viewBox="0 0 340 160">
                    <g stroke="#253f44" strokeWidth="3" strokeLinejoin="round">
                      <path d="M13 108H323L291 143H45Z" fill="#366b70" />
                      <path d="M28 110H310" stroke="#e5c476" strokeWidth="9" />
                      <path d="M74 54H253V106H59Z" fill="#e8d2a0" />
                      <path d="M123 27H222V54H115Z" fill="#d6b574" />
                      <path d="M148 27V13H181V27" fill="#607b73" />
                      <path
                        d="M69 72H98V95H69M116 71H144V95H116M163 71H191V95H163M211 71H238V95H211M135 34H159V49H135M177 34H201V49H177"
                        fill="#f7db87"
                      />
                      <path
                        d="M20 149Q68 163 117 150T218 151T329 148"
                        fill="none"
                        stroke="#b4d3bc"
                      />
                    </g>
                  </svg>
                </div>
              )}
              <div className="adv-scene-caption" aria-live="polite">
                {hover ? (
                  <>
                    <MousePointer2 size={14} />
                    {selected
                      ? `Use ${ITEMS[selected].name} with ${hover}`
                      : hover}
                  </>
                ) : selected ? (
                  <>
                    <Hand size={14} />
                    Choose something to use {ITEMS[
                      selected
                    ].name.toLowerCase()}{" "}
                    with
                  </>
                ) : (
                  <span>{roomDescription}</span>
                )}
              </div>
              {!dialogue && (
                <nav className="adv-exits" aria-label="Nearby places" inert={!!panel||!!puzzle}>
                  {room.exits.map((id, i) => (
                    <button key={id} onClick={() => move(id)}>
                      <span className="adv-exit-arrow">
                        {i === 0 ? (
                          <ArrowLeft size={16} />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                      </span>
                      {ROOMS[id].name.replace("The ", "")}
                    </button>
                  ))}
                </nav>
              )}
              {dialogue && (
                <div
                  className={`adv-dialogue ${dialogCharacter ? "has-portrait" : ""}`}
                  ref={dialogueRef}
                  role="dialog"
                  aria-label={`${dialogue.speaker} says`}
                  tabIndex={-1}
                >
                  {dialogCharacter && (
                    <div className="adv-dialogue-portrait">
                      <Character id={dialogCharacter} talking />
                    </div>
                  )}
                  <div className="adv-dialogue-body">
                    <div className="adv-dialogue-heading">
                      <strong>{dialogue.speaker}</strong>
                      <button
                        onClick={closeDialogue}
                        aria-label="Close conversation"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <p key={`${dialogue.speaker}-${line}`} aria-live="polite">
                      {dialogue.lines[line]}
                    </p>
                    {line === dialogue.lines.length - 1 &&
                    dialogue.choices?.length ? (
                      <div className="adv-dialogue-choices">
                        {dialogue.choices.map((choice) => (
                          <button
                            key={choice.id}
                            onClick={() =>
                              dispatch({
                                type: "talk",
                                character: talkTarget || dialogCharacter || "",
                                choice: choice.id,
                              })
                            }
                          >
                            {choice.label}
                            <ChevronRight size={15} />
                          </button>
                        ))}
                        <button
                          className="adv-dialogue-bye"
                          onClick={closeDialogue}
                        >
                          I’ll have a look around.
                        </button>
                      </div>
                    ) : (
                      <div className="adv-dialogue-bottom">
                        <span>
                          {dialogue.lines.length > 1
                            ? `${line + 1} / ${dialogue.lines.length}`
                            : ""}
                        </span>
                        <button onClick={advance}>
                          {line < dialogue.lines.length - 1
                            ? "Go on"
                            : "Got it"}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div
              className={`adv-inventory ${selected ? "has-selection" : ""}`}
              inert={!!dialogue || !!panel || !!puzzle}
            >
              <div className="adv-bag-label">
                <span>
                  <Hand size={19} />
                </span>
                <strong>Your bag</strong>
                <small>
                  {state.inventory.length
                    ? `${state.inventory.length} things worth keeping`
                    : "Room for a good idea"}
                </small>
              </div>
              <div className="adv-inventory-items" aria-label="Inventory">
                {inventory.map((item) => (
                  <button
                    key={item}
                    className={`adv-item ${selected === item ? "selected" : ""}`}
                    onClick={() => pickItem(item)}
                    aria-label={ITEMS[item].name}
                    aria-pressed={selected === item}
                    title={ITEMS[item].name}
                  >
                    <ItemArt item={item} />
                    <span>{ITEMS[item].name}</span>
                    {selected === item && (
                      <i>
                        <Check size={10} />
                      </i>
                    )}
                  </button>
                ))}
                {!state.inventory.length ? (
                  <div className="adv-empty-bag">
                    <p>Every good adventure begins with empty pockets.</p>
                    <span>
                      Click a character to talk. Click an object to investigate.
                    </span>
                  </div>
                ) : (
                  Array.from(
                    { length: Math.max(0, 5 - inventory.length) },
                    (_, i) => <div className="adv-empty-slot" key={i} />,
                  )
                )}
              </div>
              {state.inventory.length > 8 && (
                <div className="adv-bag-pages">
                  <button
                    aria-label="Previous inventory items"
                    disabled={inventoryPage === 0}
                    onClick={() => setInventoryPage((p) => p - 1)}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <small>
                    {inventoryPage + 1}/{Math.ceil(state.inventory.length / 8)}
                  </small>
                  <button
                    aria-label="More inventory items"
                    disabled={(inventoryPage + 1) * 8 >= state.inventory.length}
                    onClick={() => setInventoryPage((p) => p + 1)}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              <div className="adv-inspect">
                <button
                  disabled={!selected}
                  onClick={() => {
                    if (selected) dispatch({ type: "inspect", item: selected });
                  }}
                >
                  <Eye size={18} />
                  <span>Inspect</span>
                </button>
                {selected && (
                  <button
                    className="adv-put-away"
                    aria-label="Put selected item away"
                    onClick={() => setSelected(null)}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
            <footer
              className="adv-game-footer"
              inert={!!dialogue || !!panel || !!puzzle}
            >
              <span>
                {selected ? (
                  "Select another item to combine, or an object in the room to use it."
                ) : (
                  <>
                    <MousePointer2 size={13} />
                    Click to explore. Your curiosity sets the pace.
                  </>
                )}
              </span>
              <div>
                <button
                  aria-label="Reveal interactive objects"
                  aria-pressed={showHotspots}
                  onClick={() => setShowHotspots((s) => !s)}
                >
                  <Eye size={14} /> Look around <kbd>H</kbd>
                </button>
                <button onClick={() => dispatch({ type: "hint" })}>
                  <HelpCircle size={14} /> A little nudge
                </button>
                <button
                  aria-label={muted ? "Enable sound" : "Mute sound"}
                  onClick={() => {
                    setMuted((m) => !m);
                    if (muted) playCue("click");
                  }}
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </footer>
          </div>
        </main>
      )}
      {toast && screen === "game" && (
        <div className="adv-toast" role="status">
          <Sparkles size={16} />
          {toast}
        </div>
      )}
      {puzzle && (
        <AdventurePuzzle
          puzzle={puzzle}
          draftKey={`astraified:bramble:draft:${puzzle}`}
          onSolve={() => {
            const solved = puzzle;
            setPuzzle(null);
            dispatch({ type: "solve", puzzle: solved });
          }}
          onClose={() => setPuzzle(null)}
          onHint={() => {
            const next = transition(state, { type: "hint" });
            setState(next.state);
          }}
        />
      )}
      {panel === "map" && (
        <div className="adv-modal-scope">
          <Modal title="Around Bramble Bay" onClose={closePanel} wide>
            <div className="adv-map-intro">
              <Compass size={20} />
              <p>Follow a lead. You can always come back.</p>
            </div>
            <div className="adv-map-grid">
              {roomList.map((id) => (
                <button
                  key={id}
                  className={`adv-map-room ${id === state.room ? "current" : ""}`}
                  onClick={() => move(id)}
                >
                  <img src={`/adventure/${id}.png`} alt="" />
                  <span>{ROOMS[id].name}</span>
                  <small>
                    {id === state.room
                      ? "You are here"
                      : state.visited.includes(id)
                        ? "Revisit"
                        : "Take a look"}
                    <ArrowRight size={13} />
                  </small>
                </button>
              ))}
            </div>
            <p className="adv-map-footnote">{getObjective(state)}</p>
          </Modal>
        </div>
      )}
      {panel === 'memento' && <div className="adv-modal-scope"><Modal title="Pip’s pocket harbor" onClose={closePanel} wide><PocketHarbor open={!!state.flags.mementoOpened}/></Modal></div>}
      {panel === "notebook" && (
        <div className="adv-modal-scope">
          <Modal title="Your field notebook" onClose={closePanel} wide>
            <div className="adv-notebook-tabs">
              <button
                className={notebookTab === "notes" ? "active" : ""}
                onClick={() => setNotebookTab("notes")}
              >
                <BookOpen size={16} /> Observations
              </button>
              <button
                className={notebookTab === "sources" ? "active" : ""}
                onClick={() => setNotebookTab("sources")}
              >
                <Sparkles size={16} /> Ideas & sources
              </button>
            </div>
            {notebookTab === "notes" ? (
              <div className="adv-notes">
                <div className="adv-notebook-objective">
                  <Compass size={19} />
                  <div>
                    <strong>Your case</strong>
                    <p>{getObjective(state)}</p>
                  </div>
                </div>
                {completedNotes.length ? (
                  completedNotes.map((note) => (
                    <article key={note.id}>
                      <span className="adv-note-mark">
                        {["parallel", "feeder", "loop"].includes(note.id)
                          ? "✦"
                          : "✧"}
                      </span>
                      <div>
                        <h3>{note.title}</h3>
                        <p>{note.text}</p>
                        {note.sourceUrl && (
                          <a
                            href={note.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Explore the underlying idea <ArrowRight size={12} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="adv-empty-notes">
                    A fresh page. The best notes begin with noticing something.
                  </p>
                )}
                <p className="adv-assistance-note">
                  {state.hintsUsed} {state.hintsUsed === 1 ? "nudge" : "nudges"}{" "}
                  requested. Help is part of investigating.
                </p>
              </div>
            ) : (
              <div className="adv-source-notes">
                <h3>Electricity you can put to work</h3>
                <p>
                  This case explores complete circuits, series and parallel
                  connections, and the difference between a broken lamp branch
                  and a shared supply fault.
                </p>
                <a
                  className="adv-source-link"
                  href={CIRCUIT_SOURCE}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen size={24} />
                  <div>
                    <strong>Resistors in Series and Parallel</strong>
                    <span>OpenStax · College Physics 2e</span>
                  </div>
                  <ArrowRight size={20} />
                </a>
                <h3>A useful, simplified world</h3>
                <p>{DISCOVERIES.assumptions.text}</p>
                <p>
                  The notebook contains editorial explanations of these ideas.
                  The characters and mystery are original fiction. Solving the
                  case is practice; it does not by itself demonstrate lasting
                  mastery.
                </p>
                <h3>Made for curious minds</h3>
                <p>
                  Try an idea, observe what happens, and change your plan. You
                  can undo connections, revisit rooms, and ask for a nudge.
                  There is no timer.
                </p>
              </div>
            )}
          </Modal>
        </div>
      )}
      {panel === "settings" && (
        <div className="adv-modal-scope">
          <Modal title="A moment by the harbor" onClose={closePanel}>
            <div className="adv-settings">
              <button onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}Sound
                effects<span>{muted ? "Off" : "On"}</span>
              </button>
              <button
                onClick={() => {
                  setShowHotspots((s) => !s);
                  setPanel(null);
                }}
              >
                <Eye size={20} />
                Reveal things to investigate
                <span>{showHotspots ? "On" : "Off"}</span>
              </button>
              <button
                onClick={() => {
                  setScreen("cover");
                  setPanel(null);
                }}
              >
                <Compass size={20} />
                Return to the case cover
                <ArrowRight size={17} />
              </button>
              <button onClick={() => setPanel("restart")}>
                <RotateCcw size={20} />
                Start a fresh case
                <ArrowRight size={17} />
              </button>
            </div>
            <p className="adv-settings-note">
              {saveFailed
                ? "Browser storage is unavailable. This session is playable, but your progress cannot be kept after closing it."
                : "Your progress saves automatically on this device."}
            </p>
            <p className="adv-settings-note">
              Keyboard: Tab to explore, Enter to interact, H to reveal objects,
              Escape to close a conversation or put an item away. Ambient
              movement follows your device’s reduced-motion preference.
            </p>
          </Modal>
        </div>
      )}
      {panel === "restart" && (
        <div className="adv-modal-scope">
          <Modal title="A fresh page?" onClose={closePanel}>
            <p className="adv-reset-copy">
              This resets your progress in Bramble Bay, including its
              discoveries and keepsakes. Your source studio and other saved
              experiments stay available.
            </p>
            <div className="adv-reset-actions">
              <button className="adv-soft-button" onClick={closePanel}>
                Keep investigating
              </button>
              <button className="adv-solid-button" onClick={restart}>
                <RotateCcw size={15} /> Start fresh
              </button>
            </div>
          </Modal>
        </div>
      )}
      {panel === "ending" && (
        <div className="adv-modal-scope">
          <Modal
            title="The last ferry, home at last."
            onClose={closePanel}
            wide
          >
            <div className="adv-ending">
              <div className="adv-ending-stamp">
                <Compass size={50} />
                <span>Case closed</span>
              </div>
              <div>
                <h3>A small light can bring a whole harbor home.</h3>
                <p>
                  Wren brings the ferry alongside. Pip rescues the scones. Tock
                  quietly crosses out “flawless” in the maintenance log.
                </p>
                <blockquote>
                  “I have learned two things,” says Tock. “Backups need their
                  own paths. And apologies do not require a form.”
                </blockquote>
                <div className="adv-ending-takeaways">
                  <span>
                    <Check size={17} />
                    Made a complete conducting loop
                  </span>
                  <span>
                    <Check size={17} />
                    Built and tested independent branches
                  </span>
                  <span>
                    <Check size={17} />
                    Diagnosed a shared supply fault
                  </span>
                </div>
                <p className="adv-ending-secret">
                  {state.flags.mementoOpened
                    ? "Button has found a tiny new command. First Mate applications are open."
                    : state.flags.favorDone
                      ? "Pip’s pocket harbor has one last secret. A certain crab might appreciate it."
                      : "The important things are home. But Pip may still be missing something small…"}
                </p>
                <div className="adv-ending-actions">
                  <button className="adv-solid-button" onClick={closePanel}>
                    Stay a little longer <ArrowRight size={16} />
                  </button>
                  <button
                    className="adv-soft-button"
                    onClick={() => {
                      setNotebookTab("notes");
                      setPanel("notebook");
                    }}
                  >
                    Open my notebook
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
