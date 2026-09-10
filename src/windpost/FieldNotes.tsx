import { BookOpen, Check, Compass, Mail, Package } from "lucide-react";
import {
  type EpisodeFixture,
  type SiteId,
  stationConfig,
  stationRound,
} from "./episodes";
import {
  learningStatus,
  questGoal,
  type EpisodeProgress,
  type RecordedTrial,
} from "./runtime";
import { formatStationReading } from "./readout-format";

export function SourceLink({
  episode,
  id,
}: {
  episode: EpisodeFixture;
  id: string;
}) {
  const source = episode.sources.find((entry) => entry.id === id);
  return source?.url ? (
    <a href={source.url} target="_blank" rel="noreferrer">
      {source.title} ↗
    </a>
  ) : source ? (
    <span>{source.title}</span>
  ) : null;
}

function arrangement(
  episode: EpisodeFixture,
  site: SiteId,
  trial: RecordedTrial,
) {
  const binding = episode.scene.stations[site];
  if ("assignment" in trial)
    return `${trial.assignment.filter(Boolean).length} cards placed`;
  if (binding.kind === "evidence-crates") return "Source cards";
  const config = stationConfig(episode, site);
  const formatChoice = (id: string) => {
    const control = config.controls.find((entry) => entry.id === id);
    const value = trial.inputs[id];
    return control?.kind === "choice"
      ? (control.options.find((entry) => entry.value === value)?.label ??
          String(value))
      : String(value);
  };
  return [
    formatChoice(binding.socketInput),
    ...(binding.prediction ? [formatChoice(binding.prediction.inputId)] : []),
  ].join(" · ");
}

