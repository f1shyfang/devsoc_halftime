import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HostClient from "./host-client";

export const dynamic = "force-dynamic";

type Bounty = {
  id: string;
  slug: string;
  title: string;
  max_seats: number;
};

export default async function HostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounties_public")
    .select("id, slug, title, max_seats")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  return <HostClient bounty={data as Bounty} />;
}
