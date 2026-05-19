"use client";

import { useRef, useState } from "react";

type Photo = { url: string; prompt: string | null; location: string | null };

type Props = {
  huntName: string;
  teamName: string;
  totalSec: number;
  rank: number;
  totalCompleted: number;
  rankLabel: string;
  medal: string;
  hintsUsed: number;
  photosCount: number;
  overrides: number;
  photos: Photo[];
};

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function FinaleActions(props: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);

  const capture = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const { toBlob } = await import("html-to-image");
    return await toBlob(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#fffdf3",
    });
  };

  const share = async () => {
    setSharing(true);
    setShareErr(null);
    try {
      const blob = await capture();
      if (!blob) throw new Error("capture failed");
      const file = new File([blob], `unsw-quest-${props.huntName}-${Date.now()}.png`, {
        type: "image/png",
      });
      // Prefer Web Share API with files (mobile + supported desktops).
      // navigator.canShare is the right precheck — Safari throws on share({files})
      // when files aren't supported, instead of falling back.
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${props.teamName} · UNSW Quest`,
          text: `We finished ${props.huntName} in ${fmt(props.totalSec)} — ${props.rank > 0 ? `${props.rankLabel} of ${props.totalCompleted}` : "complete"}.`,
        });
      } else {
        // Fallback: trigger a download.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke after a tick so download starts.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "share failed";
      // Some browsers throw on share cancellation — silence that case.
      if (!/abort|cancel/i.test(msg)) {
        setShareErr(msg);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      {/* The shareable card — captured directly */}
      <article
        ref={cardRef}
        style={{
          width: "min(100%, 560px)",
          position: "relative",
          background: "#fffdf3",
          border: "2.4px solid #1a1a22",
          borderRadius: 24,
          padding: "36px 28px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "6px 8px 0 rgba(26,26,34,0.08)",
          overflow: "hidden",
        }}
      >
        <div className="confetti" aria-hidden>
          <i style={{ top: "6%", left: "8%" }} />
          <i style={{ top: "10%", left: "78%", background: "var(--lime)", transform: "rotate(-30deg)" }} />
          <i style={{ top: "30%", left: "4%", background: "var(--ink)" }} />
          <i style={{ top: "42%", left: "88%", background: "var(--lime)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="hand" style={{ fontSize: 18, color: "var(--accent)", letterSpacing: "0.06em" }}>
            YOU FINISHED
          </div>
          <div className="hand" style={{ fontSize: 48, lineHeight: 1, marginTop: 4 }}>
            {props.huntName}
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {props.teamName}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="mono small muted">Total time</div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            {fmt(props.totalSec)}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 4, marginTop: 10 }}>
            <span className="pill acc-pill" style={{ fontSize: 12 }}>
              {props.rank > 0 ? `${props.rankLabel} of ${props.totalCompleted}` : "finished"} {props.medal}
            </span>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
            marginTop: 4,
          }}
        >
          <div className="card flat" style={{ padding: 14, textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 28 }}>{props.hintsUsed}</div>
            <div className="xs">hints</div>
          </div>
          <div className="card flat" style={{ padding: 14, textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 28 }}>{props.photosCount}</div>
            <div className="xs">photos</div>
          </div>
          <div className="card flat" style={{ padding: 14, textAlign: "center" }}>
            <div className="hand" style={{ fontSize: 28 }}>{props.overrides}</div>
            <div className="xs">overrides</div>
          </div>
        </div>
        <div className="muted small" style={{ textAlign: "center", marginTop: 4 }}>
          UNSW Quest · {new Date().toLocaleDateString()}
        </div>
      </article>

      {/* Share button + standings link */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "min(100%, 560px)",
        }}
      >
        <button
          className="btn primary"
          onClick={share}
          disabled={sharing}
          style={{ width: "100%", minHeight: 52, fontSize: 15 }}
        >
          {sharing ? "Preparing…" : "📤 Share your results"}
        </button>
        {shareErr ? (
          <div className="p" style={{ color: "var(--bad)", textAlign: "center" }}>{shareErr}</div>
        ) : null}
      </div>

      {/* Highlight reel */}
      {props.photos.length > 0 ? (
        <section
          style={{
            width: "min(100%, 560px)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div className="label" style={{ paddingLeft: 4 }}>
            HIGHLIGHT REEL · {props.photos.length} photo{props.photos.length === 1 ? "" : "s"}
          </div>
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              gap: 12,
              padding: "4px 4px 12px",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {props.photos.map((p, i) => (
              <figure
                key={`${p.url}-${i}`}
                style={{
                  margin: 0,
                  flex: "0 0 auto",
                  width: 220,
                  scrollSnapAlign: "start",
                  background: "var(--paper)",
                  border: "var(--stroke) solid var(--ink)",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "3px 4px 0 rgba(26,26,34,0.08)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.prompt ?? "captured photo"}
                  style={{
                    width: "100%",
                    height: 220,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <figcaption style={{ padding: "10px 12px" }}>
                  <div className="hand" style={{ fontSize: 16, lineHeight: 1.2 }}>
                    {p.prompt ?? "Team photo"}
                  </div>
                  {p.location ? (
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {p.location}
                    </div>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
