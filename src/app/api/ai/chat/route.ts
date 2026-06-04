import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { retrieveCourses } from "@/lib/data/ai-search";

export const maxDuration = 60;

const SYSTEM = `你是「高師大選課助手」，協助高雄師範大學的學生選課。
規則：
- 只能根據 searchCourses 工具回傳的真實課程資料回答，不可捏造課程、教師或評分。
- 學生用自然語言描述需求（例如「想找輕鬆又有收穫的通識」、「比較某兩位老師」）時，先用 searchCourses 取得資料再回答。
- 評分面向：甜度(給分甜)、涼度(輕鬆)、負擔(作業考試多寡)、品質(內容紮實)、給分。分數 1–5。
- 若課程「尚無評價」(reviewCount 為 0)，要誠實說明目前沒有評價資料，只能依課名/教師/學分提供參考。
- 回答用繁體中文，精簡、條列推薦，並附上課號方便學生查詢。`;

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(JSON.stringify({ error: "AI_DISABLED" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: deepseek("deepseek-chat"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      searchCourses: tool({
        description:
          "搜尋高師大課程資料庫，依關鍵字（課名、教師、主題）取得課程與其評分摘要。",
        inputSchema: z.object({
          query: z.string().describe("搜尋關鍵字，例如課名、教師姓名或主題"),
          department: z.string().optional().describe("系所代碼（可選）"),
        }),
        execute: async ({ query, department }) => {
          const courses = await retrieveCourses(query, department);
          return { count: courses.length, courses };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
