import { COOKIE_NAME } from "@/lib/device-id";

/**
 * Read the device-id cookie from an incoming route-handler Request. Returns
 * null if absent so callers can decide whether to 400. Used in place of
 * `getDeviceIdClient()` now that RPCs run server-side.
 */
export function getDeviceIdFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const prefix = `${COOKIE_NAME}=`;
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}
