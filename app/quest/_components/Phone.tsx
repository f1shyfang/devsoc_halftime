import type { ReactNode, CSSProperties } from "react";

export function Phone({
  time = "9:41",
  battery = "●●●● 87%",
  screenStyle,
  statusColor,
  children,
}: {
  time?: string;
  battery?: string;
  screenStyle?: CSSProperties;
  statusColor?: string;
  children: ReactNode;
}) {
  return (
    <div className="phone">
      <div className="notch" />
      <div className="screen" style={screenStyle}>
        <div className="status" style={statusColor ? { color: statusColor } : undefined}>
          <span className="time">{time}</span>
          <span className="right mono">{battery}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
