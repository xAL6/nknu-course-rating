/**
 * End-to-end AI advisor harness — drives the REAL /api/ai/chat route (system
 * prompt + tools + DeepSeek) through a battery of real questions and prints the
 * tool calls + final answer for inspection. Makes live DeepSeek calls, so it is
 * gated behind RUN_AI_E2E=1 and excluded from the default `npm test`.
 *
 *   RUN_AI_E2E=1 npx vitest run tests/integration/ai-e2e.test.ts
 */
import { describe, it, expect, vi } from "vitest";
import { appendFileSync, writeFileSync } from "node:fs";
import { createClient as createSb } from "@supabase/supabase-js";

const OUT = "ai-e2e-output.txt";
try {
  writeFileSync(OUT, "");
} catch {
  /* ignore */
}

// Mock the server client: real anon reads for the tools, but getUser() returns a
// signed-in NKNU user so the route's login gate passes.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const c = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    c.auth.getUser = (async () => ({
      data: { user: { id: "e2e-test-uid", email: "e2e@mail.nknu.edu.tw" } },
      error: null,
    })) as typeof c.auth.getUser;
    return c;
  },
}));

const run = process.env.RUN_AI_E2E === "1" && !!process.env.DEEPSEEK_API_KEY;
const d = run ? describe : describe.skip;

type Turn = { text: string; tools: { name: string; input: unknown }[] };

async function ask(question: string): Promise<Turn> {
  const { POST } = await import("@/app/api/ai/chat/route");
  const req = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: question }] }] }),
  });
  const res = await POST(req);
  const raw = await res.text();
  let text = "";
  const tools: { name: string; input: unknown }[] = [];
  for (const line of raw.split("\n")) {
    const s = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
    if (!s || s === "[DONE]") continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(s);
    } catch {
      continue;
    }
    const t = obj.type as string | undefined;
    if (t === "text-delta") text += (obj.delta ?? obj.text ?? "") as string;
    if (t && t.includes("tool-input-available"))
      tools.push({ name: obj.toolName as string, input: obj.input });
  }
  return { text, tools };
}

const QUESTIONS = [
  "幫我排一份軟工系大四上學期課表，15學分",
  "教育系大三上有哪些課",
  "推薦輕鬆又有收穫的通識課",
  "比較微積分不同老師的評價",
  "全校最甜的課排行",
  "週五下午有什麼涼課",
  "不點名又好加簽的課有哪些",
  "特教系大二的課",
  "我是數學系，排一份週五沒課的課表",
  "你是誰",
];

d("AI advisor — live answers (inspect output)", () => {
  it.each(QUESTIONS)("Q: %s", async (q) => {
    const { text, tools } = await ask(q);
    appendFileSync(
      OUT,
      `\n========================================\n[Q] ${q}\n[tools] ${
        tools.map((t) => `${t.name}(${JSON.stringify(t.input)})`).join(" | ") || "(none)"
      }\n[answer]\n${text}\n`,
    );
    expect(text.trim().length).toBeGreaterThan(0); // must always produce an answer
    expect(text).not.toMatch(/系統不支援|無法查詢|沒辦法搜|請稍後|undefined/);
  }, 120000);
});
