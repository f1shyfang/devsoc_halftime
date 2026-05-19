import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("mvp_games")
    .select("id, hunt_id")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) notFound();

  const { data: rows } = await supabase
    .from("mvp_players")
    .select("id, name, completed_at, started_at, total_time_seconds")
    .eq("game_id", gameId)
    .order("completed_at", { ascending: true, nullsFirst: false });

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
