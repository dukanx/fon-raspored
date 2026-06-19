import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { Analytics } from '@vercel/analytics/react'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fon-raspored-five.vercel.app'),
  title: "FON Raspored",
  description: "Lični raspored nastave za studente FON-a",
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon2.png',
  },
  appleWebApp: {
    capable: true,
    title: 'FON Raspored',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'FON Raspored',
    description: 'Unesi prezime i dobij lični raspored nastave',
    url: 'https://fon-raspored-five.vercel.app',
    siteName: 'FON Raspored',
    images: [{ url: '/linkPic.png', width: 1536, height: 1024, alt: 'FON Raspored' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FON Raspored',
    description: 'Unesi prezime i dobij lični raspored nastave',
    images: ['/linkPic.png'],
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
      <Analytics />
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
