import { NextResponse } from "next/server";
import { after } from "next/server";
import { getRedis } from "@/lib/redis";
import { getPusher, debateChannel } from "@/lib/pusher";
import { getAnthropic, JUDGE_MODEL } from "@/lib/anthropic";
import { buildJudgePrompt } from "@/lib/judge-prompt";
import {
  canJudge,
  roomJudgingLockKey,
  roomMetaKey,
  roomTurnsKey,
  type RoomMeta,
  type TurnEntry,
} from "@/lib/room-state";
import {
  drawVerdict,
  parseVerdict,
  type Verdict,
} from "@/lib/verdict-parser";
import { PUSHER_FLUSH_MS, ROOM_TTL_SEC } from "@/lib/config";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    roomId?: string;
  } | null;
  if (!body?.roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }
  const roomId = body.roomId;
  const redis = getRedis();
  const metaKey = roomMetaKey(roomId);
  const lockKey = roomJudgingLockKey(roomId);

  const meta = (await redis.hgetall(metaKey)) as unknown as RoomMeta | null;
  if (!meta || !meta.player1) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  if (!canJudge(meta.state)) {
    return NextResponse.json(
      { error: "invalid state", state: meta.state },
      { status: 409 }
    );
  }

  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 300 });
  if (!acquired) {
    return NextResponse.json(
      { ok: true, judging: true, duplicate: true },
      { status: 200 }
    );
  }

  await redis.hset(metaKey, { state: "judging" });
  await getPusher().trigger(debateChannel(roomId), "judging-started", {
    state: "judging",
  });

  const turns = (await redis.lrange(roomTurnsKey(roomId), 0, -1)) as TurnEntry[];

  after(async () => {
    await runJudgment({
      roomId,
      meta,
      turns,
    });
  });

  return NextResponse.json({ ok: true, judging: true });
}

async function runJudgment(args: {
  roomId: string;
  meta: RoomMeta;
  turns: TurnEntry[];
}) {
  const { roomId, meta, turns } = args;
  const pusher = getPusher();
  const channel = debateChannel(roomId);

  const stream = (strict: boolean) =>
    streamClaude({
      prompt: buildJudgePrompt(meta.prompt, turns, meta.player1, meta.player2, strict),
      onFlush: (chunk) => pusher.trigger(channel, "judgment-chunk", { chunk }),
    });

  let fullText = "";
  try {
    fullText = await stream(false);
  } catch (err) {
    console.error("judge stream failed", err);
    fullText = "";
  }

  let parsed = parseVerdict(fullText);
  if (!parsed.ok) {
    try {
      const retryText = await stream(true);
      const retryParsed = parseVerdict(retryText);
      if (retryParsed.ok) {
        parsed = retryParsed;
      } else {
        parsed = { ok: false, prose: retryParsed.prose };
      }
    } catch (err) {
      console.error("judge retry failed", err);
    }
  }

  let verdict: Verdict;
  let isDraw = false;
  if (parsed.ok) {
    verdict = parsed.verdict;
  } else {
    verdict = drawVerdict();
    isDraw = true;
  }

  const winnerId =
    verdict.winner === "player1" ? meta.player1 : meta.player2;
  const loserId =
    verdict.winner === "player1" ? meta.player2 : meta.player1;

  const redis = getRedis();
  try {
    await redis.hset(roomMetaKey(roomId), {
      state: "done",
      verdict: JSON.stringify({
        ...verdict,
        winner_id: winnerId,
        loser_id: loserId,
        is_draw: isDraw,
        stake: meta.stake,
      }),
    });
    await redis.expire(roomMetaKey(roomId), ROOM_TTL_SEC);
    await pusher.trigger(channel, "judgment-done", {
      verdict,
      winner_id: winnerId,
      loser_id: loserId,
      is_draw: isDraw,
      stake: meta.stake,
    });
  } catch (err) {
    console.error("judge persistence failed", err);
    // Notify clients so they exit the "Judge is deliberating…" spinner.
    // The room may remain in `judging` if Redis is unreachable; the 5min
    // SETNX lock will expire and the next /api/judge can retry.
    try {
      await pusher.trigger(channel, "judgment-failed", {
        message: "Judgment could not be persisted. Retry shortly.",
      });
    } catch {
      /* swallow — Pusher also down, nothing left to do */
    }
  }
}

async function streamClaude(args: {
  prompt: string;
  onFlush: (chunk: string) => Promise<unknown> | unknown;
}): Promise<string> {
  const client = getAnthropic();
  let buffer = "";
  let full = "";
  let lastFlushAt = Date.now();

  const flush = async () => {
    if (!buffer) return;
    const chunk = buffer;
    buffer = "";
    lastFlushAt = Date.now();
    try {
      await args.onFlush(chunk);
    } catch (err) {
      console.error("pusher flush error", err);
    }
  };

  const stream = client.messages.stream({
    model: JUDGE_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: args.prompt }],
  });

  stream.on("text", (text: string) => {
    full += text;
    buffer += text;
  });

  // Poll-flush loop in parallel with stream consumption.
  const flushTimer = setInterval(async () => {
    if (Date.now() - lastFlushAt >= PUSHER_FLUSH_MS) {
      await flush();
    }
  }, PUSHER_FLUSH_MS);

  try {
    await stream.finalMessage();
  } finally {
    clearInterval(flushTimer);
    await flush();
  }

  return full;
}
