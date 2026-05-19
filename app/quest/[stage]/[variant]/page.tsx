import Link from "next/link";
import { notFound } from "next/navigation";
import { findVariant, stages } from "../../_registry";

export function generateStaticParams() {
  return stages.flatMap((stage) =>
    stage.variants.map((variant) => ({ stage: stage.slug, variant: variant.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stage: string; variant: string }>;
}) {
  const { stage, variant } = await params;
  const found = findVariant(stage, variant);
  if (!found) return { title: "UNSW Quest" };
  return { title: `UNSW Quest · ${found.stage.title} — ${found.variant.label}` };
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ stage: string; variant: string }>;
}) {
  const { stage: stageSlug, variant: variantSlug } = await params;
  const found = findVariant(stageSlug, variantSlug);
  if (!found) notFound();

  const { stage, variant } = found;
  const Screen = variant.Component;

  return (
    <div className="viewer">
      <div className="crumbs">
        <Link href="/quest">storyboard</Link>
        <span className="sep">/</span>
        <span>stage {stage.number}</span>
        <span className="sep">/</span>
        <span>{stage.title}</span>
      </div>
      <div className="viewer-title">{variant.label}</div>
      <div className="nav">
        {stage.variants.map((v) => (
          <Link
            key={v.slug}
            href={`/quest/${stage.slug}/${v.slug}`}
            className={v.slug === variant.slug ? "on" : ""}
          >
            {v.tag} · {v.label}
          </Link>
        ))}
      </div>
      <Screen />
      {variant.anno ? (
        <div className="muted small" style={{ fontFamily: "var(--hand)", fontSize: 16 }}>
          {variant.anno}
        </div>
      ) : null}
    </div>
  );
}
