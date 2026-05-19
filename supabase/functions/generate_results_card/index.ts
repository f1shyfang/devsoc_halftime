// supabase/functions/generate_results_card/index.ts
//
// Renders a 1080x1920 (9:16) PNG "results card" for a completed UNSW Quest
// hunt session, uploads it to the public `results-cards` bucket, and returns
// the public URL. Backs PRD §6.8 finale "Share results card" CTA.
//
// Stack:
//   - satori (npm:satori)            — JSX/HTML → SVG (pure JS, runs in Deno)
//   - @resvg/resvg-wasm              — SVG → PNG via WASM (sharp/native libs
//                                       aren't available on Supabase Edge)
//   - @supabase/supabase-js          — DB reads + Storage upload (service role)
//
// Request:  POST { hunt_session_id: string (uuid) }
// Response: 200 { url: string } | 4xx/5xx { error: string }
//
// CORS: open. The function is invoked from the Next.js client on finale.tsx.
//
// Idempotency: if quest_hunt_sessions.results_card_url is already set we
// return it without re-rendering. To force regeneration pass `force: true`.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import satori, { type SatoriOptions } from "npm:satori@0.10.13";
import {
  initWasm,
  Resvg,
} from "npm:@resvg/resvg-wasm@2.6.2";
import React from "npm:react@18.3.1";

// ---------------------------------------------------------------------------
// One-time module init (cold start). Edge Functions reuse the isolate across
// invocations, so doing this at module scope keeps p95 down.
// ---------------------------------------------------------------------------

const RESVG_WASM_URL =
  "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

// Inter is the de-facto safe font for satori; the Vercel OG playground bundles
// the same files. We fetch raw .otf bytes (satori needs ArrayBuffer font data,
// not a CSS @import). Pinned commit to keep cold-start fetches reproducible.
const FONT_REGULAR_URL =
  "https://raw.githubusercontent.com/rsms/inter/v3.19/docs/font-files/Inter-Regular.otf";
const FONT_BOLD_URL =
  "https://raw.githubusercontent.com/rsms/inter/v3.19/docs/font-files/Inter-Bold.otf";

let wasmReady: Promise<void> | null = null;
async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const res = await fetch(RESVG_WASM_URL);
      if (!res.ok) {
        throw new Error(`failed to fetch resvg wasm: ${res.status}`);
      }
      const bytes = await res.arrayBuffer();
      await initWasm(bytes);
    })();
  }
  return wasmReady;
}

let fontsPromise: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null =
  null;
async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const [reg, bold] = await Promise.all([
        fetch(FONT_REGULAR_URL).then((r) => {
          if (!r.ok) throw new Error(`font regular: ${r.status}`);
          return r.arrayBuffer();
        }),
        fetch(FONT_BOLD_URL).then((r) => {
          if (!r.ok) throw new Error(`font bold: ${r.status}`);
          return r.arrayBuffer();
        }),
      ]);
      return { regular: reg, bold };
    })();
  }
  return fontsPromise;
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "--:--";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// ---------------------------------------------------------------------------
// Card template — we build the React tree via React.createElement so this
// file is plain .ts (no JSX transform on the Edge Function runtime).
// ---------------------------------------------------------------------------

interface CardData {
  huntName: string;
  teamName: string;
  totalTime: string; // pre-formatted "MM:SS"
  rankLabel: string; // e.g. "2nd of 7"
  heroPhotoUrl: string | null;
}

