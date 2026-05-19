import { Phone } from "../_components/Phone";

export function MapFull() {
  return (
    <Phone time="9:43" battery="●●●● 86%">
      <div className="body" style={{ padding: 0 }}>
        <div className="ph-box map" style={{ position: "absolute", inset: 0, borderRadius: 0, border: 0 }} />
        <div style={{ position: "absolute", top: 46, left: 14, right: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div className="pill solid">← back to clue</div>
          <div className="pill mono">130 m</div>
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            transform: "translate(-50%,-50%)",
            width: 140,
            height: 140,
            border: "2.4px dashed var(--accent)",
            borderRadius: "50%",
            background: "rgba(239,91,58,0.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            transform: "translate(-50%,-50%)",
            width: 14,
            height: 14,
            background: "var(--accent)",
            border: "3px solid white",
            borderRadius: "50%",
            boxShadow: "0 0 0 4px rgba(239,91,58,0.3)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "60%",
            top: "36%",
            width: 18,
            height: 18,
            background: "var(--ink)",
            borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
          }}
        />
        <div style={{ position: "absolute", bottom: 14, left: 14, right: 14 }} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">Geofence</div>
              <div className="h3">25 m around the clue</div>
            </div>
            <div className="btn primary" style={{ padding: "8px 12px" }}>Got it</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function MapSplit() {
  return (
    <Phone time="9:43" battery="●●●● 86%">
      <div className="body">
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="label">Clue 1 / 9</div>
            <div className="pill mono">04:42</div>
          </div>
        </div>
        <div className="pad" style={{ paddingTop: 6, paddingBottom: 8 }}>
          <div className="riddle sm">&ldquo;I hold thousands of worlds but never leave my shelf.&rdquo;</div>
        </div>
        <div style={{ margin: "0 12px 8px", position: "relative", height: 240 }}>
          <div className="ph-box map" style={{ position: "absolute", inset: 0, borderRadius: 14 }} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 110,
              height: 110,
              border: "2.2px dashed var(--accent)",
              borderRadius: "50%",
              background: "rgba(239,91,58,0.1)",
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
            }}
          />
        </div>
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", paddingBottom: 8 }}>
            <div className="hand" style={{ fontSize: 18 }}>130 m to checkpoint</div>
            <div className="muted small">accuracy ±8m</div>
          </div>
          <div className="btn primary">I&apos;m here · verify</div>
        </div>
      </div>
    </Phone>
  );
}

export function MapCompass() {
  return (
    <Phone time="9:43" battery="●●●● 86%">
      <div className="body">
        <div className="pad">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="pill solid">← clue</div>
            <div className="label">No map mode</div>
          </div>
        </div>
        <div className="grow center" style={{ flexDirection: "column", gap: 18 }}>
          <div
            style={{
              width: 160,
              height: 160,
              border: "1.6px solid var(--ink)",
              borderRadius: "50%",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }} className="mono small">N</div>
            <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)" }} className="mono small muted">S</div>
            <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} className="mono small muted">W</div>
            <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }} className="mono small muted">E</div>
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "18px solid transparent",
                borderRight: "18px solid transparent",
                borderBottom: "64px solid var(--accent)",
                transform: "rotate(38deg) translate(0, -8px)",
                transformOrigin: "center",
              }}
            />
          </div>
          <div className="hand" style={{ fontSize: 34, lineHeight: 1 }}>130 m</div>
          <div className="muted small">walk roughly northeast</div>
        </div>
        <div className="pad">
          <div className="btn ink-btn">Show me the map instead</div>
        </div>
      </div>
    </Phone>
  );
}
