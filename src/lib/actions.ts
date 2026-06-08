"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  isAllowedEmail,
  randomDisplayName,
  REVIEW_TAG_VALUES,
  MAX_REVIEW_TAGS,
} from "@/lib/config";

const ALLOWED_TAGS = new Set(REVIEW_TAG_VALUES);

/**
 * Per-user write throttle. Best-effort (in-memory per instance, like the AI
 * limiter) — stops a single account from hammering an action; swap for a shared
 * store (Upstash) for cross-instance guarantees.
 */
function throttle(action: string, userId: string, limit: number, windowMs: number) {
  if (!rateLimit(`act:${action}:${userId}`, limit, windowMs).ok) throw new Error("RATE_LIMITED");
}

/** Log a DB error server-side and surface a generic code — never leak internals. */
function failDb(action: string, error: unknown): never {
  console.error(`[action:${action}]`, error);
  throw new Error("REQUEST_FAILED");
}

/** Magic-byte sniff: the real image MIME, or null if the bytes aren't a known image. */
function sniffImageMime(b: Uint8Array): string | null {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  return null;
}

const MINUTE = 60 * 1000;

/** Require an authenticated NKNU-domain user; ensure their profile exists. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) throw new Error("UNAUTHORIZED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  let displayName = profile?.display_name;
  if (!displayName) {
    displayName = randomDisplayName();
    await supabase.from("profiles").insert({ user_id: user.id, display_name: displayName });
  }
  return { supabase, user, displayName };
}

const reviewSchema = z.object({
  courseKey: z.string().min(1),
  syllabusNo: z.string().min(1),
  semesterId: z.string().optional(),
  sweetness: z.coerce.number().int().min(1).max(5),
  coolness: z.coerce.number().int().min(1).max(5),
  quality: z.coerce.number().int().min(1).max(5),
  body: z.string().max(5000).optional(),
});

export async function submitReview(formData: FormData) {
  const { supabase, user, displayName } = await requireUser();
  throttle("review", user.id, 20, 10 * MINUTE);
  const input = reviewSchema.parse(Object.fromEntries(formData));

  // tags arrive as repeated form fields — Object.fromEntries would drop all but
  // the last, so read them with getAll. Dedupe, keep only known tags, cap length.
  const tags = [...new Set(formData.getAll("tags").map(String))]
    .filter((t) => ALLOWED_TAGS.has(t))
    .slice(0, MAX_REVIEW_TAGS);

  const { data: course } = await supabase
    .from("courses")
    .select("id, semester_id")
    .eq("syllabus_no", input.syllabusNo)
    .maybeSingle();
  if (!course) throw new Error("COURSE_NOT_FOUND");

  const { error } = await supabase.from("reviews").upsert(
    {
      course_id: course.id,
      user_id: user.id,
      semester_id: input.semesterId ?? course.semester_id,
      sweetness: input.sweetness,
      coolness: input.coolness,
      quality: input.quality,
      body: input.body || null,
      tags,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,user_id" },
  );
  if (error) failDb("submitReview", error);

  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  await supabase.from("profiles").update({ reputation: (count ?? 0) * 10 }).eq("user_id", user.id);

  revalidatePath(`/course/${input.courseKey}`);
  revalidatePath("/leaderboard");
  return { ok: true };
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Update the signed-in user's profile: display name and (optional) avatar.
 * Avatar is uploaded with the service-role client to avatars/<uid>/… (bucket is
 * public-read). The new name is also snapshotted onto the user's past reviews
 * and comments so it stays consistent.
 */
