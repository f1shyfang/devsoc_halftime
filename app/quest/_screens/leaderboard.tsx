import { Phone } from "../_components/Phone";

export function LeaderboardBar() {
  return (
    <Phone time="10:02" battery="●●●● 81%">
      <div className="body">
        <div
          style={{
            margin: "6px 12px 8px",
            padding: "8px 10px",
            background: "var(--ink)",
            color: "var(--paper)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div className="mono small" style={{ color: "var(--lime)" }}>2 / 7</div>
          <div className="grow" style={{ fontSize: 11 }}>
            You&apos;re behind <b>Team Echo</b> by <b>1:24</b>
          </div>
          <div style={{ fontSize: 14 }}>▾</div>
        </div>
        <div className="pad" style={{ paddingBottom: 6 }}>
          <div className="label">Tier 2 · Clue 5</div>
        </div>
        <div className="pad" style={{ paddingTop: 6 }}>
          <div className="riddle sm">&ldquo;Where clubs recruit and free pizza appears.&rdquo;</div>
        </div>
        <div className="grow" />
        <div className="pad">
          <div className="row gap-2">
            <div className="btn ghost"><span>💡</span> 2</div>
            <div className="btn ghost"><span>🗺️</span></div>
            <div className="btn primary grow">I&apos;m here</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function LeaderboardPeek() {
  return (
    <Phone time="10:02" battery="●●●● 81%">
      <div className="body" style={{ position: "relative" }}>
        <div style={{ opacity: 0.4, display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="pad"><div className="label">Tier 2 · Clue 5</div></div>
          <div className="pad"><div className="riddle">&ldquo;Where clubs recruit…&rdquo;</div></div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 80,
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "8px 12px",
            borderRadius: 99,
            fontFamily: "var(--mono)",
            fontSize: 10,
          }}
        >
          2 of 7 · ▴
        </div>
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            background: "var(--paper)",
            border: "var(--stroke) solid var(--ink)",
            borderRadius: 18,
            padding: 14,
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div className="h2">Standings</div>
            <div className="muted small">updated live</div>
          </div>
          <div className="lb">
            <div className="rank">1</div>
            <div className="av lime-av">EC</div>
            <div className="nm">Echo Squad</div>
            <div className="pr">T2 · C5</div>
            <div className="tm">19:22</div>
          </div>
          <div className="lb me">
            <div className="rank">2</div>
            <div className="av">US</div>
            <div className="nm">You</div>
            <div className="pr">T2 · C5</div>
            <div className="tm">20:46</div>
          </div>
          <div className="lb">
            <div className="rank">3</div>
            <div className="av ink-av">DR</div>
            <div className="nm">Drop Bears</div>
            <div className="pr">T2 · C4</div>
            <div className="tm">21:18</div>
          </div>
          <div className="lb">
            <div className="rank">4</div>
            <div className="av dash">…</div>
            <div className="nm muted">4 more teams</div>
            <div className="pr" />
            <div className="tm" />
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function LeaderboardTabbed() {
  return (
    <Phone time="10:02" battery="●●●● 81%">
      <div className="body">
        <div className="pad">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="hand" style={{ fontSize: 26 }}>Standings</div>
            <div className="pill ghost">updates live</div>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>UNSW 101 · 7 teams</div>
        </div>
        <div className="pad" style={{ paddingTop: 0, flex: 1, overflow: "hidden" }}>
          <div className="card" style={{ padding: "6px 4px" }}>
            <div className="lb">
              <div className="rank">1</div><div className="av lime-av">EC</div>
              <div className="nm">Echo Squad</div><div className="pr">T2 · C5</div><div className="tm">19:22</div>
            </div>
            <div className="lb me">
              <div className="rank">2</div><div className="av">US</div>
              <div className="nm">You · Quokkas</div><div className="pr">T2 · C5</div><div className="tm">20:46</div>
            </div>
            <div className="lb">
              <div className="rank">3</div><div className="av ink-av">DR</div>
              <div className="nm">Drop Bears</div><div className="pr">T2 · C4</div><div className="tm">21:18</div>
            </div>
            <div className="lb">
              <div className="rank">4</div><div className="av lime-av">FN</div>
              <div className="nm">FinanceBros</div><div className="pr">T2 · C4</div><div className="tm">22:01</div>
            </div>
            <div className="lb">
              <div className="rank">5</div><div className="av">MX</div>
              <div className="nm">MathX</div><div className="pr">T1 · C3</div><div className="tm">22:38</div>
            </div>
            <div className="lb">
              <div className="rank">6</div><div className="av ink-av">PZ</div>
              <div className="nm">Pizza Time</div><div className="pr">T1 · C3</div><div className="tm">23:11</div>
            </div>
          </div>
        </div>
        <div className="tab">
          <div className="ti"><div className="ic" />Hunt</div>
          <div className="ti on"><div className="ic" />Standings</div>
          <div className="ti"><div className="ic" />Reel</div>
        </div>
      </div>
    </Phone>
  );
}
