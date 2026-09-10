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
} from "lucide-react";
import type { EpisodePackage } from "./episodes/types";
import type { EpisodeJobView } from "../server/episode-jobs";
import { validateEpisodePackage } from "./episodes/schema";
import { TRANSFORMER_REFERENCE } from "./episodes/reference";
import {
  TRANSFORMER_SOURCE_URL,
  TRANSFORMER_STARTER,
} from "./episodes/starter-source";
import EpisodePlayer from "./episodes/Player";
import { EpisodeArt } from "./episodes/EpisodeArt";
import "./episodes/episodes.css";

const LIBRARY_KEY = "astraified:episodes:library:v1";
const JOB_KEY = "astraified:episodes:job:v1";
function apiError(data: { error?: unknown }, fallback: string): string {
  if (typeof data.error === "string") return data.error;
  if (
    data.error &&
    typeof data.error === "object" &&
    "message" in data.error &&
    typeof data.error.message === "string"
  )
    return data.error.message;
  return fallback;
}
function readLibrary(): EpisodePackage[] {
  try {
    const data = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
    if (!Array.isArray(data) || data.length > 6) return [];
    return data
      .map((p) => validateEpisodePackage(p))
      .filter((r) => r.valid)
      .map((r) => r.package!);
  } catch {
    return [];
  }
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
  story: "Writing the mystery",
  validation: "Checking the case",
  ready: "Your adventure is ready",
};

