import { Phone } from "../_components/Phone";

export function PhotoModal() {
  return (
    <Phone time="9:58" battery="●●●● 82%">
      <div className="body" style={{ position: "relative" }}>
        <div style={{ opacity: 0.35, display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="pad"><div className="label">Clue unlocked</div></div>
          <div className="pad"><div className="hand" style={{ fontSize: 26 }}>Physics Lawn ✓</div></div>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(26,26,34,0.4)",
            display: "flex",
            alignItems: "flex-end",
            padding: 14,
          }}
        >
          <div className="card" style={{ width: "100%", padding: 18 }}>
            <div
              className="hand"
              style={{ fontSize: 14, color: "var(--accent)", letterSpacing: "0.08em" }}
            >
              PHOTO CHALLENGE
            </div>
            <div className="h2" style={{ margin: "4px 0 10px" }}>Recreate the Einstein pose</div>
            <div className="ph-box photo" style={{ height: 120, marginBottom: 12 }} />
            <div className="row gap-2">
              <div className="btn ghost grow">Skip</div>
              <div className="btn primary grow"><span>📷</span> Snap it</div>
            </div>
            <div className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
              Skipping doesn&apos;t affect your time.
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function PhotoCamera() {
  return (
    <Phone time="9:58" battery="●●●● 82%" screenStyle={{ background: "#1a1a22" }} statusColor="#fff8ec">
      <div className="body" style={{ color: "#fff8ec" }}>
        <div className="pad">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="pill solid" style={{ background: "#fff8ec", color: "#1a1a22" }}>× skip</div>
            <div
              className="pill"
              style={{ background: "rgba(0,0,0,0.4)", color: "#fff8ec", borderColor: "rgba(255,255,255,0.5)" }}
            >
              flip
            </div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="hand" style={{ fontSize: 20 }}>Recreate the Einstein pose 🤪</div>
        </div>
        <div
          className="grow ph-box photo"
          style={{
            margin: "0 12px 14px",
            borderRadius: 14,
            borderColor: "rgba(255,248,236,0.3)",
            color: "rgba(255,248,236,0.5)",
          }}
        >
          [ live camera preview ]
        </div>
        <div className="pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1.4px solid rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ↺
          </div>
          <div style={{ width: 64, height: 64, border: "3px solid white", borderRadius: "50%", padding: 4 }}>
            <div style={{ width: "100%", height: "100%", background: "white", borderRadius: "50%" }} />
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1.4px solid rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ⏱
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function PhotoInline() {
  return (
    <Phone time="9:58" battery="●●●● 82%">
      <div className="body">
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">Tier 2 · Clue 6 of 9</div>
            <div className="pill mono">19:31</div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 6 }}>
          <div className="hand" style={{ fontSize: 28, color: "var(--good)", lineHeight: 1 }}>
            Physics Lawn ✓
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>unlocked 12 seconds ago</div>
        </div>
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card flat" style={{ borderStyle: "dashed" }}>
            <div className="row gap-2">
              <span style={{ fontSize: 18 }}>📷</span>
              <div className="grow">
                <div className="h3">Optional · photo challenge</div>
                <div className="muted small">Recreate the Einstein pose. Saves to your reel.</div>
              </div>
            </div>
            <div className="row gap-2" style={{ marginTop: 10 }}>
              <div className="btn ghost grow small" style={{ padding: 8 }}>Later</div>
              <div className="btn primary grow"><span>📷</span> Now</div>
            </div>
          </div>
        </div>
        <div className="grow" />
        <div className="pad">
          <div className="btn ink-btn">Next clue →</div>
        </div>
      </div>
    </Phone>
  );
}
