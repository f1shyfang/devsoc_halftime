const GENERIC_SUFFIXES = new Set([
  "building",
  "centre",
  "center",
  "block",
  "hall",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((tok) => tok.length > 0 && !GENERIC_SUFFIXES.has(tok)),
  );
}

/**
 * Jaccard similarity over name tokens (after lowercasing, stripping
 * punctuation, and removing generic building-y suffixes).
 * Returns a value in [0, 1].
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);

  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const tok of ta) if (tb.has(tok)) intersection++;
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

export type MatchConfidence = "high" | "medium" | "low" | "no_match";

/**
 * Tiered confidence for a single best-candidate match.
 * Caller is responsible for deciding `no_match` (zero candidates within 100m).
 */
export function classifyConfidence(
  nameScore: number,
  distanceMeters: number,
): Exclude<MatchConfidence, "no_match"> {
  if (nameScore >= 0.85 && distanceMeters <= 30) return "high";
  if (nameScore >= 0.6 && distanceMeters <= 50) return "medium";
  return "low";
}
