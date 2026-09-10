import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  Anchor,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Flag,
  Lightbulb,
  LockKeyhole,
  MapPin,
  MousePointer2,
  Orbit,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { referenceMission } from "./domain/reference";
import { CIRCUIT_ASSUMPTIONS } from "./domain/circuits";
import {
  parseSavedMission,
  parseSavedProgress,
  type SavedProgress,
} from "./domain/storage";
import {
  addToLibrary,
  readSavedLibrary,
  LIBRARY_STORAGE_KEY,
} from "./domain/library";
import type { GameMode, MissionPackage, StationId } from "./domain/types";
import Workbench from "./game/Workbench";
import CreateMission from "./components/CreateMission";
import { Modal } from "./components/Modal";
const HarborWorld = lazy(() => import("./game/HarborWorld"));
type Progress = SavedProgress;
const emptyProgress: Progress = {
  completed: [],
  assisted: [],
  attempts: 0,
  hints: 0,
};
function readProgress(mission: MissionPackage): Progress {
  try {
    return parseSavedProgress(
      localStorage.getItem(`astraified:progress:${mission.id}`),
      mission,
    );
  } catch {
    return { ...emptyProgress };
  }
}
function readMission(): MissionPackage {
  try {
    return (
      parseSavedMission(localStorage.getItem("astraified:mission")) ||
      referenceMission
    );
  } catch {
    return referenceMission;
  }
}
function readLibrary(): MissionPackage[] {
  try {
    return readSavedLibrary(
      localStorage.getItem(LIBRARY_STORAGE_KEY),
      localStorage.getItem("astraified:mission"),
    );
  } catch {
    return [];
  }
}

