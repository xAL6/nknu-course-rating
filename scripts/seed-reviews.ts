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
import { randomDisplayName, REVIEW_TAG_VALUES } from "../src/lib/config";

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

// ── review-text phrase banks (rating-aware so text matches the numbers) ──────
const POS_QUALITY = [
  "老師上課很有條理，重點都會幫你抓出來",
  "內容蠻紮實的，跟著上完真的學得到東西",
  "講解清楚，難的觀念也會用例子帶過",
  "投影片做得很完整，複習很方便",
  "老師很願意回答問題，下課問也不會被嫌",
  "上課會補充很多課本沒有的東西，收穫滿大",
  "教學認真，看得出來有用心備課",
];
const NEG_QUALITY = [
  "上課比較照本宣科，自己看課本差不多",
  "講解有點跳，要回家自己再補一次",
  "進度有時候有點亂，會跟不太上",
  "內容偏淺，想深入要自己找資料",
  "老師講話有點小聲，後面容易放空",
];
const HEAVY_LOAD = [
  "作業偏多，幾乎每週都有要交",
  "報告一個接一個，期末會有點爆",
  "考試＋報告＋作業，後半學期要排好時間",
  "需要花不少課後時間，修之前先評估一下",
];
const LIGHT_LOAD = [
  "作業不多，負擔算很輕",
  "幾乎沒什麼作業，蠻好過的",
  "壓力不大，考前讀一下就行",
  "整體很輕鬆，可以當涼課修",
];
const SWEET_GRADE = [
  "給分很甜，認真寫就有不錯的分數",
  "只要有交、有到，分數都很漂亮",
  "佛心老師，不太會當人",
  "甜度頗高，想衝 GPA 可以考慮",
];
const HARSH_GRADE = [
  "給分偏嚴，想拿高分要很拼",
  "考試蠻硬的，平均不會太高",
  "標準有點高，分數沒有想像中好拿",
];
const ATTEND = ["會點名要注意出席", "幾乎不點名，蠻自由的", "偶爾抽點，別太常翹"];
const CLOSING = [
  "整體推薦，想了解這個領域的可以修",
  "想輕鬆過的話可以考慮",
  "建議先把基礎顧好再來會比較跟得上",
  "看個人需求，但我自己是覺得值得",
  "中規中矩，沒有特別雷",
  "蠻喜歡這門課的氛圍，會推給朋友",
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

  const ordered = shuffle(parts);
  const shortComment = ordered[0];
  // body = the rest, sometimes omitted entirely for short reviews
  const rest = ordered.slice(1);
  const body = rest.length && chance(0.85) ? rest.join("。") + "。" : null;
  return { shortComment, body };
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
  // profiles (display_name snapshot used on each review)
  const profiles = ids.map((user_id) => ({ user_id, display_name: randomDisplayName() }));
  const { error: pErr } = await sb.from("profiles").upsert(profiles, { onConflict: "user_id", ignoreDuplicates: true });
  if (pErr) throw pErr;
  // map id -> display name (read back, since some profiles pre-existed)
  const { data: prows } = await sb.from("profiles").select("user_id, display_name").in("user_id", ids);
  const nameById = new Map((prows ?? []).map((p) => [p.user_id, p.display_name as string]));
  return ids.map((id) => ({ id, name: nameById.get(id) ?? randomDisplayName() }));
}

async function purge(sb: Sb) {
  const users = await listSeedUsers(sb);
  console.log(`Purging ${users.length} seed users (reviews/profiles cascade)…`);
  let done = 0;
  for (const u of users) {
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  deleteUser ${u.email}: ${error.message}`);
    else done++;
  }
  console.log(`Removed ${done}/${users.length} seed users.`);
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
      const { shortComment, body } = buildText(r);
      rows.push({
        course_id: g.id,
        user_id: u.id,
        semester_id: g.semester_id,
        sweetness: r.sweetness,
        coolness: r.coolness,
        loading: r.loading,
        quality: r.quality,
        grading: r.grading,
        short_comment: shortComment,
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
