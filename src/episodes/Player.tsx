import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Map,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
} from "lucide-react";
import type {
  EpisodeAction,
  EpisodeDialogue,
  EpisodePackage,
  EpisodeState,
} from "./types";
import {
  createEpisodeState,
  matchesEpisodeCondition,
  parseEpisodeSave,
  transitionEpisode,
} from "./engine";
import { TransformerPuzzle } from "./TransformerPuzzle";
import { Character } from "../adventure/Character";
import { playCue } from "../adventure/audio";
import { EpisodeArt } from "./EpisodeArt";
import "./episodes.css";
const RoomCanvas = lazy(() => import("../adventure/RoomCanvas"));
const keyFor = (episode: EpisodePackage) =>
  `astraified:episode:${episode.id}:${episode.revision}`;

function SourceText({
  text,
  sources,
}: {
  text: string;
  sources: EpisodePackage["sources"];
}) {
  if (!sources.length) return text;
  const ids = sources.map((source) =>
    source.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(?<![\\w-])(${ids.join("|")})(?![\\w-])`, "g");
  return text.split(pattern).map((part, key) => {
    const index = sources.findIndex((source) => source.id === part);
    return index < 0 ? (
      part
    ) : (
      <a
        key={key}
        href={`#episode-source-${index}`}
        title={sources[index].title}
      >
        source {index + 1}
      </a>
    );
  });
}

export function EpisodeModal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const callback = useRef(onClose);
  callback.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        callback.current();
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="ep-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`ep-modal ${wide ? "ep-modal-wide" : ""}`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="ep-icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function loadProgress(episode: EpisodePackage): {
  state: EpisodeState;
  drafts: Record<string, unknown>;
} {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(episode)) || "null");
    const state = parseEpisodeSave(episode, raw?.state);
    if (state)
      return {
        state,
        drafts:
          raw?.drafts &&
          typeof raw.drafts === "object" &&
          !Array.isArray(raw.drafts)
            ? raw.drafts
            : {},
      };
  } catch {}
  return { state: createEpisodeState(episode), drafts: {} };
}

