import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getPusher, debateChannel } from "@/lib/pusher";
import {
  canSubmitTurn,
  nextStateAfterTurn,
  roomMetaKey,
  roomTurnsKey,
  type RoomMeta,
  type TurnEntry,
} from "@/lib/room-state";
import { TOTAL_TURNS } from "@/lib/config";

export const maxDuration = 30;

export async function POST(req: Request) {
  const sessionId = req.headers.get("x-session-id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing session" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as {
    roomId?: string;
    turn_index?: number;
    transcript?: string;
    audio_duration_ms?: number;
  } | null;
  if (
    !body ||
    typeof body.roomId !== "string" ||
    typeof body.turn_index !== "number" ||
    typeof body.transcript !== "string"
  ) {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const redis = getRedis();
  const metaKey = roomMetaKey(body.roomId);
  const turnsKey = roomTurnsKey(body.roomId);

  const meta = (await redis.hgetall(metaKey)) as unknown as RoomMeta | null;
  if (!meta || !meta.player1) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  if (sessionId !== meta.player1 && sessionId !== meta.player2) {
    return NextResponse.json({ error: "not a player" }, { status: 403 });
  }
  if (!canSubmitTurn(meta.state)) {
    return NextResponse.json(
      { error: "invalid state", state: meta.state },
      { status: 409 }
    );
  }
  // Turns must arrive in order. Reject submissions that skip ahead or repeat
  // a stale index — dedup alone would let a misbehaving client RPUSH a future
  // turn and bump turn_count past the current speaker's turn.
  const expectedIndex = Number(meta.turn_count);
  if (body.turn_index !== expectedIndex) {
    return NextResponse.json(
      { error: "wrong turn index", expected_index: expectedIndex },
      { status: 409 }
    );
  }
  // Whose turn is it? Even index → player1, odd → player2.
  const expectedPlayer =
    body.turn_index % 2 === 0 ? meta.player1 : meta.player2;
  if (sessionId !== expectedPlayer) {
    return NextResponse.json(
      { error: "not your turn", expected_index: expectedIndex },
      { status: 409 }
    );
  }

  // Idempotency: scan existing turns; reject duplicate turn_index.
  const existing = (await redis.lrange(turnsKey, 0, -1)) as TurnEntry[];
  const already = existing.some((t) => t.turn_index === body.turn_index);
  if (already) {
    return NextResponse.json({ status: "ok", duplicate: true });
  }

  const turn: TurnEntry = {
    player: sessionId,
    transcript: body.transcript,
    turn_index: body.turn_index,
    audio_duration_ms: body.audio_duration_ms,
  };
  await redis.rpush(turnsKey, turn);
  const newCount = Number(meta.turn_count) + 1;
  const newState = nextStateAfterTurn(meta.state, newCount, TOTAL_TURNS);
  await redis.hset(metaKey, {
    turn_count: newCount,
    state: newState,
  });

  await getPusher().trigger(debateChannel(body.roomId), "turn-submitted", {
    turn,
    turn_count: newCount,
    state: newState,
  });

  return NextResponse.json({
    status: "ok",
    turn_count: newCount,
    state: newState,
  });
}
