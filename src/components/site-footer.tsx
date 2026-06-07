import Link from "next/link";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="glass mt-auto">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-16 sm:grid-cols-2 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="font-mono text-xs uppercase tracking-wide text-mute">{SITE_NAME_EN}</div>
          <p className="mt-2 max-w-xs text-sm text-body">
            高雄師範大學學生自治的選課評價平台。資料來自學校公開課表，評價由同學貢獻。
          </p>
        </div>
        <FooterCol
          title="探索"
          links={[
            { href: "/courses", label: "課程搜尋" },
            { href: "/teachers", label: "教師列表" },
            { href: "/leaderboard", label: "貢獻排行" },
          ]}
        />
        <FooterCol
          title="工具"
          links={[
            { href: "/timetable", label: "排課模擬" },
            { href: "/ai", label: "AI 課程助手" },
            { href: "/submit", label: "撰寫評價" },
          ]}
        />
        <FooterCol
          title="關於"
          links={[
            { href: "/about", label: "關於本站" },
            { href: "/privacy", label: "隱私權" },
            { href: "/guidelines", label: "評價守則" },
          ]}
        />
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto max-w-[1400px] px-6 py-6 text-xs text-mute">
          © {new Date().getFullYear()} {SITE_NAME}・非官方學生專案
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wide text-mute">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-body transition-colors hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
