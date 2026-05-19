import { Phone } from "../_components/Phone";
import { Reticle } from "../_components/Reticle";

export function QrFull() {
  return (
    <Phone time="9:46" battery="●●●● 85%" screenStyle={{ background: "#1a1a22" }} statusColor="#fff8ec">
      <div className="body">
        <div className="pad">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="pill solid" style={{ background: "#fff8ec", color: "#1a1a22" }}>← back</div>
            <div
              className="pill"
              style={{ background: "rgba(0,0,0,0.4)", color: "#fff8ec", borderColor: "rgba(255,255,255,0.5)" }}
            >
              torch · off
            </div>
          </div>
        </div>
        <div className="grow center" style={{ flexDirection: "column", gap: 18 }}>
          <Reticle />
          <div className="hand" style={{ color: "#fff8ec", fontSize: 20 }}>Find the printed code</div>
          <div className="mono small" style={{ color: "rgba(255,248,236,0.7)" }}>at the library entrance</div>
        </div>
        <div className="pad">
          <div
            className="btn"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff8ec", borderColor: "rgba(255,255,255,0.5)" }}
          >
            Can&apos;t find it? Use GPS instead
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function QrFramed() {
  return (
    <Phone time="9:46" battery="●●●● 85%">
      <div className="body">
        <div className="pad">
          <div className="label">Clue 4 · verify by QR</div>
          <div className="h2" style={{ marginTop: 4 }}>There&apos;s a code at this spot</div>
        </div>
        <div className="pad" style={{ paddingTop: 6 }}>
          <div
            className="card"
            style={{
              padding: 12,
              background: "#1a1a22",
              borderColor: "#1a1a22",
              position: "relative",
              aspectRatio: "1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
            }}
          >
            <Reticle style={{ width: 140, height: 140, transform: "scale(0.9)" }} />
            <div
              style={{ position: "absolute", top: 8, left: 10, color: "#fff8ec" }}
              className="mono small"
            >
              SCANNING…
            </div>
          </div>
        </div>
        <div className="pad">
          <div className="p muted">Point your camera at the printed code. Auto-unlocks on success.</div>
        </div>
        <div className="grow" />
        <div className="pad">
          <div className="btn ghost">Use GPS fallback</div>
        </div>
      </div>
    </Phone>
  );
}

export function QrPrompt() {
  return (
    <Phone time="9:46" battery="●●●● 85%">
      <div className="body">
        <div className="pad">
          <div className="label">Clue 4 — bench plaque</div>
        </div>
        <div className="pad grow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="hand" style={{ fontSize: 28, lineHeight: 1.05 }}>
            Look for a small sticker on the plaque.
          </div>
          <div className="p muted">It looks like a square barcode. About the size of a coin.</div>
          <div
            className="ph-box"
            style={{
              height: 160,
              borderStyle: "solid",
              borderColor: "var(--hair)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontFamily: "var(--mono)", fontSize: 10 }}>[ sample QR illustration ]</div>
          </div>
          <div className="grow" />
          <div className="btn primary"><span>📷</span> Open scanner</div>
          <div className="btn ghost">Can&apos;t find it · use GPS</div>
        </div>
      </div>
    </Phone>
  );
}
