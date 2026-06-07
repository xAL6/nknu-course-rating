import { TimetableBuilder } from "@/components/timetable-builder";
import { latestSemester } from "@/lib/data/courses";

export const metadata = { title: "排課模擬" };

export default async function TimetablePage() {
  const defaultTerm = (await latestSemester())?.split("-")[1] ?? "2";
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">排課模擬</h1>
      <p className="mt-1 text-sm text-body">
        先選學期（上 / 下 / 暑修），加入想修的課即時預覽一週課表並自動偵測衝堂。課表鎖定學期但不限學年，可跨年度排課、分享或儲存。
      </p>
      <div className="mt-6">
        <TimetableBuilder defaultTerm={defaultTerm} />
      </div>
    </div>
  );
}
