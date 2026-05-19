"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "quest_onboarded_v1";

const SLIDES: Array<{ emoji: string; title: string; body: string }> = [
  {
    emoji: "🏃‍♀️",
    title: "Race campus puzzles with friends",
    body: "UNSW Quest is a real-world treasure hunt. Form a team of 1–6 and solve riddles tied to actual places on campus.",
  },
  {
    emoji: "🗺️",
    title: "Solve, walk, unlock",
    body: "Each clue points to a building, statue, or hidden corner. Walk there together — your phone unlocks the next one when you arrive.",
  },
  {
    emoji: "🏁",
    title: "Finish, share, brag",
    body: "Three tiers, one finale. Beat the clock, snap photo challenges, share your results card.",
  },
];

/**
 * 3-slide welcome carousel (PRD §6.10). Shows once per device, then sets a
 * localStorage flag. Skip → Done both dismiss permanently. Renders nothing
 * during SSR; the client effect decides whether to mount.
 */
export function OnboardingCarousel() {
  const [visible, setVisible] = useState<boolean>(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      // localStorage can throw in private mode — just don't show.
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Best-effort.
    }
    setVisible(false);
  };

  if (!visible) return null;
  const slide = SLIDES[i];
  const isLast = i === SLIDES.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,34,0.6)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "min(100%, 380px)",
          padding: 24,
          background: "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="label" style={{ color: "var(--accent)" }}>
            WELCOME · {i + 1} / {SLIDES.length}
          </div>
          <button
            onClick={dismiss}
            className="muted small"
            style={{
              background: "none",
              border: 0,
              padding: "4px 8px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            skip
          </button>
        </div>

        <div style={{ fontSize: 56, textAlign: "center", lineHeight: 1 }}>
          {slide.emoji}
        </div>
        <div className="hand" style={{ fontSize: 28, lineHeight: 1.1, textAlign: "center" }}>
          {slide.title}
        </div>
        <div className="p muted" style={{ textAlign: "center", lineHeight: 1.45 }}>
          {slide.body}
        </div>

        <div
          className="row"
          style={{ justifyContent: "center", gap: 6, marginTop: 4 }}
        >
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              aria-hidden
              style={{
                width: idx === i ? 18 : 8,
                height: 8,
                borderRadius: 4,
                background: idx === i ? "var(--accent)" : "var(--hair)",
                transition: "width 160ms",
              }}
            />
          ))}
        </div>

        <div className="row gap-2" style={{ marginTop: 6 }}>
          {i > 0 ? (
            <button className="btn ghost grow" onClick={() => setI((n) => Math.max(0, n - 1))}>
              Back
            </button>
          ) : null}
          {isLast ? (
            <button className="btn primary grow" onClick={dismiss}>
              Let&apos;s play →
            </button>
          ) : (
            <button className="btn primary grow" onClick={() => setI((n) => Math.min(SLIDES.length - 1, n + 1))}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
