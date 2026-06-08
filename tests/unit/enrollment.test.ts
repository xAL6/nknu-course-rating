import { describe, it, expect } from "vitest";
import { fillRate, avgFillRate, enrollLevel, fillPct } from "@/lib/enrollment";

describe("fillRate", () => {
  it("returns count/cap for valid capacity", () => {
    expect(fillRate(18, 20)).toBeCloseTo(0.9);
    expect(fillRate(0, 30)).toBe(0);
  });
  it("returns null (never NaN/Infinity) when capacity is missing or zero", () => {
    expect(fillRate(5, 0)).toBeNull(); // no div-by-zero
    expect(fillRate(5, null)).toBeNull();
    expect(fillRate(null, 30)).toBeNull();
    expect(fillRate(5, -1)).toBeNull();
    expect(fillRate(undefined, undefined)).toBeNull();
  });
});

describe("avgFillRate", () => {
  it("averages only offerings that have capacity data", () => {
    const r = avgFillRate([
      { enrollCount: 10, enrollCap: 20 }, // 0.5
      { enrollCount: 30, enrollCap: 30 }, // 1.0
      { enrollCount: 5, enrollCap: null }, // skipped
    ]);
    expect(r.sample).toBe(2);
    expect(r.rate).toBeCloseTo(0.75);
  });
  it("returns {rate:null, sample:0} when nothing has capacity (no NaN)", () => {
    expect(avgFillRate([{ enrollCount: 5, enrollCap: 0 }])).toEqual({ rate: null, sample: 0 });
    expect(avgFillRate([])).toEqual({ rate: null, sample: 0 });
  });
});

describe("enrollLevel boundaries", () => {
  it("buckets at the documented thresholds", () => {
    expect(enrollLevel(null)).toBeNull();
    expect(enrollLevel(1.2)?.key).toBe("full");
    expect(enrollLevel(1)?.key).toBe("full");
    expect(enrollLevel(0.8)?.key).toBe("hot");
    expect(enrollLevel(0.5)?.key).toBe("ok");
    expect(enrollLevel(0.49)?.key).toBe("easy");
    expect(enrollLevel(0)?.key).toBe("easy");
  });
});

describe("fillPct", () => {
  it("formats a percent or null", () => {
    expect(fillPct(0.955)).toBe("96%");
    expect(fillPct(1)).toBe("100%");
    expect(fillPct(null)).toBeNull();
  });
});
