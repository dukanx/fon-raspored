import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
// Next-specifična integracija (usePathname/useSearchParams) — NE patchuje
// history.pushState kao /react, koji je lomio navigaciju u Next 16.
import { Analytics } from '@vercel/analytics/next'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "FON Raspored",
  description:
    "Lični raspored nastave, ispitni rokovi i kolokvijumi za studente Fakulteta organizacionih nauka (FON).",
  // Izričito govori pretraživaču koja je prava adresa stranice. Bez ovoga isti
  // sadržaj na `.vercel.app` i na fonraspored.rs izgleda kao dva sajta, pa se
  // signali (posete, linkovi) dele između njih umesto da se sabiraju.
  alternates: {
    canonical: '/',
  },
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
    url: SITE_URL,
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Postavi temu PRE prvog iscrtavanja. Bez ovoga se `dark` klasa dodaje
            tek u useEffect-u (providers.tsx), pa svaki pun reload bljesne belo.
            Offline je to posebno vidljivo jer tada svaka navigacija postaje
            hard reload (RSC fetch padne -> Next radi MPA navigaciju).
            Mora da preslikava applyTheme() iz providers.tsx: samo localStorage,
            bez prefers-color-scheme (CSS tamu vozi isključivo `.dark` klasa). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('fon_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        {/* Ista tehnika, drugi problem: `/` je prerenderovana kao onboarding, pa
            se korisniku koji već ima identitet onboarding iscrta i tek onda
            zameni Rasporedom/Rokovima (preusmerenje čeka hidraciju). Ovde
            sinhrono, pre prvog iscrtavanja, utvrđujemo da preusmerenje sledi i
            sakrivamo onboarding — vidi se samo pozadina.
            Uslov mora da preslikava app/page.tsx (session pa saved identitet, uz
            izuzetak za ?edit=1); on je i taj koji skida klasu. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname==='/'&&new URLSearchParams(location.search).get('edit')!=='1'&&(sessionStorage.getItem('fon_group')||(localStorage.getItem('fon_saved_group')&&localStorage.getItem('fon_saved_year'))))document.documentElement.classList.add('fon-booting')}catch(e){}`,
          }}
        />
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
