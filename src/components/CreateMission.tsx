import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  Link2,
  LoaderCircle,
  MousePointer2,
  Orbit,
  Play,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { GameMode, MissionPackage } from "../domain/types";

const sampleSource =
  "A graph is a set of nodes connected by edges. In a weighted graph, each edge has a cost, such as distance or travel time. A route is a sequence of connected nodes. Its total cost is the sum of the costs of all edges used. The shortest path is a valid route with the lowest total cost between a start and destination. Choosing the cheapest next edge at each step does not always produce the cheapest complete route. To compare routes, add every edge cost, then compare the totals. A disconnected pair of nodes cannot be crossed directly. In an undirected graph, an edge can be traversed in either direction at the same cost.";

export default function CreateMission({
  onBack,
  onPlay,
}: {
  onBack: () => void;
  onPlay: (mission: MissionPackage, mode: GameMode) => void;
}) {
  const [input, setInput] = useState<"text" | "url" | "file">("text"),
    [sourceText, setSourceText] = useState(""),
    [sourceUrl, setSourceUrl] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState(""),
    [level, setLevel] = useState("High school"),
    [mode, setMode] = useState<GameMode>("adventure");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mission, setMission] = useState<MissionPackage | null>(null),
    [warnings, setWarnings] = useState<string[]>([]),
    [configured, setConfigured] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((x) => setConfigured(x.configured))
      .catch(() => setConfigured(false));
    return () => abort.current?.abort();
  }, []);
  async function generate() {
    setBusy(true);
    setError("");
    setMission(null);
    setWarnings([]);
    const form = new FormData();
    form.set("topic", topic);
    form.set("level", level);
    form.set("mode", mode);
    if (input === "text") form.set("sourceText", sourceText);
    if (input === "url") form.set("sourceUrl", sourceUrl);
    if (input === "file" && file) form.set("file", file);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 125000);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message ||
            data.error ||
            data.message ||
            "The mission could not be generated.",
        );
      setMission(data.mission);
      setWarnings(data.warnings || []);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "Generation stopped. Your source is still here when you’re ready to try again."
          : e instanceof Error
            ? e.message
            : "Generation failed. Please try again.",
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      abort.current = null;
    }
  }
  const ready =
    input === "text"
      ? sourceText.trim().length >= 120
      : input === "url"
        ? sourceUrl.trim().startsWith("http")
        : !!file;
  return (
    <main className="creator-page">
      <button className="text-button back-link" onClick={onBack}>
        <ArrowLeft size={17} /> Back to adventures
      </button>
      <div className="creator-heading">
        <div>
          <h1>What will your next world teach?</h1>
          <p>Bring the material. Give the adventure a direction.</p>
        </div>
        <span className="status-pill">
          <span className="status-dot" /> Early access
        </span>
      </div>
      <div className="creator-grid">
        <section className="creator-form">
          <div className="form-section">
            <div className="section-title">
              <BookOpen size={21} />
              <h2>Start with a source</h2>
            </div>
            <p>
              A short chapter or explanation works best. This first version
              supports circuits and weighted routes.
            </p>
            <div className="input-tabs" role="tablist" aria-label="Source type">
              {(
                [
                  { id: "text", label: "Paste text", icon: FileText },
                  { id: "url", label: "Add a link", icon: Link2 },
                  { id: "file", label: "Upload a file", icon: Upload },
                ] as const
              ).map((item) => (
                <button
                  role="tab"
                  aria-selected={input === item.id}
                  className={input === item.id ? "active" : ""}
                  key={item.id}
                  disabled={busy}
                  onClick={() => setInput(item.id)}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
            {input === "text" && (
              <>
                <label className="sr-only" htmlFor="source-text">
                  Source material
                </label>
                <textarea
                  id="source-text"
                  className="source-text"
                  placeholder="Paste a concept, passage, or lesson you want to turn into an adventure…"
                  value={sourceText}
                  disabled={busy}
                  onChange={(e) => setSourceText(e.target.value)}
                />
                <div className="input-help">
                  <span>{sourceText.length.toLocaleString()} characters</span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setSourceText(sampleSource);
                      setTopic("Finding the shortest route");
                    }}
                  >
                    Try a sample about routes
                  </button>
                </div>
              </>
            )}
            {input === "url" && (
              <div className="url-input">
                <label htmlFor="source-url">Public webpage URL</label>
                <input
                  id="source-url"
                  type="url"
                  placeholder="https://…"
                  value={sourceUrl}
                  disabled={busy}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
                <p>
                  Use a public article or lesson. Sign-in pages aren’t
                  supported.
                </p>
              </div>
            )}
            {input === "file" && (
              <label className="upload-area">
                <Upload size={30} />
                <strong>{file ? file.name : "Choose your source file"}</strong>
                <span>PDF, Markdown, or text · up to 10 MB</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 10 * 1024 * 1024) {
                      setError("Choose a file smaller than 10 MB.");
                      return;
                    }
                    setFile(f ?? null);
                  }}
                />
              </label>
            )}
          </div>
          <div className="form-section">
            <div className="section-title">
              <Sparkles size={21} />
              <h2>Shape the adventure</h2>
            </div>
            <div className="form-row">
              <label>
                Focus, if you have one
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Why parallel circuits keep working"
                  disabled={busy}
                />
              </label>
              <label>
                Learner level
                <select
                  value={level}
                  disabled={busy}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option>High school</option>
                  <option>College introductory</option>
                  <option>Curious beginner</option>
                </select>
              </label>
            </div>
            <div className="mode-options">
              {(
                [
                  {
                    id: "adventure",
                    title: "Point & click",
                    text: "Investigate, connect clues, and experiment.",
                    icon: MousePointer2,
                  },
                  {
                    id: "explore",
                    title: "Explore in 3D",
                    text: "Move around a small world of discoveries.",
                    icon: Orbit,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  className={`mode-option ${mode === item.id ? "selected" : ""}`}
                  disabled={busy}
                  onClick={() => setMode(item.id)}
                >
                  <item.icon size={23} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                  {mode === item.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          {configured === false && (
            <p className="error-message">
              The generation service is unavailable or has no API key. The
              harbor adventure is still ready to play.
            </p>
          )}
          <div className="generate-footer">
            <p>
              Creates a new mission in the harbor world.
              <br />
              Your sources stay linked to its learning objectives.
            </p>
            {busy ? (
              <button
                className="button secondary"
                onClick={() => abort.current?.abort()}
              >
                <X size={16} /> Cancel
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!ready || configured === false}
                onClick={generate}
              >
                <Sparkles size={17} /> Create adventure
              </button>
            )}
          </div>
        </section>
        <aside className="creation-preview">
          {busy ? (
            <div className="generation-status" role="status">
              <div className="generation-orb">
                <LoaderCircle size={38} />
              </div>
              <h2>A new adventure is taking shape</h2>
              <p>
                Astra is reading your material and designing the mission. The
                result is checked for supported mechanics and source references.
              </p>
              <span>This usually takes a minute or two.</span>
            </div>
          ) : mission ? (
            <>
              <div className="preview-art">
                <img
                  src="/harbor-key-art.png"
                  alt="Lighthouse overlooking the harbor"
                />
                <span className="status-pill">
                  <Check size={14} /> Mission ready
                </span>
              </div>
              <div className="preview-content">
                <p className="small-label">Your new adventure</p>
                <h2>{mission.title}</h2>
                <p>{mission.description}</p>
                <h3>What you’ll explore</h3>
                <ul className="learning-list">
                  {mission.objectives.map((o) => (
                    <li key={o.id}>
                      <Check size={16} />
                      {o.title}
                    </li>
                  ))}
                </ul>
                <p className="source-count">
                  {mission.sources.length} source excerpts ·{" "}
                  {mission.stations.length} discoveries
                </p>
                {warnings.map((warning, index) => (
                  <p className="hint-note" key={index}>
                    {warning}
                  </p>
                ))}
                <button
                  className="button primary full-width"
                  onClick={() => onPlay(mission, mode)}
                >
                  <Play size={17} /> Play your adventure
                </button>
              </div>
            </>
          ) : (
            <div className="preview-empty">
              <div className="preview-art">
                <img
                  src="/harbor-key-art.png"
                  alt="A moonlit harbor with a workshop and lighthouse"
                />
              </div>
              <div className="preview-content">
                <p className="small-label">From understanding to adventure</p>
                <h2>
                  A small world.
                  <br />
                  An idea that stays.
                </h2>
                <p>
                  Your mission will have a story, experiments, helpful nudges,
                  and a new situation to test what you’ve learned.
                </p>
                <div className="creation-flow">
                  <span>Source</span>
                  <i>→</i>
                  <span>Discoveries</span>
                  <i>→</i>
                  <span>Adventure</span>
                </div>
                <p className="muted">
                  The harbor is our first reusable setting. New subjects change
                  its story and puzzles.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
