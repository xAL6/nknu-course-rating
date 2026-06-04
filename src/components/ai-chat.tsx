"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, Send, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "推薦輕鬆又有收穫的通識課",
  "資工相關、甜度高的選修有哪些？",
  "幫我比較教某門課的不同老師",
  "想找週五沒課的課表，先給我建議",
];

export function AiChat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-lg text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">AI 課程助手</h2>
            <p className="mt-2 text-sm text-body">
              用一句話描述你想要的課,我會根據同學評價與課程資料給你建議。
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="elev-1 hover:elev-2 rounded-lg bg-canvas px-3 py-2.5 text-left text-sm text-body transition-shadow"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "elev-1 bg-canvas"
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type === "text")
                  return (
                    <span key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  );
                if (part.type.startsWith("tool-"))
                  return (
                    <span
                      key={i}
                      className="my-1 flex items-center gap-1.5 text-xs text-mute"
                    >
                      <Search className="size-3" /> 搜尋課程資料庫…
                    </span>
                  );
                return null;
              })}
            </div>
          </div>
        ))}

        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="elev-1 flex items-center gap-2 rounded-2xl bg-canvas px-4 py-2.5 text-sm text-mute">
              <Loader2 className="size-4 animate-spin" /> 思考中…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-error-soft bg-error-soft/40 px-4 py-3 text-sm text-error-deep">
            AI 助手目前無法使用(可能尚未設定 DEEPSEEK_API_KEY)。
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-center gap-2 border-t border-hairline pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入你的選課需求…"
          className="h-11 flex-1 rounded-full border border-hairline bg-canvas px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={busy} className="size-11 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
