import Link from "next/link";
import type { ComponentType } from "react";
import { ClueNotebook } from "../_screens/clue";
import { MapSplit } from "../_screens/map";
import { HintInline } from "../_screens/hint";
import { QrFramed } from "../_screens/qr";
import { UnlockTakeover, UnlockZoomOut } from "../_screens/unlock";
import { PhotoInline } from "../_screens/photo";
import { LeaderboardTabbed } from "../_screens/leaderboard";

type Step = { n: string; stage: string; label: string; Component: ComponentType };

const steps: Step[] = [
  { n: "01", stage: "Clue card", label: "Notebook card", Component: ClueNotebook },
  { n: "02", stage: "Map", label: "Split", Component: MapSplit },
  { n: "03", stage: "Hint", label: "Inline reveal", Component: HintInline },
  { n: "04", stage: "QR", label: "Framed scan", Component: QrFramed },
  { n: "05a", stage: "Unlock", label: "Full takeover", Component: UnlockTakeover },
  { n: "05b", stage: "Unlock", label: "Map zoom-out", Component: UnlockZoomOut },
  { n: "06", stage: "Photo", label: "Inline · later", Component: PhotoInline },
  { n: "07", stage: "Leaderboard", label: "Tabbed", Component: LeaderboardTabbed },
];

export const metadata = {
  title: "UNSW Quest · Flow",
};

export default function FlowPage() {
  return (
    <>
      <header className="top">
        <div>
          <h1>
            UNSW Quest <span className="accent-text">/ chosen flow</span>
          </h1>
          <div className="crumb">v0.1 · 8 frames · one variant per stage</div>
        </div>
        <div className="legend">
          <Link href="/quest" style={{ borderBottom: "1px dashed currentColor" }}>
            full storyboard →
          </Link>
        </div>
      </header>

      <div className="intro">
        <span className="hand">One team&apos;s hunt in a single panorama — pan right to walk the journey.</span>
        Eight chosen variants joined left-to-right: clue → map → hint → QR → unlock → photo → leaderboard.
      </div>

      <div className="track-wrap">
        <div
          className="track"
          style={{ gap: 28, alignItems: "stretch" }}
        >
          {steps.map((step, i) => (
            <div
              key={step.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  width: 290,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div className="label">STEP {step.n} · {step.stage}</div>
                  <div className="hand" style={{ fontSize: 24, lineHeight: 1 }}>{step.label}</div>
                </div>
                <step.Component />
              </div>
              {i < steps.length - 1 ? (
                <div
                  aria-hidden
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--quest-muted)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 0,
                      borderTop: "1.6px dashed var(--quest-muted)",
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "var(--hand)",
                      fontSize: 26,
                      color: "var(--accent)",
                      lineHeight: 1,
                    }}
                  >
                    →
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
