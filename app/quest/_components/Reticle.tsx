import type { CSSProperties } from "react";

export function Reticle({ style }: { style?: CSSProperties }) {
  return (
    <div className="reticle" style={style}>
      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />
      <div className="laser" />
    </div>
  );
}
