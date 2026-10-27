import { games } from "@/content/theatre";
import { Runes, ZText } from "./ui/Glyphs";

/* The ZUBA Arcade banner: six games playable in the browser with a Zualingo account.
   Links are plain <a> because /play is a separate (Flutter) app, not a Next.js page. */
export default function ArcadeBanner({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`arcade ${compact ? "compact" : ""}`} aria-label="ZUBA Arcade" data-music-off>
      <div className="arcade-art" style={{ backgroundImage: "url(/media/games/arcade-banner.webp)" }} aria-hidden="true" />
      <div className="arcade-shade" aria-hidden="true" />
      <div className="arcade-copy">
        <Runes text="Arcade" />
        <span className="t-label">Play free in your browser</span>
        <h2 className="t-title lg arcade-title">
          <ZText>ZUBA Arcade</ZText>
        </h2>
        <p className="arcade-sub">Six games · One account · Real ZUBA</p>
        {!compact && (
          <p className="t-lead arcade-lead">
            Build a kingdom, outwit the elders at Ayò, play live opponents worldwide, run through the Shadows of Africa, blast stone forts, solve riddles and battle friends in live quizzes. Already on the
            Zualingo app? Sign in with the same email and password and carry on exactly where you left off.
          </p>
        )}
        <div className="arcade-actions">
          <a href="/play" className="btn primary arcade-play">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
            </svg>
            Play Now
          </a>
          <a href="/play" className="btn">
            Create Free Account
          </a>
        </div>
        <ul className="arcade-games">
          {games.map((g) => (
            <li key={g.slug}>
              <a href={`/play?game=${g.play}`} title={`Play ${g.title.split(":")[0]}`}>
                <img src={g.poster} alt="" loading="lazy" />
                <span>{g.title.split(":")[0]}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
