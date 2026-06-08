import type { TimetableCourse } from "@/lib/timetable-store";
import { WEEKDAY_LABELS, PERIOD_TIMES } from "@/lib/period-shared";
import { colorFor } from "@/lib/timetable-colors";

const ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "T", "A", "B", "C", "D", "E"];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Wrap CJK/Latin text to `maxW`, capped at `maxLines` (ellipsis on overflow). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
      if (lines.length === maxLines - 1) break;
    } else {
      cur += ch;
    }
  }
  let rest = cur;
  if (lines.length === maxLines - 1) {
    // remaining text goes on the last line, ellipsised if needed
    const used = [...text].slice(lines.join("").length).join("");
    rest = used;
    while (rest && ctx.measureText(rest + "…").width > maxW) rest = rest.slice(0, -1);
    if (rest.length < used.length) rest += "…";
  }
  if (rest) lines.push(rest);
  return lines.slice(0, maxLines);
}

export function downloadTimetablePng(courses: TimetableCourse[], semesterLabel: string | null, dateStr: string) {
  // group occupied period-indices per weekday per course
  const byDay = new Map<number, Map<string, { c: TimetableCourse; idxs: number[] }>>();
  let maxUsedIdx = -1;
  let minUsedIdx = ORDER.length;
  let hasSat = false;
  for (const c of courses) {
    for (const s of c.slots) {
      const idx = ORDER.indexOf(String(s.period));
      if (idx < 0) continue;
      const wd = Number(s.weekday);
      if (wd === 6) hasSat = true;
      maxUsedIdx = Math.max(maxUsedIdx, idx);
      minUsedIdx = Math.min(minUsedIdx, idx);
      const day = byDay.get(wd) ?? new Map();
      const key = c.courseCode + (c.syllabusNo ?? "");
      const e = day.get(key) ?? { c, idxs: [] };
      e.idxs.push(idx);
      day.set(key, e);
      byDay.set(wd, day);
    }
  }
  if (maxUsedIdx < 0) {
    minUsedIdx = 0;
    maxUsedIdx = 8;
  }
  const periods = ORDER.slice(minUsedIdx, maxUsedIdx + 1);
  const weekdays = hasSat ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];

  // layout (css px)
  const scale = 2;
  const pad = 36;
  const titleH = 70;
  const headerH = 40;
  const labelW = 60;
  const colW = 156;
  const rowH = 58;
  const footerH = 34;
  const W = pad * 2 + labelW + weekdays.length * colW;
  const H = pad + titleH + headerH + periods.length * rowH + footerH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  // background
  ctx.fillStyle = "#0c0c10";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 0.7);
  glow.addColorStop(0, "rgba(245,177,61,0.18)");
  glow.addColorStop(1, "rgba(245,177,61,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const gridX = pad + labelW;
  const gridY = pad + titleH + headerH;

  // title
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 26px ui-sans-serif, system-ui, 'Noto Sans TC', sans-serif";
  ctx.fillText("我的課表", pad, pad + 34);
  ctx.fillStyle = "#f5b13d";
  ctx.font = "600 14px ui-sans-serif, system-ui, 'Noto Sans TC', sans-serif";
  ctx.fillText(semesterLabel ? `${semesterLabel}` : "NKNU 選課評價", pad, pad + 56);

  // weekday header
  ctx.textAlign = "center";
  ctx.font = "600 15px ui-sans-serif, system-ui, 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "#cfcfcf";
  weekdays.forEach((wd, i) => {
    ctx.fillText(WEEKDAY_LABELS[wd], gridX + i * colW + colW / 2, pad + titleH + 26);
  });

  // period rows: labels + faint cells
  ctx.textAlign = "center";
  periods.forEach((p, r) => {
    const y = gridY + r * rowH;
    // period label
    ctx.fillStyle = "#dcdcdc";
    ctx.font = "700 15px ui-sans-serif, system-ui, 'Noto Sans TC', sans-serif";
    ctx.fillText(p, pad + labelW / 2, y + 24);
    ctx.fillStyle = "#7a7a7a";
    ctx.font = "400 9px ui-sans-serif, system-ui, sans-serif";
    const t = PERIOD_TIMES[p] ?? "";
    if (t) ctx.fillText(t.replace("–", "\n"), pad + labelW / 2, y + 40);
    // faint cell bgs
    weekdays.forEach((_, i) => {
      rr(ctx, gridX + i * colW + 3, y + 3, colW - 6, rowH - 6, 9);
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fill();
    });
  });

  // course blocks (merge consecutive periods of the same course)
  ctx.textAlign = "left";
  for (const wd of weekdays) {
    const col = weekdays.indexOf(wd);
    const day = byDay.get(wd);
    if (!day) continue;
    for (const { c, idxs } of day.values()) {
      const sorted = [...new Set(idxs)].sort((a, b) => a - b);
      // split into consecutive runs
      const runs: [number, number][] = [];
      let start = sorted[0];
      let prev = sorted[0];
      for (let k = 1; k < sorted.length; k++) {
        if (sorted[k] === prev + 1) prev = sorted[k];
        else {
          runs.push([start, prev]);
          start = prev = sorted[k];
        }
      }
      runs.push([start, prev]);

      for (const [a, b] of runs) {
        const ra = a - minUsedIdx;
        const rb = b - minUsedIdx;
        if (ra < 0 || rb >= periods.length) continue;
        const x = gridX + col * colW + 4;
        const y = gridY + ra * rowH + 4;
        const w = colW - 8;
        const h = (rb - ra + 1) * rowH - 8;
        rr(ctx, x, y, w, h, 10);
        ctx.fillStyle = colorFor(c.courseCode);
        ctx.fill();
        // text
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 12.5px ui-sans-serif, system-ui, 'Noto Sans TC', sans-serif";
        const nameLines = wrap(ctx, c.name, w - 16, c.classroom ? 2 : 3);
        let ty = y + 19;
        for (const ln of nameLines) {
          ctx.fillText(ln, x + 9, ty);
          ty += 16;
        }
        if (c.classroom) {
          ctx.fillStyle = "rgba(255,255,255,0.82)";
          ctx.font = "400 10.5px ui-sans-serif, system-ui, 'Noto Sans TC', sans-serif";
          const room = wrap(ctx, c.classroom, w - 16, 1)[0] ?? "";
          ctx.fillText(room, x + 9, Math.min(ty + 2, y + h - 8));
        }
      }
    }
  }

  // footer
  ctx.textAlign = "left";
  ctx.fillStyle = "#6a6a6a";
  ctx.font = "400 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("nknu-course-rating · 高師大選課評價", pad, H - pad + 6);
  ctx.textAlign = "right";
  ctx.fillText(`製作於 ${dateStr}`, W - pad, H - pad + 6);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `課表${semesterLabel ? `-${semesterLabel.replace(/\s/g, "")}` : ""}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
