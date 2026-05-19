import type { CSSProperties } from "react";

export type IconName =
  | "map"
  | "book"
  | "pumpkin"
  | "gear"
  | "juice"
  | "runner"
  | "flag"
  | "bulb"
  | "camera"
  | "share"
  | "stopwatch"
  | "sparkles"
  | "medal"
  | "play"
  | "check";

type Props = {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

const PATHS: Record<IconName, (stroke: number) => React.ReactNode> = {
  map: () => (
    <>
      <path d="M3.4 6.4 Q3.2 5.9 3.8 5.7 L8.9 4.1 L15.1 5.9 L20.3 4.2 Q20.9 4.1 21 4.7 L21 17.4 Q21 18 20.4 18.2 L15.1 19.9 L8.9 18.1 L3.7 19.9 Q3 20 3.4 19.4 Z" />
      <path d="M9 4.3 L9.2 18.2" />
      <path d="M15 6 L14.9 19.8" />
      <circle cx="6.2" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M6.2 10.5 L6.2 13.5" />
    </>
  ),
  book: () => (
    <>
      <path d="M5 4.2 Q4.2 4.2 4.2 5.3 L4.3 18.4 Q4.3 19.7 5.4 19.7 L18.6 19.6 Q19.7 19.6 19.7 18.4 L19.6 5.3 Q19.6 4.1 18.5 4.2 Z" />
      <path d="M4.4 5.5 Q4.4 7 5.3 7 L18.5 7 Q19.6 7 19.6 5.5" />
      <path d="M8 11 L16 10.9" />
      <path d="M8 13.7 L14.2 13.6" />
      <path d="M8 16.3 L15 16.2" />
    </>
  ),
  pumpkin: () => (
    <>
      <path d="M11.8 9.4 L12.3 6 L13.4 7.6" />
      <path d="M12.3 6.6 Q13.6 5.4 14.4 6.6" />
      <path d="M11.7 9.5 Q7 9.2 5.5 12.6 Q4.4 16.5 6.6 18.9 Q8.3 20.4 10 19.4 Q11 18.9 12 18.9 Q13 18.9 14 19.4 Q15.7 20.4 17.4 18.9 Q19.6 16.5 18.5 12.6 Q17 9.2 12.3 9.5 Z" />
      <path d="M9 11 Q8.4 14.5 8.8 18.8" />
      <path d="M15 11 Q15.6 14.5 15.2 18.8" />
    </>
  ),
  gear: () => (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3 L12 5.4" />
      <path d="M12 18.6 L12 21" />
      <path d="M3 12 L5.4 12" />
      <path d="M18.6 12 L21 12" />
      <path d="M5.6 5.6 L7.3 7.3" />
      <path d="M16.7 16.7 L18.4 18.4" />
      <path d="M5.6 18.4 L7.3 16.7" />
      <path d="M16.7 7.3 L18.4 5.6" />
    </>
  ),
  juice: () => (
    <>
      <path d="M7 7.5 L7.2 19.8 L17 19.7 L16.9 7.4 Z" />
      <path d="M14 7.4 L14.1 4.2 L12 4.2" />
      <path d="M14 4.2 Q12.6 4 12 4.6" />
      <path d="M7.1 11.2 L17 11.1" />
      <path d="M9 14 L11.5 16 L13 14.5" />
    </>
  ),
  runner: () => (
    <>
      <circle cx="15" cy="5.4" r="1.9" />
      <path d="M14.7 7.4 Q13.6 10 12.6 12.4" />
      <path d="M12.6 12.4 Q15.4 14 15.8 16.6" />
      <path d="M15.8 16.6 L15 19.4" />
      <path d="M12.6 12.4 Q10.4 14 8.6 15.4" />
      <path d="M8.6 15.4 L6.4 16.8" />
      <path d="M13.8 9.4 L17.6 8.4" />
      <path d="M17.6 8.4 L18.8 6.6" />
      <path d="M13 11 L10 9.6" />
    </>
  ),
  flag: () => (
    <>
      <path d="M5 4 L5 21" />
      <path d="M5 4.2 L17 4.2 L17 12 L5 12 Z" />
      <path d="M11 4.2 L11 12" />
      <path d="M5 8.1 L17 8.1" />
      <path
        d="M5 4.2 L11 4.2 L11 8.1 L5 8.1 Z M11 8.1 L17 8.1 L17 12 L11 12 Z"
        fill="currentColor"
        stroke="none"
        opacity="0.85"
      />
    </>
  ),
  bulb: () => (
    <>
      <path d="M8.4 9.4 Q8.2 4.8 12.1 4.4 Q15.9 4.6 15.8 9.2 Q15.5 11.6 14 13.4 L14 14.8 L10.2 14.8 L10.2 13.4 Q8.7 11.7 8.4 9.4 Z" />
      <path d="M10.4 16.7 L13.8 16.7" />
      <path d="M10.7 18.6 L13.4 18.6" />
      <path d="M11.4 20.3 L12.8 20.3" />
      <path d="M11 8 L12 11 L13 8" />
    </>
  ),
  camera: () => (
    <>
      <path d="M3.2 8.5 L6.5 8.5 L8.4 6 L15.7 6 L17.6 8.5 L20.8 8.5 L20.8 19 L3.2 19 Z" />
      <circle cx="12" cy="13.2" r="3.6" />
      <circle cx="12" cy="13.2" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="10.2" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  share: () => (
    <>
      <path d="M5 11 L5 19.8 L19 19.8 L19 11" />
      <path d="M12 14.2 L12 3.4" />
      <path d="M8 7.4 L12 3.4 L16 7.4" />
    </>
  ),
  stopwatch: () => (
    <>
      <path d="M10 3.4 L14 3.4" />
      <path d="M12 3.6 L12 5.4" />
      <path d="M18.6 6 L20.4 7.8" />
      <circle cx="12" cy="14" r="6.8" />
      <path d="M12 8.2 L12 9.4" />
      <path d="M18.4 14 L17.2 14" />
      <path d="M5.6 14 L6.8 14" />
      <path d="M12 19.6 L12 18.6" />
      <path d="M12 14 L12 10.2" />
      <path d="M12 14 L14.6 13.4" />
    </>
  ),
  play: () => (
    <>
      <path d="M7.4 4.4 L18.6 11.7 Q19 12 18.6 12.3 L7.4 19.6 Q7 19.8 7 19.3 L7 4.7 Q7 4.2 7.4 4.4 Z" fill="currentColor" />
    </>
  ),
  check: () => (
    <>
      <path d="M4.6 12.6 L9.4 17.6 L19.4 6.4" />
    </>
  ),
  medal: () => (
    <>
      <path d="M8.4 3 L12 9.4 L15.6 3" />
      <circle cx="12" cy="15" r="5.6" />
      <path d="M12 12.2 L12.9 14.3 L15 14.5 L13.4 15.9 L13.9 18 L12 16.9 L10.1 18 L10.6 15.9 L9 14.5 L11.1 14.3 Z" />
    </>
  ),
  sparkles: () => (
    <>
      <path d="M11 4 L12 9.4 L17 11 L12 12.6 L11 18 L10 12.6 L5 11 L10 9.4 Z" />
      <path d="M18.4 4.4 L18.9 6.4 L21 7 L18.9 7.6 L18.4 9.6 L17.9 7.6 L15.8 7 L17.9 6.4 Z" />
      <path d="M5.6 16.4 L6 18 L7.6 18.4 L6 18.8 L5.6 20.4 L5.2 18.8 L3.6 18.4 L5.2 18 Z" />
    </>
  ),
};

export function QuestIcon({
  name,
  size = 32,
  stroke = 1.6,
  className,
  style,
  title,
}: Props) {
  const draw = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {draw(stroke)}
    </svg>
  );
}

const EMOJI_TO_ICON: Record<string, IconName> = {
  "🗺️": "map",
  "📚": "book",
  "🎃": "pumpkin",
  "⚙️": "gear",
  "🧃": "juice",
  "🏃‍♀️": "runner",
  "🏃": "runner",
  "🏁": "flag",
  "💡": "bulb",
  "📷": "camera",
  "📸": "camera",
  "📤": "share",
  "⏱": "stopwatch",
  "⏱️": "stopwatch",
  "🎉": "sparkles",
  "🎊": "sparkles",
  "✨": "sparkles",
  "🥇": "medal",
  "🥈": "medal",
  "🥉": "medal",
  "🏆": "medal",
  "▶": "play",
  "▶️": "play",
  "✓": "check",
  "✔": "check",
  "✔️": "check",
};

export function emojiToIcon(emoji: string | null | undefined, fallback: IconName = "map"): IconName {
  if (!emoji) return fallback;
  return EMOJI_TO_ICON[emoji] ?? fallback;
}
