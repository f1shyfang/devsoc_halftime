import Link from "next/link";
import { MvpPlayShell } from "./mvp-play-shell";

export const dynamic = "force-dynamic";

export const metadata = { title: "UNSW Quest · Play" };

export default function PlayPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#f7f1e3] text-[#1a1a22]">
      <header className="w-full border-b border-[#d8d1bf] px-5 py-4 flex items-center justify-between max-w-lg mx-auto">
        <Link href="/" className="font-semibold text-sm">
          UNSW Quest
        </Link>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[#6f6f7a]">
          In hunt
        </span>
      </header>
      <section className="flex-1 px-5 py-6 max-w-lg mx-auto w-full">
        <MvpPlayShell />
      </section>
    </main>
  );
}
