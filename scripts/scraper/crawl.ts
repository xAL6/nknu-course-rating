/**
 * NKNU course crawler — full coverage across 學制 (uDeformType) × 日夜 (uDN).
 *
 *   npm run crawl -- --year 114 --sem 2            # all levels -> Supabase
 *   npm run crawl -- --year 114 --sem 2 --dump out.json
 *
 * 學制: 1 大學部 / 2 碩士班 / 3 博士班 / G 通識軍訓體育 / S 學院開課 / H 學程第二專長
 * 日夜: D 日間 / N 進修 ; 校區預設「全部」(和平+燕巢)
 *
 * Flags: --year --sem --deform <v> --dn <D|N> --dept <code|名稱>
 *        --all-classes --dump <path> --limit <n> --delay <ms>
 */
import { writeFileSync } from "node:fs";
import { NknuClient, type CourseRecord, type Option } from "./nknu.js";

type Args = Record<string, string | boolean>;
function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) a[key] = true;
      else (a[key] = next), i++;
    }
  }
  return a;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Enriched = CourseRecord & {
  semesterId: string;
  departmentCode: string;
  departmentName: string;
  degreeLevel: string;
  degreeLevelCode: string;
  dayNight: string;
  classCode: string | null;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delay = Number(args.delay ?? 1000);
  const client = new NknuClient();

  const $0 = await client.getInitial();
  let years: string[];
  if (args.year) {
    years = [String(args.year)];
  } else {
    const from = args.from ? Number(args.from) : -Infinity;
    const to = args.to ? Number(args.to) : Infinity;
    years = client
      .years($0)
      .map((y) => y.value)
      .filter((y) => Number(y) >= from && Number(y) <= to);
  }
  const semesters = args.sem ? [String(args.sem)] : ["1", "2"];
  let deforms = client.deforms($0);
  if (args.deform) deforms = deforms.filter((d) => d.value === String(args.deform));
  const dns = args.dn ? [String(args.dn)] : ["D", "N"];

  console.error(
    `[crawl] years=${years.join(",")} sems=${semesters.join(",")} ` +
      `deforms=${deforms.map((d) => d.value).join(",")} dn=${dns.join(",")}`,
  );

  const all: Enriched[] = [];
  const seen = new Set<string>();

  for (const year of years) {
    for (const sem of semesters) {
      const semesterId = `${year}-${sem}`;
      for (const deform of deforms) {
        for (const dn of dns) {
          let departments: Option[];
          let $base;
          try {
            const r = await client.selectDeform($0, { year, semester: sem, deform: deform.value, dn });
            departments = r.departments;
            $base = r.$;
            await sleep(delay);
          } catch (e) {
            console.error(`[crawl] ERROR deform ${deform.value}/${dn}:`, (e as Error).message);
            continue;
          }
          if (args.dept) {
            const f = String(args.dept);
            departments = departments.filter((d) => d.value === f || d.label.includes(f));
          }
          if (args.limit) departments = departments.slice(0, Number(args.limit));
          if (departments.length === 0) continue;

          for (const dept of departments) {
            try {
              const { $, classes } = await client.selectDepartment($base, {
                year,
                semester: sem,
                deform: deform.value,
                dn,
                departmentCode: dept.value,
              });
              await sleep(delay);

              let deptCount = 0;
              for (const klass of pickClasses(classes)) {
                const records = await client.search($, {
                  year,
                  semester: sem,
                  deform: deform.value,
                  dn,
                  departmentCode: dept.value,
                  classCode: klass?.value,
                });
                for (const r of records) {
                  const key = `${semesterId}:${r.syllabusNo ?? r.courseCode + r.teachers.join()}`;
                  if (seen.has(key)) continue;
                  seen.add(key);
                  all.push({
                    ...r,
                    // 系級/班級 from the searched uClass (authoritative grouping);
                    // 必修 are locked under a specific 班級, 全年級 holds 選修.
                    className: klass?.label ?? r.className,
                    classCode: klass?.value ?? null,
                    semesterId,
                    departmentCode: dept.value,
                    departmentName: dept.label,
                    degreeLevel: deform.label.replace(/^[A-Za-z0-9/]+[:：]\s*/, ""),
                    degreeLevelCode: deform.value,
                    dayNight: dn,
                  });
                  deptCount++;
                }
                await sleep(delay);
              }
              if (deptCount > 0)
                console.error(`[crawl] ${semesterId} ${deform.value}/${dn} ${dept.label} -> ${deptCount}`);
            } catch (e) {
              console.error(`[crawl] ERROR ${semesterId} ${dept.label}:`, (e as Error).message);
              await sleep(delay * 2);
            }
          }
        }
      }
    }
  }

  console.error(`[crawl] total unique offerings: ${all.length}`);

  if (args.dump) {
    writeFileSync(String(args.dump), JSON.stringify(all, null, 2), "utf-8");
    console.error(`[crawl] wrote ${args.dump}`);
  } else {
    const { upsertCourses } = await import("./upsert.js");
    await upsertCourses(all);
    console.error(`[crawl] upserted ${all.length} offerings to Supabase`);
  }
}

/**
 * The class (班級/系級) filter genuinely restricts results: "全年級選課用" only
 * returns all-grade electives (選修); each grade's 必修 are locked under that
 * specific 班級. So we must search EVERY class and union (dedup by syllabusNo
 * upstream). Verified: 國文學系 114-2 → 全年級 5 vs union-of-9-classes 105.
 */
function pickClasses(classes: Option[]): (Option | undefined)[] {
  return classes.length === 0 ? [undefined] : classes;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
