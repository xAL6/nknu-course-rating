import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import {
  retrieveCourses,
  compareTeachersForAI,
  getCourseDetailForAI,
  buildScheduleForAI,
  listDeptCoursesForAI,
} from "@/lib/data/ai-search";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const maxDuration = 60;

const SYSTEM = `你是「選課嘴砲學長」🎓——高師大傳說級的選課老司機，嘴很賤但超靠譜。

【人設與語氣】（demo 用，要讓人會心一笑）
- 講話浮誇、愛吐槽、台式幽默＋適量 emoji，但別油到讓人尷尬。
- 看到甜涼課兩眼發光（例：「這根本佛祖親自開的課🙏 涼到要帶外套」）；看到硬課就哀號（例：「修這門＝簽賣身契📝，期末會在圖書館過夜」）；看到全勤點名課就「阿彌陀佛，肉身務必到場」。
- 可以調侃課程、自嘲、講幹話開場，但**梗歸梗、數據要實在**——絕不為了好笑亂編課程、評分或標籤。
- 幽默是調味，最後一定要給「準確、可行動」的建議與課程連結。

【正事規則（無論多好笑都要遵守）】
- 只能根據工具回傳的真實課程資料回答，不可捏造課程、教師、評分或標籤。
- 先選對工具再回答：
  · listDeptCourses — 「○○系大幾上/下學期有哪些課」這種「系所＋年級＋學期」的結構化問題，一定用這個（它用真實班級歸屬精準列課，不會像關鍵字那樣猜年級或混進別系）。
  · searchCourses — 依關鍵字／主題找課（例如「推薦輕鬆的通識」）；可用 tags 篩選（例如只看「不點名」「好加簽」的課）。tags 僅能用這些值：會點名/不點名/點名抽人/好加簽/難加簽/不考試/重期末/有期中考/重報告/作業偏多/需分組/佛心給分/容易被當/全英授課/遠距居多。
  · compareTeachers — 比較「同一門課的不同授課老師」，傳入課名。
  · getCourseDetail — 深入單一課程（評分、標籤分布、歷年搶課熱度、短評），courseKey 取自其他工具回傳值。
  · buildSchedule — 自動排出一份「不衝堂」的建議課表。把使用者說的空堂日轉成 freeWeekdays（1=週一…7=週日，例如「週五沒課」→[5]），系所名稱放 department；可帶 targetCredits、tags、prefer（sweet/easy/quality）。回傳的是一個「可行建議」，要提醒可再自行調整，不可捏造未回傳的課；若回傳 error，請把 message 轉達給學生。
- 評分面向：甜度(給分甜)、涼度(輕鬆)、收穫(學到多少/內容紮實)。分數 1–5。
- 工具回傳的 tags 是同學標記的「快速標籤」與其次數（例如 {"好加簽":12,"會點名":8}），代表點名/加簽/考試/作業/授課形式等事實面向。可引用標籤與次數佐證（例如「12 人標『好加簽』」），不可捏造未出現的標籤。
- enrollFillRate 是「選課人數 / 名額」比例：越接近或超過 1 代表越搶手、越難選上；可用來回答「選上機率／好不好搶」。
- 若課程「尚無評價」(reviewCount 為 0)，要誠實說明目前沒有評價資料，只能依課名/教師/學分提供參考。
- 比較不同老師時，用條列或表格並排呈現各自的評分、標籤與熱度。
- 回答用繁體中文，精簡、條列推薦。
- 【工具使用上限，務必遵守】
  · 找課／推薦：只呼叫 searchCourses 「一次」。它回傳的資料已含評分、標籤、搶課熱度，足以直接推薦——不要再對每門課逐一 getCourseDetail。
  · getCourseDetail 只在使用者明確說要「深入了解某一門特定課」時才用，且最多一次。
  · 比較老師：只呼叫 compareTeachers 一次。排課：只呼叫 buildSchedule 一次。
  · 拿到工具結果後，「立刻用文字給出結論」。嚴禁反覆搜尋；最後務必輸出文字回答，不可只丟工具結果。
  · 課程沒有評分(rating 為 null)也沒關係，照樣可以推薦，只要誠實說明「尚無評價」。
  · 即使工具結果很少、或沒有「完全符合」條件的課，也要「用現有結果直接回答並說明限制」，嚴禁換關鍵字反覆重搜（最多換一次關鍵字）。
- 提到課程時，務必用 Markdown 連結附上課程頁面：[課名（課號）](連結)。連結必須直接用工具回傳的「url」欄位原字串（已編碼好），不要自己用 courseKey 組裝、也不要改寫，否則含括號的課名（如「專題(二)」）連結會壞掉。`;

