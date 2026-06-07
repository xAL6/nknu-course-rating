/**
 * Seed realistic-looking reviews so the site doesn't read as empty (trending,
 * leaderboard, per-course ratings, AI TL;DR all need real rows).
 *
 *   npm run seed-reviews            # default spread
 *   npm run seed-reviews -- --groups 120 --users 70
 *   npm run seed-reviews -- --purge # remove every seeded user (cascades reviews)
 *
 * Uses the service-role client (BYPASSES RLS) — owner/admin only, never shipped.
 *
 * Reversibility: seed users are created with email `seed.<n>@mail.nknu.edu.tw`
 * and app_metadata `{ seed: true }`. Deleting them cascades reviews + profiles,
 * and the reviews trigger drops now-empty course_rating_summary rows. `--purge`
 * does exactly that.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { REVIEW_TAG_VALUES } from "../src/lib/config";

type Sb = ReturnType<typeof createAdminClient>;

const SEED_DOMAIN = "mail.nknu.edu.tw";
const SEED_PREFIX = "seed.";
const isSeedEmail = (e?: string | null) => !!e && e.startsWith(SEED_PREFIX) && e.endsWith(`@${SEED_DOMAIN}`);

// ── tiny CLI ───────────────────────────────────────────────────────────────
function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]) || def;
  return def;
}
const PURGE = process.argv.includes("--purge");
const N_USERS = arg("users", 60);
const N_GROUPS = arg("groups", 90);
const MIN_PER = arg("min", 3);
const MAX_PER = arg("max", 9);

// ── helpers ──────────────────────────────────────────────────────────────────
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: readonly T[]): T => a[rnd(a.length)];
const chance = (p: number) => Math.random() < p;
const clamp5 = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function sampleN<T>(a: T[], n: number): T[] {
  return shuffle(a).slice(0, Math.min(n, a.length));
}

// ── funny anonymized handles (for demo) ──────────────────────────────────────
const H_PREFIX = [
  "資深", "業餘", "菜逼八", "佛系", "硬派", "邊緣", "資優", "學店", "快樂", "崩潰",
  "資淺", "全校最強", "傳說中的", "退休", "兼職",
];
const H_ROLE = [
  "蹺課仔", "共筆王", "重修生", "早八鬥士", "加簽乞丐", "點名絕緣體", "報告製造機",
  "停修候選人", "GPA保衛者", "涼課獵人", "死當邊緣人", "考古題信徒", "分組孤兒",
  "通識亂修俠", "期末突擊隊", "微積分受害者", "第八節殭屍", "螢幕前的影子", "選課手刀王",
  "凌晨交作業的人",
];
function makeHandles(n: number): string[] {
  const set = new Set<string>();
  let guard = 0;
  while (set.size < n && guard++ < n * 50) {
    const name = `${pick(H_PREFIX)}${pick(H_ROLE)}`;
    set.add(name);
  }
  // top up with a numeric suffix if the combo space ran dry
  let k = 2;
  while (set.size < n) set.add(`${pick(H_PREFIX)}${pick(H_ROLE)}${k++}`);
  return shuffle([...set]);
}

// ── review-text phrase banks (rating-aware + 有梗, for demo) ──────────────────
const POS_QUALITY = [
  "老師根本行走的維基百科，問什麼都答得出來",
  "上完一學期發現自己居然真的會了，當場嚇到",
  "投影片做得比我畢業專題還用心",
  "乾貨多到筆記抄到手抽筋，但真的值得",
  "講課又有料又好笑，難得一堂不會想睡的課",
  "老師舉的例子超生活化，秒懂",
];
const NEG_QUALITY = [
  "上課內容估狗都有，來教室純粹刷存在感",
  "老師講到哪我也不知道，反正期末再說",
  "PPT 是十年前的，連錯字都沒改",
  "聽完一節課，筆記上只有我畫的小烏龜",
  "全程照念課本，我自己在家念還比較快",
];
const HEAVY_LOAD = [
  "作業多到我以為我輔修了這門課",
  "報告一個接一個，室友以為我搬去圖書館住了",
  "每週都有作業，週末是可以吃的東西嗎",
  "期末三個報告同時爆，我直接原地升天",
];
const LIGHT_LOAD = [
  "涼到可以邊上課邊追劇",
  "作業少到我懷疑老師是不是忘記出了",
  "考前翻一下就過，佛到不行",
  "這門課是來養生的，建議搭配溫開水服用",
];
const SWEET_GRADE = [
  "甜到蛀牙，閉著眼睛都能過",
  "只要你還活著、有交，分數就很漂亮",
  "老師佛到我都不好意思翹課了",
  "給分甜到我懷疑教授是糖做的",
];
const HARSH_GRADE = [
  "給分硬到可以拿來敲核桃",
  "考卷發下來我一度以為拿到別人的",
  "想拿 A 要先燒香拜拜順便擲筊",
  "被當得心服口服，老師標準是真的高",
];
const ATTEND = ["點名點到我以為在當兵", "幾乎不點名，自由到想哭", "會抽點，賭徒們自己保重"];
const CLOSING = [
  "總之推爆，朋友我先選了你動作快點",
  "想涼的快來、想學東西的也來，雙贏",
  "沒有雷，雷的是當初不認真的我",
  "建議先顧好基礎，不然會像我一樣邊哭邊修",
  "會推給下一屆學弟妹（如果他們對我好的話）",
  "選這門就對了，相信學長姐的眼淚",
];

function buildText(p: { quality: number; loading: number; grading: number; coolness: number }) {
  const parts: string[] = [];
  parts.push(p.quality >= 4 ? pick(POS_QUALITY) : p.quality <= 2 ? pick(NEG_QUALITY) : pick([...POS_QUALITY, ...NEG_QUALITY]));
  if (p.loading >= 4) parts.push(pick(HEAVY_LOAD));
  else if (p.loading <= 2) parts.push(pick(LIGHT_LOAD));
  if (p.grading >= 4) parts.push(pick(SWEET_GRADE));
  else if (p.grading <= 2) parts.push(pick(HARSH_GRADE));
  if (chance(0.4)) parts.push(pick(ATTEND));
  if (chance(0.7)) parts.push(pick(CLOSING));

  // One 心得 paragraph (no separate one-line short review).
  const body = shuffle(parts).join("。") + "。";
  return { body };
}

function tagsFor(p: { loading: number; grading: number; coolness: number; quality: number }): string[] {
  const out = new Set<string>();
  // attendance: always pick one of the three sometimes
  if (chance(0.7)) out.add(pick(["會點名", "不點名", "點名抽人"]));
  if (p.grading >= 4 && chance(0.7)) out.add("佛心給分");
  if (p.grading <= 2 && chance(0.6)) out.add("容易被當");
  if (p.loading >= 4) {
    if (chance(0.6)) out.add(pick(["作業偏多", "重報告", "重期末"]));
    if (chance(0.4)) out.add(pick(["有期中考", "需分組"]));
  }
  if (p.loading <= 2 && chance(0.5)) out.add("不考試");
  if (chance(0.12)) out.add("好加簽");
  if (chance(0.08)) out.add("難加簽");
  if (chance(0.06)) out.add("全英授課");
  if (chance(0.05)) out.add("遠距居多");
  // ensure subset of allowed + cap 5
  return [...out].filter((t) => REVIEW_TAG_VALUES.includes(t)).slice(0, 5);
}

// per-(course,teacher) "true" profile; each review jitters around it
function courseProfile() {
  const tier = pick(["good", "good", "mid", "mid", "mixed", "tough"] as const);
  const base = {
    good: { quality: 4.4, coolness: 3.6, loading: 2.6, grading: 4.2, sweetness: 4.1 },
    mid: { quality: 3.4, coolness: 3.2, loading: 3.2, grading: 3.4, sweetness: 3.3 },
    mixed: { quality: 3.6, coolness: 2.6, loading: 3.8, grading: 3.2, sweetness: 3.0 },
    tough: { quality: 4.0, coolness: 2.2, loading: 4.3, grading: 2.4, sweetness: 2.5 },
  }[tier];
  return base;
}
function ratingFrom(base: ReturnType<typeof courseProfile>) {
  const j = () => (Math.random() - 0.5) * 1.6; // ±0.8
  return {
    sweetness: clamp5(base.sweetness + j()),
    coolness: clamp5(base.coolness + j()),
    loading: clamp5(base.loading + j()),
    quality: clamp5(base.quality + j()),
    grading: clamp5(base.grading + j()),
  };
}

function pastDate(maxDaysAgo = 600): string {
  const ms = Date.now() - rnd(maxDaysAgo) * 86_400_000 - rnd(86_400_000);
  return new Date(ms).toISOString();
}

// ── auth user management ─────────────────────────────────────────────────────
async function listSeedUsers(sb: Sb) {
  const found: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (isSeedEmail(u.email)) found.push({ id: u.id, email: u.email! });
    if (data.users.length < 200) break;
  }
  return found;
}

async function ensureUsers(sb: Sb, n: number) {
  const existing = await listSeedUsers(sb);
  const byEmail = new Map(existing.map((u) => [u.email, u.id]));
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const email = `${SEED_PREFIX}${i}@${SEED_DOMAIN}`;
    let id = byEmail.get(email);
    if (!id) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: `seed-${i}-${Math.random().toString(36).slice(2)}`,
        email_confirm: true,
        app_metadata: { seed: true },
      });
      if (error) throw new Error(`createUser ${email}: ${error.message}`);
      id = data.user!.id;
      process.stdout.write(`.`);
    }
    ids.push(id);
  }
  process.stdout.write(`\n`);
  // profiles (display_name snapshot used on each review) — funny handles for demo
  const handles = makeHandles(ids.length);
  const profiles = ids.map((user_id, i) => ({ user_id, display_name: handles[i] }));
  const { error: pErr } = await sb.from("profiles").upsert(profiles, { onConflict: "user_id", ignoreDuplicates: true });
  if (pErr) throw pErr;
  // map id -> display name (read back, since some profiles pre-existed)
  const { data: prows } = await sb.from("profiles").select("user_id, display_name").in("user_id", ids);
  const nameById = new Map((prows ?? []).map((p) => [p.user_id, p.display_name as string]));
  return ids.map((id, i) => ({ id, name: nameById.get(id) ?? handles[i] }));
}

async function purge(sb: Sb) {
  const users = await listSeedUsers(sb);
  const ids = users.map((u) => u.id);
  console.log(`Purging ${ids.length} seed users' data…`);
  // Delete reviews + profiles directly (service role). Deleting reviews fires the
  // summary trigger; profiles are FK'd from reviews so reviews must go first.
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    await sb.from("reviews").delete().in("user_id", chunk);
    await sb.from("profiles").delete().in("user_id", chunk);
  }
  // Best-effort: also remove the auth identities (GoTrue sometimes refuses; ignore).
  let removed = 0;
  for (const u of users) {
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (!error) removed++;
  }
  console.log(`Cleared data for ${ids.length} seed users (auth rows removed: ${removed}).`);
}

// ── course sampling ──────────────────────────────────────────────────────────
type Offering = { id: string; course_key: string; teacher_key: string; name: string; semester_id: string | null };

async function sampleGroups(sb: Sb, nGroups: number) {
  // pull recent offerings (latest semesters first) and group by (course_key, teacher_key)
  const rows: Offering[] = [];
  for (let off = 0; off < 4000; off += 1000) {
    const { data, error } = await sb
      .from("courses")
      .select("id, course_key, teacher_key, name, semester_id")
      .neq("teacher_key", "")
      .not("teacher_key", "is", null)
      .order("semester_id", { ascending: false })
      .range(off, off + 999);
    if (error) throw error;
    rows.push(...(data as Offering[]));
    if (!data || data.length < 1000) break;
  }
  const groups = new Map<string, Offering>(); // key -> chosen (latest) offering
  for (const r of rows) {
    const k = `${r.course_key}|${r.teacher_key}`;
    if (!groups.has(k)) groups.set(k, r); // first seen = latest semester (sorted desc)
  }
  return sampleN([...groups.values()], nGroups);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createAdminClient();

  if (PURGE) {
    await purge(sb);
    return;
  }

  console.log(`Ensuring ${N_USERS} seed users…`);
  const users = await ensureUsers(sb, N_USERS);

  console.log(`Sampling ${N_GROUPS} (course, teacher) groups…`);
  const groups = await sampleGroups(sb, N_GROUPS);
  console.log(`Got ${groups.length} groups. Building reviews…`);

  type Row = Record<string, unknown>;
  const rows: Row[] = [];
  for (const g of groups) {
    const base = courseProfile();
    const count = MIN_PER + rnd(MAX_PER - MIN_PER + 1);
    const reviewers = sampleN(users, count); // distinct users => unique(course_id,user_id) holds
    for (const u of reviewers) {
      const r = ratingFrom(base);
      const { body } = buildText(r);
      rows.push({
        course_id: g.id,
        user_id: u.id,
        semester_id: g.semester_id,
        sweetness: r.sweetness,
        coolness: r.coolness,
        loading: r.loading,
        quality: r.quality,
        grading: r.grading,
        body,
        tags: tagsFor(r),
        display_name: u.name,
        like_count: chance(0.5) ? rnd(14) : 0,
        useful_count: chance(0.5) ? rnd(10) : 0,
        created_at: pastDate(),
      });
    }
  }

  console.log(`Inserting ${rows.length} reviews (batched)…`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error, count } = await sb
      .from("reviews")
      .upsert(batch, { onConflict: "course_id,user_id", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;
    inserted += count ?? batch.length;
    process.stdout.write(`  ${Math.min(i + 200, rows.length)}/${rows.length}\r`);
  }
  // reputation = reviewCount * 10 (mirrors the real submitReview action) so the
  // 貢獻排行 board orders sensibly. Count from the DB (not the in-memory rows) so
  // it stays correct across idempotent re-runs.
  const ids = users.map((u) => u.id);
  const countByUser = new Map<string, number>(ids.map((id) => [id, 0]));
  const { data: mine } = await sb.from("reviews").select("user_id").in("user_id", ids);
  for (const r of mine ?? []) countByUser.set(r.user_id as string, (countByUser.get(r.user_id as string) ?? 0) + 1);
  for (const [user_id, c] of countByUser) {
    await sb.from("profiles").update({ reputation: c * 10 }).eq("user_id", user_id);
  }

  console.log(`\nDone. Seeded ~${inserted} reviews across ${groups.length} courses for ${users.length} users.`);
  console.log(`Undo anytime with:  npm run seed-reviews -- --purge`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
