import { describe, it, expect } from "vitest";
import { getDeviceIdFromRequest } from "./device";

function reqWithCookie(value?: string) {
  const headers = new Headers();
  if (value) headers.set("cookie", `quest_device_id=${value}; other=x`);
  return new Request("http://localhost/api/x", { headers });
}

describe("getDeviceIdFromRequest", () => {
  it("returns the device id from the cookie", () => {
    expect(getDeviceIdFromRequest(reqWithCookie("abc-123"))).toBe("abc-123");
  });
  it("returns null when the cookie is absent", () => {
    expect(getDeviceIdFromRequest(reqWithCookie())).toBeNull();
  });
});
