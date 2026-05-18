import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the real /api/join-queue route handler. We mock the lib helpers
 * (getRedis, getPusher, generateDebatePrompt) at module load time so the route
 * runs against an in-memory Redis and a stub Pusher — no env vars required.
 */

type FakeHash = Record<string, unknown>;

class FakeRedis {
  queue: string[] = [];
  hashes = new Map<string, FakeHash>();
  ttl = new Map<string, number>();

  async lpop(_key: string, count?: number): Promise<string | string[] | null> {
    if (typeof count === "number") {
      const out: string[] = [];
      for (let i = 0; i < count && this.queue.length; i++) {
        out.push(this.queue.shift()!);
      }
      return out.length ? out : null;
    }
    return this.queue.shift() ?? null;
  }
  async lpush(_key: string, ...values: string[]) {
    for (const v of values) this.queue.unshift(v);
    return this.queue.length;
  }
  async lrem(_key: string, _count: number, value: string) {
    const before = this.queue.length;
    this.queue = this.queue.filter((v) => v !== value);
    return before - this.queue.length;
  }
  async expire(key: string, sec: number) {
    this.ttl.set(key, sec);
    return 1;
  }
  async hset(key: string, obj: FakeHash) {
    const prev = this.hashes.get(key) ?? {};
    this.hashes.set(key, { ...prev, ...obj });
    return Object.keys(obj).length;
  }
}

const fakeRedis = new FakeRedis();
const pusherTriggers: Array<{ channel: string; event: string; data: unknown }> =
  [];

vi.mock("@/lib/redis", () => ({
  getRedis: () => fakeRedis,
}));
vi.mock("@/lib/pusher", () => ({
  getPusher: () => ({
    trigger: (channel: string, event: string, data: unknown) => {
      pusherTriggers.push({ channel, event, data });
      return Promise.resolve();
    },
  }),
  debateChannel: (id: string) => `debate-${id}`,
  lobbyChannel: (id: string) => `lobby-${id}`,
}));
vi.mock("@/lib/anthropic", () => ({
  generateDebatePrompt: async () => "Test prompt: remote work debate",
}));

// Dynamic import after mocks are registered.
async function loadRoute() {
  return await import("@/app/api/join-queue/route");
}

function joinReq(sessionId: string): Request {
  return new Request("http://test.local/api/join-queue", {
    method: "POST",
    headers: { "x-session-id": sessionId, "content-type": "application/json" },
  });
}

describe("/api/join-queue handler", () => {
  beforeEach(() => {
    fakeRedis.queue = [];
    fakeRedis.hashes.clear();
    fakeRedis.ttl.clear();
    pusherTriggers.length = 0;
  });

  it("empty queue → waiting + enqueues self + sets TTL", async () => {
    const { POST } = await loadRoute();
    const resp = await POST(joinReq("alice"));
    const body = await resp.json();
    expect(body.status).toBe("waiting");
    expect(fakeRedis.queue).toEqual(["alice"]);
    expect(fakeRedis.ttl.get("queue")).toBeDefined();
  });

  it("second joiner pops first → matched, room HSET, Pusher fires", async () => {
    const { POST } = await loadRoute();
    await POST(joinReq("alice"));
    const resp = await POST(joinReq("bob"));
    const body = await resp.json();
    expect(body.status).toBe("matched");
    expect(body.player1).toBe("alice");
    expect(body.player2).toBe("bob");
    expect(body.prompt).toContain("remote work");
    expect(fakeRedis.queue).toEqual([]);
    expect(fakeRedis.hashes.size).toBe(1);
    const [roomKey, meta] = [...fakeRedis.hashes.entries()][0];
    expect(roomKey).toMatch(/^room:.{6}:meta$/);
    expect((meta as Record<string, unknown>).state).toBe("waiting");
    // One trigger to lobby-alice (the waiter), one to debate-{roomId}.
    expect(pusherTriggers.length).toBe(2);
    expect(pusherTriggers.some((t) => t.channel === "lobby-alice")).toBe(true);
    expect(pusherTriggers.some((t) => t.event === "room-ready")).toBe(true);
  });

  it("third joiner with one already matched goes back to waiting", async () => {
    const { POST } = await loadRoute();
    await POST(joinReq("a"));
    await POST(joinReq("b"));
    const resp = await POST(joinReq("c"));
    const body = await resp.json();
    expect(body.status).toBe("waiting");
    expect(fakeRedis.queue).toEqual(["c"]);
  });

  it("stale self-entry: pops self → falls through to enqueue", async () => {
    const { POST } = await loadRoute();
    fakeRedis.queue = ["alice"];
    const resp = await POST(joinReq("alice"));
    const body = await resp.json();
    expect(body.status).toBe("waiting");
    expect(fakeRedis.queue).toEqual(["alice"]);
  });

  it("missing x-session-id → 400", async () => {
    const { POST } = await loadRoute();
    const resp = await POST(
      new Request("http://test.local/api/join-queue", { method: "POST" })
    );
    expect(resp.status).toBe(400);
  });

  it("DELETE removes session from queue", async () => {
    const { POST, DELETE } = await loadRoute();
    await POST(joinReq("alice"));
    expect(fakeRedis.queue).toEqual(["alice"]);
    const resp = await DELETE(joinReq("alice"));
    expect(resp.status).toBe(200);
    expect(fakeRedis.queue).toEqual([]);
  });
});
