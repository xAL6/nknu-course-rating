/**
 * Crawl scheduleRoom.aspx to map every room -> 校區 (和平/燕巢), then backfill
 * courses.campus from each course's classroom code. Run: npm run crawl:rooms
 */
import axios, { type AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";
import { Client } from "pg";

const F = {
  year: "ctl00$phMain$uYearSemester$uYear",
  semester: "ctl00$phMain$uYearSemester$uSemester",
  dn: "ctl00$phMain$uDN",
  area: "ctl00$phMain$uArea",
  building: "ctl00$phMain$uBuilding",
  room: "ctl00$phMain$uRoom",
};

type Room = { room_code: string; campus: string; building: string | null; name: string | null };

class RoomClient {
  private http: AxiosInstance;
  constructor() {
    const jar = new CookieJar();
    const instance = axios.create({
      baseURL: "https://sso.nknu.edu.tw/Stu/",
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "zh-TW" },
    });
    (instance.defaults as { jar?: CookieJar }).jar = jar;
    this.http = wrapper(instance);
  }
  async get() {
    const res = await this.http.get("scheduleRoom.aspx");
    return cheerio.load(res.data);
  }
  private state($: cheerio.CheerioAPI): Record<string, string> {
    const s: Record<string, string> = {};
    $("input, select").each((_, el) => {
      const $el = $(el);
      const name = $el.attr("name");
      if (!name) return;
      const type = ($el.attr("type") || "").toLowerCase();
      if (el.tagName === "select")
        s[name] = $el.find("option[selected]").attr("value") ?? $el.find("option").first().attr("value") ?? "";
      else if (type === "radio" || type === "checkbox") {
        if ($el.attr("checked") !== undefined) s[name] = $el.attr("value") ?? "on";
      } else s[name] = $el.attr("value") ?? "";
    });
    return s;
  }
  async post($: cheerio.CheerioAPI, overrides: Record<string, string>, eventTarget: string) {
    const body = new URLSearchParams({
      ...this.state($),
      ...overrides,
      __EVENTTARGET: eventTarget,
      __EVENTARGUMENT: "",
    }).toString();
    const res = await this.http.post("scheduleRoom.aspx", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return cheerio.load(res.data);
  }
  options($: cheerio.CheerioAPI, name: string) {
    const out: { value: string; text: string }[] = [];
    $(`select[name="${name}"] option`).each((_, o) => {
      const value = $(o).attr("value") ?? "";
      if (value) out.push({ value, text: $(o).text().trim() });
    });
    return out;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = new RoomClient();
  const $0 = await c.get();
  const year = c.options($0, F.year)[0]?.value ?? "114";
  const rooms = new Map<string, Room>();

  for (const [area, campus] of [["1", "和平"], ["2", "燕巢"]] as const) {
    const $a = await c.post($0, { [F.year]: year, [F.semester]: "1", [F.dn]: "D", [F.area]: area }, F.area);
    const buildings = c.options($a, F.building);
    process.stderr.write(`[rooms] ${campus}: ${buildings.length} buildings\n`);
    for (const b of buildings) {
      const $b = await c.post($a, { [F.year]: year, [F.semester]: "1", [F.dn]: "D", [F.area]: area, [F.building]: b.value }, F.building);
      const buildingName = b.text.replace(/^\s*\S+\s*:?\s*/, "").trim();
      for (const r of c.options($b, F.room)) {
        const name = r.text.includes(":") ? r.text.split(":").slice(1).join(":").trim() : r.text;
        if (!rooms.has(r.value)) rooms.set(r.value, { room_code: r.value, campus, building: buildingName || null, name: name || null });
      }
      await sleep(300);
    }
  }
  process.stderr.write(`[rooms] collected ${rooms.size} rooms\n`);

  // Persist + backfill via direct pg.
  const conn = process.env.POSTGRES_URL_NON_POOLING!;
  const u = new URL(conn);
  const db = new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1) || "postgres",
    ssl: { rejectUnauthorized: false }, // admin-only; see migrate.ts header
  });
  await db.connect();
  try {
    for (const r of rooms.values()) {
      await db.query(
        `insert into rooms(room_code, campus, building, name) values ($1,$2,$3,$4)
         on conflict (room_code) do update set campus=excluded.campus, building=excluded.building, name=excluded.name`,
        [r.room_code, r.campus, r.building, r.name],
      );
    }
    const res = await db.query(
      `update courses c set campus = r.campus
       from rooms r
       where c.classroom is not null and split_part(c.classroom, ' ', 1) = r.room_code`,
    );
    process.stderr.write(`[rooms] backfilled campus on ${res.rowCount} courses\n`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
