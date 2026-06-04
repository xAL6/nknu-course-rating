import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { zhTW } from "@clerk/localizations";
import "./globals.css";

const clerkLocalization = {
  ...zhTW,
  signIn: {
    ...zhTW.signIn,
    start: {
      ...zhTW.signIn?.start,
      title: "登入 NKNU 選課評價",
      subtitle: "歡迎回來!請登入以繼續",
    },
  },
  signUp: {
    ...zhTW.signUp,
    start: { ...zhTW.signUp?.start, title: "註冊 NKNU 選課評價", subtitle: "建立帳號以撰寫評價" },
  },
};
import { ThemeProvider } from "@/components/theme-provider";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME}`, template: `%s・${SITE_NAME}` },
  description: SITE_TAGLINE,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <html
        lang="zh-Hant"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col bg-background">
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <SiteNav />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <Toaster position="top-center" richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
