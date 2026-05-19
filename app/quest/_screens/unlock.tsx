import { Phone } from "../_components/Phone";

export function UnlockTakeover() {
  return (
    <Phone time="9:52" battery="●●●● 84%" screenStyle={{ background: "var(--accent)" }} statusColor="white">
      <div className="body" style={{ color: "white" }}>
        <div className="confetti">
          <i style={{ top: "8%", left: "14%" }} />
          <i style={{ top: "20%", left: "74%", background: "var(--lime)", transform: "rotate(-20deg)" }} />
          <i style={{ top: "30%", left: "30%", background: "white" }} />
          <i style={{ top: "60%", left: "80%" }} />
          <i style={{ top: "72%", left: "18%", background: "var(--lime)" }} />
        </div>
        <div className="grow center" style={{ flexDirection: "column", gap: 18, padding: 24, textAlign: "center" }}>
          <div className="ring white" />
          <div style={{ fontFamily: "var(--hand)", fontSize: 46, lineHeight: 1 }}>Tier 2 unlocked</div>
          <div className="p" style={{ color: "rgba(255,255,255,0.85)" }}>
            All 3 warm-up clues solved.
            <br />
            Now: Law, Arc, Physics Lawn.
          </div>
        </div>
        <div className="pad">
          <div className="btn" style={{ background: "white", color: "var(--accent)", borderColor: "white" }}>
            Continue →
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function UnlockZoomOut() {
  return (
    <Phone time="9:52" battery="●●●● 84%">
      <div className="body" style={{ padding: 0, position: "relative" }}>
        <div className="ph-box map" style={{ position: "absolute", inset: 0, borderRadius: 0, border: 0 }} />
        <div
          style={{
            position: "absolute",
            left: "32%",
            top: "24%",
            width: 54,
            height: 54,
            border: "1.6px solid var(--ink)",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.04)",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "38%",
            top: "32%",
            width: 8,
            height: 8,
            background: "var(--ink)",
            borderRadius: "50%",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "54%",
            top: "54%",
            width: 88,
            height: 88,
            border: "2.4px dashed var(--accent)",
            borderRadius: "50%",
            background: "rgba(239,91,58,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "62%",
            top: "60%",
            width: 12,
            height: 12,
            background: "var(--accent)",
            borderRadius: "50%",
            border: "2px solid white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "70%",
            top: "64%",
            width: 12,
            height: 12,
            background: "var(--accent)",
            borderRadius: "50%",
            border: "2px solid white",
            opacity: 0.7,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "60%",
            top: "72%",
            width: 12,
            height: 12,
            background: "var(--accent)",
            borderRadius: "50%",
            border: "2px solid white",
            opacity: 0.7,
          }}
        />
        <div style={{ position: "absolute", top: 46, left: 14, right: 14 }} className="card">
          <div className="label">Tier 2 unlocked</div>
          <div className="h2" style={{ marginTop: 4 }}>3 new clues · Law · Arc · Physics</div>
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 14, right: 14 }}>
          <div className="btn primary">Start tier 2</div>
        </div>
      </div>
    </Phone>
  );
}

export function UnlockBanner() {
  return (
    <Phone time="9:52" battery="●●●● 84%">
      <div className="body">
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">Tier 2 · Clue 4 of 9</div>
            <div className="pill mono">14:02</div>
          </div>
          <div className="dots" style={{ marginTop: 10 }}>
            <div className="d on" /><div className="seg" /><div className="d on" />
            <div className="seg" /><div className="d on" />
            <div className="seg off" style={{ margin: "0 4px" }} />
            <div className="d now" /><div className="seg off" /><div className="d" />
            <div className="seg off" /><div className="d" />
          </div>
        </div>
        <div
          style={{
            margin: "6px 12px 0",
            padding: "10px 14px",
            background: "var(--lime)",
            border: "var(--stroke) solid var(--ink)",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="hand" style={{ fontSize: 18, lineHeight: 1 }}>Tier 2 unlocked!</div>
            <div className="mono small muted">Spread to Law / Arc / Physics</div>
          </div>
          <div style={{ fontSize: 22 }}>🎉</div>
        </div>
        <div className="pad grow" style={{ paddingTop: 14 }}>
          <div className="label">Next clue</div>
          <div className="riddle" style={{ marginTop: 6 }}>&ldquo;Future arguments are born here.&rdquo;</div>
        </div>
        <div className="pad">
          <div className="btn primary">Begin walking →</div>
        </div>
      </div>
    </Phone>
  );
}
