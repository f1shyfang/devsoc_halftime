"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Bounty = {
  id: string;
  slug: string;
  title: string;
  max_seats: number;
  host_id: string;
};

type RosterEntry = {
  profile_id: string;
  name: string;
  tags: string[];
  checked_in_at: string;
};

export default function RoomClient({
  bounty,
  hostName,
  initialRoster,
}: {
  bounty: Bounty;
  hostName: string;
  initialRoster: RosterEntry[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster);
  const fetchedRef = useRef<Set<string>>(
    new Set(initialRoster.map((r) => r.profile_id)),
  );

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("room_presence")
      .select("profile_id, checked_in_at, profiles(name, tags)")
      .eq("bounty_id", bounty.id)
      .eq("is_present", true)
      .order("checked_in_at", { ascending: true });
    if (!data) return;
    const next = data.map((row) => {
      const raw = row.profiles as unknown;
      const obj = Array.isArray(raw) ? raw[0] : raw;
      const p = (obj ?? null) as { name: string; tags: string[] | null } | null;
      return {
        profile_id: row.profile_id as string,
        name: p?.name ?? "guest",
        tags: p?.tags ?? [],
        checked_in_at: row.checked_in_at as string,
      };
    });
    fetchedRef.current = new Set(next.map((r) => r.profile_id));
    setRoster((prev) => mergeRoster(prev, next));
  }, [supabase, bounty.id]);

  // Realtime + reconnect-driven refetch.
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(refetch, 1000);
    };
    const stopPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = null;
    };

    const channel = supabase
      .channel(`presence:${bounty.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_presence",
          filter: `bounty_id=eq.${bounty.id}`,
        },
        () => {
          // Cheap path: any change triggers a refetch (rows are joined to
          // profiles which we'd need anyway).
          refetch();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopPolling();
          refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startPolling();
        }
      });

    return () => {
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [supabase, bounty.id, refetch]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-10 py-5 border-b border-white/10 text-xs uppercase tracking-[0.3em] text-[var(--td-dim)] flex justify-between">
        <span>TableDrop · {bounty.slug}</span>
        <span>halftime</span>
      </header>

      <section className="px-10 pt-10 pb-6 flex flex-col gap-3">
        <h1
          className="font-display leading-[1.05] max-w-5xl"
          style={{ fontSize: "clamp(40px, 5.5vw, 76px)" }}
        >
          {bounty.title}
        </h1>
        <p className="text-[var(--td-dim)] text-xl">
          Hosted by {hostName} · {roster.length}/{bounty.max_seats} seats
        </p>
      </section>

      <section className="flex-1 px-10 pb-10 overflow-hidden">
        {roster.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-1">
            {roster.map((entry, idx) => (
              <RosterRow key={entry.profile_id} entry={entry} stagger={idx} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function RosterRow({ entry, stagger }: { entry: RosterEntry; stagger: number }) {
  const [mountedAt] = useState(() => Date.now());
  const fresh = Date.now() - mountedAt < 1500;
  return (
    <li
      className="td-row-in flex items-baseline justify-between border-b border-white/5 py-3"
      style={{ animationDelay: `${Math.min(stagger * 50, 400)}ms` }}
    >
      <span
        className={`text-3xl font-display ${fresh ? "td-row-pulse" : ""}`}
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {entry.name}
      </span>
      <span className="text-[var(--td-dim)] text-base tracking-wide">
        {(entry.tags ?? []).slice(0, 4).join(" · ")}
      </span>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col gap-3 mt-6">
      <p className="font-display text-4xl text-[var(--td-text)]/80">
        Doors open. The table is set.
      </p>
      <p className="text-[var(--td-dim)]">Scan the QR card at the table to join.</p>
    </div>
  );
}

function mergeRoster(prev: RosterEntry[], next: RosterEntry[]): RosterEntry[] {
  const prevById = new Map(prev.map((r) => [r.profile_id, r]));
  return next.map((r) => prevById.get(r.profile_id) ?? r);
}
