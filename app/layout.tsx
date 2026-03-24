import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FON Raspored",
  description: "Lični raspored nastave za studente FON-a",
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'FON Raspored',
    description: 'Unesi prezime i dobij lični raspored nastave',
    url: 'https://fon-raspored-five.vercel.app',
    siteName: 'FON Raspored',
    images: [{ url: 'https://fon-raspored-five.vercel.app/og-image.png', width: 1200, height: 630 }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          {children}
          <footer className="py-4 text-center text-xs text-gray-400 dark:text-gray-600">
            Made by{' '}
            <a
              href="https://github.com/dukanx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#024c7d] dark:text-[#60c3ad] hover:underline font-medium"
            >
              dukanx
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
