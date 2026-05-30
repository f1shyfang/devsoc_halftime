import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { mvpGames, mvpPlayers } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { DEMO_GAME_ID } from "@/lib/mvp/constants";
import { LeaderboardView } from "./leaderboard-view";
import type { MvpLeaderboardRow } from "@/lib/mvp/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "UNSW Quest · Leaderboard" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game: gameParam } = await searchParams;
  const gameId = gameParam?.trim() || DEMO_GAME_ID;

  const game =
    (
      await db
        .select({ id: mvpGames.id, hunt_id: mvpGames.huntId })
        .from(mvpGames)
        .where(eq(mvpGames.id, gameId))
        .limit(1)
    )[0] ?? null;
  if (!game) notFound();

  const rows = await db
    .select({
      id: mvpPlayers.id,
      name: mvpPlayers.name,
      completed_at: mvpPlayers.completedAt,
      started_at: mvpPlayers.startedAt,
      total_time_seconds: mvpPlayers.totalTimeSeconds,
    })
    .from(mvpPlayers)
    .where(eq(mvpPlayers.gameId, gameId))
    .orderBy(asc(mvpPlayers.completedAt));

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#f7f1e3] text-[#1a1a22]">
      <header className="w-full border-b border-[#d8d1bf] px-5 py-4 flex items-center justify-between max-w-lg mx-auto">
        <Link href="/" className="font-semibold text-sm">
          UNSW Quest
        </Link>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[#6f6f7a]">
          Live race
        </span>
      </header>
      <section className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-6">
        <div>
          <h1
            className="text-4xl leading-tight"
            style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}
          >
            Leaderboard
          </h1>
          <p className="text-sm text-[#6f6f7a] mt-1">Updates live as players finish.</p>
        </div>
        <LeaderboardView
          gameId={gameId}
          initialRows={(rows ?? []) as MvpLeaderboardRow[]}
        />
      </section>
    </main>
  );
}
