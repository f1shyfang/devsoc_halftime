import Link from "next/link";
import { notFound } from "next/navigation";
import { findStage, stages } from "../_registry";

export function generateStaticParams() {
  return stages.map((stage) => ({ stage: stage.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  const found = findStage(stage);
  return { title: found ? `UNSW Quest · ${found.title}` : "UNSW Quest" };
}

export default async function StagePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage: stageSlug } = await params;
  const stage = findStage(stageSlug);
  if (!stage) notFound();

  return (
    <div className="viewer">
      <div className="crumbs">
        <Link href="/quest">storyboard</Link>
        <span className="sep">/</span>
        <span>stage {stage.number}</span>
      </div>
      <div className="viewer-title">{stage.title}</div>
      <div className="muted small" style={{ maxWidth: 320, textAlign: "center" }}>{stage.blurb}</div>
      <div
        style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {stage.variants.map((variant) => {
          const Screen = variant.Component;
          return (
            <div className="frame-wrap" key={variant.slug}>
              <div className="frame-label">
                <span className="tag">{variant.tag}</span>
                <span className="lbl">{variant.label}</span>
              </div>
              <Link href={`/quest/${stage.slug}/${variant.slug}`}>
                <Screen />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
