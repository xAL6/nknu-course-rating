import { describe, it, expect } from "vitest";
import { isAllowedEmail } from "@/lib/config";
import { buildSlotMap, type TimetableCourse } from "@/lib/timetable-store";

describe("isAllowedEmail", () => {
  it("allows the NKNU student domain", () => {
    expect(isAllowedEmail("s1234567@mail.nknu.edu.tw")).toBe(true);
  });
  it("rejects other domains", () => {
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("a@nknu.edu.tw")).toBe(false); // staff domain, not student
  });
  it("rejects empty / null", () => {
    expect(isAllowedEmail("")).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
  });
});

describe("buildSlotMap (timetable conflict detection)", () => {
  const a: TimetableCourse = {
    courseCode: "A1", syllabusNo: "1", name: "A", teachers: [], classroom: null,
    semesterId: "114-2", slots: [{ weekday: 1, period: "3" }, { weekday: 1, period: "4" }],
  };
  const b: TimetableCourse = {
    courseCode: "B1", syllabusNo: "2", name: "B", teachers: [], classroom: null,
    semesterId: "114-2", slots: [{ weekday: 1, period: "4" }],
  };

  it("detects an overlapping slot", () => {
    const map = buildSlotMap([a, b]);
    expect(map.get("1-4")!.length).toBe(2); // conflict at 週一 period 4
    expect(map.get("1-3")!.length).toBe(1);
  });
  it("no conflict when disjoint", () => {
    const map = buildSlotMap([a]);
    expect([...map.values()].every((arr) => arr.length === 1)).toBe(true);
  });
});
