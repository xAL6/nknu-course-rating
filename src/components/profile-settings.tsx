"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfile } from "@/lib/actions";

export function ProfileSettings({
  displayName,
  avatarUrl,
  welcome = false,
}: {
  displayName: string;
  avatarUrl: string | null;
  welcome?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const dirty = name.trim() !== displayName || !!file || removed;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_097_152) return toast.error("圖片請小於 2MB。");
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return toast.error("只支援 PNG / JPG / WebP / GIF。");
    setFile(f);
    setRemoved(false);
    setPreview(URL.createObjectURL(f));
  }

  function removeAvatar() {
    setFile(null);
    setPreview(null);
    setRemoved(true);
    if (inputRef.current) inputRef.current.value = "";
  }

  function save() {
    const n = name.trim();
    if (n.length < 1 || n.length > 20) return toast.error("名稱請介於 1–20 字。");
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("displayName", n);
        if (file) fd.set("avatar", file);
        else if (removed) fd.set("removeAvatar", "1");
        await updateProfile(fd);
        toast.success("個人資料已更新");
        setFile(null);
        setRemoved(false);
        router.refresh();
      } catch (e) {
        const msg = (e as Error).message;
        toast.error(msg === "UNAUTHORIZED" ? "請先登入。" : "更新失敗，請再試一次。");
      }
    });
  }

  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      {welcome && (
        <p className="mb-4 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm text-body">
          👋 歡迎！幫自己取個名字、換上頭像吧——之後評價就會用這個身分顯示。
        </p>
      )}
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative shrink-0 rounded-full outline-none"
          aria-label="上傳頭像"
        >
          <Avatar className="size-20">
            {preview && <AvatarImage src={preview} alt="" />}
            <AvatarFallback
              className="text-2xl font-bold"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {(name || "?").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="size-6 text-white" />
          </span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

        <div className="w-full flex-1">
          <label className="text-xs font-medium text-mute">顯示名稱</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="取個名字…"
              className="glass-soft h-11 w-full max-w-xs rounded-xl px-3.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            />
            <button
              onClick={save}
              disabled={pending || !dirty}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-[color:var(--accent)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
              style={{ border: "1px solid var(--accent-line)" }}
            >
              <Check className="size-4" /> {pending ? "儲存中…" : "儲存"}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-xs text-mute">點頭像可上傳圖片（最大 2MB）。這是公開顯示的匿名身分，不會顯示你的信箱。</p>
            {preview && (
              <button
                type="button"
                onClick={removeAvatar}
                className="flex shrink-0 items-center gap-1 text-xs text-mute transition-colors hover:text-error"
              >
                <Trash2 className="size-3.5" /> 移除頭像
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
