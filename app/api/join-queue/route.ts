import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getPusher, debateChannel, lobbyChannel } from "@/lib/pusher";
import { generateDebatePrompt } from "@/lib/anthropic";
import {
  generateRoomId,
  roomMetaKey,
  type RoomMeta,
} from "@/lib/room-state";
import { QUEUE_TTL_SEC, ROOM_TTL_SEC, STAKE } from "@/lib/config";

export const maxDuration = 30;

const QUEUE_KEY = "queue";

export async function POST(req: Request) {
  const sessionId = req.headers.get("x-session-id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing session" }, { status: 400 });
  }

  const redis = getRedis();
  const pusher = getPusher();

  // Try to pop a waiting opponent atomically. If none, push self and wait.
  // RPOPLPUSH-style isn't needed because the queue is one-directional.
  const popped = (await redis.lpop(QUEUE_KEY, 1)) as string[] | string | null;
  const partner = Array.isArray(popped) ? popped[0] : popped;

  if (partner && partner !== sessionId) {
    // Make a room with the partner.
    const roomId = generateRoomId();
    const prompt = await generateDebatePrompt();
    const meta: RoomMeta = {
      player1: partner,
      player2: sessionId,
      prompt,
      stake: STAKE,
      state: "waiting",
      turn_count: 0,
      created_at: Date.now(),
    };
    const metaKey = roomMetaKey(roomId);
    await redis.hset(metaKey, meta as unknown as Record<string, unknown>);
    await redis.expire(metaKey, ROOM_TTL_SEC);

    const payload = {
      roomId,
      prompt,
      stake: STAKE,
      player1: partner,
      player2: sessionId,
    };

    // Notify both players. Partner is listening on its lobby channel;
    // self learns inline via the response.
    await Promise.all([
      pusher.trigger(lobbyChannel(partner), "matched", payload),
      pusher.trigger(debateChannel(roomId), "room-ready", payload),
    ]);

    return NextResponse.json({ status: "matched", ...payload });
  }

  if (partner === sessionId) {
    // We popped ourselves (stale entry). Push back, treat as fresh queue.
  }

  // No partner — enqueue self.
  await redis.lpush(QUEUE_KEY, sessionId);
  await redis.expire(QUEUE_KEY, QUEUE_TTL_SEC);
  return NextResponse.json({ status: "waiting" });
}

export async function DELETE(req: Request) {
  const sessionId = req.headers.get("x-session-id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing session" }, { status: 400 });
  }
  const redis = getRedis();
  await redis.lrem(QUEUE_KEY, 0, sessionId);
  return NextResponse.json({ status: "cancelled" });
}
