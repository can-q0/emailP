import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EmailP - Laboratory Email Sorter",
  description:
    "AI-powered patient report generator from laboratory emails",
};

const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var d = (!t || t === 'system')
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : t === 'dark';
    if (d) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <SessionProvider session={session}>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