export default function EpisodeStudio({ onBack }: { onBack: () => void }) {
  const [library, setLibrary] = useState(readLibrary);
  const [playing, setPlaying] = useState<EpisodePackage | null>(null);
  const [sourceMode, setSourceMode] = useState<"text" | "url" | "file">("text");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState("High school / introductory college");
  const [topic, setTopic] = useState(
    "Transformer neural networks: sequence position, attention, and causal masking",
  );
  const [jobId, setJobId] = useState(savedJob);
  const [job, setJob] = useState<EpisodeJobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedError, setSavedError] = useState("");
  const [pollRetry, setPollRetry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const addToLibrary = (episode: EpisodePackage) => {
    setLibrary((previous) => {
      const next = [
        episode,
        ...previous.filter((p) => p.id !== episode.id),
      ].slice(0, 6);
      try {
        const serialized = JSON.stringify(next);
        if (serialized.length > 3_000_000) throw new Error();
        localStorage.setItem(LIBRARY_KEY, serialized);
        setSavedError("");
      } catch {
        setSavedError(
          "This adventure is ready, but your browser could not save the library. Keep this page open to play.",
        );
      }
      return next;
    });
  };
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(
          `/api/episodes/jobs/${encodeURIComponent(jobId!)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            apiError(data, "Could not read the adventure’s progress."),
          );
        if (stopped) return;
        const next = data.job as EpisodeJobView;
        setJob(next);
        setError("");
        if (next.status === "ready" && next.episode) addToLibrary(next.episode);
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
  }, [jobId, pollRetry]);
  function rememberJob(next: EpisodeJobView) {
    setJob(next);
    setJobId(next.id);
    try {
      localStorage.setItem(JOB_KEY, next.id);
    } catch {}
    setPollRetry((n) => n + 1);
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const body = new FormData();
    body.set("topic", topic);
    body.set("level", level);
    if (sourceMode === "text") body.set("sourceText", sourceText);
    if (sourceMode === "url") body.set("sourceUrl", sourceUrl);
    if (sourceMode === "file" && file) body.set("file", file);
    try {
      const response = await fetch("/api/episodes/jobs", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(apiError(data, "Could not start your adventure."));
      rememberJob(data.job);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not start your adventure.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeJob(action: "cancel" | "resume") {
    if (!jobId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/episodes/jobs/${encodeURIComponent(jobId)}/${action}`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(apiError(data, `Could not ${action} the adventure.`));
      rememberJob(data.job);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const running = !!job && !terminal(job);
  const sourceReady =
    sourceMode === "text"
      ? sourceText.trim().length >= 120
      : sourceMode === "url"
        ? /^https?:\/\//i.test(sourceUrl)
        : !!file;
  if (playing)
    return (
      <EpisodePlayer
        key={`${playing.id}:${playing.revision}`}
        episode={playing}
        onHome={() => setPlaying(null)}
      />
    );
  return (
    <div className="ep-app ep-studio">
      <header className="ep-topbar">
        <button className="ep-home" onClick={onBack}>
          <ArrowLeft size={17} />
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
              Bring a source. Follow it into a mystery of curious characters,
              useful discoveries, and things worth figuring out.
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
            <h2>Cases worth opening</h2>
            <span>Point & click adventures</span>
          </div>
          <div className="ep-case-list">
            {[...library, TRANSFORMER_REFERENCE].map((episode) => (
              <article key={episode.id} className="ep-case">
                <button
                  className="ep-case-art"
                  onClick={() => setPlaying(episode)}
                  aria-label={`Play ${episode.title}`}
                >
                  <img
                    src={`/adventure/${episode.scenes[0].background}.png`}
                    alt=""
                  />
                  <span>
                    <ArrowRight />
                  </span>
                </button>
                <div>
                  <span className="ep-case-kind">
                    {episode.generated
                      ? "Generated from your source"
                      : "Authored Transformer reference"}
                  </span>
                  <h3>{episode.title}</h3>
                  <p>{episode.subtitle}</p>
                  <button
                    className="ep-text-button"
                    onClick={() => setPlaying(episode)}
                  >
                    Open the case <ArrowRight size={16} />
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
              <Sparkles size={16} /> A new case
            </span>
            <h2>What shall we discover?</h2>
            <p>
              Start with a focused explanation of transformers. This first
              generator covers sequence position, attention, and causal masking.
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
                    onClick={() => setSourceText(TRANSFORMER_STARTER)}
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
                <button
                  className="ep-source-example"
                  type="button"
                  onClick={() => setSourceUrl(TRANSFORMER_SOURCE_URL)}
                >
                  Use Attention Is All You Need
                </button>
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
            <label htmlFor="ep-focus">Focus</label>
            <input
              id="ep-focus"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
            />
            <label htmlFor="ep-level">Who is playing?</label>
            <select
              id="ep-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option>High school / introductory college</option>
              <option>College computer science</option>
              <option>Curious beginner with basic algebra</option>
            </select>
            <p className="ep-small ep-source-disclosure">
              Creating sends extracted text to OpenAI using your configured API
              credits. A focused episode uses up to 24,000 source characters.
              Completed stages are kept on this computer so interrupted work can
              resume. This version creates new cases using the Bramble Bay art
              set and three reviewed Transformer instruments.
            </p>
            <button
              className="ep-primary ep-generate"
              type="submit"
              disabled={busy || running || !sourceReady}
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
            {library.length >= 6 && (
              <p className="ep-small">
                This browser keeps your six most recent generated adventures.
                Creating another will replace the oldest case in this library.
              </p>
            )}
          </form>
          <aside className="ep-generation-side">
            {job ? (
              <section className="ep-job" aria-live="polite">
                <span className="ep-eyebrow">Your next adventure</span>
                <h2>
                  {job.status === "ready"
                    ? "A new mystery awaits."
                    : job.status === "cancelled"
                      ? "Paused where you left it."
                      : job.status === "interrupted"
                        ? "Your work is still here."
                        : job.status === "failed"
                          ? "This case needs another look."
                          : stageLabel[job.stage]}
                </h2>
                <ol className="ep-job-stages">
                  {(["learning", "story", "validation", "ready"] as const).map(
                    (stage, index) => {
                      const current = [
                        "learning",
                        "story",
                        "validation",
                        "ready",
                      ].indexOf(job.stage);
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
                    },
                  )}
                </ol>
                <progress
                  value={job.progress}
                  max={100}
                  aria-label="Adventure generation progress"
                />
                {job.learningPlan && (
                  <div className="ep-learning-preview">
                    <h3>The ideas in your case</h3>
                    <ul>
                      {job.learningPlan.objectives.map((o) => (
                        <li key={o.family}>{o.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.warnings.map((warning, index) => (
                  <p className="ep-small" key={index}>
                    {warning}
                  </p>
                ))}
                {job.error && (
                  <p className="ep-error" role="alert">
                    {job.error.message}
                  </p>
                )}
                <div className="ep-button-row">
                  {running && (
                    <button
                      className="ep-secondary"
                      disabled={busy}
                      onClick={() => changeJob("cancel")}
                    >
                      Stop generation
                    </button>
                  )}
                  {job.resumable && (
                    <button
                      className="ep-primary"
                      disabled={busy}
                      onClick={() => changeJob("resume")}
                    >
                      Resume from saved work
                    </button>
                  )}
                  {job.status === "ready" && job.episode && (
                    <button
                      className="ep-primary"
                      onClick={() => setPlaying(job.episode!)}
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
                  Play the reference case first to see where we’re headed, or
                  bring a source and make a mystery of your own.
                </p>
              </section>
            )}
            {error && (
              <div className="ep-error" role="alert">
                <p>{error}</p>
                {jobId && (
                  <button
                    className="ep-secondary"
                    onClick={() => setPollRetry((n) => n + 1)}
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
          Return to Bramble Bay
        </button>
      </footer>
    </div>
  );
}
