"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RATING_DIMENSIONS, SEMESTER_TERMS, REVIEW_TAG_GROUPS, MAX_REVIEW_TAGS } from "@/lib/config";
import { submitReview } from "@/lib/actions";
import type { Offering } from "@/lib/data/types";

export function ReviewForm({
  courseKey,
  offerings,
}: {
  courseKey: string;
  offerings: Offering[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(RATING_DIMENSIONS.map((d) => [d.key, 3])),
  );
  const [syllabusNo, setSyllabusNo] = useState(offerings[0]?.syllabusNo ?? "");
  const [tags, setTags] = useState<string[]>([]);

  const toggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_REVIEW_TAGS
          ? prev
          : [...prev, tag],
    );

  const semLabel = (id: string) => {
    const [y, t] = id.split("-");
    return `${y} ${SEMESTER_TERMS[t] ?? t}`;
  };

  function action(formData: FormData) {
    startTransition(async () => {
      try {
        await submitReview(formData);
        toast.success("評價已送出，感謝你的分享！");
        router.refresh();
      } catch (e) {
        const msg = (e as Error).message;
        toast.error(msg === "UNAUTHORIZED" ? "請先以高師大信箱登入。" : "送出失敗，請再試一次。");
      }
    });
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="courseKey" value={courseKey} />
      <input type="hidden" name="syllabusNo" value={syllabusNo} />
      {RATING_DIMENSIONS.map((d) => (
        <input key={d.key} type="hidden" name={d.key} value={scores[d.key]} />
      ))}
      {tags.map((t) => (
        <input key={t} type="hidden" name="tags" value={t} />
      ))}

      <div>
        <Label className="text-sm text-body">修課學期 / 授課教師</Label>
        <Select value={syllabusNo} onValueChange={(v) => setSyllabusNo(v ?? "")}>
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {offerings.map((o) => (
              <SelectItem key={o.syllabusNo ?? o.semesterId} value={o.syllabusNo ?? ""}>
                {semLabel(o.semesterId)}・{o.teachers.join("、") || "待聘"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-5">
        {RATING_DIMENSIONS.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {d.label} <span className="text-mute">· {d.hint}</span>
              </Label>
              <span className="font-mono text-sm" style={{ color: d.color }}>
                {scores[d.key]}
              </span>
            </div>
            <Slider
              className="mt-2"
              min={1}
              max={5}
              step={1}
              value={[scores[d.key]]}
              onValueChange={(v) =>
                setScores((s) => ({ ...s, [d.key]: Array.isArray(v) ? v[0] : v }))
              }
            />
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label className="text-sm">課程標籤（選填）</Label>
          <span className="text-xs text-mute">
            {tags.length}/{MAX_REVIEW_TAGS}
          </span>
        </div>
        <div className="mt-2 space-y-3">
          {REVIEW_TAG_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-mute">{g.label}</span>
              {g.tags.map((t) => {
                const active = tags.includes(t);
                const disabled = !active && tags.length >= MAX_REVIEW_TAGS;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    disabled={disabled}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "border border-hairline text-body hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="shortComment" className="text-sm">
          一句話短評
        </Label>
        <input
          id="shortComment"
          name="shortComment"
          maxLength={100}
          placeholder="例：甜涼好過，但要交期末報告"
          className="mt-1.5 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <Label htmlFor="body" className="text-sm">
          詳細心得（選填）
        </Label>
        <Textarea
          id="body"
          name="body"
          rows={5}
          maxLength={5000}
          placeholder="分享評分方式、作業份量、考試型態、教學風格…"
          className="mt-1.5"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full">
        {pending ? "送出中…" : "送出評價"}
      </Button>
    </form>
  );
}