export default function EpisodePlayer({
  episode,
  onHome,
}: {
  episode: EpisodePackage;
  onHome: () => void;
}) {
  const [initial] = useState(() => loadProgress(episode));
  const [state, setState] = useState(() =>
    initial.state.started
      ? initial.state
      : transitionEpisode(episode, initial.state, { type: "start" }).state,
  );
  const [drafts, setDrafts] = useState(initial.drafts);
  const [dialogue, setDialogue] = useState<EpisodeDialogue | null>(() =>
    initial.state.started
      ? null
      : { speaker: "A new case", lines: [episode.briefing] },
  );
  const [line, setLine] = useState(0);
  const [puzzle, setPuzzle] = useState<string | null>(
    initial.state.activePuzzle ?? null,
  );
  const [pendingPuzzle, setPendingPuzzle] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<
    "map" | "notes" | "ending" | "reset" | "gift" | null
  >(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [announcements, setAnnouncements] = useState(0);
  const modalOpen = !!dialogue || !!puzzle || !!panel;
  const scene = episode.scenes.find((s) => s.id === state.scene)!;
  const selectedItem = episode.items.find((i) => i.id === selected);
  const activePuzzle = episode.puzzles.find((p) => p.id === puzzle);
  const pendingEnding = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(keyFor(episode), JSON.stringify({ state, drafts }));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [state, drafts, episode]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    setHover("");
    setRevealed(false);
  }, [state.scene]);
  useEffect(() => {
    if (modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key.toLowerCase() === "h") setRevealed(e.type === "keydown");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [modalOpen]);
  const closeDialogue = useCallback(() => {
    setDialogue(null);
    setLine(0);
    if (pendingPuzzle) {
      setPuzzle(pendingPuzzle);
      setPendingPuzzle(null);
    } else if (pendingEnding.current) {
      pendingEnding.current = false;
      setPanel("ending");
    }
  }, [pendingPuzzle]);
  function act(action: EpisodeAction) {
    const result = transitionEpisode(episode, state, action);
    setState(result.state);
    setSelected(null);
    if (result.message) setMessage(result.message);
    if (result.dialogue) {
      setDialogue(result.dialogue);
      setLine(0);
    }
    if (result.puzzle) {
      if (result.dialogue) setPendingPuzzle(result.puzzle);
      else setPuzzle(result.puzzle);
    }
    if (!state.completed && result.state.completed) {
      if (result.dialogue) pendingEnding.current = true;
      else setPanel("ending");
    }
    if (!muted) {
      if (result.state.inventory.length > state.inventory.length)
        playCue("pickup");
      else if (result.state.solvedPuzzles.length > state.solvedPuzzles.length)
        playCue("success");
      else if (action.type === "move") playCue("door");
    }
    return result;
  }
  function inspect() {
    if (!selectedItem) return;
    const result = act({ type: "inspect", target: selectedItem.id });
    if (
      result.dialogue ||
      result.puzzle ||
      (!state.completed && result.state.completed)
    )
      return;
    setMessage("");
    if (selectedItem.icon === "gift" || selectedItem.icon === "keepsake") {
      setPanel("gift");
      setSelected(null);
      return;
    }
    setLine(0);
    setDialogue(
      result.dialogue ?? {
        speaker: selectedItem.name,
        lines: [selectedItem.description],
      },
    );
    setSelected(null);
  }
  function reset() {
    const fresh = createEpisodeState(episode);
    setState(transitionEpisode(episode, fresh, { type: "start" }).state);
    setDrafts({});
    setPuzzle(null);
    setPendingPuzzle(null);
    setSelected(null);
    setPanel(null);
    setDialogue({ speaker: "A fresh case", lines: [episode.briefing] });
    setLine(0);
    pendingEnding.current = false;
  }
  return (
    <div className="ep-app ep-player">
      <div inert={modalOpen || undefined}>
        <header className="ep-topbar">
          <button className="ep-home" onClick={onHome}>
            <ArrowLeft size={17} />
            <span>astraified.</span>
          </button>
          <span className="ep-save-status" role="status">
            {saveFailed
              ? "Progress could not be saved"
              : "Saved on this device"}
          </span>
          <button
            className="ep-icon-button"
            onClick={() => setPanel("reset")}
            aria-label="Restart this case"
          >
            <RotateCcw size={17} />
          </button>
        </header>
        <main className="ep-stage-wrap">
          <div
            className="ep-stage"
            style={{
              backgroundImage: `url(/adventure/${scene.background}.png)`,
            }}
          >
            <Suspense fallback={null}>
              <RoomCanvas room={scene.background} complete={false} />
            </Suspense>
            <div className="ep-scene-heading">
              <h1>{scene.name}</h1>
              <span>{state.completed ? "Case closed" : episode.title}</span>
            </div>
            <div className="ep-scene-tools">
              <button
                onClick={() => setPanel("map")}
                aria-label="Open case map"
              >
                <Map />
                <span>Map</span>
              </button>
              <button
                onClick={() => setPanel("notes")}
                aria-label="Open field notebook"
              >
                <BookOpen />
                <span>Notes</span>
                {state.discoveries.length > 0 && <i />}
              </button>
            </div>
            <div className="ep-world" aria-label={`Explore ${scene.name}`}>
              {scene.hotspots
                .filter(
                  (h) =>
                    !h.visibleIf || matchesEpisodeCondition(state, h.visibleIf),
                )
                .map((h) => {
                  const linked = episode.rules
                    .flatMap((r) =>
                      r.trigger.target === h.id ? r.effects : [],
                    )
                    .find((e) => e.type === "openPuzzle");
                  const done =
                    linked?.type === "openPuzzle" &&
                    state.solvedPuzzles.includes(linked.puzzle);
                  return (
                    <button
                      key={h.id}
                      className={`ep-hotspot ${h.kind === "character" ? "ep-person" : "ep-object"} ${revealed ? "ep-revealed" : ""} ${done ? "ep-repaired" : ""}`}
                      style={{
                        left: `${h.x}%`,
                        top: `${h.y}%`,
                        width: `${h.w}%`,
                        height: `${h.h}%`,
                      }}
                      aria-label={`${selectedItem ? `Use ${selectedItem.name} on ` : ""}${h.label}`}
                      onMouseEnter={() => setHover(h.label)}
                      onMouseLeave={() => setHover("")}
                      onFocus={() => setHover(h.label)}
                      onBlur={() => setHover("")}
                      onClick={() =>
                        act(
                          selected
                            ? { type: "use", item: selected, target: h.id }
                            : { type: "interact", target: h.id },
                        )
                      }
                    >
                      {h.kind === "character" ? (
                        <Character id={h.portrait || "tock"} />
                      ) : (
                        <EpisodeArt
                          icon={h.icon || "machine"}
                          active={!!done || state.completed}
                        />
                      )}
                      <span className="ep-hotspot-label">
                        {h.label}
                        {done ? " ✓" : ""}
                      </span>
                    </button>
                  );
                })}
            </div>
            <p className="ep-scene-caption">
              {selectedItem
                ? `Use ${selectedItem.name}${hover ? ` on ${hover}` : ""}`
                : hover || scene.description}
            </p>
            <nav className="ep-exits" aria-label="Nearby places">
              {scene.exits.map((id) => (
                <button
                  key={id}
                  onClick={() => act({ type: "move", scene: id })}
                >
                  <ArrowRight size={14} />
                  {episode.scenes.find((s) => s.id === id)?.name}
                </button>
              ))}
            </nav>
            {state.completed && (
              <div className="ep-broadcast-stream" aria-hidden="true">
                ♪
              </div>
            )}
          </div>
          <div className="ep-inventory">
            <div className="ep-bag-label">
              <strong>Your bag</strong>
              <span>
                {state.inventory.length
                  ? `${state.inventory.length} ${state.inventory.length === 1 ? "thing" : "things"} worth keeping`
                  : "Room for a discovery"}
              </span>
            </div>
            <div className="ep-bag-items" role="group" aria-label="Inventory">
              {state.inventory.map((id) => {
                const item = episode.items.find((i) => i.id === id)!;
                return (
                  <button
                    key={id}
                    className={`ep-item ${selected === id ? "ep-selected" : ""}`}
                    aria-pressed={selected === id}
                    aria-label={item.name}
                    title={item.description}
                    onClick={() => {
                      if (selected && selected !== id)
                        act({ type: "combine", item: selected, target: id });
                      else setSelected(selected === id ? null : id);
                    }}
                  >
                    <EpisodeArt icon={item.icon} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
              {!state.inventory.length && (
                <span className="ep-empty-bag">
                  An empty bag. A promising beginning.
                </span>
              )}
            </div>
            <button
              className="ep-inspect"
              disabled={!selected}
              onClick={inspect}
            >
              <Search size={19} />
              Inspect
            </button>
          </div>
          <footer className="ep-game-footer">
            <span>
              {selectedItem
                ? "Choose an object, or another item to combine."
                : "Click to explore. Follow a hunch."}
            </span>
            <div>
              <button
                aria-pressed={revealed}
                onClick={() => setRevealed(!revealed)}
              >
                <Search size={14} />
                Look around
              </button>
              <button onClick={() => act({ type: "hint" })}>
                <Sparkles size={14} />A little nudge
              </button>
              <button
                onClick={() => setMuted(!muted)}
                aria-label={muted ? "Enable sound" : "Mute sound"}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </footer>
        </main>
        {message && (
          <div className="ep-toast" role="status">
            {message}
          </div>
        )}
      </div>
      {dialogue && (
        <EpisodeModal title={dialogue.speaker} onClose={closeDialogue}>
          <div className="ep-conversation">
            {dialogue.portrait && (
              <div className="ep-portrait">
                <Character id={dialogue.portrait} talking />
              </div>
            )}
            <div>
              <p>{dialogue.lines[line]}</p>
              <button
                className="ep-primary"
                onClick={() =>
                  line < dialogue.lines.length - 1
                    ? setLine(line + 1)
                    : closeDialogue()
                }
              >
                {line < dialogue.lines.length - 1
                  ? "Go on"
                  : "Back to the case"}
                <ArrowRight size={16} />
              </button>
              {dialogue.lines.length > 1 && (
                <span className="ep-line-count">
                  {line + 1} / {dialogue.lines.length}
                </span>
              )}
            </div>
          </div>
        </EpisodeModal>
      )}
      {activePuzzle && !dialogue && (
        <EpisodeModal
          title={activePuzzle.title}
          onClose={() => setPuzzle(null)}
          wide
        >
          <TransformerPuzzle
            key={`${episode.id}:${activePuzzle.id}`}
            config={activePuzzle.config}
            title={activePuzzle.title}
            instructions={activePuzzle.instructions}
            draft={drafts[activePuzzle.id]}
            onDraftChange={(draft) =>
              setDrafts((previous) => ({
                ...previous,
                [activePuzzle.id]: draft,
              }))
            }
            onComplete={(evidence) => {
              const result = transitionEpisode(episode, state, {
                type: "submitPuzzle",
                puzzle: activePuzzle.id,
                evidence,
              });
              setState(result.state);
              if (result.state.solvedPuzzles.includes(activePuzzle.id)) {
                setPuzzle(null);
                setDialogue({
                  speaker: "A working repair",
                  lines: [
                    result.message ||
                      "The repair passed its checks. Time to see what changes in the case.",
                  ],
                });
                setLine(0);
                if (!muted) playCue("success");
                if (result.state.completed && !state.completed)
                  pendingEnding.current = true;
              } else
                setMessage(
                  result.message || "That repair needs another check.",
                );
            }}
            onClose={() => setPuzzle(null)}
          />
        </EpisodeModal>
      )}
      {panel === "map" && (
        <EpisodeModal
          title="Around the bay"
          onClose={() => setPanel(null)}
          wide
        >
          <div className="ep-map">
            {episode.scenes.map((s) => (
              <button
                key={s.id}
                disabled={s.id === scene.id || !scene.exits.includes(s.id)}
                onClick={() => {
                  setPanel(null);
                  act({ type: "move", scene: s.id });
                }}
              >
                <img src={`/adventure/${s.background}.png`} alt="" />
                <strong>{s.name}</strong>
                <span>
                  {s.id === scene.id
                    ? "You are here"
                    : state.visited.includes(s.id)
                      ? "A familiar place"
                      : "A new lead"}
                </span>
              </button>
            ))}
          </div>
        </EpisodeModal>
      )}
      {panel === "notes" && (
        <EpisodeModal
          title="Your field notebook"
          onClose={() => setPanel(null)}
        >
          <div className="ep-notebook">
            <p className="ep-notebook-lead">{episode.subtitle}</p>
            <h3>Your discoveries</h3>
            {state.discoveries.length ? (
              state.discoveries.map((id) => {
                const d = episode.discoveries.find((d) => d.id === id)!;
                return (
                  <article key={id}>
                    <h4>{d.title}</h4>
                    <p>
                      <SourceText text={d.text} sources={episode.sources} />
                    </p>
                  </article>
                );
              })
            ) : (
              <p>Your first clue is waiting somewhere in the bay.</p>
            )}
            <h3>Ideas at work</h3>
            {episode.objectives.map((o) => (
              <article key={o.id}>
                <h4>{o.title}</h4>
                <p>
                  {episode.puzzles
                    .filter((p) => p.objectiveId === o.id)
                    .some((p) => state.solvedPuzzles.includes(p.id))
                    ? "Explored through a working repair."
                    : "An idea to investigate."}
                </p>
              </article>
            ))}
            <h3>Sources behind this case</h3>
            {episode.sources.map((source, index) => (
              <article
                key={source.id}
                id={`episode-source-${index}`}
                tabIndex={-1}
              >
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {index + 1}. {source.title}
                    {source.page ? ` · page ${source.page}` : ""}
                  </a>
                ) : (
                  <strong>
                    {index + 1}. {source.title}
                  </strong>
                )}
                <details>
                  <summary>Read source excerpt</summary>
                  <p>{source.text}</p>
                </details>
              </article>
            ))}
            <p className="ep-small">
              The instruments use illustrative vectors and demonstrate selected
              computations. They are not a trained language model. The story is
              fiction; the linked sources explain the concepts. A completed case
              is practice, not a measurement of lasting mastery.
            </p>
          </div>
        </EpisodeModal>
      )}
      {panel === "ending" && (
        <EpisodeModal
          title="A message worth hearing"
          onClose={() => setPanel(null)}
        >
          <div className="ep-ending">
            <EpisodeArt icon="machine" active />
            <p>{episode.ending}</p>
            <div className="ep-ending-actions">
              <button className="ep-primary" onClick={() => setPanel(null)}>
                Keep exploring
              </button>
              <button className="ep-secondary" onClick={onHome}>
                Your adventures
              </button>
            </div>
            <span className="ep-small">
              Optional favors and discoveries are still waiting in the bay.
            </span>
          </div>
        </EpisodeModal>
      )}
      {panel === "reset" && (
        <EpisodeModal title="A fresh page?" onClose={() => setPanel(null)}>
          <p>
            This resets only this case and its instruments. Your sources and
            other adventures stay in the library.
          </p>
          <div className="ep-button-row">
            <button className="ep-secondary" onClick={() => setPanel(null)}>
              Keep investigating
            </button>
            <button className="ep-primary" onClick={reset}>
              Start fresh
            </button>
          </div>
        </EpisodeModal>
      )}
      {panel === "gift" && (
        <EpisodeModal
          title="Your pocket announcer"
          onClose={() => setPanel(null)}
        >
          <div className="ep-keepsake">
            <EpisodeArt icon="machine" active={announcements > 0} />
            <p aria-live="polite">
              {
                [
                  "A tiny machine, waiting for a very unimportant message.",
                  "All spoons report to the moon. Bring a cardigan.",
                  "The next ferry will be arriving yesterday, subject to biscuits.",
                  "Captain Teapot requests permission to steep.",
                  "This announcement has been inspected by a crab.",
                ][announcements % 5]
              }
            </p>
            <button
              className="ep-primary"
              onClick={() => {
                setAnnouncements((n) => n + 1);
                if (!muted) playCue("success");
              }}
            >
              Make an announcement
            </button>
          </div>
        </EpisodeModal>
      )}
    </div>
  );
}
