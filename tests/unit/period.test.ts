import { describe, it, expect } from "vitest";
import { parseClassTime } from "../../scripts/scraper/period";
import { formatSlots } from "@/lib/schedule";

describe("parseClassTime", () => {
  it("parses weekday-first single-digit periods", () => {
    expect(parseClassTime("13,14")).toEqual([
      { weekday: 1, period: "3" },
      { weekday: 1, period: "4" },
    ]);
  });
  it("parses a different weekday", () => {
    expect(parseClassTime("48,49")).toEqual([
      { weekday: 4, period: "8" },
      { weekday: 4, period: "9" },
    ]);
  });
  it("handles letter periods (evening)", () => {
    expect(parseClassTime("7A")).toEqual([{ weekday: 7, period: "A" }]);
  });
  it("returns [] for empty / undefined", () => {
    expect(parseClassTime("")).toEqual([]);
    expect(parseClassTime(null)).toEqual([]);
    expect(parseClassTime(undefined)).toEqual([]);
  });
  it("ignores invalid weekday tokens", () => {
    expect(parseClassTime("8,9")).toEqual([]); // weekday 8/9 invalid alone (no period)
  });
});

describe("formatSlots", () => {
  it("groups by weekday with labels", () => {
    expect(
      formatSlots([
        { weekday: 1, period: "3" },
        { weekday: 1, period: "4" },
        { weekday: 3, period: "5" },
      ]),
    ).toBe("週一 3,4、週三 5");
  });
  it("shows placeholder when empty", () => {
    expect(formatSlots([])).toBe("時間未定");
  });
});
