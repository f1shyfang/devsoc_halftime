"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseRpcError } from "@/lib/rpc-errors";

type Bounty = { id: string; slug: string; title: string; max_seats: number };

type Request = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  profile_id: string;
  profile_name: string;
  profile_tags: string[];
};

const TOKEN_KEY = "tabledrop:admin-token";

export default function HostClient({ bounty }: { bounty: Bounty }) {
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hydrate token from sessionStorage after mount.
  useEffect(() => {
    const t = typeof window !== "undefined" ? window.sessionStorage.getItem(TOKEN_KEY) : null;
    if (t) setToken(t);
  }, []);

  const refetch = useCallback(async () => {
    const [{ data: reqs }, { data: presence }] = await Promise.all([
      supabase
        .from("bounty_requests")
        .select("id, status, created_at, profile_id, profiles(name, tags)")
        .eq("bounty_id", bounty.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("room_presence")
        .select("profile_id", { count: "exact", head: true })
        .eq("bounty_id", bounty.id)
        .eq("is_present", true),
    ]);
    if (reqs) {
      setRequests(
        reqs.map((r) => {
          const p = pickProfile(r.profiles);
          return {
            id: r.id as string,
            status: r.status as Request["status"],
            created_at: r.created_at as string,
            profile_id: r.profile_id as string,
            profile_name: p?.name ?? "guest",
            profile_tags: p?.tags ?? [],
          };
        }),
      );
    }
    setPresentCount(typeof presence === "number" ? presence : (presence as unknown as { count?: number } | null)?.count ?? 0);
  }, [supabase, bounty.id]);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel(`host:${bounty.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bounty_requests",
          filter: `bounty_id=eq.${bounty.id}`,
        },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_presence",
          filter: `bounty_id=eq.${bounty.id}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, bounty.id, refetch]);

  const acceptReq = useCallback(
    async (requestId: string) => {
      if (!token) return;
      setBusy(requestId);
      setErrorMsg(null);
      const { error } = await supabase.rpc("accept_request", {
        p_request_id: requestId,
        p_admin_token: token,
      });
      setBusy(null);
      if (error) setErrorMsg(parseRpcError(error)?.message ?? "Accept failed.");
      else refetch();
    },
    [supabase, token, refetch],
  );

  const rejectReq = useCallback(
    async (requestId: string) => {
      if (!token) return;
      setBusy(requestId);
      setErrorMsg(null);
      const { error } = await supabase.rpc("reject_request", {
        p_request_id: requestId,
        p_admin_token: token,
      });
      setBusy(null);
      if (error) setErrorMsg(parseRpcError(error)?.message ?? "Reject failed.");
      else refetch();
    },
    [supabase, token, refetch],
  );

  const onSaveToken = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const t = tokenInput.trim();
      if (!t) return;
      window.sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setTokenInput("");
    },
    [tokenInput],
  );

  const clearToken = useCallback(() => {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const pending = requests.filter((r) => r.status === "pending");
  const acceptedCount = requests.filter((r) => r.status === "accepted").length;

  if (!token) {
    return (
      <main className="min-h-screen max-w-md mx-auto px-6 py-12 flex flex-col gap-6">
        <h1 className="font-display text-3xl">Host queue · {bounty.slug}</h1>
        <p className="text-sm text-[var(--td-dim)]">
          Paste the admin token. Stays in this tab only (sessionStorage). Never project this
          page.
        </p>
        <form onSubmit={onSaveToken} className="flex flex-col gap-3">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="admin token"
            className="bg-transparent border-b border-[var(--td-dim)] py-2 outline-none focus:border-[var(--td-accent)]"
            autoFocus
          />
          <button
            type="submit"
            className="h-12 rounded-md bg-[var(--td-accent)] text-black font-medium"
          >
            Unlock queue
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-[var(--td-dim)]">
            Host queue · do not project
          </span>
          <h1 className="font-display text-3xl">{bounty.title}</h1>
        </div>
        <button
          onClick={clearToken}
          className="text-xs uppercase tracking-widest text-[var(--td-dim)]"
        >
          lock
        </button>
      </header>

      <div className="flex gap-2 text-xs uppercase tracking-widest">
        <Chip label={`${pending.length} pending`} />
        <Chip label={`${acceptedCount} accepted`} accent />
        <Chip label={`${presentCount}/${bounty.max_seats} present`} />
      </div>

      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}

      <section className="flex flex-col gap-3">
        {pending.length === 0 ? (
          <p className="text-[var(--td-dim)]">Queue empty.</p>
        ) : (
          pending.map((req) => (
            <div
              key={req.id}
              className="border border-white/10 rounded-md p-4 flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xl">{req.profile_name}</span>
                <span className="text-xs text-[var(--td-dim)]">
                  {relativeTime(req.created_at)}
                </span>
              </div>
              {req.profile_tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {req.profile_tags.slice(0, 5).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 text-xs rounded-full border border-white/15 text-[var(--td-dim)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => acceptReq(req.id)}
                  disabled={busy === req.id || acceptedCount >= bounty.max_seats}
                  className="h-11 px-4 flex-1 rounded-md bg-[var(--td-accent)] text-black font-medium disabled:opacity-50"
                >
                  {busy === req.id ? "…" : "Accept"}
                </button>
                <button
                  onClick={() => rejectReq(req.id)}
                  disabled={busy === req.id}
                  className="h-11 px-4 rounded-md border border-white/15 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function Chip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full border ${
        accent ? "border-[var(--td-accent)] text-[var(--td-accent)]" : "border-white/15 text-[var(--td-dim)]"
      }`}
    >
      {label}
    </span>
  );
}

function pickProfile(p: unknown): { name: string; tags: string[] | null } | null {
  if (!p) return null;
  const obj = Array.isArray(p) ? p[0] : p;
  if (!obj || typeof obj !== "object") return null;
  return obj as { name: string; tags: string[] | null };
}

function relativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}
