import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { questClueProgress } from "@/lib/db/schema";
import { getDeviceIdFromRequest } from "@/lib/api/device";

/**
 * Set the captured photo URL on a clue-progress row. Replaces the play-shell's
 * former direct `supabase.from("quest_clue_progress").update(...)` write (used
 * by the "photo later" flow, separate from the unlock RPC's p_photo_url path).
 */
export async function POST(req: Request): Promise<Response> {
  const deviceId = getDeviceIdFromRequest(req);
  if (!deviceId) {
    return Response.json({ error: "missing_device_id" }, { status: 400 });
  }
  const body = (await req.json()) as {
    sessionId?: string;
    clueId?: string;
    photoUrl?: string;
  };
  if (!body.sessionId || !body.clueId || !body.photoUrl) {
    return Response.json({ error: "missing_args" }, { status: 400 });
  }
  await db
    .update(questClueProgress)
    .set({ photoCaptureUrl: body.photoUrl })
    .where(
      and(
        eq(questClueProgress.huntSessionId, body.sessionId),
        eq(questClueProgress.clueId, body.clueId),
      ),
    );
  return Response.json({ ok: true }, { status: 200 });
}
