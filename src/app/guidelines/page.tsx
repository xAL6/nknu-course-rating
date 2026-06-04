export const metadata = { title: "評價守則" };

export default function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">評價守則</h1>
      <p className="mt-4 text-body">為了讓評價對大家有幫助,請遵守以下原則:</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-body">
        <li>對事不對人:聚焦在課程內容、評分方式、作業與考試,避免人身攻擊。</li>
        <li>據實分享:根據自己實際的修課經驗,不誇大也不抹黑。</li>
        <li>具體有用:說明甜度/涼度/負擔的原因,讓學弟妹能判斷是否適合自己。</li>
        <li>尊重多元:每個人的標準不同,理性討論。</li>
        <li>禁止洩漏考題、轉售作業或張貼廣告。</li>
      </ul>
      <p className="mt-6 text-sm text-mute">
        違反守則的內容可能被檢舉並移除。AI 會協助標記疑似灌水或不當的評價交由人工審核。
      </p>
    </div>
  );
}