export default function App() {
  const [page, setPage] = useState<"library" | "create" | "play">("library");
  const [mission, setMission] = useState<MissionPackage>(readMission),
    [mode, setMode] = useState<GameMode>("adventure");
  const [progress, setProgress] = useState<Progress>(() =>
    readProgress(readMission()),
  );
  const [savedMissions, setSavedMissions] =
    useState<MissionPackage[]>(readLibrary);
  const [active, setActive] = useState<StationId>("workshop"),
    [panel, setPanel] = useState<
      "notebook" | "workbench" | "complete" | "reset" | null
    >(null),
    [muted, setMuted] = useState(true),
    [notice, setNotice] = useState("");
  const [sourceTab, setSourceTab] = useState<"discoveries" | "sources">(
    "discoveries",
  );
  const closePanel = useCallback(() => setPanel(null), []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(savedMissions));
    } catch {}
  }, [savedMissions]);
  useEffect(() => {
    try {
      localStorage.setItem(
        `astraified:progress:${mission.id}`,
        JSON.stringify(progress),
      );
    } catch {}
  }, [progress, mission.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice]);
  const station =
    mission.stations.find((s) => s.id === active) || mission.stations[0];
  const allDone = mission.stations.every((s) =>
    progress.completed.includes(s.id),
  );
  function selectStation(id: StationId) {
    const index = mission.stations.findIndex((s) => s.id === id);
    if (
      index > 0 &&
      !progress.completed.includes(mission.stations[index - 1].id)
    ) {
      setNotice(
        `Visit ${mission.stations[index - 1].name} first to continue the investigation.`,
      );
      return;
    }
    setActive(id);
  }
  function selectMission(next: MissionPackage) {
    setMission(next);
    setProgress(readProgress(next));
    try {
      localStorage.setItem("astraified:mission", JSON.stringify(next));
    } catch {}
  }
  function play(next = mission, nextMode = mode) {
    selectMission(next);
    setSavedMissions((previous) => addToLibrary(previous, next));
    setMode(nextMode);
    const saved = readProgress(next);
    setActive(
      next.stations.find((s) => !saved.completed.includes(s.id))?.id ||
        next.stations[0].id,
    );
    setPage("play");
    setPanel(null);
  }
  function completeStation(assisted: boolean) {
    const completed = Array.from(new Set([...progress.completed, active]));
    setProgress((p) => ({
      ...p,
      completed,
      assisted: assisted
        ? Array.from(new Set([...p.assisted, active]))
        : p.assisted,
    }));
    setPanel(null);
    setNotice(station.check.explanation);
    const next = mission.stations.find((s) => !completed.includes(s.id));
    if (next) setActive(next.id);
    else setPanel("complete");
  }
  return (
    <div className={`app ${page === "play" ? "playing" : ""}`}>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => setPage("library")}
          aria-label="Astraified home"
        >
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <path
              d="M20 2l4.5 13.5L38 20l-13.5 4.5L20 38l-4.5-13.5L2 20l13.5-4.5z"
              fill="currentColor"
            />
            <circle cx="20" cy="20" r="4" fill="#f3f7fa" />
          </svg>
          <span>astraified</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={page !== "create" ? "active" : ""}
            onClick={() => setPage("library")}
          >
            <Compass size={17} /> Adventures
          </button>
          <button
            className={page === "create" ? "active" : ""}
            onClick={() => setPage("create")}
          >
            <Sparkles size={16} /> Create a world
          </button>
        </nav>
        <div className="header-right">
          <span className="build-label">First expedition</span>
          <button
            className="avatar"
            onClick={() => setPanel("notebook")}
            aria-label="Open field notebook"
          >
            <BookOpen size={19} />
          </button>
        </div>
      </header>
      {page === "library" && (
        <main className="library-page">
          <div className="library-heading">
            <div>
              <p>Good ideas deserve a world of their own.</p>
              <h1>Where curiosity takes you.</h1>
            </div>
            <button
              className="button secondary"
              onClick={() => setPage("create")}
            >
              <Sparkles size={17} /> Create an adventure
            </button>
          </div>
          {savedMissions.length > 0 && (
            <label className="mission-library">
              Your adventures
              <select
                aria-label="Choose a saved adventure"
                value={mission.id}
                onChange={(event) =>
                  selectMission(
                    [referenceMission, ...savedMissions].find(
                      (item) => item.id === event.target.value,
                    ) || referenceMission,
                  )
                }
              >
                {[referenceMission, ...savedMissions].map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <span>Saved on this device</span>
            </label>
          )}
          <div className="adventure-layout">
            <section
              className="adventure-cover"
              aria-label="Featured adventure"
            >
              <img
                className="cover-image"
                src="/harbor-key-art.png"
                alt="A moonlit island harbor, workshop and lighthouse"
              />
              <div className="cover-shade" />
              <div className="cover-content">
                <span className="story-tag">
                  <Anchor size={14} /> A harbor mystery
                </span>
                <h2>{mission.title}</h2>
                <p>{mission.description}</p>
                <div className="mission-meta">
                  <span>
                    <Clock3 size={15} />
                    {mission.estimatedMinutes} min
                  </span>
                  <span>
                    <Lightbulb size={15} />
                    {mission.topic}
                  </span>
                </div>
                <div className="cover-bottom">
                  <span className="choose-label">Choose how you explore</span>
                  <div className="mode-switch">
                    <button
                      className={mode === "adventure" ? "selected" : ""}
                      onClick={() => setMode("adventure")}
                    >
                      <MousePointer2 size={17} /> Point & click
                    </button>
                    <button
                      className={mode === "explore" ? "selected" : ""}
                      onClick={() => setMode("explore")}
                    >
                      <Orbit size={18} /> Explore in 3D
                    </button>
                  </div>
                  <button
                    className="button gold start-button"
                    onClick={() => play()}
                  >
                    <Play size={18} fill="currentColor" />
                    {allDone
                      ? "Revisit the harbor"
                      : progress.completed.length
                        ? "Continue expedition"
                        : "Enter the harbor"}
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>
              <div className="cover-caption">
                Seabrook Harbor <span>51° N · After sundown</span>
              </div>
            </section>
            <aside className="expedition-summary">
              <div className="notebook-heading">
                <BookOpen size={21} />
                <span>Your field notebook</span>
              </div>
              <h2>
                A little adventure.
                <br />A lasting discovery.
              </h2>
              <p>Follow the clues. Try an idea. See what changes.</p>
              <div className="summary-objectives">
                {mission.objectives.map((objective, index) => (
                  <div key={objective.id}>
                    <span
                      className={`objective-number ${progress.completed.includes(mission.stations[index]?.id) ? "done" : ""}`}
                    >
                      {progress.completed.includes(
                        mission.stations[index]?.id,
                      ) ? (
                        <Check size={15} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>{objective.title}</span>
                  </div>
                ))}
              </div>
              <button
                className="source-link"
                onClick={() => {
                  setSourceTab("sources");
                  setPanel("notebook");
                }}
              >
                <BookOpen size={17} />
                <span>
                  Grounded in your sources
                  <small>{mission.sources.length} linked excerpts</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <div className="progress-summary">
                <span>Expedition progress</span>
                <strong>
                  {progress.completed.length} / {mission.stations.length}
                </strong>
                <div>
                  <i
                    style={{
                      width: `${(progress.completed.length / mission.stations.length) * 100}%`,
                    }}
                  />
                </div>
                <small>Saved on this device</small>
              </div>
              {mission.generated && (
                <button
                  className="text-button"
                  onClick={() => selectMission(referenceMission)}
                >
                  Return to the original harbor mission
                </button>
              )}
            </aside>
          </div>
          <div className="library-footer">
            <span>
              <Compass size={17} /> Every discovery starts with a question.
            </span>
            <span>
              {mission.generated
                ? "Astra-generated mission · shared harbor setting"
                : "The first Astraified adventure · curated reference mission"}
            </span>
          </div>
        </main>
      )}
      {page === "create" && (
        <CreateMission onBack={() => setPage("library")} onPlay={play} />
      )}
      {page === "play" && (
        <main className="play-page">
          <div className="play-toolbar">
            <button className="text-button" onClick={() => setPage("library")}>
              <ArrowLeft size={17} /> Expedition
            </button>
            <span>{mission.title}</span>
            <div className="play-tools">
              <div className="segmented">
                <button
                  aria-label="Point and click mode"
                  className={mode === "adventure" ? "active" : ""}
                  onClick={() => setMode("adventure")}
                >
                  <MousePointer2 size={16} />
                  <span>Point & click</span>
                </button>
                <button
                  aria-label="3D explore mode"
                  className={mode === "explore" ? "active" : ""}
                  onClick={() => setMode("explore")}
                >
                  <Orbit size={17} />
                  <span>3D explore</span>
                </button>
              </div>
              <button
                className="icon-button"
                aria-label={
                  muted ? "Enable harbor ambience" : "Mute harbor ambience"
                }
                onClick={() => setMuted(!muted)}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                className="icon-button"
                aria-label="Restart expedition"
                onClick={() => setPanel("reset")}
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </div>
          <div className="game-layout">
            <section className="world-frame">
              <Suspense
                fallback={
                  <div className="world-loading">
                    <Compass size={35} />
                    <span>Arriving at Seabrook Harbor…</span>
                  </div>
                }
              >
                <HarborWorld
                  mode={mode}
                  activeStation={active}
                  completedStations={progress.completed}
                  onSelectStation={selectStation}
                  muted={muted}
                />
              </Suspense>
              <div className="world-top">
                <span className="world-location">
                  <MapPin size={15} /> Seabrook Harbor
                </span>
                <span className="world-weather">Moonrise / calm seas</span>
              </div>
              <div className="world-bottom">
                <span>
                  {mode === "adventure"
                    ? "Select a place to investigate"
                    : "Drag to look around · scroll to zoom · select a place"}
                </span>
                <button onClick={() => setPanel("notebook")}>
                  <BookOpen size={17} /> Field notebook
                </button>
              </div>
              {allDone && (
                <div className="world-complete">
                  <Flag size={20} />
                  <span>The harbor is alight again.</span>
                </div>
              )}
            </section>
            <aside className="mission-panel">
              <div className="journey-progress">
                <span>Your discoveries</span>
                <strong>
                  {progress.completed.length} of {mission.stations.length}
                </strong>
              </div>
              <div className="station-list">
                {mission.stations.map((s, index) => {
                  const done = progress.completed.includes(s.id),
                    locked =
                      index > 0 &&
                      !progress.completed.includes(
                        mission.stations[index - 1].id,
                      );
                  return (
                    <button
                      key={s.id}
                      className={`${active === s.id ? "active" : ""} ${done ? "completed" : ""}`}
                      onClick={() => selectStation(s.id)}
                      aria-label={`Visit ${s.name}`}
                      aria-disabled={locked}
                    >
                      <span>
                        {done ? (
                          <Check size={16} />
                        ) : locked ? (
                          <LockKeyhole size={14} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div>
                        <strong>{s.name}</strong>
                        <small>
                          {done
                            ? "Discovery recorded"
                            : locked
                              ? "Ahead on your journey"
                              : s.title}
                        </small>
                      </div>
                      {active === s.id && <ChevronRight size={17} />}
                    </button>
                  );
                })}
              </div>
              <div className="station-story">
                <span className="small-label">
                  {progress.completed.includes(active)
                    ? "A discovery worth revisiting"
                    : "Your next discovery"}
                </span>
                <h1>{station.title}</h1>
                <p>{station.story}</p>
                <div className="station-task">
                  <Lightbulb size={20} />
                  <p>{station.task}</p>
                </div>
                <button
                  className="button primary full-width"
                  onClick={() => setPanel("workbench")}
                >
                  <Play size={16} />
                  {station.kind === "routing"
                    ? "Open the route map"
                    : "Open the workbench"}
                </button>
                <button
                  className="text-button full-width source-small"
                  onClick={() => {
                    setSourceTab("sources");
                    setPanel("notebook");
                  }}
                >
                  <BookOpen size={15} /> Read the source behind this discovery
                </button>
              </div>
              <div className="caretaker-note">
                <span className="caretaker-avatar">I</span>
                <p>
                  “A good question is often the best tool in the workshop.”
                  <small>Iona · Harbor caretaker</small>
                </p>
              </div>
            </aside>
          </div>
        </main>
      )}
      {notice && (
        <div className="toast" role="status">
          <Lightbulb size={18} />
          {notice}
        </div>
      )}
      {panel === "workbench" && (
        <Modal title={station.name} onClose={closePanel} wide>
          <Workbench
            key={`${mission.id}:${station.id}`}
            station={station}
            onComplete={completeStation}
            onAttempt={() =>
              setProgress((p) => ({ ...p, attempts: p.attempts + 1 }))
            }
            onHint={() =>
              setProgress((p) => ({
                ...p,
                hints: p.hints + 1,
                assisted: Array.from(new Set([...p.assisted, active])),
              }))
            }
            onSupport={() =>
              setProgress((p) => ({
                ...p,
                assisted: Array.from(new Set([...p.assisted, active])),
              }))
            }
          />
        </Modal>
      )}
      {panel === "notebook" && (
        <Modal title="Your field notebook" onClose={closePanel}>
          <div className="notebook-tabs">
            <button
              className={sourceTab === "discoveries" ? "active" : ""}
              onClick={() => setSourceTab("discoveries")}
            >
              Discoveries
            </button>
            <button
              className={sourceTab === "sources" ? "active" : ""}
              onClick={() => setSourceTab("sources")}
            >
              Sources & assumptions
            </button>
          </div>
          <div className="notebook-body">
            {sourceTab === "discoveries" ? (
              <>
                {mission.stations.map((s) => (
                  <article className="discovery" key={s.id}>
                    <span
                      className={`discovery-icon ${progress.completed.includes(s.id) ? "done" : ""}`}
                    >
                      {progress.completed.includes(s.id) ? (
                        <Check size={18} />
                      ) : (
                        <Compass size={18} />
                      )}
                    </span>
                    <div>
                      <h3>{s.name}</h3>
                      <p>
                        {progress.completed.includes(s.id)
                          ? s.concept
                          : "A discovery waiting to happen."}
                      </p>
                      {progress.completed.includes(s.id) && (
                        <small>
                          {progress.assisted.includes(s.id)
                            ? "Completed with support"
                            : "Completed without hints"}
                        </small>
                      )}
                    </div>
                  </article>
                ))}
                <div className="notebook-note">
                  A successful mission is a beginning. Try the idea in a
                  different context to see what stays with you.
                </div>
              </>
            ) : (
              <>
                {mission.sources.map((source) => (
                  <article className="source-entry" key={source.id}>
                    <h3>{source.title}</h3>
                    {source.page && (
                      <span className="small-label">Page {source.page}</span>
                    )}
                    <p>{source.text}</p>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        Open source <ArrowUpRight size={14} />
                      </a>
                    )}
                  </article>
                ))}
                {mission.stations.some((s) => s.kind === "circuit") && (
                  <div className="notebook-note">
                    <strong>How this simulation works</strong>
                    <p>{CIRCUIT_ASSUMPTIONS}</p>
                  </div>
                )}
                <p className="muted">
                  The harbor and its characters are fictional. Educational
                  claims are tied to the material above.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
      {panel === "complete" && (
        <Modal title="The beacon is back" onClose={closePanel}>
          <div className="completion-body">
            <div className="completion-icon">
              <Flag size={33} />
            </div>
            <h2>You brought the harbor to life.</h2>
            <p>{mission.conclusion}</p>
            <div className="completion-stats">
              <div>
                <strong>{progress.completed.length}</strong>
                <span>discoveries</span>
              </div>
              <div>
                <strong>{progress.attempts}</strong>
                <span>experiments & checks</span>
              </div>
              <div>
                <strong>{progress.hints}</strong>
                <span>helpful nudges</span>
              </div>
            </div>
            <p className="notebook-note">
              You applied these ideas in new situations. A later challenge will
              help check what you retain.
            </p>
            <button
              className="button primary full-width"
              onClick={() => {
                setPanel(null);
                setPage("create");
              }}
            >
              <Sparkles size={17} /> Create your next adventure
            </button>
            <button className="text-button full-width" onClick={closePanel}>
              Stay and explore
            </button>
          </div>
        </Modal>
      )}
      {panel === "reset" && (
        <Modal title="Begin this expedition again?" onClose={closePanel}>
          <div className="reset-body">
            <p>
              This resets the discoveries and experiment history for this
              mission on this device.
            </p>
            <div className="workbench-footer">
              <button className="button secondary" onClick={closePanel}>
                Keep exploring
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setProgress(emptyProgress);
                  setActive("workshop");
                  setPanel(null);
                }}
              >
                Restart expedition
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
