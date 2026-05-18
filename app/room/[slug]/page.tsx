import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomClient from "./room-client";

export const dynamic = "force-dynamic";

type Bounty = {
  id: string;
  slug: string;
  title: string;
  max_seats: number;
  host_id: string;
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: bounty } = await supabase
    .from("bounties_public")
    .select("id, slug, title, max_seats, host_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!bounty) notFound();

  const { data: host } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", (bounty as Bounty).host_id)
    .maybeSingle();

  const { data: presence } = await supabase
    .from("room_presence")
    .select("profile_id, checked_in_at, profiles(name, tags)")
    .eq("bounty_id", (bounty as Bounty).id)
    .eq("is_present", true)
    .order("checked_in_at", { ascending: true });

  const initialRoster = (presence ?? []).map((row) => {
    const raw = row.profiles as unknown;
    const obj = Array.isArray(raw) ? raw[0] : raw;
    const p = (obj ?? null) as { name: string; tags: string[] | null } | null;
    return {
      profile_id: row.profile_id as string,
      name: p?.name ?? "guest",
      tags: p?.tags ?? [],
      checked_in_at: row.checked_in_at as string,
    };
  });

  return (
    <RoomClient
      bounty={bounty as Bounty}
      hostName={host?.name ?? "Host"}
      initialRoster={initialRoster}
    />
  );
}
