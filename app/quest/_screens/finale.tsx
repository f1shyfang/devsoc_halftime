import { Phone } from "../_components/Phone";

export function FinaleStats() {
  return (
    <Phone time="10:42" battery="●●●● 72%">
      <div className="body">
        <div className="confetti">
          <i style={{ top: "8%", left: "10%" }} />
          <i style={{ top: "14%", left: "80%", background: "var(--lime)", transform: "rotate(-30deg)" }} />
          <i style={{ top: "36%", left: "6%", background: "var(--ink)" }} />
        </div>
        <div className="pad" style={{ textAlign: "center" }}>
          <div className="hand" style={{ fontSize: 18, color: "var(--accent)" }}>YOU FINISHED</div>
          <div className="hand" style={{ fontSize: 38, lineHeight: 1, marginTop: 2 }}>UNSW 101</div>
        </div>
        <div className="pad" style={{ paddingTop: 0, textAlign: "center" }}>
          <div className="mono small muted">Total time</div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            58:24
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 4, marginTop: 4 }}>
            <span className="pill acc-pill">2nd of 7 🥈</span>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="row gap-2" style={{ textAlign: "center" }}>
            <div className="card flat grow" style={{ padding: 10, textAlign: "center" }}>
              <div className="hand" style={{ fontSize: 22 }}>3</div>
              <div className="xs">hints</div>
            </div>
            <div className="card flat grow" style={{ padding: 10, textAlign: "center" }}>
              <div className="hand" style={{ fontSize: 22 }}>5</div>
              <div className="xs">photos</div>
            </div>
            <div className="card flat grow" style={{ padding: 10, textAlign: "center" }}>
              <div className="hand" style={{ fontSize: 22 }}>
                2.3<span style={{ fontSize: 11 }}>km</span>
              </div>
              <div className="xs">walked</div>
            </div>
          </div>
        </div>
        <div className="grow" />
        <div className="pad">
          <div className="btn primary"><span>↗</span> Share results card</div>
        </div>
      </div>
    </Phone>
  );
}

export function FinaleReceipt() {
  return (
    <Phone time="10:42" battery="●●●● 72%">
      <div className="body">
        <div className="pad" style={{ textAlign: "center" }}>
          <div className="hand" style={{ fontSize: 14, letterSpacing: "0.2em", color: "var(--quest-muted)" }}>
            — RECEIPT —
          </div>
          <div className="hand" style={{ fontSize: 26, marginTop: 2 }}>Team Quokkas</div>
        </div>
        <div className="pad" style={{ paddingTop: 0, flex: 1, overflow: "hidden" }}>
          <div
            className="card flat"
            style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "14px 16px", background: "#fffdf3" }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>HUNT</span><span>UNSW 101</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span>STARTED</span><span>09:39</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span>FINISHED</span><span>10:37</span>
            </div>
            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>TIER 1</span><span>14:22</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
              <span>TIER 2</span><span>21:18</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
              <span>TIER 3</span><span>19:44</span>
            </div>
            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>HINTS × 3</span><span className="acc">+3:00</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
              <span>OVERRIDES</span><span>0</span>
            </div>
            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
              <span>TOTAL</span><span>58:24</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
              <span>RANK</span><span className="acc">2 / 7</span>
            </div>
          </div>
        </div>
        <div className="pad">
          <div className="row gap-2">
            <div className="btn ghost grow">Reel</div>
            <div className="btn primary grow">Share</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function FinaleReel() {
  return (
    <Phone time="10:42" battery="●●●● 72%">
      <div className="body">
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">your reel · 5 photos</div>
            <div className="pill solid mono">58:24 · 2nd</div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 6 }}>
          <div
            className="ph-box photo"
            style={{ height: 230, borderRadius: 14, borderStyle: "solid", borderColor: "var(--ink)" }}
          />
          <div className="hand" style={{ fontSize: 18, marginTop: 8, lineHeight: 1.1 }}>
            &ldquo;Recreate the Einstein pose&rdquo;
          </div>
          <div className="muted small">Tier 2 · Physics Lawn · 10:14</div>
        </div>
        <div className="pad" style={{ paddingTop: 8 }}>
          <div className="row gap-2">
            <div className="ph-box photo" style={{ width: 56, height: 56, borderRadius: 10 }} />
            <div className="ph-box photo" style={{ width: 56, height: 56, borderRadius: 10 }} />
            <div className="ph-box photo" style={{ width: 56, height: 56, borderRadius: 10 }} />
            <div className="ph-box photo" style={{ width: 56, height: 56, borderRadius: 10 }} />
          </div>
        </div>
        <div className="grow" />
        <div className="pad">
          <div className="btn primary"><span>↗</span> Share this card</div>
        </div>
      </div>
    </Phone>
  );
}
