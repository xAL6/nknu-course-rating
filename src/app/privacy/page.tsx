export const metadata = { title: "隱私權" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">隱私權政策</h1>
      <div className="mt-6 space-y-4 text-body">
        <p>我們以「最少蒐集」為原則保護你的隱私:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            登入採用 Google 帳號驗證,僅限高師大學生信箱(@mail.nknu.edu.tw)。我們{" "}
            <strong>只儲存 Google 的使用者識別碼(sub)</strong>,不會保存你的電子郵件位址。
          </li>
          <li>你撰寫評價時顯示的是可自訂的匿名暱稱,而非真實姓名或信箱。</li>
          <li>排課模擬的課表僅儲存在你的瀏覽器(localStorage),不會上傳。</li>
          <li>我們不會將任何個人資料販售或提供給第三方。</li>
        </ul>
        <p className="text-sm text-mute">你可以隨時刪除自己的評價與帳號資料。</p>
      </div>
    </div>
  );
}
