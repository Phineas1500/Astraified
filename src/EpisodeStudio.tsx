import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Link,
  Upload,
  Sparkles,
  Check,
  LoaderCircle,
  Box,
  MousePointer2,
} from "lucide-react";
import type { EpisodeJobView } from "../server/episode-jobs";
import { validateGamePackage } from "./games/schema";
import { isFeaturedGame, studioGames } from "./games/catalog";
import {
  gameIdentity,
  gameRevisionKey,
  type GameFormat,
  type GamePackage,
} from "./games/types";
import {
  addGameToLibrary,
  readGameLibrary,
  isGeneratedGame,
  GAME_LIBRARY_KEY,
  LEGACY_EPISODE_LIBRARY_KEY,
  MAX_SAVED_GAMES,
} from "./games/library";
import {
  TRANSFORMER_SOURCE_URL,
  TRANSFORMER_STARTER,
} from "./episodes/starter-source";
import GamePlayer from "./games/Player";
import { EpisodeArt } from "./episodes/EpisodeArt";
import { GeneratorConnection } from "./games/GeneratorConnection";
import { useGeneratorConnection } from "./games/useGeneratorConnection";
import "./episodes/episodes.css";
import "./games/studio.css";

const JOB_KEY = "astraified:episodes:job:v1";
function responseJob(data: Record<string, unknown>): EpisodeJobView {
  const job = data.job as EpisodeJobView | undefined;
  if (
    !job ||
    typeof job.id !== "string" ||
    !Array.isArray(job.warnings) ||
    !job.usage ||
    ![
      "queued",
      "running",
      "ready",
      "failed",
      "cancelled",
      "interrupted",
    ].includes(job.status)
  )
    throw new Error(
      "The generator returned an unreadable progress update. Please check again.",
    );
  return job;
}
function readLibrary(): GamePackage[] {
  try {
    return readGameLibrary(
      localStorage.getItem(GAME_LIBRARY_KEY),
      localStorage.getItem(LEGACY_EPISODE_LIBRARY_KEY),
    );
  } catch {
    return [];
  }
}
function gameFromJob(job: EpisodeJobView): GamePackage | null {
  const raw =
    job.game ??
    ((!job.format || job.format === "point-and-click") && job.episode
      ? { version: 1, format: "point-and-click", episode: job.episode }
      : null);
  return validateGamePackage(raw).game ?? null;
}
function savedJob() {
  try {
    return localStorage.getItem(JOB_KEY);
  } catch {
    return null;
  }
}
const terminal = (job: EpisodeJobView) =>
  ["ready", "failed", "cancelled", "interrupted"].includes(job.status);
const stageLabel = {
  source: "Reading your source",
  learning: "Finding the ideas worth playing",
  mechanics: "Building your experiments",
  story: "Building your adventure",
  validation: "Checking the playable route",
  review: "Reviewing the lesson against your source",
  ready: "Your adventure is ready",
};

