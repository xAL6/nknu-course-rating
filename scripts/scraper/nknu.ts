import axios, { type AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";
import { parseClassTime, type Slot } from "./period.js";

const BASE = "https://sso.nknu.edu.tw/Stu/scheduleDepartment.aspx";

const F = {
  year: "ctl00$phMain$uYearSemester$uYear",
  semester: "ctl00$phMain$uYearSemester$uSemester",
  department: "ctl00$phMain$uDepartment",
  klass: "ctl00$phMain$uClass",
  dn: "ctl00$phMain$uDN",
  campus: "ctl00$phMain$uCampus",
  deform: "ctl00$phMain$uDeformType",
  search: "ctl00$phMain$uSearch",
} as const;

export type Option = { value: string; label: string };

export type CourseRecord = {
  syllabusNo: string | null;
  courseCode: string;
  name: string;
  nameEn: string | null;
  credits: number | null;
  courseType: string | null;
  category: string | null;
  className: string | null;
  teachers: string[];
  classTimeRaw: string | null;
  slots: Slot[];
  classroom: string | null;
  enrollCount: number | null;
  enrollCap: number | null;
  syllabusUrl: string | null;
};

export class NknuClient {
  private http: AxiosInstance;

  constructor() {
    const jar = new CookieJar();
    const instance = axios.create({
      baseURL: "https://sso.nknu.edu.tw/Stu/",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });
    (instance.defaults as { jar?: CookieJar }).jar = jar;
    this.http = wrapper(instance);
  }

  async getInitial(): Promise<cheerio.CheerioAPI> {
    const res = await this.http.get("scheduleDepartment.aspx");
    return cheerio.load(res.data);
  }

  /** Collect the current value of every named form control. */
  private formState($: cheerio.CheerioAPI): Record<string, string> {
    const state: Record<string, string> = {};
    $("input, select, textarea").each((_, el) => {
      const $el = $(el);
      const name = $el.attr("name");
      if (!name) return;
      const type = ($el.attr("type") || "").toLowerCase();
      if (el.tagName === "select") {
        const selected = $el.find("option[selected]").attr("value");
        state[name] = selected ?? $el.find("option").first().attr("value") ?? "";
      } else if (type === "radio" || type === "checkbox") {
        if ($el.attr("checked") !== undefined) state[name] = $el.attr("value") ?? "on";
      } else {
        state[name] = $el.attr("value") ?? "";
      }
    });
    return state;
  }

  private async post(
    $: cheerio.CheerioAPI,
    overrides: Record<string, string>,
    opts: { eventTarget?: string; clickSearch?: boolean } = {},
  ): Promise<cheerio.CheerioAPI> {
    const state = { ...this.formState($), ...overrides };
    state["__EVENTTARGET"] = opts.eventTarget ?? "";
    state["__EVENTARGUMENT"] = "";
    if (opts.clickSearch) state[F.search] = "查詢";
    const body = new URLSearchParams(state).toString();
    const res = await this.http.post("scheduleDepartment.aspx", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return cheerio.load(res.data);
  }

  departments($: cheerio.CheerioAPI): Option[] {
    return this.options($, F.department);
  }
  classes($: cheerio.CheerioAPI): Option[] {
    return this.options($, F.klass);
  }
  years($: cheerio.CheerioAPI): Option[] {
    return this.options($, F.year);
  }

  private options($: cheerio.CheerioAPI, name: string): Option[] {
    const out: Option[] = [];
    $(`select[name="${name}"] option`).each((_, o) => {
      const value = $(o).attr("value") ?? "";
      const label = $(o).text().trim();
      if (value) out.push({ value, label });
    });
    return out;
  }

  /**
   * Select a year/semester/department (the department change repopulates the
   * class list via postback) and return the resulting page + its class options.
   */
  async selectDepartment(
    $: cheerio.CheerioAPI,
    year: string,
    semester: string,
    departmentCode: string,
  ): Promise<{ $: cheerio.CheerioAPI; classes: Option[] }> {
    const $after = await this.post(
      $,
      { [F.year]: year, [F.semester]: semester, [F.department]: departmentCode },
      { eventTarget: F.department },
    );
    return { $: $after, classes: this.classes($after) };
  }

  /** Run the search and return the raw results page. */
  async searchPage(
    $: cheerio.CheerioAPI,
    sel: { year: string; semester: string; departmentCode: string; classCode?: string },
  ): Promise<cheerio.CheerioAPI> {
    const overrides: Record<string, string> = {
      [F.year]: sel.year,
      [F.semester]: sel.semester,
      [F.department]: sel.departmentCode,
    };
    if (sel.classCode) overrides[F.klass] = sel.classCode;
    return this.post($, overrides, { clickSearch: true });
  }

  /** Run the search for the current selection (optionally a specific class). */
  async search(
    $: cheerio.CheerioAPI,
    sel: { year: string; semester: string; departmentCode: string; classCode?: string },
  ): Promise<CourseRecord[]> {
    return parseCourses(await this.searchPage($, sel));
  }
}

/** Anchor-based parse of the result list table. */
export function parseCourses($: cheerio.CheerioAPI): CourseRecord[] {
  const table = $("#ctl00_phMain_uScheduleList_uList");
  const rows = table.find("tbody > tr");
  const out: CourseRecord[] = [];

  rows.each((_, tr) => {
    const $tr = $(tr);
    // Main rows have the full 11-column layout; skip footable detail rows.
    const cells = $tr.children("td");
    if (cells.length < 10) return;
    const txt = (i: number) => cells.eq(i).text().replace(/\s+/g, " ").trim();

    // td[1]: 開課代號 / 課程名稱 / 英文名稱
    const syllabusA = $tr.find('a[href*="syllabusForEnro.aspx"]').first();
    const syllabusHref = syllabusA.attr("href") ?? null;
    const syllabusNo = syllabusHref?.match(/SyllabusNo=([^&]+)/)?.[1] ?? null;
    const nameDivs = syllabusA.find("div");
    const name = nameDivs.eq(0).text().trim() || syllabusA.text().trim();
    const nameEn = nameDivs.eq(1).text().trim() || null;
    const courseCode =
      cells.eq(1).find("div.col-9").first().text().trim() || txt(1).split(/\s/)[0] || "";

    // td[6]: 授課教師 (one or more anchor links)
    const teachers: string[] = [];
    cells
      .eq(6)
      .find('a[href*="scheduleTeacher.aspx"]')
      .each((_, a) => {
        const t = $(a).text().trim();
        if (t && !teachers.includes(t)) teachers.push(t);
      });
    if (teachers.length === 0) {
      // 待聘 / TBD — no link; take the leading text token.
      const t = txt(6).replace(/\[課程大綱\].*$/, "").trim();
      if (t) teachers.push(t);
    }

    const credits = Number(txt(2)) || null;
    const courseType = txt(3) || null;
    const categoryRaw = txt(4);
    const category = categoryRaw && categoryRaw !== "-" ? categoryRaw : null;
    const className = txt(5) || null;
    const classTimeRaw = txt(7) || null;

    // td[8]: classroom — prefer the anchor title (already de-spaced label)
    const roomA = cells.eq(8).find('a[href*="scheduleRoom.aspx"]').first();
    const classroom =
      (roomA.attr("title") || roomA.text() || txt(8)).replace(/\s+/g, " ").trim() || null;

    // td[9]: 選修人數 enrolled/cap
    let enrollCount: number | null = null;
    let enrollCap: number | null = null;
    const enrollM = txt(9).match(/(\d+)\s*\/\s*(\d+)/);
    if (enrollM) {
      enrollCount = Number(enrollM[1]);
      enrollCap = Number(enrollM[2]);
    }

    if (!courseCode && !name) return;
    out.push({
      syllabusNo,
      courseCode,
      name,
      nameEn,
      credits,
      courseType,
      category,
      className,
      teachers,
      classTimeRaw: classTimeRaw && /[1-7]/.test(classTimeRaw) ? classTimeRaw : null,
      slots: parseClassTime(classTimeRaw),
      classroom,
      enrollCount,
      enrollCap,
      syllabusUrl: syllabusHref ? new URL(syllabusHref, BASE).toString() : null,
    });
  });

  return out;
}
