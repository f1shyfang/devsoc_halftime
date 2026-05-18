import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  generateRoomId,
  roomMetaKey,
  roomTurnsKey,
  type RoomMeta,
  type TurnEntry,
} from "@/lib/room-state";
import { ROOM_TTL_SEC, STAKE, TOTAL_TURNS } from "@/lib/config";

export const maxDuration = 10;

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    prompt?: string;
    transcripts?: string[];
    player1?: string;
    player2?: string;
  } | null;
  if (
    !body ||
    typeof body.prompt !== "string" ||
    !Array.isArray(body.transcripts) ||
    body.transcripts.length !== TOTAL_TURNS
  ) {
    return NextResponse.json(
      { error: `body must include prompt and ${TOTAL_TURNS} transcripts` },
      { status: 400 }
    );
  }
  const player1 = body.player1 || "seed-player-1";
  const player2 = body.player2 || "seed-player-2";

  const roomId = generateRoomId();
  const meta: RoomMeta = {
    player1,
    player2,
    prompt: body.prompt,
    stake: STAKE,
    state: "complete",
    turn_count: TOTAL_TURNS,
    created_at: Date.now(),
  };
  const redis = getRedis();
  await redis.hset(
    roomMetaKey(roomId),
    meta as unknown as Record<string, unknown>
  );
  await redis.expire(roomMetaKey(roomId), ROOM_TTL_SEC);

  const turns: TurnEntry[] = body.transcripts.map((t, i) => ({
    player: i % 2 === 0 ? player1 : player2,
    transcript: t,
    turn_index: i,
  }));
  if (turns.length > 0) {
    await redis.rpush(
      roomTurnsKey(roomId),
      ...(turns as unknown as Array<string | number | object>)
    );
    await redis.expire(roomTurnsKey(roomId), ROOM_TTL_SEC);
  }

  return NextResponse.json({
    roomId,
    url: `/debate/${roomId}`,
  });
}
