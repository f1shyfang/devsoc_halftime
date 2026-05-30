import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/db/rpc", () => ({ callRpcRows: vi.fn(), callRpcOne: vi.fn() }));

import { POST } from "./route";
import { callRpcRows } from "@/lib/db/rpc";

const mockedRows = vi.mocked(callRpcRows);

function makeReq(body: unknown, deviceId = "dev-1") {
  return new Request("http://localhost/api/quest/teams/create", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `quest_device_id=${deviceId}` },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.clearAllMocks());

describe("POST /api/quest/teams/create", () => {
  it("calls quest_create_team and returns the row", async () => {
    mockedRows.mockResolvedValueOnce([{ team_id: "t1", invite_code: "ABC123", session_id: "s1" }]);
    const res = await POST(makeReq({ huntId: "h1", teamName: "Sharks" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ team_id: "t1", invite_code: "ABC123", session_id: "s1" });
    expect(mockedRows).toHaveBeenCalledWith("quest_create_team", ["dev-1", "h1", "Sharks"]);
  });

  it("400s without a device cookie", async () => {
    const res = await POST(makeReq({ huntId: "h1" }, ""));
    expect(res.status).toBe(400);
  });

  it("passes null teamName when omitted", async () => {
    mockedRows.mockResolvedValueOnce([{ team_id: "t1", invite_code: "X", session_id: "s1" }]);
    await POST(makeReq({ huntId: "h1" }));
    expect(mockedRows).toHaveBeenCalledWith("quest_create_team", ["dev-1", "h1", null]);
  });
});
