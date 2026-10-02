<h1 align="center">NKNU 選課評價</h1>

<p align="center">高師大學生的選課評價與排課平台</p>

<p align="center">
  <a href="#功能"><strong>功能</strong></a> ·
  <a href="#實作筆記"><strong>實作筆記</strong></a> ·
  <a href="#技術棧"><strong>技術棧</strong></a> ·
  <a href="#本機執行"><strong>本機執行</strong></a>
</p>

![NKNU 選課評價首頁](docs/screenshots/home.jpg)

課程資料爬自學校的公開課表。學生用校園 Google 信箱登入後，可以替每位老師的每門課寫評價，再用排課工具或 AI 助手排出自己的課表。

非官方的學生專案，目前沒有公開的線上版，要跑起來需要自己的 Supabase 專案。

## 功能

- 依學年期、日夜間、校區、學制、系所、班級篩選，分類跟學校的開課系統一樣
- 用課名、老師或課號搜尋，一次搜遍所有學期
- 甜度、涼度、收穫三項評分，加上心得和標籤（會點名、佛心給分⋯），可以按讚、留言
- 同一門課的不同老師分開計分，課號換了也接得上歷年評價
- 排課模擬會即時標出衝堂，排好的課表可以存到帳號、分享連結或下載成 PNG
- AI 課程助手會自己查資料庫，幫你找課、比較老師、依條件排課，講話有點嗆

<p align="center">
  <img alt="AI 助手依條件排出不衝堂的課表" src="docs/screenshots/ai-timetable.jpg" width="52%">
  <img alt="要求 AI 助手印出系統提示時被拒絕" src="docs/screenshots/ai-prompt-injection.jpg" width="46%">
  <br>
  <sub>左：依條件排出不衝堂的課表　右：要它交出 system prompt，直接被嗆回去</sub>
</p>

## 實作筆記

### 爬蟲

學校課表是 ASP.NET WebForms 頁面。爬蟲帶著 `__VIEWSTATE` 模擬下拉選單的 postback，依序走過學制、系所、班級三層。學校伺服器不太穩，請求失敗會用指數退避重試。

### 課程識別

開課代號會跨年重複使用，同一門課的代號又幾乎每年換，像演算法在 110 到 114 學年就用了五個代號（MA231→232→233→234→238）。所以去重靠全域唯一的 `syllabus_no`，評價則掛在「系所＋正規化課名＋老師」組成的課程鍵上，歷年評價才接得起來。

### 寫入權限

Supabase 的 anon key 和 API 本來就是公開的，前端擋不住直接打 API 的人，所以寫入權限交給資料庫的 RLS：只能寫自己的資料，而且帳號必須是高師信箱。個人資料表刻意不存 email。

### AI 助手

模型只能呼叫 7 個唯讀、參數化的查詢工具，碰不到 SQL，也寫不了資料。明顯的注入攻擊和過長的訊息在進模型前就會被擋掉，另外還有強化過的 system prompt 和每人每小時的使用上限。

資料表關係圖在 [`docs/schema.png`](docs/schema.png)。

## 技術棧

- [Next.js](https://nextjs.org) 16、React 19、TypeScript
- [Supabase](https://supabase.com)：Postgres、Auth、RLS、Storage
- [Tailwind CSS](https://tailwindcss.com) v4、[shadcn/ui](https://ui.shadcn.com)（Base UI）
- [AI SDK](https://ai-sdk.dev) 搭配 DeepSeek
- 爬蟲：axios、cheerio

## 本機執行

需要 Node.js 24 以上和一個 Supabase 專案。AI 助手另外要 DeepSeek API key，沒填會顯示未啟用。

```bash
npm install
cp .env.example .env.local    # 填入 Supabase 的金鑰和連線字串
npm run migrate               # 建立資料表
npm run crawl -- --year 114   # 爬一個學年的課表
npm run dev                   # http://localhost:3000
```

Supabase、Google 登入的設定步驟和其他指令都在 [`docs/SETUP.md`](docs/SETUP.md)。

## 開發

改資料庫請新增 migration，不要改既有的檔案。送 PR 前先跑過 `npx tsc --noEmit && npm run build && npm test`。

## 授權

[MIT](LICENSE)
