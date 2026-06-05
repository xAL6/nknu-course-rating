import { describe, it, expect } from "vitest";
import {
  encodeShare,
  decodeShare,
  timetableSemester,
  type TimetableCourse,
} from "@/lib/timetable-store";

// URL-safe base64 of arbitrary text, matching the codec in timetable-store.
const b64 = (s: string) =>
  Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
import { rateLimit, clientIp } from "@/lib/rate-limit";

const course = (over: Partial<TimetableCourse> = {}): TimetableCourse => ({
  courseCode: "CS101",
  courseKey: "207:資料結構",
  syllabusNo: "abc",
  name: "資料結構",
  teachers: ["王老師"],
  classroom: "理學大樓 101",
  semesterId: "114-2",
  slots: [{ weekday: 1, period: "3" }],
  ...over,
});

describe("timetable share codec", () => {
  it("round-trips a timetable through the URL-safe token", () => {
    const tt = [course(), course({ courseCode: "CS102", name: "演算法", syllabusNo: "def" })];
    const token = encodeShare(tt);
    expect(token).not.toMatch(/[+/=]/); // URL-safe
    const back = decodeShare(token);
    expect(back).toEqual(tt);
  });

  it("preserves CJK course names exactly", () => {
    const back = decodeShare(encodeShare([course({ name: "國文（一）" })]));
    expect(back?.[0].name).toBe("國文（一）");
  });

  it("returns null on garbage / non-array input", () => {
    expect(decodeShare("!!!not-base64!!!")).toBeNull();
    expect(decodeShare(b64('"just a string"'))).toBeNull(); // valid base64, not an array
    expect(decodeShare(b64("{not json"))).toBeNull();
  });
});

describe("timetableSemester (semester lock)", () => {
  it("reports the first course's semester", () => {
    expect(timetableSemester([course({ semesterId: "113-1" })])).toBe("113-1");
  });
  it("is null for an empty timetable", () => {
    expect(timetableSemester([])).toBeNull();
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true); // b unaffected by a
  });
});

describe("clientIp", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip then unknown", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
