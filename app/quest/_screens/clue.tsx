import { Phone } from "../_components/Phone";

export function ClueText() {
  return (
    <Phone>
      <div className="body">
        <div className="pad" style={{ paddingBottom: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">Tier 1 · Clue 1 of 3</div>
            <div className="pill"><span>00:04:12</span></div>
          </div>
          <div className="dots" style={{ marginTop: 10 }}>
            <div className="d now" /><div className="seg off" />
            <div className="d" /><div className="seg off" />
            <div className="d" />
          </div>
        </div>
        <div className="pad grow" style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="label">The riddle</div>
          <div className="riddle lg">&ldquo;I hold thousands of worlds but never leave my shelf.&rdquo;</div>
          <div className="row gap-2" style={{ marginTop: "auto" }}>
            <div className="btn ghost grow"><span>💡</span> Hint · 2 left</div>
            <div className="btn ghost"><span>🗺️</span></div>
          </div>
          <div className="btn primary">Walking there →</div>
        </div>
      </div>
    </Phone>
  );
}

export function ClueNotebook() {
  return (
    <Phone>
      <div className="body">
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="hand" style={{ fontSize: 20 }}>Quest log · clue 1</div>
            <div className="pill solid mono">04:12</div>
          </div>
        </div>
        <div className="pad grow" style={{ paddingTop: 6 }}>
          <div
            className="card"
            style={{
              background: "#fffdf3",
              padding: 18,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              borderRadius: 14,
            }}
          >
            <div className="hand" style={{ fontSize: 14, color: "var(--quest-muted)" }}>
              &ldquo;Riddle me this…&rdquo;
            </div>
            <div className="riddle">I hold thousands of worlds but never leave my shelf.</div>
            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="hand" style={{ fontSize: 15 }}>
                💡 hint <span className="acc">(+60s)</span>
              </div>
              <div className="hand" style={{ fontSize: 15 }}>🗺️ map</div>
            </div>
            <div className="grow" />
            <div className="btn ink-btn">I think I&apos;m there →</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function CluePeekMap() {
  return (
    <Phone>
      <div className="body">
        <div className="pad" style={{ paddingBottom: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">Clue 1 / 9</div>
            <div className="row gap-2">
              <div className="pill ghost">2 hints</div>
              <div className="pill solid mono">04:12</div>
            </div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 6, paddingBottom: 8 }}>
          <div className="riddle sm">
            &ldquo;I hold thousands of worlds but never leave my shelf.&rdquo;
          </div>
        </div>
        <div className="grow" style={{ margin: "0 12px 8px", position: "relative" }}>
          <div className="ph-box map" style={{ height: "100%", borderRadius: 14 }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 78,
                height: 78,
                border: "2px dashed var(--accent)",
                borderRadius: "50%",
                background: "rgba(239,91,58,0.08)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 10,
                height: 10,
                background: "var(--accent)",
                border: "2px solid white",
                borderRadius: "50%",
                boxShadow: "0 0 0 3px rgba(239,91,58,0.3)",
              }}
            />
            <div style={{ position: "absolute", bottom: 8, left: 8 }} className="pill mono small">
              130 m away
            </div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="row gap-2">
            <div className="btn ghost"><span>💡</span></div>
            <div className="btn primary grow">I&apos;m here · verify</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}
