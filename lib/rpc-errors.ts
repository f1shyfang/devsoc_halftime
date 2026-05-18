export type TableDropErrorCode =
  | "bounty_full"
  | "bounty_closed"
  | "awaiting_curation"
  | "not_requested"
  | "rejected"
  | "invalid_token"
  | "unauthorized"
  | "auth_required"
  | "bounty_not_found"
  | "unknown";

export type TableDropError = {
  code: TableDropErrorCode;
  message: string;
  retryable: boolean;
};

const COPY: Record<TableDropErrorCode, { message: string; retryable: boolean }> = {
  bounty_full: { message: "This table is full.", retryable: false },
  bounty_closed: { message: "This bounty has ended.", retryable: false },
  awaiting_curation: { message: "Host will accept you shortly.", retryable: false },
  not_requested: { message: "Request to join first, then scan the table QR.", retryable: false },
  rejected: { message: "Host declined this round.", retryable: false },
  invalid_token: { message: "Check-in QR not recognized.", retryable: false },
  unauthorized: { message: "Admin token rejected.", retryable: false },
  auth_required: { message: "Sign-in required.", retryable: true },
  bounty_not_found: { message: "No bounty with that link.", retryable: false },
  unknown: { message: "Something went wrong. Try again.", retryable: true },
};

export function parseRpcError(err: unknown): TableDropError | null {
  if (!err) return null;
  const raw =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : "";
  for (const code of Object.keys(COPY) as TableDropErrorCode[]) {
    if (code !== "unknown" && raw.includes(code)) {
      return { code, ...COPY[code] };
    }
  }
  return { code: "unknown", ...COPY.unknown };
}
