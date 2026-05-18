import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  roomMetaKey,
  roomTurnsKey,
  type RoomMeta,
  type TurnEntry,
} from "@/lib/room-state";

export const maxDuration = 10;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }
  const redis = getRedis();
  const meta = (await redis.hgetall(roomMetaKey(roomId))) as unknown as
    | RoomMeta
    | null;
  if (!meta || !meta.player1) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  const turns = (await redis.lrange(roomTurnsKey(roomId), 0, -1)) as TurnEntry[];
  let verdict: unknown = null;
  if (meta.verdict) {
    try {
      verdict = JSON.parse(meta.verdict);
    } catch {
      verdict = null;
    }
  }
  return NextResponse.json({
    roomId,
    state: meta.state,
    player1: meta.player1,
    player2: meta.player2,
    prompt: meta.prompt,
    stake: Number(meta.stake),
    turn_count: Number(meta.turn_count),
    turns,
    verdict,
  });
}
