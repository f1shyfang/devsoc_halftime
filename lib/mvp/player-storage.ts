import { MVP_PLAYER_STORAGE_KEY } from "./constants";

export function getStoredPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(MVP_PLAYER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPlayerId(playerId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MVP_PLAYER_STORAGE_KEY, playerId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredPlayerId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MVP_PLAYER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
