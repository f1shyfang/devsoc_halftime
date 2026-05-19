import Link from "next/link";
import { stages } from "./_registry";

export default function QuestStoryboardPage() {
  return (
    <>
      <header className="top">
        <div>
          <h1>
            UNSW Quest <span className="accent-text">/ wireframe storyboard</span>
          </h1>
          <div className="crumb">v0.1 · 8 stages · 3 variations each · mid-fi</div>
        </div>
        <div className="legend" style={{ alignItems: "center" }}>
          <Link href="/quest/flow" style={{ borderBottom: "1px dashed currentColor" }}>flow →</Link>
          <Link href="/quest/play" style={{ borderBottom: "1px dashed currentColor" }}>play view →</Link>
          <Link
            href="/quest/demo"
            className="pill acc-pill"
            style={{ textDecoration: "none" }}
          >
            ▶ playable demo
          </Link>
        </div>
      </header>

      <div className="intro">
        <span className="hand">A scroll through one team&apos;s hunt — from first clue to results card.</span>
        Each column is one moment in the journey. Three iPhone-shaped sketches per moment explore distinct
        takes on the same screen. Pan right to follow the flow. Tap any frame to open it on its own page.
      </div>

      <div className="track-wrap">
        <div className="track">
          {stages.map((stage) => (
            <section className="stage" key={stage.slug}>
              <div className="stage-head">
                <div className="stage-head-row">
                  <div>
                    <div className="n">STAGE {stage.number}</div>
                    <h2>{stage.title}</h2>
                  </div>
                  <div className="pill ghost">{stage.pill}</div>
                </div>
                <div className="blurb">{stage.blurb}</div>
              </div>

              <div className="frames">
                {stage.variants.map((variant) => {
                  const Screen = variant.Component;
                  return (
                    <div className="frame-wrap" key={variant.slug}>
                      <div className="frame-label">
                        <span className="tag">{variant.tag}</span>
                        <span className="lbl">{variant.label}</span>
                      </div>
                      <Link href={`/quest/${stage.slug}/${variant.slug}`} aria-label={`${stage.title} · ${variant.label}`}>
                        <Screen />
                      </Link>
                      {variant.anno ? <div className="anno below">{variant.anno}</div> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
