const SESSION_KEY = "debateconnect.sessionId";
const CREDITS_KEY = "debateconnect.credits";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getCredits(starting: number): number {
  if (typeof window === "undefined") return starting;
  const v = window.localStorage.getItem(CREDITS_KEY);
  if (v == null) {
    window.localStorage.setItem(CREDITS_KEY, String(starting));
    return starting;
  }
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : starting;
}

export function setCredits(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREDITS_KEY, String(Math.max(0, value)));
}

export function adjustCredits(delta: number, starting: number): number {
  const current = getCredits(starting);
  const next = Math.max(0, current + delta);
  setCredits(next);
  return next;
}

// Per-room one-shot guard. Returns true on the first call for a given roomId,
// false on every subsequent call (including after a page refresh). Without
// this, refreshing /debate/[id] after a verdict re-applies the stake delta.
export function tryClaimCreditApplication(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `debateconnect.applied.${roomId}`;
  if (window.localStorage.getItem(key)) return false;
  window.localStorage.setItem(key, "1");
  return true;
}
