"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api/fetcher";
import { getStoredPlayerId } from "@/lib/mvp/player-storage";
import type { MvpLeaderboardRow } from "@/lib/mvp/types";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function elapsed(row: MvpLeaderboardRow, nowMs: number) {
  if (row.completed_at && row.total_time_seconds != null) {
    return row.total_time_seconds;
  }
  if (row.started_at) {
    return Math.floor((nowMs - new Date(row.started_at).getTime()) / 1000);
  }
  return 0;
}

export function LeaderboardView({
  gameId,
  initialRows,
}: {
  gameId: string;
  initialRows: MvpLeaderboardRow[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    setMyId(getStoredPlayerId());
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data } = useSWR<{ rows: MvpLeaderboardRow[] }>(
    `/api/mvp/games/${gameId}/leaderboard`,
    swrFetcher,
    { refreshInterval: 2500, fallbackData: { rows: initialRows } },
  );
  const rows = data?.rows ?? initialRows;

  const ranked = useMemo(() => {
    const enriched = rows.map((r) => ({
      ...r,
      elapsed: elapsed(r, now),
      done: r.completed_at != null,
    }));
    enriched.sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1;
      if (a.done && b.done) return a.elapsed - b.elapsed;
      if (a.started_at && !b.started_at) return -1;
      if (!a.started_at && b.started_at) return 1;
      return a.elapsed - b.elapsed;
    });
    return enriched;
  }, [rows, now]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-[430px]">
      <ol className="flex flex-col gap-2">
        {ranked.map((row, i) => {
          const isMe = myId === row.id;
          return (
            <li
              key={row.id}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 min-h-[52px] transition-colors duration-200 ${
                isMe
                  ? "border-[#ef5b3a] bg-[#fff5f2]"
                  : "border-[#1a1a22] bg-[#fbf7ec]"
              }`}
            >
              <span className="w-6 text-sm font-bold text-[#6f6f7a] tabular-nums">
                {row.done ? i + 1 : "—"}
              </span>
              <span className="flex-1 font-semibold truncate">{row.name}</span>
              <span className="tabular-nums font-mono text-sm text-[#6f6f7a]">
                {row.done ? fmt(row.elapsed) : row.started_at ? fmt(row.elapsed) : "lobby"}
              </span>
            </li>
          );
        })}
      </ol>
      {ranked.length === 0 ? (
        <p className="text-center text-[#6f6f7a] text-sm">No players yet — scan the kickoff QR.</p>
      ) : null}
      <Link
        href="/play"
        className="min-h-[48px] flex items-center justify-center rounded-full bg-[#ef5b3a] text-white font-semibold"
      >
        Back to hunt
      </Link>
    </div>
  );
}
