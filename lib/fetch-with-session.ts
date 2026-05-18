import { getOrCreateSessionId } from "./session";

export async function fetchWithSession(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const sessionId = getOrCreateSessionId();
  const headers = new Headers(init.headers);
  headers.set("x-session-id", sessionId);
  if (!headers.has("content-type") && init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
