import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";
import { DEMO_GAME_ID } from "@/lib/mvp/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "UNSW Quest · Join" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game: gameParam } = await searchParams;
  const gameId = gameParam?.trim() || DEMO_GAME_ID;

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("mvp_games")
    .select("id, status, hardcoded_start_location, hunt_id")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) notFound();
  if (game.status === "ended") {
    redirect(`/leaderboard?game=${gameId}`);
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#f7f1e3] text-[#1a1a22]">
      <header className="w-full border-b border-[#d8d1bf] px-5 py-4 flex items-center justify-between max-w-lg mx-auto">
        <Link href="/" className="font-semibold text-sm">
          UNSW Quest
        </Link>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[#6f6f7a]">
          Join game
        </span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-5 py-10 gap-6 max-w-lg mx-auto w-full">
        <div className="text-center flex flex-col gap-2">
          <h1
            className="text-4xl leading-tight"
            style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}
          >
            Join the hunt
          </h1>
          <p className="text-sm text-[#6f6f7a]">
            Enter your name — your time starts when you tap I&apos;m here at the room.
          </p>
        </div>
        <JoinForm gameId={gameId} startLocation={game.hardcoded_start_location} />
      </section>
    </main>
  );
}
