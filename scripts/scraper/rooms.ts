/**
 * Build the 校區(campus) map from scheduleRoom.aspx building lists and backfill
 * courses.campus. 和平 buildings are numeric codes (0,1,3,4,5,6,7,9,11,G,CB);
 * 燕巢 are 2-letter codes (BT,CM,LI,MA,PH,SF,SR,TC). A course's room code carries
 * the building as a prefix, so we join on prefix. Run: npm run crawl:rooms
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
};

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
    return cheerio.load((await this.http.get("scheduleRoom.aspx")).data);
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
    return cheerio.load(
      (
        await this.http.post("scheduleRoom.aspx", body, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      ).data,
    );
  }
  buildings($: cheerio.CheerioAPI) {
    const out: { code: string; name: string }[] = [];
    $(`select[name="${F.building}"] option`).each((_, o) => {
      const code = $(o).attr("value") ?? "";
      const name = $(o).text().replace(/^\s*\S+\s*:?\s*/, "").trim();
      if (code) out.push({ code, name });
    });
    return out;
  }
}

async function main() {
  const c = new RoomClient();
  const $0 = await c.get();
  const year = $0(`select[name="${F.year}"] option`).first().attr("value") ?? "114";

  const buildings: { code: string; campus: string; name: string }[] = [];
  for (const [area, campus] of [["1", "和平"], ["2", "燕巢"]] as const) {
    const $a = await c.post($0, { [F.year]: year, [F.semester]: "1", [F.dn]: "D", [F.area]: area }, F.area);
    for (const b of c.buildings($a)) buildings.push({ code: b.code, campus, name: b.name });
    process.stderr.write(`[rooms] ${campus}: ${c.buildings($a).length} buildings\n`);
  }

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
    await db.query("delete from rooms");
    for (const b of buildings) {
      await db.query(
        "insert into rooms(room_code, campus, building, name) values ($1,$2,$3,$4) on conflict (room_code) do update set campus=excluded.campus, name=excluded.name",
        [b.code, b.campus, b.code, b.name],
      );
    }
    // Backfill campus from the room code prefix. 和平 buildings are numeric
    // (0,1,3,4,5,6,7,9,11) plus G(體育館) and CB(宿舍B); 燕巢 buildings are all
    // letter-coded (BT,CM,LI,MA,PH,SF,SR,TC). Course room codes use those
    // prefixes (case-insensitive, sometimes 1 letter, e.g. P5011 -> PH). So:
    // digit / G / CB -> 和平; any other leading letter -> 燕巢.
    const res = await db.query(`
      update courses c set campus = case
        when s.room ~ '^[0-9]'    then '和平'
        when s.room ~* '^CB'      then '和平'
        when s.room ~* '^G'       then '和平'
        when s.room ~ '^[A-Za-z]' then '燕巢'
        else null end
      from (select id, split_part(classroom, ' ', 1) as room from courses
            where classroom is not null and classroom <> '') s
      where c.id = s.id and s.room <> ''`);
    process.stderr.write(`[rooms] stored ${buildings.length} buildings; backfilled campus on ${res.rowCount} courses\n`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