export default function EpisodeStudio({ onBack }: { onBack: () => void }) {
  const [library, setLibrary] = useState(readLibrary);
  const libraryRef = useRef(library);
  const [playing, setPlaying] = useState<GamePackage | null>(null);
  const [format, setFormat] = useState<GameFormat>("3d");
  const [readyGame, setReadyGame] = useState<GamePackage | null>(null);
  const [sourceMode, setSourceMode] = useState<"text" | "url" | "file">("text");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState("Curious beginner (no prior knowledge)");
  const [topic, setTopic] = useState("");
  const [jobId, setJobId] = useState(savedJob);
  const [job, setJob] = useState<EpisodeJobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedError, setSavedError] = useState("");
  const [pollRetry, setPollRetry] = useState(0);
  const connection = useGeneratorConnection();
  const { request: generatorRequest, status: generatorStatus } = connection;
  const formRef = useRef<HTMLFormElement>(null);
  const addToLibrary = (game: GamePackage) => {
    const next = addGameToLibrary(libraryRef.current, game);
    libraryRef.current = next;
    setLibrary(next);
    try {
      if (!next.some((entry) => gameIdentity(entry) === gameIdentity(game)))
        throw new Error();
      localStorage.setItem(GAME_LIBRARY_KEY, JSON.stringify(next));
      setSavedError("");
    } catch {
      setSavedError(
        "This adventure is ready, but your browser could not save the library. Keep this page open to play.",
      );
    }
  };
  useEffect(() => {
    if (!jobId || generatorStatus !== "online") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      try {
        const data = await generatorRequest(
          `/api/episodes/jobs/${encodeURIComponent(jobId!)}`,
          { signal: controller.signal },
        );
        if (stopped) return;
        const next = responseJob(data);
        setJob(next);
        setError("");
        if (next.status === "ready") {
          const completed = gameFromJob(next);
          setReadyGame(completed);
          if (completed) addToLibrary(completed);
          else
            setError(
              "This job finished, but its game could not be validated. Your earlier adventures remain in the library.",
            );
        } else setReadyGame(null);
        if (!terminal(next)) timer = setTimeout(poll, 1800);
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Could not reconnect to this adventure.",
          );
      }
    }
    poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, pollRetry, generatorStatus, generatorRequest]);
  function rememberJob(next: EpisodeJobView) {
    setJob(next);
    setJobId(next.id);
    setReadyGame(next.status === "ready" ? gameFromJob(next) : null);
    try {
      localStorage.setItem(JOB_KEY, next.id);
    } catch {}
    setPollRetry((n) => n + 1);
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (generatorStatus !== "online" || busy || (job && !terminal(job))) return;
    setError("");
    setBusy(true);
    const body = new FormData();
    body.set("topic", topic);
    body.set("level", level);
    body.set("format", format);
    if (sourceMode === "text") body.set("sourceText", sourceText);
    if (sourceMode === "url") body.set("sourceUrl", sourceUrl);
    if (sourceMode === "file" && file) body.set("file", file);
    try {
      const data = await generatorRequest(
        "/api/episodes/jobs",
        { method: "POST", body },
        120_000,
      );
      rememberJob(responseJob(data));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start your adventure.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeJob(action: "cancel" | "resume") {
    if (!jobId || generatorStatus !== "online") return;
    setBusy(true);
    setError("");
    try {
      const data = await generatorRequest(
        `/api/episodes/jobs/${encodeURIComponent(jobId)}/${action}`,
        { method: "POST" },
      );
      rememberJob(responseJob(data));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const running = !!job && !terminal(job);
  const jobStages =
    job?.pipeline === "general-v1" || job?.pipeline === "harbor-v1"
      ? ([
          "learning",
          "mechanics",
          "story",
          "validation",
          "review",
          "ready",
        ] as const)
      : (["learning", "story", "validation", "ready"] as const);
  const sourceReady =
    sourceMode === "text"
      ? sourceText.trim().length >= 120
      : sourceMode === "url"
        ? /^https?:\/\//i.test(sourceUrl)
        : !!file;
  if (playing)
    return (
      <GamePlayer
        key={gameRevisionKey(playing)}
        game={playing}
        onHome={() => setPlaying(null)}
      />
    );
  return (
    <div className="ep-app ep-studio">
      <header className="ep-topbar">
        <button
          className="ep-home"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Astraified home"
        >
          <span>astraified.</span>
        </button>
        <button
          className="ep-secondary"
          onClick={() =>
            formRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
        >
          Create an adventure <Sparkles size={15} />
        </button>
      </header>
      <main>
        <section className="ep-studio-intro">
          <div>
            <span className="ep-eyebrow">
              <BookOpen size={16} /> The adventure studio
            </span>
            <h1>
              Give an idea
              <br />
              somewhere to go.
            </h1>
            <p>
              Bring a source. Explore it through curious characters, useful
              discoveries, and ideas you can put to work.
            </p>
            <a
              href="#ep-create"
              onClick={(e) => {
                e.preventDefault();
                formRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Start with your material <ArrowRight size={16} />
            </a>
          </div>
          <div className="ep-studio-illustration">
            <img
              src="/adventure/workshop.png"
              alt="A warm harbor workshop full of curious machinery"
            />
            <div className="ep-illustration-prop">
              <EpisodeArt icon="machine" active />
            </div>
            <span className="ep-illustration-note">
              A good idea deserves
              <br />a little adventure.
            </span>
          </div>
        </section>
        <section className="ep-library" aria-label="Your adventures">
          <div className="ep-section-title">
            <h2>Your next adventure</h2>
            <span>3D exploration & point-and-click mysteries</span>
          </div>
          <div className="ep-case-list">
            {studioGames(library).map((game) => (
              <article key={gameIdentity(game)} className="ep-case">
                <button
                  className="ep-case-art"
                  onClick={() => setPlaying(game)}
                  aria-label={`Play ${game.episode.title}`}
                >
                  <img
                    src={
                      game.format === "3d"
                        ? "/harbor-key-art.png"
                        : `/adventure/${game.episode.scenes[0].background}.png`
                    }
                    alt=""
                  />
                  <span>
                    <ArrowRight />
                  </span>
                </button>
                <div>
                  <span className="ep-format-badge">
                    {game.format === "3d" ? (
                      <Box size={13} />
                    ) : (
                      <MousePointer2 size={13} />
                    )}
                    {game.format === "3d" ? "3D exploration" : "Point & click"}
                  </span>
                  <span className="ep-case-kind">
                    {isFeaturedGame(game)
                      ? "Featured generated adventure"
                      : isGeneratedGame(game)
                      ? "Generated from your source"
                      : "Authored adventure"}
                  </span>
                  <h3>{game.episode.title}</h3>
                  <p>{game.episode.subtitle}</p>
                  <button
                    className="ep-text-button"
                    onClick={() => setPlaying(game)}
                  >
                    Play adventure <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="ep-creation-layout">
          <form
            id="ep-create"
            ref={formRef}
            className="ep-source-form"
            onSubmit={generate}
          >
            <span className="ep-eyebrow">
              <Sparkles size={16} /> A new adventure
            </span>
            <h2>What shall we discover?</h2>
            <p>
              Bring a chapter, article, or set of notes on a topic you want to
              understand. Choose how you want to play, then give your adventure
              something worth discovering.
            </p>
            <GeneratorConnection connection={connection} />
            <fieldset className="ep-format-picker">
              <legend>How would you like to play?</legend>
              {(
                [
                  [
                    "3d",
                    "3D exploration",
                    "Walk around an island, meet its residents, and handle objects.",
                    Box,
                  ],
                  [
                    "point-and-click",
                    "Point & click",
                    "Explore illustrated rooms, gather clues, and solve a mystery.",
                    MousePointer2,
                  ],
                ] as const
              ).map(([value, label, description, Icon]) => (
                <label
                  key={value}
                  className={format === value ? "ep-format-selected" : ""}
                >
                  <input
                    type="radio"
                    name="game-format"
                    value={value}
                    checked={format === value}
                    onChange={() => setFormat(value)}
                  />
                  <Icon size={21} />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="ep-small ep-format-note">
              Start with the basics: short explanations, one thing to try at a
              time, and a gentle follow-up to help it stick.{" "}
              {format === "3d"
                ? "Explore one idea in the shared harbor world."
                : "Discover two small, connected ideas as you solve the mystery."}
            </p>
            <div
              className="ep-source-tabs"
              role="tablist"
              aria-label="Source type"
            >
              {(
                [
                  ["text", "Paste text", FileText],
                  ["url", "Add a link", Link],
                  ["file", "Upload a file", Upload],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  type="button"
                  key={id}
                  role="tab"
                  aria-selected={sourceMode === id}
                  onClick={() => setSourceMode(id)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            {sourceMode === "text" && (
              <>
                <label htmlFor="ep-source">Source material</label>
                <textarea
                  id="ep-source"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  maxLength={70000}
                  placeholder="Paste a chapter, your notes, or an explanation you want to explore…"
                  rows={9}
                />
                <div className="ep-source-meta">
                  <span>{sourceText.length.toLocaleString()} characters</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceText(TRANSFORMER_STARTER);
                      setTopic("Transformer neural networks");
                    }}
                  >
                    Use Transformer starter notes
                  </button>
                </div>
              </>
            )}
            {sourceMode === "url" && (
              <>
                <label htmlFor="ep-url">Public source link</label>
                <input
                  id="ep-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                />
                <div className="ep-button-row">
                  {[
                    [
                      "Explore derivatives",
                      "https://openstax.org/books/calculus-volume-1/pages/3-1-defining-the-derivative",
                      "Derivatives: instantaneous rate of change and tangent slopes",
                    ],
                    [
                      "Explore the Constitution",
                      "https://www.archives.gov/founding-docs/constitution/what-does-it-say",
                      "The US Constitution: three branches and checks and balances",
                    ],
                    [
                      "Explore Transformers",
                      TRANSFORMER_SOURCE_URL,
                      "Transformer neural networks",
                    ],
                  ].map(([label, url, focus]) => (
                    <button
                      className="ep-source-example"
                      type="button"
                      key={url}
                      onClick={() => {
                        setSourceUrl(url);
                        setTopic(focus);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="ep-small">
                  Readable public pages and text PDFs. Pages requiring sign-in
                  are not supported.
                </p>
              </>
            )}
            {sourceMode === "file" && (
              <>
                <label className="ep-file-drop" htmlFor="ep-file">
                  <Upload size={28} />
                  <strong>{file ? file.name : "Choose a document"}</strong>
                  <span>PDF, Markdown, or plain text · up to 10 MB</span>
                  <input
                    id="ep-file"
                    type="file"
                    accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="ep-small">
                  Text PDFs, up to 60 pages. Scanned pages and diagrams need a
                  readable text explanation for this version.
                </p>
              </>
            )}
            <label htmlFor="ep-focus">Focus (optional)</label>
            <input
              id="ep-focus"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              placeholder="What would you most like to understand?"
            />
            <label htmlFor="ep-level">Your starting point</label>
            <select
              id="ep-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option>Curious beginner (no prior knowledge)</option>
              <option>High school / introductory college</option>
              <option>College level</option>
              <option>Curious beginner with basic algebra</option>
            </select>
            <p className="ep-small ep-source-disclosure">
              Creating sends extracted text to OpenAI using the host’s
              configured API credits. A focused episode uses up to 24,000 source
              characters. Generation can take several minutes; refreshing this
              page does not cancel an accepted job. Completed stages are saved
              by the generator so interrupted work can resume.{" "}
              {format === "3d"
                ? "3D adventures share a harbor world"
                : "Point-and-click adventures share the Bramble Bay art set"}
              , with activities designed from your source. A focused chapter
              works best; a whole course needs several adventures.
            </p>
            <button
              className="ep-primary ep-generate"
              type="submit"
              disabled={
                busy || running || !sourceReady || generatorStatus !== "online"
              }
            >
              {busy ? (
                <LoaderCircle className="ep-spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}{" "}
              {busy
                ? "Reading your source…"
                : running
                  ? "An adventure is taking shape"
                  : "Create my adventure"}
            </button>
            {library.length >= MAX_SAVED_GAMES && (
              <p className="ep-small">
                This browser keeps your six most recent generated adventures.
                Creating another will replace the oldest generated game in this
                library.
              </p>
            )}
          </form>
          <aside className="ep-generation-side">
            {job ? (
              <section className="ep-job" aria-live="polite">
                <span className="ep-eyebrow">
                  Your next{" "}
                  {job.format === "3d" || job.pipeline === "harbor-v1"
                    ? "3D "
                    : ""}
                  adventure
                </span>
                <h2>
                  {job.status === "ready"
                    ? "Your adventure awaits."
                    : job.status === "cancelled"
                      ? "Paused where you left it."
                      : job.status === "interrupted"
                        ? "Your work is still here."
                        : job.status === "failed"
                          ? "This adventure needs another look."
                          : stageLabel[job.stage]}
                </h2>
                {running && generatorStatus !== "online" && (
                  <p className="ep-small">
                    {generatorStatus === "locked"
                      ? "Unlock creation to check this adventure’s progress again."
                      : "Progress updates are paused. We’ll check this adventure again when the workshop reconnects."}
                  </p>
                )}
                <ol className="ep-job-stages">
                  {jobStages.map((stage, index) => {
                    const current = (jobStages as readonly string[]).indexOf(
                      job.stage,
                    );
                    return (
                      <li
                        className={
                          index < current || job.status === "ready"
                            ? "ep-stage-done"
                            : index === current
                              ? "ep-stage-current"
                              : ""
                        }
                        key={stage}
                      >
                        <span>
                          {index < current || job.status === "ready" ? (
                            <Check size={15} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        {stageLabel[stage]}
                      </li>
                    );
                  })}
                </ol>
                <progress
                  value={job.progress}
                  max={100}
                  aria-label="Adventure generation progress"
                />
                {job.learningPlan && (
                  <div className="ep-learning-preview">
                    <h3>The ideas in your adventure</h3>
                    <ul>
                      {job.learningPlan.objectives.map((o) => (
                        <li key={"id" in o ? o.id : o.family}>{o.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.warnings.map((warning, index) => (
                  <p className="ep-small" key={index}>
                    {warning}
                  </p>
                ))}
                {readyGame &&
                  "generation" in readyGame.episode &&
                  readyGame.episode.generation?.review && (
                    <details className="ep-usage">
                      <summary>Lesson review</summary>
                      <p>{readyGame.episode.generation.review.summary}</p>
                      <p>
                        AI review checks the lesson against the source. It does
                        not replace an instructor’s review or establish mastery.
                      </p>
                    </details>
                  )}
                {job.error && (
                  <p className="ep-error" role="alert">
                    {job.error.message}
                  </p>
                )}
                <div className="ep-button-row">
                  {running && (
                    <button
                      className="ep-secondary"
                      disabled={busy || generatorStatus !== "online"}
                      onClick={() => changeJob("cancel")}
                    >
                      Stop generation
                    </button>
                  )}
                  {job.resumable && (
                    <button
                      className="ep-primary"
                      disabled={busy || generatorStatus !== "online"}
                      onClick={() => changeJob("resume")}
                    >
                      Resume from saved work
                    </button>
                  )}
                  {job.status === "ready" && readyGame && (
                    <button
                      className="ep-primary"
                      onClick={() => setPlaying(readyGame)}
                    >
                      Play your adventure <ArrowRight size={16} />
                    </button>
                  )}
                </div>
                {job.usage.totalTokens > 0 && (
                  <details className="ep-usage">
                    <summary>Generation details</summary>
                    <p>
                      {job.usage.inputTokens.toLocaleString()} input tokens ·{" "}
                      {job.usage.outputTokens.toLocaleString()} output tokens.
                      Reported completed calls only; cancelled calls may also
                      incur usage.
                    </p>
                  </details>
                )}
              </section>
            ) : (
              <section className="ep-making-note">
                <EpisodeArt icon="cartridge" />
                <h2>Understanding becomes a useful tool.</h2>
                <p>
                  The source shapes what you investigate. Characters give you
                  reasons to care. The instruments let you try an idea and see
                  what changes.
                </p>
                <p>
                  Try an authored adventure from the library, or bring a source
                  and make something of your own.
                </p>
              </section>
            )}
            {error && (
              <div className="ep-error" role="alert">
                <p>{error}</p>
                {jobId && (
                  <button
                    className="ep-secondary"
                    onClick={() => {
                      setPollRetry((n) => n + 1);
                      void connection.check();
                    }}
                  >
                    Check progress again
                  </button>
                )}
              </div>
            )}
            {savedError && (
              <p className="ep-error" role="alert">
                {savedError}
              </p>
            )}
          </aside>
        </section>
      </main>
      <footer className="ep-studio-footer">
        Made for curiosity. Grounded in your sources.
        <button className="ep-text-button" onClick={onBack}>
          Play the original Bramble Bay demo
        </button>
      </footer>
    </div>
  );
}
