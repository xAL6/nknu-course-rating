"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, Search, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { AiCourseCards, type AiCard } from "@/components/ai-course-cards";
import { AiScheduleResult, type AiSchedule } from "@/components/ai-schedule-result";

const SUGGESTIONS = [
  "推薦輕鬆又有收穫的通識課",
  "不點名、又好加簽的課有哪些？",
  "比較「演算法」不同老師的評價",
  "我是數學系,排一份週五沒課的課表",
];

export function AiChat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-6" />
              </div>
              <div className="mt-2 space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">AI 課程助手</h2>
                <p className="max-w-sm text-sm text-body">
                  用一句話描述你想要的課,我會根據同學評價與課程資料給你建議。
                </p>
              </div>
              <div className="mt-4 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="glass-soft glass-interactive rounded-lg px-3 py-2.5 text-left text-sm text-body"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type === "text")
                      return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    if (part.type.startsWith("tool-")) {
                      const out = (part as {
                        output?: { kind?: string; courses?: AiCard[]; courseKey?: string };
                      }).output;
                      if (out?.kind === "schedule")
                        return <AiScheduleResult key={i} schedule={out as unknown as AiSchedule} />;
                      let cards: AiCard[] | null = null;
                      if (out?.courses && out.courses.length > 0) cards = out.courses;
                      else if (out?.courseKey) cards = [out as AiCard];
                      if (cards) return <AiCourseCards key={i} courses={cards} />;
                      return (
                        <span key={i} className="flex items-center gap-1.5 text-xs text-mute">
                          <Search className="size-3" /> 搜尋課程資料庫…
                        </span>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {busy && messages[messages.length - 1]?.role === "user" && (
            <Message from="assistant">
              <MessageContent>
                <span className="flex items-center gap-2 text-sm text-mute">
                  <Loader2 className="size-4 animate-spin" /> 思考中…
                </span>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="mt-2 rounded-md border border-error-soft bg-error-soft/40 px-4 py-2 text-sm text-error-deep">
          AI 助手暫時無法回應。可能是使用過於頻繁(請稍後再試,或登入以提高額度),或尚未設定 DEEPSEEK_API_KEY。
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="glass mt-3 flex items-end gap-2 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-ring"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder="輸入你的選課需求…(Enter 送出,Shift+Enter 換行)"
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} className="size-9 shrink-0 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
