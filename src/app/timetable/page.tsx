import { TimetableBuilder } from "@/components/timetable-builder";

export const metadata = { title: "排課模擬" };

export default function TimetablePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">排課模擬</h1>
      <p className="mt-1 text-sm text-body">
        加入想修的課,即時預覽一週課表並自動偵測衝堂。課表存在這台裝置上。
      </p>
      <div className="mt-6">
        <TimetableBuilder />
      </div>
    </div>
  );
}
