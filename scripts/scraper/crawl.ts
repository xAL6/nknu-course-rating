/**
 * NKNU course crawler.
 *
 *   npm run crawl -- --year 115 --sem 1 --dept 國文 --dump out.json
 *   npm run crawl -- --year 115 --sem 1            # all depts -> Supabase
 *
 * Flags:
 *   --year <ROC>         single year (default: all years on the page)
 *   --sem <1|2|3>        single semester (default: 1 and 2)
 *   --dept <code|名稱>    filter departments by code or name substring
 *   --all-classes        iterate every class (default: prefer 全年級, union)
 *   --dump <path>        write JSON instead of upserting to Supabase
 *   --limit <n>          stop after n departments (debugging)
 *   --delay <ms>         polite delay between requests (default 1200)
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delay = Number(args.delay ?? 1200);
  const client = new NknuClient();

  const $0 = await client.getInitial();
  const years = args.year ? [String(args.year)] : client.years($0).map((y) => y.value);
  const semesters = args.sem ? [String(args.sem)] : ["1", "2"];

  let departments = client.departments($0);
  if (args.dept) {
    const f = String(args.dept);
    departments = departments.filter((d) => d.value === f || d.label.includes(f));
  }
  if (args.limit) departments = departments.slice(0, Number(args.limit));

  console.error(
    `[crawl] years=${years.join(",")} sems=${semesters.join(",")} depts=${departments.length}`,
  );

  const all: (CourseRecord & { semesterId: string; departmentCode: string; departmentName: string })[] =
    [];
  const seen = new Set<string>();

  for (const year of years) {
    for (const sem of semesters) {
      const semesterId = `${year}-${sem}`;
      for (const dept of departments) {
        try {
          const { $, classes } = await client.selectDepartment($0, year, sem, dept.value);
          await sleep(delay);

          const targetClasses = pickClasses(classes, Boolean(args["all-classes"]));
          let deptCount = 0;
          for (const klass of targetClasses) {
            const records = await client.search($, {
              year,
              semester: sem,
              departmentCode: dept.value,
              classCode: klass?.value,
            });
            for (const r of records) {
              const key = `${semesterId}:${r.syllabusNo ?? r.courseCode + r.teachers.join()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              all.push({
                ...r,
                semesterId,
                departmentCode: dept.value,
                departmentName: dept.label,
              });
              deptCount++;
            }
            await sleep(delay);
          }
          console.error(`[crawl] ${semesterId} ${dept.label} -> ${deptCount} courses`);
        } catch (e) {
          console.error(`[crawl] ERROR ${semesterId} ${dept.label}:`, (e as Error).message);
          await sleep(delay * 2); // back off
        }
      }
    }
  }

  console.error(`[crawl] total unique offerings: ${all.length}`);

  if (args.dump) {
    const path = String(args.dump);
    writeFileSync(path, JSON.stringify(all, null, 2), "utf-8");
    console.error(`[crawl] wrote ${path}`);
  } else {
    const { upsertCourses } = await import("./upsert.js");
    await upsertCourses(all);
    console.error(`[crawl] upserted ${all.length} offerings to Supabase`);
  }
}

/** Prefer a "全年級/全部" class (covers the whole dept); else iterate all. */
function pickClasses(classes: Option[], allClasses: boolean): (Option | undefined)[] {
  if (classes.length === 0) return [undefined]; // search with default
  if (allClasses) return classes;
  const whole = classes.find((c) => /全年級|全部|不分/.test(c.label));
  return whole ? [whole] : classes;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
