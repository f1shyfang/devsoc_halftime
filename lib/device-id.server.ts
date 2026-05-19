import { cookies } from "next/headers";
import { COOKIE_NAME } from "./device-id";

/**
 * Read the `quest_device_id` cookie from a server component / route handler.
 * Throws if the cookie is missing — proxy.ts should always set it before we
 * get here, so a missing cookie indicates a misconfiguration (e.g. the route
 * isn't covered by the proxy matcher).
 */
export async function getDeviceIdServer(): Promise<string> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) {
    throw new Error(
      `[device-id] Missing ${COOKIE_NAME} cookie on the server. ` +
        `proxy.ts should have set this — check that proxy.ts matches this route.`,
    );
  }
  return value;
}
