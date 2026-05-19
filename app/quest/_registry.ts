import type { ComponentType } from "react";
import { ClueText, ClueNotebook, CluePeekMap } from "./_screens/clue";
import { MapFull, MapSplit, MapCompass } from "./_screens/map";
import { HintModal, HintInline, HintDrawer } from "./_screens/hint";
import { QrFull, QrFramed, QrPrompt } from "./_screens/qr";
import { UnlockTakeover, UnlockZoomOut, UnlockBanner } from "./_screens/unlock";
import { PhotoModal, PhotoCamera, PhotoInline } from "./_screens/photo";
import { LeaderboardBar, LeaderboardPeek, LeaderboardTabbed } from "./_screens/leaderboard";
import { FinaleStats, FinaleReceipt, FinaleReel } from "./_screens/finale";

export type Variant = {
  slug: string;
  tag: "A" | "B" | "C";
  label: string;
  anno?: string;
  Component: ComponentType;
};

export type Stage = {
  slug: string;
  number: string;
  title: string;
  pill: string;
  blurb: string;
  variants: Variant[];
};

export const stages: Stage[] = [
  {
    slug: "clue",
    number: "01",
    title: "Clue Card",
    pill: "Hero screen",
    blurb: "The screen players live in. Three takes on how to present the riddle, hints, and the way out.",
    variants: [
      { slug: "text", tag: "A", label: "Text-first", anno: "↑ riddle owns the screen", Component: ClueText },
      { slug: "notebook", tag: "B", label: "Notebook card", anno: "↑ playful, journal energy", Component: ClueNotebook },
      { slug: "peek-map", tag: "C", label: "Peek map", anno: "↑ map peek + verify CTA", Component: CluePeekMap },
    ],
  },
  {
    slug: "map",
    number: "02",
    title: "Map · geofence",
    pill: "Secondary",
    blurb: "How players see “how close is close enough.” Glanceable, dismissible — not a navigator.",
    variants: [
      { slug: "full", tag: "A", label: "Full map", Component: MapFull },
      { slug: "split", tag: "B", label: "Split", Component: MapSplit },
      { slug: "compass", tag: "C", label: "Compass", anno: "↑ minimal · no map dependency", Component: MapCompass },
    ],
  },
  {
    slug: "hint",
    number: "03",
    title: "Hint flow",
    pill: "Cost: +60s",
    blurb: "Two hints per clue, both unlocked. Confirm cost, reveal, no third out.",
    variants: [
      { slug: "modal", tag: "A", label: "Modal confirm", Component: HintModal },
      { slug: "inline", tag: "B", label: "Inline reveal", Component: HintInline },
      { slug: "drawer", tag: "C", label: "Drawer", anno: "↑ both hints in one place", Component: HintDrawer },
    ],
  },
  {
    slug: "qr",
    number: "04",
    title: "QR scan",
    pill: "2–3 clues / hunt",
    blurb: "Physical printed code at a bench or plaque. Camera-led, with a way back to the clue.",
    variants: [
      { slug: "full", tag: "A", label: "Full camera", Component: QrFull },
      { slug: "framed", tag: "B", label: "Framed scan", Component: QrFramed },
      { slug: "prompt", tag: "C", label: "Prompt first", anno: "↑ explain first, then scan", Component: QrPrompt },
    ],
  },
  {
    slug: "unlock",
    number: "05",
    title: "Unlock · tier",
    pill: "Haptic + sound",
    blurb: "The dopamine hit. Three intensities for the clue-unlock + tier-transition moment.",
    variants: [
      { slug: "takeover", tag: "A", label: "Full takeover", Component: UnlockTakeover },
      { slug: "zoom-out", tag: "B", label: "Map zoom-out", Component: UnlockZoomOut },
      { slug: "banner", tag: "C", label: "Banner ribbon", anno: "↑ stays in flow, low ceremony", Component: UnlockBanner },
    ],
  },
  {
    slug: "photo",
    number: "06",
    title: "Photo challenge",
    pill: "Non-blocking",
    blurb: "Tied to GPS unlocks. Skippable. Three ways to surface “do this, but only if you want.”",
    variants: [
      { slug: "modal", tag: "A", label: "Modal nudge", Component: PhotoModal },
      { slug: "camera", tag: "B", label: "Camera takeover", Component: PhotoCamera },
      { slug: "inline", tag: "C", label: "Inline · later", anno: "↑ doesn’t interrupt flow", Component: PhotoInline },
    ],
  },
  {
    slug: "leaderboard",
    number: "07",
    title: "Live leaderboard",
    pill: "Real-time",
    blurb: "“How are we doing?” Three positions on the spectrum from always-on to deliberately checked.",
    variants: [
      { slug: "bar", tag: "A", label: "Always-on bar", Component: LeaderboardBar },
      { slug: "peek", tag: "B", label: "Peek pill (expanded)", Component: LeaderboardPeek },
      { slug: "tabbed", tag: "C", label: "Tabbed", anno: "↑ deliberate check", Component: LeaderboardTabbed },
    ],
  },
  {
    slug: "finale",
    number: "08",
    title: "Finale · results",
    pill: "Share moment",
    blurb: "The post-confetti screen. Where pride is staged for sharing.",
    variants: [
      { slug: "stats", tag: "A", label: "Stats hero", Component: FinaleStats },
      { slug: "receipt", tag: "B", label: "Receipt", Component: FinaleReceipt },
      { slug: "reel", tag: "C", label: "Reel-first", anno: "↑ photo-led, social-shaped", Component: FinaleReel },
    ],
  },
];

export function findStage(slug: string) {
  return stages.find((s) => s.slug === slug);
}

export function findVariant(stageSlug: string, variantSlug: string) {
  const stage = findStage(stageSlug);
  if (!stage) return null;
  const variant = stage.variants.find((v) => v.slug === variantSlug);
  if (!variant) return null;
  return { stage, variant };
}