function EvidenceNotes({
  episode,
  game,
  site,
}: {
  episode: EpisodeFixture;
  game: EpisodeProgress;
  site: SiteId;
}) {
  const binding = episode.scene.stations[site],
    round = stationRound(episode, site);
  const baselineRaw = game.observations[site];
  const baseline =
    baselineRaw && "assignment" in baselineRaw ? baselineRaw : null;
  const latestRaw = game.trials
    .filter((trial) => trial.mechanism === site)
    .at(-1)?.evidence;
  const latest = latestRaw && "assignment" in latestRaw ? latestRaw : null;
  const binName = (id: string | null | undefined) =>
    id
      ? (round.slots.find((slot) => slot.id === id)?.label ?? id)
      : "On the desk";
  return (
    <article className="wp-experiment">
      <div className="wp-experiment-heading">
        <h4>{binding.title}</h4>
        <span>{round.transfer ? "Changed case" : "First arrangement"}</span>
      </div>
      <p className="wp-muted">{round.prompt}</p>
      {baseline || latest ? (
        <table className="wp-comparison">
          <caption className="wp-sr-only">
            Source card placements before and after
          </caption>
          <thead>
            <tr>
              <th scope="col">Source card</th>
              <th scope="col">Starting observation</th>
              <th scope="col">Latest attempt</th>
            </tr>
          </thead>
          <tbody>
            {round.cards.map((card, index) => (
              <tr key={card.id}>
                <th scope="row">{card.label}</th>
                <td>
                  {baseline
                    ? binName(baseline.assignment[index])
                    : "Not recorded"}
                </td>
                <td>
                  {latest ? binName(latest.assignment[index]) : "Not attempted"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="wp-muted">
          Pick up a source card to record the starting arrangement. Carry each
          card to a crate, then check your work at the stamp.
        </p>
      )}
      {latest && (
        <p className="wp-result">
          {latest.passed ? binding.successFeedback : binding.failureFeedback}
        </p>
      )}
      {latest?.passed && (
        <p className="wp-readout-description">{binding.evidenceSummary}</p>
      )}
      <details>
        <summary>Read the source cards</summary>
        {round.cards.map((card) => (
          <div className="wp-found-note" key={card.id}>
            <h4>{card.label}</h4>
            <p>{card.text}</p>
            {latest?.passed && <p>{card.explanation}</p>}
            <div className="wp-source-links">
              {card.sourceIds.map((id) => (
                <SourceLink episode={episode} id={id} key={id} />
              ))}
            </div>
          </div>
        ))}
      </details>
    </article>
  );
}

export function FieldNotes({
  episode,
  game,
  onClose,
}: {
  episode: EpisodeFixture;
  game: EpisodeProgress;
  onClose(): void;
}) {
  const learning = learningStatus(episode, game);
  return (
    <>
      <div className="wp-book-title">
        <BookOpen />
        <h2>Field notes</h2>
      </div>
      <p className="wp-muted">
        {episode.title} · Things you noticed along the way
      </p>
      <h3>Your delivery</h3>
      <p>{questGoal(episode, game)}</p>
      <div className="wp-observations">
        <span className={game.bridgeOpen ? "done" : ""}>
          {game.bridgeOpen ? <Check size={18} /> : <Compass size={18} />}Bridge
          route reopened{!game.bridgeOpen && " · pending"}
        </span>
        <span className={game.liftRaised ? "done" : ""}>
          {game.liftRaised ? <Check size={18} /> : <Package size={18} />}Parcel
          lift restored{!game.liftRaised && " · pending"}
        </span>
        <span className={game.delivered ? "done" : ""}>
          {game.delivered ? <Check size={18} /> : <Mail size={18} />}Delivered
          to {episode.story.npcNames.moss}
          {!game.delivered && " · pending"}
        </span>
      </div>

      <h3>Found on the island</h3>
      {game.discoveries.length === 0 ? (
        <p className="wp-muted">
          Look for notes beside Moss’s workshop and at Bea’s posthouse. A
          curious courier might find something useful.
        </p>
      ) : (
        <div className="wp-found-notes">
          {game.discoveries.map((id) => {
            const clue = episode.discoveries.find((entry) => entry.id === id);
            return (
              clue && (
                <article className="wp-found-note" key={id}>
                  <h4>{clue.title}</h4>
                  <p>{clue.text}</p>
                  <div className="wp-source-links">
                    {clue.sourceIds.map((sourceId) => (
                      <SourceLink
                        episode={episode}
                        id={sourceId}
                        key={sourceId}
                      />
                    ))}
                  </div>
                </article>
              )
            );
          })}
        </div>
      )}
      {game.postcards.includes(episode.story.favor.postcardId) && (
        <div
          className={"wp-favor-note" + (game.postcardReturned ? " done" : "")}
        >
          <Mail size={22} />
          <div>
            <strong>
              {game.postcardReturned
                ? "A little kindness, delivered"
                : `A postcard for ${episode.story.npcNames.bea}`}
            </strong>
            <p>
              {game.postcardReturned
                ? "The message arrived. A yellow mail pennant now flies above the posthouse."
                : episode.story.postcards.find(
                    (entry) => entry.id === episode.story.favor.postcardId,
                  )?.text}
            </p>
            <small>
              Optional island favor ·{" "}
              {game.postcardReturned ? "complete" : "still in your satchel"}
            </small>
          </div>
        </div>
      )}

      <h3>Before & after</h3>
      <p>{episode.puzzles[0].instructions}</p>
      <div className="wp-experiments">
        {(["bridge", "lift"] as const).map((site) => {
          const binding = episode.scene.stations[site];
          if (binding.kind === "evidence-crates")
            return (
              <EvidenceNotes
                key={site}
                episode={episode}
                game={game}
                site={site}
              />
            );
          const config = stationConfig(episode, site);
          const task = config.tasks.find(
            (entry) => entry.id === binding.taskId,
          )!;
          const puzzle = episode.puzzles.find(
            (entry) => entry.id === binding.puzzleId,
          )!;
          const baselineRaw = game.observations[site];
          const baseline =
            baselineRaw && "inputs" in baselineRaw ? baselineRaw : null;
          const latestRaw = game.trials
            .filter((trial) => trial.mechanism === site)
            .at(-1)?.evidence;
          const latest = latestRaw && "inputs" in latestRaw ? latestRaw : null;
          const rows = [
            { title: "Starting observation", trial: baseline },
            { title: "Latest attempt", trial: latest },
          ].filter((row) => row.trial);
          return (
            <article className="wp-experiment" key={site}>
              <div className="wp-experiment-heading">
                <h4>{binding.title}</h4>
                <span>
                  {task.transfer ? "Changed case" : "First arrangement"}
                </span>
              </div>
              <p className="wp-muted">{task.prompt}</p>
              {rows.length ? (
                <table className="wp-comparison">
                  <caption className="wp-sr-only">
                    {binding.title} observed measurements
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Observation</th>
                      {binding.readouts.map((entry) => (
                        <th scope="col" key={entry.id}>
                          {entry.label}
                          <br />
                          {entry.unit}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ title, trial }) => (
                      <tr key={title}>
                        <th scope="row">
                          {title}
                          <br />
                          <small>{arrangement(episode, site, trial!)}</small>
                        </th>
                        {binding.readouts.map((entry) => (
                          <td key={entry.id}>
                            {formatStationReading(
                              (entry.kind === "input"
                                ? trial!.inputs
                                : trial!.outputs)[entry.id],
                              binding.kind,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="wp-muted">
                  Your first interaction with the apparatus records its starting
                  arrangement. Place the object and test it to compare an
                  attempt.
                </p>
              )}
              {latest && (
                <p className="wp-result">
                  {latest.passed
                    ? binding.successFeedback
                    : binding.failureFeedback}
                </p>
              )}
              {latest?.passed && (
                <p className="wp-readout-description">
                  {binding.evidenceSummary}
                </p>
              )}
              {!baseline && latest && (
                <p className="wp-muted">
                  This earlier delivery has no saved starting observation.
                </p>
              )}
              <div className="wp-source-links">
                {puzzle.sourceIds.map((sourceId) => (
                  <SourceLink episode={episode} id={sourceId} key={sourceId} />
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {learning.verified && (
        <p className="wp-learning-note">
          <Check size={18} />
          Both starting arrangements and successful attempts replay correctly.
          You completed the first case and its changed case.
        </p>
      )}
      {learning.status === "historical-progress" && (
        <p className="wp-muted">
          Your earlier delivery is safe. Starting observations that weren’t
          recorded then haven’t been added to its history.
        </p>
      )}
      <p className="wp-muted">
        Starting observations are separate from attempts. A correct first
        attempt counts. {game.hints} nudges requested; this is a record of play,
        not a mastery score.
      </p>
      {game.trials.length > 0 && (
        <details>
          <summary>Recent attempts · {game.trials.length} retained</summary>
          <ul className="wp-trials">
            {game.trials.slice(-8).map((trial, index) => (
              <li key={index}>
                <span>
                  {episode.scene.stations[trial.mechanism].title} ·{" "}
                  {arrangement(episode, trial.mechanism, trial.evidence)}
                  <small>{trial.hints} nudges by this point</small>
                </span>
                <strong>
                  {trial.evidence.passed ? "Accepted" : "Try again"}
                </strong>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>Sources & learning model</summary>
        {episode.objectives.map((objective) => (
          <div key={objective.id}>
            <h4>{objective.title}</h4>
            <p>{objective.claim}</p>
            <p className="wp-muted">{objective.boundaries}</p>
          </div>
        ))}
        <ul>
          {episode.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
        {episode.sources.map((source) => (
          <p key={source.id}>
            <SourceLink episode={episode} id={source.id} />
            <br />
            {source.text}
          </p>
        ))}
      </details>
      <button className="wp-primary" onClick={onClose}>
        Back to the island
      </button>
    </>
  );
}
