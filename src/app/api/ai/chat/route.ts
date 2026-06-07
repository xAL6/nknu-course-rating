import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { retrieveCourses, compareTeachersForAI, getCourseDetailForAI } from "@/lib/data/ai-search";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const maxDuration = 60;

const SYSTEM = `你是「高師大選課助手」，協助高雄師範大學的學生選課。
規則：
- 只能根據工具回傳的真實課程資料回答，不可捏造課程、教師、評分或標籤。
- 先選對工具再回答：
  · searchCourses — 依關鍵字找課；可用 tags 篩選（例如只看「不點名」「可加簽」的課）。
  · compareTeachers — 比較「同一門課的不同授課老師」，傳入課名。
  · getCourseDetail — 深入單一課程（評分、標籤分布、歷年搶課熱度、短評），courseKey 取自其他工具回傳值。
- 評分面向：甜度(給分甜)、涼度(輕鬆)、負擔(作業考試多寡)、品質(內容紮實)、給分。分數 1–5。
- 工具回傳的 tags 是同學標記的「快速標籤」與其次數（例如 {"可加簽":12,"會點名":8}），代表點名/加簽/考試/作業/授課形式等事實面向。可引用標籤與次數佐證（例如「12 人標『可加簽』」），不可捏造未出現的標籤。
- enrollFillRate 是「選課人數 / 名額」比例：越接近或超過 1 代表越搶手、越難選上；可用來回答「選上機率／好不好搶」。
- 若課程「尚無評價」(reviewCount 為 0)，要誠實說明目前沒有評價資料，只能依課名/教師/學分提供參考。
- 比較不同老師時，用條列或表格並排呈現各自的評分、標籤與熱度。
- 回答用繁體中文，精簡、條列推薦。
- 提到課程時，務必用 Markdown 連結語法附上課程頁面，格式為 [課名（課號）](/course/courseKey)，courseKey 取自工具回傳的 courseKey 欄位，方便學生點擊查看。`;

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
    model: deepseek("deepseek-chat"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
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
            .describe('只回傳同時帶有這些快速標籤的課，例如 ["不點名","可加簽"]'),
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
    },
  });

  return result.toUIMessageStreamResponse();
}