function buildCard(data: CardData): any {
  const h = React.createElement;
  const { huntName, teamName, totalTime, rankLabel, heroPhotoUrl } = data;

  // Colors mirror the app's quest palette (see app/quest globals): warm cream
  // background, ink text, lime accent.
  const BG = "#FFF7E6";
  const INK = "#1A1A1A";
  const ACCENT = "#EF5B3A";
  const LIME = "#C9F25C";
  const MUTED = "#6B6B6B";

  // Hero photo: full-bleed top section. If no photo, show a lime placeholder
  // with the hunt's hero emoji vibe.
  const hero = heroPhotoUrl
    ? h("img", {
      src: heroPhotoUrl,
      width: 1080,
      height: 960,
      style: {
        width: 1080,
        height: 960,
        objectFit: "cover",
      },
    })
    : h(
      "div",
      {
        style: {
          width: 1080,
          height: 960,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: LIME,
          fontSize: 220,
        },
      },
      "🗺️",
    );

  return h(
    "div",
    {
      style: {
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        background: BG,
        fontFamily: "Inter",
        color: INK,
      },
    },
    // Brand mark (top-left, overlaid on photo)
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 48,
          left: 48,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          background: INK,
          color: BG,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 2,
          borderRadius: 999,
        },
      },
      "UNSW QUEST",
    ),
    // Hero photo
    h("div", { style: { display: "flex", width: 1080, height: 960 } }, hero),
    // Stats section
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px 0 64px",
          gap: 8,
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 32,
            color: ACCENT,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
          },
        },
        "You finished",
      ),
      h(
        "div",
        {
          style: {
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1,
            marginTop: 8,
          },
        },
        huntName,
      ),
      h(
        "div",
        {
          style: {
            marginTop: 24,
            fontSize: 40,
            color: MUTED,
          },
        },
        teamName,
      ),
    ),
    // Big time + rank
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "48px 64px 0 64px",
          gap: 16,
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 28,
            color: MUTED,
            letterSpacing: 4,
            textTransform: "uppercase",
          },
        },
        "Total time",
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "baseline",
            gap: 32,
          },
        },
        h(
          "div",
          {
            style: {
              fontSize: 220,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -8,
            },
          },
          totalTime,
        ),
        h(
          "div",
          {
            style: {
              fontSize: 48,
              fontWeight: 700,
              background: LIME,
              padding: "16px 28px",
              borderRadius: 999,
              color: INK,
            },
          },
          rankLabel,
        ),
      ),
    ),
    // Footer
    h(
      "div",
      {
        style: {
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 64px 64px 64px",
          fontSize: 24,
          color: MUTED,
        },
      },
      h("div", null, "unsw-quest.app"),
      h("div", null, "Made on campus"),
    ),
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse(
      { error: "server misconfigured: missing supabase env vars" },
      500,
    );
  }

  let body: { hunt_session_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const sessionId = body?.hunt_session_id;
  const force = body?.force === true;
  if (!sessionId || typeof sessionId !== "string") {
    return jsonResponse({ error: "hunt_session_id is required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 1. Load session + idempotency check ---------------------------------
  const { data: session, error: sessionErr } = await supabase
    .from("quest_hunt_sessions")
    .select(
      "id, team_id, hunt_id, state, completed_at, total_time_seconds, results_card_url",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) {
    return jsonResponse({ error: `session lookup failed: ${sessionErr.message}` }, 500);
  }
  if (!session) {
    return jsonResponse({ error: "session not found" }, 404);
  }
  if (session.state !== "completed" || !session.completed_at) {
    return jsonResponse({ error: "session is not completed yet" }, 409);
  }
  if (!force && session.results_card_url) {
    return jsonResponse({ url: session.results_card_url });
  }

  // ---- 2. Fetch hunt, team, hero photo, rank ------------------------------
  const [{ data: hunt }, { data: team }, { data: heroRow }] = await Promise
    .all([
      supabase.from("quest_hunts").select("name").eq("id", session.hunt_id)
        .maybeSingle(),
      supabase.from("quest_teams").select("name").eq("id", session.team_id)
        .maybeSingle(),
      supabase
        .from("quest_clue_progress")
        .select("photo_capture_url, unlocked_at")
        .eq("hunt_session_id", session.id)
        .not("photo_capture_url", "is", null)
        .order("unlocked_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // photo_capture_url in the wild can be a real public URL OR a fallback stub
  // like "inline:data:image/..." (see app/quest/demo/.../play-shell.tsx). Only
  // pass http(s) URLs to satori — anything else makes the image fetch fail.
  const rawHero = heroRow?.photo_capture_url ?? null;
  const heroPhotoUrl =
    rawHero && /^https?:\/\//i.test(rawHero) ? rawHero : null;

  // Rank: teams in this hunt that completed strictly earlier than us, +1.
  // We use a head:true count query for efficiency (no row data needed).
  const { count: earlierCount, error: rankErr } = await supabase
    .from("quest_hunt_sessions")
    .select("id", { count: "exact", head: true })
    .eq("hunt_id", session.hunt_id)
    .eq("state", "completed")
    .lt("completed_at", session.completed_at);
  if (rankErr) {
    return jsonResponse({ error: `rank lookup failed: ${rankErr.message}` }, 500);
  }

  // Total entrants for "Nth of M" — completed sessions in this hunt.
  const { count: totalCompleted } = await supabase
    .from("quest_hunt_sessions")
    .select("id", { count: "exact", head: true })
    .eq("hunt_id", session.hunt_id)
    .eq("state", "completed");

  const rank = (earlierCount ?? 0) + 1;
  const total = totalCompleted ?? rank;
  const rankLabel = `${ordinal(rank)} of ${total}`;

  // ---- 3. Render SVG → PNG -------------------------------------------------
  const t0 = performance.now();
  await ensureWasm();
  const { regular, bold } = await loadFonts();

  const fonts: SatoriOptions["fonts"] = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
  ];

  const card = buildCard({
    huntName: hunt?.name ?? "UNSW Quest",
    teamName: team?.name ?? "Team",
    totalTime: formatDuration(session.total_time_seconds ?? 0),
    rankLabel,
    heroPhotoUrl,
  });

  let png: Uint8Array;
  try {
    const svg = await satori(card, { width: 1080, height: 1920, fonts });
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1080 },
      background: "#FFF7E6",
    });
    png = resvg.render().asPng();
  } catch (e) {
    return jsonResponse(
      { error: `render failed: ${(e as Error).message}` },
      500,
    );
  }
  const renderMs = Math.round(performance.now() - t0);

  // ---- 4. Upload to Storage ------------------------------------------------
  const objectPath = `${session.hunt_id}/${session.id}.png`;
  const { error: uploadErr } = await supabase.storage
    .from("results-cards")
    .upload(objectPath, png, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: true,
    });
  if (uploadErr) {
    return jsonResponse(
      { error: `upload failed: ${uploadErr.message}` },
      500,
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("results-cards")
    .getPublicUrl(objectPath);
  const url = publicUrlData.publicUrl;

  // ---- 5. Persist on the session row --------------------------------------
  const { error: updateErr } = await supabase
    .from("quest_hunt_sessions")
    .update({ results_card_url: url })
    .eq("id", session.id);
  if (updateErr) {
    // Don't fail the request — the PNG exists and is reachable. Log only.
    console.warn(
      `[generate_results_card] persist url failed: ${updateErr.message}`,
    );
  }

  return jsonResponse({ url, render_ms: renderMs });
});
