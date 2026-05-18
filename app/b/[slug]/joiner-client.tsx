"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { parseRpcError, type TableDropError } from "@/lib/rpc-errors";

type Bounty = {
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  max_seats: number;
};

type RequestRow = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type Stage =
  | "loading"
  | "form"
  | "pending"
  | "accepted"
  | "checked_in"
  | "rejected"
  | "error";

export default function JoinerClient({
  bounty,
  checkinToken,
}: {
  bounty: Bounty;
  checkinToken: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [bountyId, setBountyId] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [error, setError] = useState<TableDropError | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInQr, setCheckInQr] = useState<string | null>(null);
  const [queueRank, setQueueRank] = useState<number | null>(null);
  const [presentCount, setPresentCount] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const checkInRanRef = useRef(false);

  const addTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    setTags((prev) => (prev.includes(t) || prev.length >= 5 ? prev : [...prev, t]));
    setTagInput("");
  }, [tagInput]);

  const stage: Stage = (() => {
    if (error && !request) return "error";
    if (checkedIn) return "checked_in";
    if (!uid) return "loading";
    if (!request) return "form";
    if (request.status === "rejected") return "rejected";
    if (request.status === "accepted") return "accepted";
    return "pending";
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (!cancelled) setUid(user.id);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (error) {
        setError(parseRpcError(error));
        return;
      }
      setUid(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Resolve bounty id once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bounties_public")
        .select("id")
        .eq("slug", bounty.slug)
        .maybeSingle();
      if (cancelled) return;
      if (data) setBountyId(data.id as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [bounty.slug, supabase]);

  // Initial fetch of own request row.
  useEffect(() => {
    if (!uid || !bountyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bounty_requests")
        .select("id, status, created_at")
        .eq("bounty_id", bountyId)
        .eq("profile_id", uid)
        .maybeSingle();
      if (cancelled || !data) return;
      setRequest(data as RequestRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, bountyId, supabase]);

  // Realtime: own request status updates.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`br:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bounty_requests",
          filter: `profile_id=eq.${uid}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<RequestRow> | null;
          if (!row || !row.id) return;
          setRequest({
            id: row.id,
            status: row.status as RequestRow["status"],
            created_at: row.created_at ?? new Date().toISOString(),
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, supabase]);

  // When accepted: ask the server for our checkin_token, then render QR.
  useEffect(() => {
    if (request?.status !== "accepted") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_checkin_token", {
        p_bounty_slug: bounty.slug,
      });
      if (cancelled || error || !data) return;
      const checkInUrl = `${window.location.origin}/b/${bounty.slug}?ci=${data}`;
      const qr = await QRCode.toDataURL(checkInUrl, {
        margin: 1,
        scale: 8,
        color: { dark: "#fafafa", light: "#000000" },
      });
      if (!cancelled) setCheckInQr(qr);
    })();
    return () => {
      cancelled = true;
    };
  }, [request?.status, bounty.slug, supabase]);

  // Auto check-in when ?ci= present + status accepted.
  useEffect(() => {
    if (!checkinToken || !uid) return;
    if (checkInRanRef.current) return;
    if (request && request.status !== "accepted") return;
    checkInRanRef.current = true;
    (async () => {
      const { data, error } = await supabase.rpc("check_in", {
        p_bounty_slug: bounty.slug,
        p_token: checkinToken,
      });
      if (error) {
        checkInRanRef.current = false;
        setError(parseRpcError(error));
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.ok) {
        setCheckedIn(true);
        setError(null);
      } else {
        checkInRanRef.current = false;
        setError(parseRpcError(row?.reason ?? "unknown"));
      }
    })();
  }, [checkinToken, uid, request, bounty.slug, supabase]);

  // Live queue rank while pending.
  useEffect(() => {
    if (request?.status !== "pending") return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase.rpc("get_queue_rank", {
        p_bounty_slug: bounty.slug,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (cancelled || !row) return;
      const r = row as { rank: number; present_count: number };
      setQueueRank(r.rank);
      setPresentCount(r.present_count);
    };
    tick();
    const interval = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [request?.status, bounty.slug, supabase]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || submitting) return;
      setSubmitting(true);
      setError(null);
      const { data, error } = await supabase.rpc("request_to_join", {
        p_bounty_slug: bounty.slug,
        p_name: name.trim(),
        p_tags: tags,
      });
      setSubmitting(false);
      if (error) {
        setError(parseRpcError(error));
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setRequest({
          id: row.request_id,
          status: row.status as RequestRow["status"],
          created_at: new Date().toISOString(),
        });
      }
    },
    [name, tags, bounty.slug, supabase, submitting],
  );

  const endsAtLabel = new Date(bounty.ends_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="min-h-screen mx-auto max-w-md px-5 py-10 flex flex-col gap-8">
      <header className="flex items-center justify-between text-xs uppercase tracking-widest text-[var(--td-dim)]">
        <span>TableDrop</span>
        <span>{bounty.location ?? ""}</span>
      </header>

      {stage === "loading" && <p className="text-[var(--td-dim)]">Loading…</p>}

      {stage === "form" && (
        <FormView
          bounty={bounty}
          endsAtLabel={endsAtLabel}
          name={name}
          setName={setName}
          tagInput={tagInput}
          setTagInput={setTagInput}
          tags={tags}
          setTags={setTags}
          addTag={addTag}
          submitting={submitting}
          onSubmit={onSubmit}
          errorMsg={error?.message ?? null}
        />
      )}

      {stage === "pending" && (
        <PendingView
          queueRank={queueRank}
          presentCount={presentCount}
        />
      )}

      {stage === "accepted" && (
        <AcceptedView checkInQr={checkInQr} />
      )}

      {stage === "checked_in" && <CheckedInView />}

      {stage === "rejected" && (
        <ErrorView title="Host declined this round." subtitle="Try another bounty." />
      )}

      {stage === "error" && (
        <ErrorView
          title={error?.message ?? "Something went wrong."}
          subtitle="Refresh or try again."
        />
      )}
    </main>
  );
}

function FormView({
  bounty,
  endsAtLabel,
  name,
  setName,
  tagInput,
  setTagInput,
  tags,
  setTags,
  addTag,
  submitting,
  onSubmit,
  errorMsg,
}: {
  bounty: Bounty;
  endsAtLabel: string;
  name: string;
  setName: (v: string) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
  addTag: () => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  errorMsg: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1
          className="font-display text-[clamp(28px,7vw,36px)] leading-[1.1]"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {bounty.title}
        </h1>
        <p className="text-sm text-[var(--td-dim)]">
          {bounty.location ? `${bounty.location} · ` : ""}ends {endsAtLabel}
        </p>
        {bounty.description && (
          <p className="text-sm text-[var(--td-text)]/80">{bounty.description}</p>
        )}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-[var(--td-dim)]">
          Your name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={40}
          required
          className="bg-transparent border-b border-[var(--td-dim)] py-3 text-lg outline-none focus:border-[var(--td-accent)]"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-[var(--td-dim)]">
          Tag yourself (up to 5)
        </span>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
              className="px-3 py-1 text-sm rounded-full border border-[var(--td-accent)] text-[var(--td-accent)]"
            >
              {t} ×
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="urban planning, rust, climate…"
            maxLength={24}
            className="flex-1 bg-transparent border-b border-[var(--td-dim)] py-2 text-base outline-none focus:border-[var(--td-accent)]"
          />
          <button
            type="button"
            onClick={addTag}
            className="text-sm text-[var(--td-dim)] uppercase tracking-widest"
          >
            Add
          </button>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}

      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="h-14 rounded-md bg-[var(--td-accent)] text-black font-medium disabled:opacity-50"
      >
        {submitting ? "Sending…" : "I'm in"}
      </button>
    </form>
  );
}

function PendingView({
  queueRank,
  presentCount,
}: {
  queueRank: number | null;
  presentCount: number | null;
}) {
  return (
    <section className="flex flex-col gap-6 mt-6">
      <h2 className="font-display text-[clamp(28px,7vw,40px)] leading-[1.05]">
        {queueRank === null
          ? "You're in the queue."
          : queueRank === 1
            ? "You're next."
            : `You're ${ordinal(queueRank)} in line.`}
      </h2>
      <p className="text-sm text-[var(--td-dim)] td-row-pulse">Host is reading…</p>
      {presentCount !== null && presentCount > 0 && (
        <p className="text-xs text-[var(--td-dim)]">
          {presentCount} {presentCount === 1 ? "person" : "people"} already in the room
        </p>
      )}
    </section>
  );
}

function AcceptedView({ checkInQr }: { checkInQr: string | null }) {
  return (
    <section className="flex flex-col items-center gap-5 mt-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ backgroundColor: "var(--td-accent)", color: "#000" }}
      >
        ✓
      </div>
      <h2 className="font-display text-[clamp(28px,7vw,40px)]">You&apos;re in.</h2>
      <p className="text-sm text-[var(--td-dim)] text-center">
        Scan the table QR to join the room.
      </p>
      <div className="w-full max-w-[280px] aspect-square bg-black p-3 rounded-md">
        {checkInQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={checkInQr} alt="Check-in QR" className="w-full h-full" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[var(--td-dim)] text-xs">
            generating…
          </div>
        )}
      </div>
    </section>
  );
}

function CheckedInView() {
  return (
    <section className="flex flex-col items-center gap-5 mt-10 text-center">
      <div className="font-display text-[clamp(32px,8vw,44px)]">
        You&apos;re at the table.
      </div>
      <p className="text-sm text-[var(--td-dim)]">Look up. The room knows.</p>
    </section>
  );
}

function ErrorView({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="flex flex-col gap-3 mt-10">
      <h2 className="font-display text-[clamp(24px,6vw,32px)]">{title}</h2>
      <p className="text-sm text-[var(--td-dim)]">{subtitle}</p>
    </section>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
