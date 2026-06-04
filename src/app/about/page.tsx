import { SITE_NAME } from "@/lib/config";

export const metadata = { title: "關於本站" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">關於 {SITE_NAME}</h1>
      <div className="mt-6 space-y-4 text-body">
        <p>
          這是一個由高雄師範大學學生發起的非官方選課評價平台,靈感來自 NTU Rating
          與臺南大學選課系統。我們希望讓選課這件事更透明——在選課之前,先看看修過的同學怎麼說。
        </p>
        <p>
          課程資料來自學校公開課表;評價、評分與心得則由同學自願貢獻。我們提供多維度評分(甜度、涼度、負擔、品質、給分)、排課模擬與
          AI 課程助手,協助你做出更合適的選擇。
        </p>
        <p className="text-sm text-mute">
          本站與學校無官方關係。若課程資訊有誤,請以學校公告為準。
        </p>
      </div>
    </div>
  );
}
