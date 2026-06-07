import { describe, it, expect } from "vitest";
import { campusFromRoom, findCommuteIssues } from "@/lib/campus";

const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "A", "B", "C", "D"];

describe("campusFromRoom", () => {
  it("maps digit / CB / G prefixes to 和平", () => {
    expect(campusFromRoom("5011")).toBe("和平");
    expect(campusFromRoom("CB201")).toBe("和平");
    expect(campusFromRoom("G101")).toBe("和平");
  });

  it("maps other letter prefixes to 燕巢", () => {
    expect(campusFromRoom("SF101")).toBe("燕巢");
    expect(campusFromRoom("PH5011")).toBe("燕巢");
    expect(campusFromRoom("bt12")).toBe("燕巢"); // case-insensitive
  });

  it("honours an embedded campus name and handles empties", () => {
    expect(campusFromRoom("燕巢 SF101")).toBe("燕巢");
    expect(campusFromRoom(null)).toBeNull();
    expect(campusFromRoom("")).toBeNull();
  });
});

describe("findCommuteIssues", () => {
  const mk = (weekday: number, period: string, classroom: string | null) => ({
    classroom,
    slots: [{ weekday, period }],
  });

  it("flags back-to-back classes on different campuses (gap 0)", () => {
    const issues = findCommuteIssues(
      [mk(3, "4", "5011"), mk(3, "5", "SF101")],
      PERIODS,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      weekday: 3,
      fromCampus: "和平",
      toCampus: "燕巢",
      gap: 0,
    });
  });

  it("reports the gap when a free period sits between campuses", () => {
    const issues = findCommuteIssues([mk(2, "4", "5011"), mk(2, "6", "SF101")], PERIODS);
    expect(issues).toHaveLength(1);
    expect(issues[0].gap).toBe(1);
  });

  it("does not flag same-campus days", () => {
    expect(findCommuteIssues([mk(1, "1", "5011"), mk(1, "2", "1203")], PERIODS)).toHaveLength(0);
  });

  it("ignores courses with unknown campus", () => {
    expect(findCommuteIssues([mk(1, "1", null), mk(1, "2", "SF101")], PERIODS)).toHaveLength(0);
  });

  it("sorts tightest (smallest gap) first", () => {
    const issues = findCommuteIssues(
      [
        mk(1, "1", "5011"),
        mk(1, "4", "SF101"), // gap 2 on Monday
        mk(2, "4", "5011"),
        mk(2, "5", "SF101"), // gap 0 on Tuesday
      ],
      PERIODS,
    );
    expect(issues[0].gap).toBe(0);
  });
});
