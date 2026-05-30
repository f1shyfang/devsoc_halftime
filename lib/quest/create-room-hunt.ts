import { db } from "@/lib/db/client";
import { questClues, questHunts } from "@/lib/db/schema";
import type { HuntDraft } from "./generate-room-hunt";

/**
 * Persist a generated hunt: one quest_hunts row (published) plus its
 * quest_clues rows. Slug is provided by the caller (rooms-<id> convention so
 * generated hunts are identifiable for cleanup). Returns the new hunt id.
 */
export async function createRoomHunt(
  draft: HuntDraft,
): Promise<{ huntId: string; slug: string }> {
  const [hunt] = await db
    .insert(questHunts)
    .values({
      slug: draft.slug,
      name: draft.name,
      description: draft.description,
      durationMinutes: draft.duration_minutes,
      heroEmoji: draft.hero_emoji,
      status: "published",
    })
    .returning({ id: questHunts.id });

  if (draft.clues.length > 0) {
    await db.insert(questClues).values(
      draft.clues.map((c) => ({
        huntId: hunt.id,
        tier: c.tier,
        sequenceInTier: c.sequence_in_tier,
        type: c.type,
        bodyText: c.body_text,
        verificationType: c.verification_type,
        locationName: c.location_name,
        locationLat: c.location_lat,
        locationLng: c.location_lng,
        geofenceRadiusM: c.geofence_radius_m,
        hints: c.hints,
      })),
    );
  }

  return { huntId: hunt.id, slug: draft.slug };
}
