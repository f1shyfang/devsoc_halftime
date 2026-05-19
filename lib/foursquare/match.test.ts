import { describe, it, expect } from "vitest";
import { nameSimilarity } from "./match";

describe("nameSimilarity", () => {
  it("returns 1.0 for identical names", () => {
    expect(nameSimilarity("Ainsworth Building", "Ainsworth Building")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(nameSimilarity("AINSWORTH building", "ainsworth Building")).toBe(1);
  });

  it("strips generic suffixes (building, centre, center, block, hall)", () => {
    expect(nameSimilarity("Ainsworth Building", "Ainsworth")).toBe(1);
    expect(nameSimilarity("Mathews Theatre", "Mathews Theatre Centre")).toBe(1);
    expect(nameSimilarity("Quad Block", "Quad")).toBe(1);
  });

  it("returns a partial score for one-word overlap in multi-word names", () => {
    const s = nameSimilarity("Red Centre East", "Red Centre West");
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(1);
  });

  it("returns 0 for fully disjoint names", () => {
    expect(nameSimilarity("Ainsworth", "Goldstein")).toBe(0);
  });

  it("ignores extra whitespace and punctuation", () => {
    expect(nameSimilarity("  Ainsworth   Building  ", "Ainsworth-Building")).toBe(1);
  });
});

import { classifyConfidence } from "./match";

describe("classifyConfidence", () => {
  it("returns 'high' when name >= 0.85 AND distance <= 30m", () => {
    expect(classifyConfidence(0.85, 30)).toBe("high");
    expect(classifyConfidence(1.0, 15)).toBe("high");
  });

  it("returns 'medium' for borderline high (just over distance)", () => {
    expect(classifyConfidence(0.85, 31)).toBe("medium");
  });

  it("returns 'medium' when name >= 0.6 AND distance <= 50m but not high", () => {
    expect(classifyConfidence(0.6, 50)).toBe("medium");
    expect(classifyConfidence(0.7, 40)).toBe("medium");
  });

  it("returns 'low' for in-radius but below medium thresholds", () => {
    expect(classifyConfidence(0.5, 90)).toBe("low");
    expect(classifyConfidence(0.59, 49)).toBe("low");
    expect(classifyConfidence(0.0, 99)).toBe("low");
  });

  it("returns 'low' when over 50m but still within 100m even with great name", () => {
    expect(classifyConfidence(0.95, 80)).toBe("low");
  });
});
