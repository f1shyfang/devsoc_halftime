import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinerClient from "./joiner-client";

export const dynamic = "force-dynamic";

type Bounty = {
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  max_seats: number;
};

export default async function BountyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ci?: string }>;
}) {
  const { slug } = await params;
  const { ci } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounties_public")
    .select("slug, title, description, location, starts_at, ends_at, max_seats")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) notFound();

  return <JoinerClient bounty={data as Bounty} checkinToken={ci ?? null} />;
}
