# NKNU 選課評價

高師大的選課評價與排課平台。課程資料爬自學校公開課表,學生用校園 Google 信箱登入後,
替「每一位老師的每一門課」寫評價,再用排課模擬器和 AI 助手安排自己的學期。

非官方學生專案,靈感來自 NTU Rating 與 NCKU Hub。

線上版 <https://nknu-new-rating-xal6s-projects.vercel.app> ・ 授權 [MIT](./LICENSE)

---

## 功能

- **課程瀏覽與篩選** —— 日夜間、學年期、校區(和平/燕巢)、學制 → 系所 → 班級層層篩選,
  跟學校的開課系統對齊。
- **跨學期搜尋** —— 課名、教師或課號,trigram 相似度排名,一次搜遍所有學年期。
- **三維度評價** —— 甜度、涼度、收穫(各 1–5),加一段修課心得與快速標籤(會點名、佛心給分…),
  可以按讚、留言。
- **每位老師分開評分** —— 同一門課不同老師各自呈現;歷年開課即使課號變了也會合併成一份紀錄。
- **排課模擬** —— 加課即時抓衝堂(只框住衝突的那一節),先選學期、鎖學期不鎖學年,
  可以跨年度排、分享連結、存到帳號,還能下載一張排好的 PNG 課表。
- **AI 課程助手** —— 一個會自己查課表的對話 agent(DeepSeek),找課、比較老師、看課程細節、
  列某系某年級的課、自動排課;答案都從資料庫來,附課程連結,講話像個會吐槽的學長。
- **個人頁** —— 首次登入可以取名字、上傳頭像。

介面是深色為底、單一暖金色的毛玻璃風格,暗亮雙主題、手機可用。設計細節寫在 [`DESIGN.md`](./DESIGN.md)。

## 技術棧

Next.js 16(App Router、Turbopack)、React 19、TypeScript。Tailwind v4 配 shadcn/ui
(Nova preset,底層是 **Base UI 不是 Radix**)與 Noto Sans TC。資料庫、登入、檔案儲存都在
**Supabase**(Postgres + Auth + RLS + Storage)。AI 用 Vercel AI SDK v6 接 DeepSeek
`deepseek-v4-pro`。爬蟲是 Node + axios + cheerio。部署在 Vercel。

## 怎麼運作

> 爬蟲把學校課表灌進 Supabase;Next.js 在伺服器端讀 Supabase 把網頁吐給使用者;學生用 Google
> 校園信箱登入後,透過 Server Action 寫評價,RLS 在資料庫層做最後把關(本人 + 高師信箱);
> DeepSeek 提供 grounded 的 AI 助手。

完整的資料表關係見 [`docs/schema.png`](./docs/schema.png)(由 [`docs/schema.puml`](./docs/schema.puml) 產生)。

#### 課程身分模型

這是整個專案最不直覺的地方。NKNU 的開課代號**不穩定**:同一個代號會在不同年份被重用,而同一門課
的代號又幾乎每年都換(吳明倫的演算法從 110 到 114 是 MA231→232→233→234→238)。所以我們用兩層識別:

- `syllabus_no` 是唯一全域穩定的鍵,用來去重與 upsert。
- `course_key = 系所 + 正規化課名 + 教師` 才是**邏輯課程** —— 跨年份穩定,又能把不同老師分開。
  課程頁、評分、歷年開課紀錄都掛在它上面。
- 列表照**開課代號**呈現(跟學校一致,同學期不同班的 EN303/EN304 各一張卡),每張卡再連到它的邏輯課程。

一筆開課會同時掛在好幾個 班級 / 系所 / 學制底下,所以這些成員身分是用陣列存、用陣列包含來查。

## 開始

需要 Node.js 24+、一個 Supabase 專案,AI 助手另外需要 DeepSeek API key(沒有的話它會顯示「未啟用」)。

```bash
git clone https://github.com/xAL6/nknu-course-rating.git
cd nknu-course-rating
npm install

cp .env.example .env.local   # 填入 Supabase 金鑰(見下表)
npm run migrate              # 套用資料庫 migration
npm run crawl -- --year 114  # 先爬一年的課程資料
npm run dev                  # http://localhost:3000
```

建 Supabase 專案、設 Google OAuth、開 Storage bucket 這些一次性步驟,寫在 [`docs/SETUP.md`](./docs/SETUP.md)。

### 環境變數

| 變數 | 必填 | 說明 |
|---|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | 公開 anon key,瀏覽器端用,靠 RLS 保護 |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | service-role key,**只給伺服器與爬蟲**,絕不可進瀏覽器 |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` | 是 | 允許投稿的校園信箱網域,逗號分隔 |
| `DEEPSEEK_API_KEY` | 否 | 沒有則 AI 助手停用 |
| `DEEPSEEK_MODEL` | 否 | 覆寫模型,預設 `deepseek-v4-pro` |
| `NEXT_PUBLIC_SITE_URL` | 否 | 站台網址,給 sitemap 與 OG 用 |

`.env.local` 已被 git 忽略;`SUPABASE_SERVICE_ROLE_KEY` 會略過 RLS,別提交、別放進瀏覽器。

## 指令

```bash
npm run dev            # 開發伺服器
npm run build          # 正式建置
npm test               # vitest(單元 + Supabase RLS 整合,需要 .env.local)
npx tsc --noEmit       # 型別檢查 app

npm run migrate                       # 套用 supabase/migrations/*.sql
npm run crawl -- --from 110 --to 114  # 全爬所有學年/學制/日夜/班級 → Supabase
npm run crawl:rooms                   # 建立校區對照、回填 courses.campus
npm run seed-reviews                  # 灌示範評價;--purge 一鍵清除
npm run reset-data                    # 清空爬下來的課程資料(保留帳號)
```

## 專案結構

```
src/
  app/            Next.js App Router(頁面 + /api 路由)
  components/     UI 元件,ui/ 底下是 shadcn / Base UI 原子元件
  lib/
    data/         server-only 資料層(courses, reviews, ai-search…)
    supabase/     client(瀏覽器)/ server(RSC)/ admin(service-role)
supabase/migrations/   編號、idempotent 的 SQL migration
scripts/scraper/       課表爬蟲
.github/workflows/     每月爬蟲 Action
```

## 安全與隱私

RLS 是真正的防線:anon key 是公開的、Supabase 的 PostgREST 是公開 HTTP API,所以寫入授權不靠前端 ——
政策要求 `auth.uid() = user_id AND is_nknu()`,而 `is_nknu()` 讀的是已驗證的 JWT email,
非校園帳號即使直連也寫不進去。我們只存登入識別碼,**從不保存使用者 email**。
回報漏洞與完整安全模型見 [`SECURITY.md`](./SECURITY.md)。

## 開發慣例

- 用 Base UI 的寫法:`<Button>` 搭 `render={<Link/>}` + `nativeButton={false}`,不要用 `asChild`。
- 動資料庫就新增一支編號、idempotent 的 migration,別改既有檔案。
- UI 維持單一金色 + 毛玻璃,別加第二個強調色。
- 送 PR 前跑過 `npx tsc --noEmit && npm run build && npm test`。

架構、資料模型、爬蟲、Auth/RLS 的完整說明在 [`CLAUDE.md`](./CLAUDE.md)。

## 授權

MIT,見 [LICENSE](./LICENSE)。