// Signed-in NKNU students get a higher allowance than anonymous visitors.
const ANON_LIMIT = 8; // requests
const AUTH_LIMIT = 40;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(JSON.stringify({ error: "AI_DISABLED" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth-aware rate limiting (per user when signed in, else per IP).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const limitKey = user ? `ai:user:${user.id}` : `ai:ip:${clientIp(req)}`;
  const limit = user ? AUTH_LIMIT : ANON_LIMIT;
  const rl = rateLimit(limitKey, limit, WINDOW_MS);
  if (!rl.ok) {
    const mins = Math.ceil(rl.resetMs / 60000);
    return new Response(
      JSON.stringify({ error: "RATE_LIMITED", retryAfterMinutes: mins }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
        },
      },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: deepseek(process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      searchCourses: tool({
        description:
          "搜尋高師大課程資料庫，依關鍵字（課名、教師、主題）取得課程、評分摘要、快速標籤與搶課熱度。可用 tags 篩選（例如只看『不點名』『可加簽』的課）。",
        inputSchema: z.object({
          query: z.string().describe("搜尋關鍵字，例如課名、教師姓名或主題"),
          department: z.string().optional().describe("系所代碼（可選）"),
          tags: z
            .array(z.string())
            .optional()
            .describe('只回傳同時帶有這些快速標籤的課，例如 ["不點名","好加簽"]'),
        }),
        execute: async ({ query, department, tags }) => {
          const courses = await retrieveCourses(query, department, { tags });
          return { count: courses.length, courses };
        },
      }),
      compareTeachers: tool({
        description:
          "比較『同一門課的不同授課老師』。傳入課名，回傳各老師版本的評分、標籤與搶課熱度，方便並列比較。",
        inputSchema: z.object({
          courseName: z.string().describe("課程名稱，例如『演算法』"),
        }),
        execute: async ({ courseName }) => {
          const courses = await compareTeachersForAI(courseName);
          return { count: courses.length, courses };
        },
      }),
      getCourseDetail: tool({
        description:
          "取得單一課程的完整資訊（評分、標籤分布、歷年搶課熱度、幾則短評），用於深入介紹或回答『這門課好不好選上』。courseKey 取自其他工具回傳的 courseKey。",
        inputSchema: z.object({
          courseKey: z.string().describe("課程的 courseKey"),
        }),
        execute: async ({ courseKey }) => {
          const detail = await getCourseDetailForAI(courseKey);
          return detail ?? { error: "NOT_FOUND" };
        },
      }),
      listDeptCourses: tool({
        description:
          "列出某『系所』實際開設的課程清單，可指定年級與學期。回答「○○系大幾上/下學期有哪些課」這類結構化問題時，一定用這個（不要用 searchCourses 關鍵字硬猜）。會用課程真實的班級歸屬精準篩選，含該年級必修＋全年級選修。",
        inputSchema: z.object({
          department: z.string().describe("系所名稱，全名或簡稱皆可，例如「軟體工程與管理學系」或「軟工系」「國文系」"),
          grade: z.number().int().min(1).max(7).optional().describe("年級：大一=1…大四=4（省略=整個系所）"),
          term: z.enum(["1", "2", "3"]).optional().describe("學期：1=上學期、2=下學期、3=暑修（省略=最新主要學期）"),
        }),
        execute: async (args) => listDeptCoursesForAI(args),
      }),
      buildSchedule: tool({
        description:
          "依條件自動排出一份『不衝堂』的建議課表（預設會避開跨校區緊接）。把『週五沒課』轉成 freeWeekdays:[5]，系所名稱放 department。",
        inputSchema: z.object({
          department: z.string().optional().describe("系所名稱關鍵字，例如『數學系』"),
          semester: z.string().optional().describe("學年期，例如 114-1；省略則用最新學期"),
          freeWeekdays: z
            .array(z.number().int().min(1).max(7))
            .optional()
            .describe("要保留沒課的星期，1=週一…7=週日，例如週五沒課為 [5]"),
          targetCredits: z.number().int().min(1).max(30).optional().describe("目標學分，預設約 15"),
          tags: z.array(z.string()).optional().describe('偏好的快速標籤，例如 ["不點名"]'),
          prefer: z
            .enum(["sweet", "easy", "quality"])
            .optional()
            .describe("排序偏好：sweet=甜、easy=涼/輕鬆、quality=收穫"),
          avoidCrossCampus: z.boolean().optional().describe("是否避開跨校區緊接，預設 true"),
        }),
        execute: async (args) => buildScheduleForAI(args),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
