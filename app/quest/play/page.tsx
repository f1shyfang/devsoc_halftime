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
  { n: "02", stage: "Map · geofence", label: "Split", Component: MapSplit },
  { n: "03", stage: "Hint flow", label: "Inline reveal", Component: HintInline },
  { n: "04", stage: "QR scan", label: "Framed scan", Component: QrFramed },
  { n: "05a", stage: "Unlock · tier", label: "Full takeover", Component: UnlockTakeover },
  { n: "05b", stage: "Unlock · tier", label: "Map zoom-out", Component: UnlockZoomOut },
  { n: "06", stage: "Photo challenge", label: "Inline · later", Component: PhotoInline },
  { n: "07", stage: "Live leaderboard", label: "Tabbed", Component: LeaderboardTabbed },
];

export const metadata = {
  title: "UNSW Quest · Chosen flow",
};

export default function PlayPage() {
  return (
    <div className="viewer" style={{ gap: 40, paddingTop: 40 }}>
      <div className="crumbs">
        <Link href="/quest">storyboard</Link>
        <span className="sep">/</span>
        <span>chosen flow</span>
      </div>
      <h1
        style={{
          fontFamily: "var(--hand)",
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1,
          margin: 0,
          textAlign: "center",
        }}
      >
        UNSW Quest <span style={{ color: "var(--accent)" }}>/ chosen flow</span>
      </h1>
      <div className="muted small" style={{ maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
        One variant locked in per stage. Scroll down to walk through a team&apos;s hunt from first
        clue to live standings.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 56, alignItems: "center", marginTop: 16 }}>
        {steps.map((step) => {
          const Screen = step.Component;
          return (
            <div
              key={step.n}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div className="label">STEP {step.n} · {step.stage}</div>
                <div className="hand" style={{ fontSize: 28, lineHeight: 1 }}>{step.label}</div>
              </div>
              <Screen />
            </div>
          );
        })}
      </div>

      <div className="muted small" style={{ marginTop: 16 }}>
        Want a different variant? Browse the full grid at{" "}
        <Link href="/quest" style={{ borderBottom: "1px dashed currentColor" }}>/quest</Link>.
      </div>
    </div>
  );
}
