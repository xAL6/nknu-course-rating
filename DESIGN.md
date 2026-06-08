# 🎨 Design System — NKNU 選課評價

> **沉穩深色 + 單一暖金主色的毛玻璃介面。** 一層 ambient 金色光暈打底,上面疊三階
> frosted-glass 表面,內容用一個 `--accent` 金色串起來 —— 不用彩虹漸層、不堆強調色。
>
> **真正的權威來源是 [`src/app/globals.css`](./src/app/globals.css)**(token + `.glass*` + ambient)。
> 本文件解釋「為什麼這樣設計」以及怎麼一致地沿用。

---

## 核心理念

1. **一層 ambient 墊在所有東西後面** —— 玻璃需要有顏色的內容才折射得出來。固定一張
   `.ambient`(金色為主的徑向光暈 + 極淡顆粒),整站共用。
2. **三階玻璃、全站統一**(見下方效能規則)。玻璃 utility 只設定顏色/邊框/陰影/模糊 ——
   **絕不設定圓角**,所以既有的 `rounded-xl/2xl` 都保留。
3. **CTA 維持實心。** 主要按鈕(`bg-primary`)維持實心墨色以保對比;玻璃是給**表面**用的,
   不是給主要控制項。評分光譜是**顏色**,玻璃是新的中性**表面**。

## 🌗 顏色 Token

雙主題(`.dark` 為預設)。完整定義在 `globals.css` 的 `:root` / `.dark`。

| 角色 | Light(`:root`) | Dark(`.dark`,預設) |
|---|---|---|
| `--background` | `#fafafa` | `#0a0a0a` |
| `--foreground` | `#171717` | `#ededed` |
| `--card` | `#ffffff` | `#171717` |
| `--primary`(CTA 墨) | `#171717` | `#ededed` |
| `--body` / `--mute` | `#4d4d4d` / `#888888` | `#a1a1a1` / `#888888` |
| `--hairline` | `#ebebeb` | `#262626` |
| `--error` | `#dc2626` | `#ef4444` |

### 金色主色(`--accent`)

整站唯一的強調色。金色在深色 + 有色背景上折射最好,是品牌記憶點。

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#b06f00` | `#f5b13d` |
| `--accent-ink`(文字用深金) | `#8a5600` | `#f7be5c` |
| `--accent-soft`(填底) | `accent 14%` | `accent 16%` |
| `--accent-line`(邊/光暈) | `accent 30%` | `accent 34%` |

### 評分光譜(品牌訊號,**不是**表面)

評分維度各有自己的顏色,用在 `.spectrum-bar` / `.text-spectrum` / 評分 chip。

| 維度 | Token | 色 |
|---|---|---|
| 甜度 sweetness | `--rate-sweet` | `#ff0080` |
| 涼度 coolness | `--rate-cool` | `#00dfd8` |
| 收穫 quality | `--rate-quality` | `#7928ca` |
| *(legacy)* 負擔 / 給分 | `--rate-load` / `--rate-grading` | `#f5a623` / `#0070f3` |

> 目前只收 **3 軸:甜 / 涼 / 收穫**。`load`/`grading` 為舊資料保留,不再收集或顯示。

## 🧊 三階玻璃

玻璃 token 在 `globals.css`(`--glass-bg*` / `--glass-border` / `--glass-highlight` /
`--glass-shadow` / `--glass-blur*`)。每階都有頂部 1px sheen(`inset 0 1px 0 var(--glass-highlight)`)。

| 階 | Class | `backdrop-filter` | 用在哪 |
|---|---|:---:|---|
| **Strong** | `.glass-strong` | ✅ 模糊 ~40–46px + saturate | 導覽列、手機選單、Dialog/Sheet/Dropdown/Select 彈層、hero 搜尋、登入卡 |
| **Standard** | `.glass` | ✅ 模糊 ~26–30px | 篩選面板、評分摘要、AI 對話殼、表單、課程詳情外層區塊、footer |
| **Soft(假玻璃)** | `.glass-soft` | ❌ **無模糊** | 課程卡(×24)、教師格、排行榜列、排課格、留言 —— 高數量清單 |

### ⚡ 效能規則(決定一次,全站套用)

> **真正的 `backdrop-filter` 只用在「每個視窗 ≤ ~6 個、且會疊在捲動內容上」的表面。**
> 任何出現在重複清單 / 格狀的東西一律用**假玻璃**(半透明底 + 1px 邊 + 陰影 + 頂部 sheen,
> **不模糊**)。

- 課程列表、教師格、排行榜這類高數量 → `.glass-soft`(捲動才順)。
- 絕不**巢狀兩層真模糊**(`.glass` 面板裡放 `.glass-soft` 子元素 OK)。
- 守門:窄螢幕降模糊;`prefers-reduced-transparency: reduce` 與 `@supports not (backdrop-filter)`
  → 退回實心 `--card`。

## ✍️ 字體

- **Noto Sans TC** —— 一套涵蓋 CJK + Latin,主內容是中文,不額外加 Latin display font。
- 字級/行高沿用 Tailwind 既有尺度;標題 `font-semibold tracking-tight`。

## 🌫️ Ambient 光暈

`.ambient`(`position: fixed; inset: 0; z-index: -1`)是整站背景單一來源:

| Token | Light | Dark |
|---|---|---|
| `--ambient-base` | `#eeede8` | `#0a0a0c` |
| `--ambient-blob-opacity` | `0.7` | `0.85` |
| `--ambient-grain-opacity` | `0.015` | `0.045` |

金色徑向光暈 + 極淡顆粒,讓玻璃有東西折射;`body` 設為 `bg-transparent` 讓 ambient 透出來。

## ✅ Do / ❌ Don't

**Do**
- 用 `--accent` 當**唯一**強調色:hover 邊、focus、連結、小重點。
- 高數量清單一律 `.glass-soft`;少量浮層才用 `.glass` / `.glass-strong`。
- 評分顏色只用在光譜條 / 評分 chip。
- 主要 CTA 維持實心 `bg-primary`。

**Don't**
- ❌ 不要引入第二個強調色或彩虹漸層(那正是當初要砍掉的「AI 味」)。
- ❌ 不要在清單卡片上開真 `backdrop-filter`(會掉 FPS)。
- ❌ 不要在玻璃 utility 裡寫圓角(交給元素自己的 `rounded-*`)。
- ❌ 不要巢狀兩層真模糊。

---

<sub>改動視覺時以 <code>globals.css</code> 為準,本文件隨之更新。</sub>