export async function updateProfile(formData: FormData) {
  const { user } = await requireUser();
  throttle("profile", user.id, 8, 10 * MINUTE);
  const admin = createAdminClient();

  const name = String(formData.get("displayName") ?? "").trim();
  if (name.length < 1 || name.length > 20) throw new Error("INVALID_NAME");

  const patch: { display_name: string; avatar_url?: string | null } = { display_name: name };

  // remove old files in this user's folder (on replace or explicit removal)
  async function clearFolder() {
    const { data: list } = await admin.storage.from("avatars").list(user.id);
    if (list?.length) await admin.storage.from("avatars").remove(list.map((f) => `${user.id}/${f.name}`));
  }

  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2_097_152) throw new Error("FILE_TOO_LARGE");
    const ext = MIME_EXT[file.type];
    if (!ext) throw new Error("BAD_FILE_TYPE");
    const buf = await file.arrayBuffer();
    // Don't trust the client-declared MIME — verify the actual bytes are the
    // image type they claim (rejects mislabeled / polyglot uploads).
    if (sniffImageMime(new Uint8Array(buf)) !== file.type) throw new Error("BAD_FILE_TYPE");
    await clearFolder();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("avatars")
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) throw new Error("UPLOAD_FAILED");
    patch.avatar_url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  } else if (formData.get("removeAvatar") === "1") {
    await clearFolder();
    patch.avatar_url = null;
  }

  const { error } = await admin.from("profiles").update(patch).eq("user_id", user.id);
  if (error) failDb("updateProfile", error);

  // Keep the snapshotted name consistent on existing UGC.
  await admin.from("reviews").update({ display_name: name }).eq("user_id", user.id);
  await admin.from("comments").update({ display_name: name }).eq("user_id", user.id);

  revalidatePath("/me");
  return { ok: true, displayName: name, avatarUrl: patch.avatar_url ?? null };
}

const voteKind = z.enum(["like", "useful", "not_useful"]);

export async function voteReview(reviewId: string, kind: string, courseKey: string) {
  const { supabase, user } = await requireUser();
  throttle("vote", user.id, 40, MINUTE);
  const k = voteKind.parse(kind);
  const { data: existing } = await supabase
    .from("votes")
    .select("kind")
    .eq("user_id", user.id)
    .eq("review_id", reviewId)
    .eq("kind", k)
    .maybeSingle();

  if (existing) {
    await supabase.from("votes").delete().eq("user_id", user.id).eq("review_id", reviewId).eq("kind", k);
  } else {
    await supabase.from("votes").insert({ user_id: user.id, review_id: reviewId, kind: k });
  }
  revalidatePath(`/course/${courseKey}`);
  return { voted: !existing };
}

const timetableCourse = z.object({
  courseCode: z.string(),
  syllabusNo: z.string().nullable(),
  name: z.string(),
  teachers: z.array(z.string()),
  classroom: z.string().nullable(),
  semesterId: z.string(),
  slots: z.array(z.object({ weekday: z.number(), period: z.string() })),
});

/** Persist the user's timetable (one row per user). */
export async function saveTimetable(courses: unknown) {
  const { supabase, user } = await requireUser();
  throttle("timetable", user.id, 30, 5 * MINUTE);
  const parsed = z.array(timetableCourse).max(60).parse(courses);
  const semesterId = parsed[0]?.semesterId ?? null;
  const { error } = await supabase.from("timetables").upsert(
    {
      user_id: user.id,
      semester_id: semesterId,
      courses: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) failDb("saveTimetable", error);
  return { ok: true, count: parsed.length };
}

/** Load the user's saved timetable, or null if none / not signed in. */
export async function loadTimetable() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("timetables")
    .select("courses, semester_id, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    courses: (data.courses ?? []) as unknown[],
    semesterId: data.semester_id as string | null,
    updatedAt: data.updated_at as string,
  };
}

export async function addComment(reviewId: string, body: string, courseKey: string) {
  const { supabase, user, displayName } = await requireUser();
  throttle("comment", user.id, 15, 5 * MINUTE);
  const text = z.string().min(1).max(2000).parse(body);
  const { error } = await supabase
    .from("comments")
    .insert({ review_id: reviewId, user_id: user.id, body: text, display_name: displayName });
  if (error) failDb("addComment", error);
  revalidatePath(`/course/${courseKey}`);
  return { ok: true };
}

