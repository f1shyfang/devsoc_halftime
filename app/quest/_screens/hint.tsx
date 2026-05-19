import { Phone } from "../_components/Phone";

export function HintModal() {
  return (
    <Phone time="9:44" battery="●●●● 86%">
      <div className="body" style={{ position: "relative" }}>
        <div style={{ opacity: 0.35, pointerEvents: "none", display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="pad"><div className="label">Tier 1 · Clue 1</div></div>
          <div className="pad grow"><div className="riddle">&ldquo;I hold thousands of worlds but never leave my shelf.&rdquo;</div></div>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(26,26,34,0.45)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div className="card" style={{ width: "100%", background: "var(--paper)", padding: 18 }}>
            <div className="row gap-2" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>💡</span>
              <div className="h2">Use a hint?</div>
            </div>
            <div className="p muted" style={{ marginBottom: 14 }}>
              This adds <b style={{ color: "var(--accent)" }}>+60 seconds</b> to your final time. You&apos;ll have 1 hint left after this.
            </div>
            <div className="row gap-2">
              <div className="btn ghost grow">Cancel</div>
              <div className="btn primary grow">Spend hint</div>
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function HintInline() {
  return (
    <Phone time="9:44" battery="●●●● 86%">
      <div className="body">
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">Clue 1 / 9</div>
            <div className="pill mono">05:12 <span className="acc">+1:00</span></div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 6 }}>
          <div className="riddle sm">&ldquo;I hold thousands of worlds but never leave my shelf.&rdquo;</div>
        </div>
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="card tint">
            <div className="row gap-2" style={{ marginBottom: 6 }}>
              <span>💡</span>
              <div className="label" style={{ color: "var(--accent)" }}>Hint 1 of 2</div>
            </div>
            <div className="hand" style={{ fontSize: 18, lineHeight: 1.25 }}>
              Think about what holds worlds you can travel to.
            </div>
          </div>
        </div>
        <div className="grow" />
        <div className="pad">
          <div className="row gap-2">
            <div className="btn ghost grow">Reveal hint 2 (+60s)</div>
            <div className="btn ink-btn"><span>🗺️</span></div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function HintDrawer() {
  return (
    <Phone time="9:44" battery="●●●● 86%">
      <div className="body" style={{ position: "relative" }}>
        <div style={{ opacity: 0.25, display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="pad"><div className="label">Tier 1 · Clue 1</div></div>
          <div className="pad grow"><div className="riddle">&ldquo;I hold thousands of worlds…&rdquo;</div></div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            background: "var(--paper)",
            border: "var(--stroke) solid var(--ink)",
            borderRadius: 20,
            padding: 14,
          }}
        >
          <div style={{ width: 40, height: 4, background: "var(--hair)", borderRadius: 99, margin: "0 auto 12px" }} />
          <div className="h2" style={{ marginBottom: 10 }}>Hints</div>
          <div className="card flat" style={{ marginBottom: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <div className="label">Hint 1 · revealed</div>
              <div className="mono small acc">+60s</div>
            </div>
            <div className="p">Think about what holds worlds you can travel to.</div>
          </div>
          <div
            className="card dash"
            style={{ borderColor: "var(--hair)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              <div className="label">Hint 2 · locked</div>
              <div className="muted small">Adds another +60s</div>
            </div>
            <div className="btn primary" style={{ padding: "8px 12px" }}>Reveal</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}
