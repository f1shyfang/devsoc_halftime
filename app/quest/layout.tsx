import type { Metadata } from "next";
import { Inter, Caveat, JetBrains_Mono } from "next/font/google";
import "./quest.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-quest-ui" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-quest-hand" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-quest-mono" });

export const metadata: Metadata = {
  title: "UNSW Quest — Wireframe Storyboard",
  description: "Mid-fi wireframes for the UNSW Quest campus scavenger hunt app",
};

export default function QuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`quest-root ${inter.variable} ${caveat.variable} ${mono.variable}`}
      style={{
        fontFamily: "var(--font-quest-ui), Inter, system-ui, sans-serif",
        // route the next/font variables into the names the CSS expects
        ["--ui" as string]: "var(--font-quest-ui), Inter, system-ui, sans-serif",
        ["--hand" as string]: "var(--font-quest-hand), 'Caveat', 'Bradley Hand', cursive",
        ["--mono" as string]: "var(--font-quest-mono), 'JetBrains Mono', ui-monospace, monospace",
      }}
    >
      {children}
    </div>
  );
}
