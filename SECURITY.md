# 安全政策 · Security Policy

## 回報漏洞 · Reporting a Vulnerability

若你發現安全性問題,**請勿開公開 issue**。請改用 GitHub 的私密回報:
**Security → Report a vulnerability**(GitHub Private Vulnerability Reporting),
或直接私訊維護者。我們會盡快回覆並協調修復後再公開。

Please report security issues **privately** via GitHub's *Report a vulnerability*
(Private Vulnerability Reporting) rather than opening a public issue.

## 安全模型 · Security Model

- **RLS 是最終防線。** anon key 是公開的、Supabase 的 PostgREST 是公開 HTTP API,所以**寫入
  授權不靠前端**。寫入政策要求 `auth.uid() = user_id AND is_nknu()`;`is_nknu()` 讀的是
  **已驗證的 JWT email**,因此即使是直接以 Google 登入、繞過本 app 的非校園帳號也寫不進去。
  `service_role` 會略過 RLS,**僅用於爬蟲 / 管理腳本**(server-only)。
- **登入網域限制。** 只允許 `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` 列出的校園信箱投稿。
- **隱私優先。** 只儲存登入 uid,**從不保存使用者 email**。
- **AI 防禦縱深**(提示注入 = 信任邊界問題,分層處理):
  1. 進模型前的決定性守門(阻擋明顯的注入/越獄 + 過長輸入);
  2. 強化過的 system prompt(輸入視為資料而非指令、鎖定在選課範疇);
  3. **最小權限工具**(唯讀、參數化,沒有 SQL/寫入 —— 越獄也做不了壞事);
  4. 工具呼叫次數上限(防迴圈);
  5. rate limit(匿名 / 登入分級)。

## 給貢獻者 · For Contributors

- **絕不提交金鑰。** `.env*` 已被 `.gitignore` 忽略;`.env.example` 只放佔位字串。
- `SUPABASE_SERVICE_ROLE_KEY` / `DEEPSEEK_API_KEY` 等只放在本機 `.env.local` 或部署平台的
  加密環境變數 / GitHub Actions secrets,**不要寫進程式碼或文件**。
- 公開的 `NEXT_PUBLIC_SUPABASE_URL` 與 anon key 屬於設計上可公開的值,真正的保護來自 RLS。
- 送 PR 前請跑 `npx tsc --noEmit && npm run build && npm test`。
