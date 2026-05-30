import { callRpcRows } from "@/lib/db/rpc";
import { getDeviceIdFromRequest } from "@/lib/api/device";

export async function POST(req: Request): Promise<Response> {
  const deviceId = getDeviceIdFromRequest(req);
  if (!deviceId) {
    return Response.json({ error: "missing_device_id" }, { status: 400 });
  }
  const body = (await req.json()) as { huntId?: string; teamName?: string };
  if (!body.huntId) {
    return Response.json({ error: "missing_hunt_id" }, { status: 400 });
  }
  try {
    const rows = await callRpcRows("quest_create_team", [
      deviceId,
      body.huntId,
      body.teamName?.trim() || null,
    ]);
    if (rows.length === 0) {
      return Response.json({ error: "create_failed" }, { status: 400 });
    }
    return Response.json(rows[0], { status: 200 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "create_failed" },
      { status: 400 },
    );
  }
}
