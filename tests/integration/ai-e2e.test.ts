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

type Msg = { id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] };

async function send(messages: Msg[]): Promise<Turn> {
  const { POST } = await import("@/app/api/ai/chat/route");
  const req = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
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

const ask = (question: string) => send([{ id: "m1", role: "user", parts: [{ type: "text", text: question }] }]);

/** Two-turn conversation: ask q1, feed its answer back, then ask the follow-up. */
async function askFollowUp(q1: string, q2: string): Promise<Turn> {
  const a1 = await ask(q1);
  return send([
    { id: "m1", role: "user", parts: [{ type: "text", text: q1 }] },
    { id: "m2", role: "assistant", parts: [{ type: "text", text: a1.text }] },
    { id: "m3", role: "user", parts: [{ type: "text", text: q2 }] },
  ]);
}

const QUESTIONS = [
  // English
  "recommend an easy general education course with good takeaways",
  "which teacher for calculus is the most lenient",
  // typo / informal / wrong character
  "微積份哪個老師比較甜", // 份 (wrong) vs 分
  "軟體工程系大4上有啥課", // mixed digits / informal
  // special units / ambiguous
  "體育課有哪些可以選",
  "軍訓課表",
  "數學系的課", // no grade/term — should act sensibly, not error
  "想找週一沒課又涼的通識", // combined free-day + cool + gen-ed
  // long-ish rambling but legit (must not be falsely refused, must answer)
  "我是英語系大三的學生，這學期想修一些不要太硬、最好不點名、作業少一點、老師給分甜一點的課，時間希望集中在下午，因為早上想睡覺，可以幫我推薦幾門嗎，通識或系上選修都可以",
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
    // no hallucinated link domains — every course link must use the real site host
    expect(text).not.toMatch(/nkust|nknu\.(cc|red)|github\.io|\.live|sso\.nknu\.edu\.tw|amazonaws/);
    // no process / tool-use narration leaking into the answer
    expect(text).not.toMatch(/換個打法|拆開來撈|撈撈看|不掛 ?tag|回來自己挑|搜了[一二兩三]|被系統卡|第一輪搜|搜尋上限|limitReached/);
  }, 120000);
});

const FOLLOWUPS: [string, string][] = [
  ["教育系大三上有哪些課", "那下學期呢"], // context carry: same dept/grade, switch term
  ["全校最甜的課排行", "那最涼的呢"], // context carry: switch ranking dimension
  ["軟工系大四上15學分課表", "幫我把專題拿掉重排"], // refine prior schedule
];

d("AI advisor — multi-turn follow-ups", () => {
  it.each(FOLLOWUPS)("Q1: %s → Q2: %s", async (q1, q2) => {
    const { text, tools } = await askFollowUp(q1, q2);
    appendFileSync(
      OUT,
      `\n========================================\n[Q1] ${q1}\n[Q2] ${q2}\n[tools] ${
        tools.map((t) => `${t.name}(${JSON.stringify(t.input)})`).join(" | ") || "(none)"
      }\n[answer]\n${text}\n`,
    );
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toMatch(/系統不支援|無法查詢|沒辦法搜|請稍後|undefined/);
    expect(text).not.toMatch(/nkust|nknu\.(cc|red)|github\.io|\.live|sso\.nknu\.edu\.tw|amazonaws/);
  }, 180000);
});
