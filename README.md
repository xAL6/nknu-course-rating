# NKNU 選課評價 · NKNU Course Rating

高雄師範大學（NKNU）的**選課評價 + 排課**平台。課程資料爬自學校公開課表,學生以高師大
Google 學校信箱登入後,可針對「每位老師的每門課」撰寫多維度評價。靈感來自 NTU Rating /
TAINAN選,並整合 DeepSeek AI 課程助手。

- **Live**：<https://nknu-new-rating-xal6s-projects.vercel.app>
- 非官方學生專案。資料來自學校公開課表,評價由同學貢獻。

## 功能

- **課程瀏覽 / 篩選**：日夜間 · 學年期 · 校區 · 學制 · 系所→班級 層層篩選(跟學校開課系統對齊)
- **跨學期搜尋**：以課名 / 教師 / 課號搜尋,trigram 相似度排名,跨所有學年期
- **三維度評價**：甜度 / 涼度 / 收穫(1–5)+ 修課心得 + 快速標籤(會點名、佛心給分…),可按讚、留言
- **每位老師各自評分**:同一門課不同老師分開呈現;歷年(即使課號改了)合併成一份開課紀錄
- **排課模擬**：加課自動偵測衝堂(紅色標示),**先選學期(上/下/暑)、鎖學期不鎖學年**(可跨年度排課),
  可分享連結、存到帳號,並**下載精美課表圖片(PNG)**
- **AI 課程助手**:對話式 agent(DeepSeek `v4-pro`),會自己呼叫工具查真實課表 ——
  找課/比較老師/課程細節/系所年級列課/自動排課,grounded RAG、附課程連結、有梗的學長口吻;
  多層防注入/越獄防禦
- **個人頁**:首次登入可**取名、上傳頭像**(顯示在導覽列、個人頁、評價)
- 隱私優先:只儲存登入識別碼,**不保存 email**;暗/亮雙主題、單一金色毛玻璃風;手機版 RWD

## 技術棧

- **Next.js 16**(App Router, Turbopack)+ React 19 + TypeScript
- **Tailwind v4** + shadcn/ui(Nova preset → Base UI)+ Noto Sans TC;深色金色毛玻璃 UI
- **Supabase**(Postgres + Auth + RLS + Storage)——資料庫、登入、檔案同一家
- **Vercel AI SDK v6** + **DeepSeek `deepseek-v4-pro`**(tool-calling agent)+ AI Elements
- 爬蟲:Node + axios + cheerio(`scripts/scraper/`)
- 部署於 **Vercel**

## 架構一句話

> 爬蟲把學校課表灌進 **Supabase**;**Next.js（Vercel）** 在伺服器端讀 Supabase 把網頁吐給
> 使用者;學生用 **Google 學校信箱**登入後,透過 **Server Action** 寫評價,**RLS** 在資料庫層
> 做最後把關(本人 + 高師信箱);**DeepSeek** 提供 AI 助手。

### 課程身分模型(重點)
NKNU 的開課代號不穩定(會重用、且幾乎每年都換),所以採**兩層識別**:
- **邏輯課程** `course_key = 系所 + 正規化課名 + 老師` → 課程頁 / 評分 / 開課紀錄(跨年合併)
- **清單**照 `開課代號` 呈現(同學期不同代號各一張卡,跟學校一致),各自連到其邏輯課程
- 一筆開課會掛在多個 班級/系所/學制,因此成員身分以陣列儲存、查詢用陣列包含

## 開發

```bash
npm run dev            # 開發伺服器 (localhost:3000)
npm run build          # 正式建置
npm test               # vitest（單元 + Supabase 整合;需要 .env.local）
npx tsc --noEmit       # 型別檢查

npm run migrate                       # 套用 supabase/migrations/*.sql
npm run crawl -- --from 110 --to 114  # 爬課程資料進 Supabase（idempotent）
npm run seed-reviews                  # 灌示範評價（搞笑暱稱+心得）；--purge 可一鍵清除
vercel deploy --prod --yes            # 部署
```

> AI 助手需要 `DEEPSEEK_API_KEY`（可選 `DEEPSEEK_MODEL`，預設 `deepseek-v4-pro`）。

需要 `.env.local`(Supabase 金鑰等);變數清單見 [`docs/SETUP.md`](docs/SETUP.md)。

## 文件

- [`CLAUDE.md`](CLAUDE.md) — 完整架構、資料模型、爬蟲、Auth/RLS、資料流(開發者必讀)
- [`docs/SETUP.md`](docs/SETUP.md) — 營運手冊:已 provision 狀態、剩餘手動步驟、日常指令
