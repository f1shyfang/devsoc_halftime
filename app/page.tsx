import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FeedBounty = {
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  max_seats: number;
};

export default async function FeedPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounties_public")
    .select("slug, title, description, location, starts_at, ends_at, max_seats")
    .order("starts_at", { ascending: true });

  const bounties = (data ?? []) as FeedBounty[];
  const halftime = bounties.find((b) => b.slug === "halftime-tabledrop");
  const rest = bounties.filter((b) => b.slug !== "halftime-tabledrop");

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-12 flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl">TableDrop</h1>
        <p className="text-[var(--td-dim)] text-sm">
          Summon a table. Curated rooms, here, now.
        </p>
      </header>

      {halftime && (
        <section className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest text-[var(--td-accent)]">
            Now
          </span>
          <BountyCard bounty={halftime} highlight />
        </section>
      )}

      {rest.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-widest text-[var(--td-dim)]">
            Other tables
          </span>
          <div className="flex flex-col gap-3">
            {rest.map((b) => (
              <BountyCard key={b.slug} bounty={b} />
            ))}
          </div>
        </section>
      )}

      {bounties.length === 0 && (
        <p className="text-[var(--td-dim)]">No tables open. Check back soon.</p>
      )}
    </main>
  );
}

function BountyCard({
  bounty,
  highlight,
}: {
  bounty: FeedBounty;
  highlight?: boolean;
}) {
  const endsAt = new Date(bounty.ends_at).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Link
      href={`/b/${bounty.slug}`}
      className={`block rounded-md border p-5 flex flex-col gap-2 transition-colors ${
        highlight
          ? "border-[var(--td-accent)] hover:bg-white/[0.02]"
          : "border-white/10 hover:bg-white/[0.02]"
      }`}
    >
      <h2 className="font-display text-2xl leading-tight">{bounty.title}</h2>
      {bounty.description && (
        <p className="text-sm text-[var(--td-text)]/80 line-clamp-2">
          {bounty.description}
        </p>
      )}
      <p className="text-xs text-[var(--td-dim)] mt-1">
        {bounty.location ? `${bounty.location} · ` : ""}ends {endsAt} · {bounty.max_seats} seats
      </p>
    </Link>
  );
}
