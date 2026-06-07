import { describe, it, expect } from "vitest";
import { buildSchedule } from "@/lib/schedule-builder";

const P = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "A", "B", "C", "D"];

type C = {
  courseKey: string;
  courseCode: string;
  classroom: string | null;
  campus?: string | null;
  slots: { weekday: number; period: string }[];
  credits: number | null;
  score: number;
};

const mk = (o: Partial<C> & { courseKey: string; slots: C["slots"] }): C => ({
  courseCode: o.courseKey,
  classroom: "5011", // 和平 by default
  credits: 3,
  score: 1,
  ...o,
});

describe("buildSchedule", () => {
  it("avoids slot conflicts (higher score wins the slot)", () => {
    const { chosen } = buildSchedule(
      [
        mk({ courseKey: "A", slots: [{ weekday: 1, period: "3" }], score: 2 }),
        mk({ courseKey: "B", slots: [{ weekday: 1, period: "3" }], score: 1 }),
      ],
      { periodOrder: P, targetCredits: 99 },
    );
    expect(chosen.map((c) => c.courseKey)).toEqual(["A"]);
  });

  it("keeps free weekdays empty", () => {
    const { chosen } = buildSchedule(
      [
        mk({ courseKey: "Fri", slots: [{ weekday: 5, period: "3" }] }),
        mk({ courseKey: "Mon", slots: [{ weekday: 1, period: "3" }] }),
      ],
      { periodOrder: P, freeWeekdays: [5], targetCredits: 99 },
    );
    expect(chosen.map((c) => c.courseKey)).toEqual(["Mon"]);
  });

  it("stops once the credit target is reached", () => {
    const { chosen, totalCredits } = buildSchedule(
      [
        mk({ courseKey: "A", slots: [{ weekday: 1, period: "1" }], credits: 3 }),
        mk({ courseKey: "B", slots: [{ weekday: 2, period: "1" }], credits: 3 }),
        mk({ courseKey: "C", slots: [{ weekday: 3, period: "1" }], credits: 3 }),
      ],
      { periodOrder: P, targetCredits: 4 },
    );
    expect(chosen.length).toBe(2);
    expect(totalCredits).toBe(6);
  });

  it("skips back-to-back cross-campus classes by default", () => {
    const { chosen } = buildSchedule(
      [
        mk({ courseKey: "HePing", slots: [{ weekday: 1, period: "3" }], classroom: "5011", score: 2 }),
        mk({ courseKey: "YanChao", slots: [{ weekday: 1, period: "4" }], classroom: "SF101", score: 1 }),
      ],
      { periodOrder: P, targetCredits: 99 },
    );
    expect(chosen.map((c) => c.courseKey)).toEqual(["HePing"]);
  });

  it("allows the cross-campus hop when avoidCrossCampus is false", () => {
    const { chosen } = buildSchedule(
      [
        mk({ courseKey: "HePing", slots: [{ weekday: 1, period: "3" }], classroom: "5011", score: 2 }),
        mk({ courseKey: "YanChao", slots: [{ weekday: 1, period: "4" }], classroom: "SF101", score: 1 }),
      ],
      { periodOrder: P, targetCredits: 99, avoidCrossCampus: false },
    );
    expect(chosen.length).toBe(2);
  });

  it("does not pick the same logical course twice", () => {
    const { chosen } = buildSchedule(
      [
        mk({ courseKey: "X", slots: [{ weekday: 1, period: "1" }], score: 2 }),
        mk({ courseKey: "X", slots: [{ weekday: 2, period: "1" }], score: 1 }),
      ],
      { periodOrder: P, targetCredits: 99 },
    );
    expect(chosen.length).toBe(1);
  });
});
