import { callRpcRows } from "@/lib/db/rpc";
import { getDeviceIdFromRequest } from "@/lib/api/device";

export async function POST(req: Request): Promise<Response> {
  const deviceId = getDeviceIdFromRequest(req);
  if (!deviceId) {
    return Response.json({ error: "missing_device_id" }, { status: 400 });
  }
  const body = (await req.json()) as { inviteCode?: string };
  const code = (body.inviteCode ?? "").trim().toUpperCase();
  if (code.length !== 6) {
    return Response.json({ error: "invalid_invite_code" }, { status: 400 });
  }
  try {
    const rows = await callRpcRows("quest_join_team", [deviceId, code]);
    if (rows.length === 0) {
      return Response.json({ error: "join_failed" }, { status: 400 });
    }
    return Response.json(rows[0], { status: 200 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "join_failed" },
      { status: 400 },
    );
  }
}
