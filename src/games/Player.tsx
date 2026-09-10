import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { gameRevisionKey, type GamePackage } from "./types";

const PointAndClickPlayer = lazy(() => import("../episodes/Player"));
const ThreeDPlayer = lazy(() =>
  import("../windpost/Windpost").then((module) => ({
    default: module.EpisodePlayer,
  })),
);

class PlayerBoundary extends Component<
  { children: ReactNode; onHome(): void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="ep-app ep-player-loading" role="alert">
        <h1>This adventure could not open.</h1>
        <p>
          Your saved games are still in the library. Reload the app to try again.
        </p>
        <button className="ep-primary" onClick={() => window.location.reload()}>
          Reload app
        </button>
        <button className="ep-secondary" onClick={this.props.onHome}>
          <ArrowLeft size={17} /> Back to the library
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

/** Both formats mount in the main page and retain their own progress stores. */
export default function GamePlayer({
  game,
  onHome,
}: {
  game: GamePackage;
  onHome(): void;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${game.episode.title} · Astraified`;
    window.scrollTo({ top: 0 });
    return () => {
      document.title = previous;
    };
  }, [game.episode.title]);
  return (
    <PlayerBoundary key={gameRevisionKey(game)} onHome={onHome}>
      <Suspense
        fallback={
          <main className="ep-app ep-player-loading" aria-live="polite">
            <LoaderCircle className="ep-spin" size={28} />
            <h1>Opening {game.episode.title}…</h1>
            <button className="ep-secondary" onClick={onHome}>
              <ArrowLeft size={17} /> Back to the library
            </button>
          </main>
        }
      >
        {game.format === "3d" ? (
          <ThreeDPlayer episode={game.episode} onHome={onHome} />
        ) : (
          <PointAndClickPlayer episode={game.episode} onHome={onHome} />
        )}
      </Suspense>
    </PlayerBoundary>
  );
}
