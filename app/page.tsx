import Link from "next/link";
import { redirect } from "next/navigation";
import { QuestIcon } from "./quest/_components/QuestIcon";
import { DEMO_GAME_ID } from "@/lib/mvp/constants";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;
  if (game?.trim()) {
    redirect(`/join?game=${encodeURIComponent(game.trim())}`);
  }
  return (
    <main className="min-h-screen flex flex-col bg-[#f7f1e3] text-[#1a1a22]">
      <nav className="w-full border-b border-[#d8d1bf]">
        <div className="w-full max-w-6xl mx-auto flex justify-between items-center p-4 px-5 text-sm gap-4">
          <Link href="/" className="font-semibold whitespace-nowrap text-base">
            UNSW Quest
          </Link>
          <div className="flex items-center gap-5 text-foreground/70">
            <Link href="/quest" className="hover:text-foreground">Storyboard</Link>
            <Link href="/quest/flow" className="hover:text-foreground hidden sm:inline">Flow</Link>
            <Link href="/quest/play" className="hover:text-foreground hidden sm:inline">Walkthrough</Link>
            <Link
              href="/quest/demo"
              className="rounded-full bg-[#ef5b3a] text-white px-3 py-1.5 font-semibold hover:opacity-90 inline-flex items-center gap-1.5"
            >
              <QuestIcon name="play" size={12} />
              Play
            </Link>
          </div>
        </div>
      </nav>

      <section className="w-full max-w-5xl mx-auto px-5 py-20 sm:py-28 flex flex-col items-center text-center gap-6">
        <span
          className="text-xs uppercase tracking-[0.18em] text-[#6f6f7a]"
          style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
        >
          DevSoc · UNSW · halftime
        </span>
        <h1
          className="text-5xl sm:text-7xl leading-[1] max-w-3xl"
          style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}
        >
          Race your friends across campus,{" "}
          <span className="text-[#ef5b3a]">one clue at a time.</span>
        </h1>
        <p className="text-lg text-[#6f6f7a] max-w-xl leading-relaxed">
          UNSW Quest is a real-time scavenger hunt for the Kensington campus. Form a team,
          solve riddles tied to real places, race the live leaderboard, finish at the Library Lawn.
        </p>
        <div className="flex gap-3 flex-wrap justify-center pt-2">
          <Link
            href={`/join?game=${DEMO_GAME_ID}`}
            className="rounded-full bg-[#ef5b3a] text-white px-6 py-3 font-semibold hover:opacity-90 inline-flex items-center gap-2"
          >
            <QuestIcon name="play" size={14} />
            Join pitch hunt
          </Link>
          <Link
            href="/quest/demo"
            className="rounded-full border-2 border-[#1a1a22] text-[#1a1a22] px-6 py-3 font-semibold hover:bg-[#1a1a22] hover:text-[#fbf7ec] inline-flex items-center gap-2"
          >
            Team demo (GPS)
          </Link>
          <Link
            href="/quest"
            className="rounded-full border-2 border-[#1a1a22] text-[#1a1a22] px-6 py-3 font-semibold hover:bg-[#1a1a22] hover:text-[#fbf7ec]"
          >
            See the design
          </Link>
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto px-5 pb-24 grid gap-6 grid-cols-1 sm:grid-cols-3">
        <RouteCard
          href={`/join?game=${DEMO_GAME_ID}`}
          tag="PITCH · KAHOOT"
          title="Pitch hunt (MVP)"
          accent="#ef5b3a"
          description="Scan the kickoff QR, enter your name, solve two puzzles, optional selfie — individual leaderboard updates live."
          cta="Join pitch hunt →"
        />
        <RouteCard
          href="/quest/demo"
          tag="LIVE · TEAMS"
          title="Team GPS demo"
          accent="#3a6ef0"
          description="Create a team, share an invite code, race clues with GPS verification and a live team leaderboard."
          cta="Play UNSW 101 →"
        />
        <RouteCard
          href="/quest"
          tag="DESIGN · 24 SCREENS"
          title="Wireframe storyboard"
          accent="#1a1a22"
          description="Eight stages × three variants each — the full design exploration. Pan right to walk one team's hunt, tap any frame for detail."
          cta="Open storyboard →"
        />
        <RouteCard
          href="/quest/flow"
          tag="CHOSEN FLOW · 8 FRAMES"
          title="Single panorama"
          accent="#c9f558"
          description="The 8 locked-in variants joined left-to-right as one connected panorama. The path from first clue to final standings."
          cta="See the flow →"
          accentTextDark
        />
      </section>

      <footer className="mt-auto border-t border-[#d8d1bf]">
        <div className="w-full max-w-6xl mx-auto px-5 py-8 text-xs text-[#6f6f7a] flex flex-wrap items-center justify-between gap-4">
          <div>UNSW Quest · v0.1 · DevSoc halftime hack</div>
          <div className="flex gap-4">
            <Link href="/quest" className="hover:text-[#1a1a22]">storyboard</Link>
            <Link href="/quest/play" className="hover:text-[#1a1a22]">walkthrough</Link>
            <Link href="/quest/flow" className="hover:text-[#1a1a22]">flow</Link>
            <Link href="/quest/demo" className="hover:text-[#1a1a22]">demo</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function RouteCard({
  href,
  tag,
  title,
  description,
  cta,
  accent,
  accentTextDark,
}: {
  href: string;
  tag: string;
  title: string;
  description: string;
  cta: string;
  accent: string;
  accentTextDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 p-7 rounded-2xl border-2 border-[#1a1a22] bg-[#fbf7ec] hover:-translate-y-0.5 hover:shadow-[6px_8px_0_rgba(26,26,34,0.08)] transition-all"
    >
      <span
        className="self-start text-[10px] tracking-[0.18em] uppercase font-semibold px-2.5 py-1 rounded-full"
        style={{
          background: accent,
          color: accentTextDark ? "#1a1a22" : "#fff",
          border: `1px solid ${accent === "#c9f558" ? "#1a1a22" : accent}`,
        }}
      >
        {tag}
      </span>
      <h3
        className="text-3xl leading-[1]"
        style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}
      >
        {title}
      </h3>
      <p className="text-sm text-[#6f6f7a] leading-relaxed flex-1">{description}</p>
      <div className="text-sm font-semibold text-[#1a1a22] group-hover:text-[#ef5b3a]">{cta}</div>
    </Link>
  );
}
