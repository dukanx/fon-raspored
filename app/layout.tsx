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
  // Title je najjači pojedinačni signal na strani, pa uz brend nosi i dva
  // upita koja studenti stvarno kucaju ("raspored nastave", "ispitni rokovi").
  // "nastava", a ne "časovi" — ovo je fakultet, i tako piše svuda u aplikaciji.
  // Ime na home screen-u NE zavisi od ovoga — njega diktiraju `appleWebApp.title`
  // (iOS) i `name`/`short_name` iz app/manifest.ts (Android), koji ostaju kratki.
  title: "FON Raspored - raspored nastave i ispitni rokovi",
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

// Strukturisani podaci (schema.org). Vidljivom sadržaju ne dodaje ništa —
// mašinama kaže ono što se iz dve rečenice teksta ne da zaključiti: da je ovo
// besplatna web aplikacija, na srpskom, za studente, i o kom fakultetu je reč.
//
// `about` (a ne `publisher`/`provider`) je namerno: aplikacija je O FON-u,
// nije FON-ova. Suprotno bi bilo lažno predstavljanje institucije.
//
// `WebSite` je tu zbog jedne konkretne stvari: Google iz njega čita "site name"
// pa u rezultatima pretrage umesto golog domena piše FON Raspored.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'FON Raspored',
      alternateName: 'fonraspored.rs',
      inLanguage: 'sr-RS',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: 'FON Raspored',
      url: SITE_URL,
      applicationCategory: 'EducationalApplication',
      // PWA — radi u svakom modernom browseru, instalira se na telefon.
      operatingSystem: 'Web, Android, iOS',
      inLanguage: 'sr-RS',
      description:
        'Lični raspored nastave, ispitni rokovi i kolokvijumi za studente ' +
        'Fakulteta organizacionih nauka u Beogradu. Student izabere godinu, ' +
        'smer i predmete, pa dobije samo svoje termine.',
      isAccessibleForFree: true,
      // Google traži `offers` da bi besplatnu aplikaciju i prikazao kao besplatnu.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'RSD' },
      featureList: [
        'Raspored nastave po godini, smeru i grupi',
        'Ispitni rokovi i kolokvijumi',
        'Izvoz u kalendar (ICS)',
        'Podsetnici za prijavu ispita',
        'Deljenje rasporeda linkom',
      ],
      audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
      about: {
        '@type': 'CollegeOrUniversity',
        name: 'Fakultet organizacionih nauka',
        alternateName: 'FON',
        url: 'https://fon.bg.ac.rs',
        parentOrganization: {
          '@type': 'CollegeOrUniversity',
          name: 'Univerzitet u Beogradu',
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Beograd',
          addressCountry: 'RS',
        },
      },
      author: {
        '@type': 'Person',
        name: 'dukanx',
        url: 'https://github.com/dukanx',
      },
    },
  ],
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
        {/* Zamena `<` unicode escape-om: JSON.stringify ne beži HTML, pa bi
            zatvarajući script tag u nekom stringu prekinuo ovaj blok.
            Preporuka iz next/dist/docs/01-app/02-guides/json-ld.md. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
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
