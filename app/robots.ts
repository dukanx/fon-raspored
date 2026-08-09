import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Next od ovoga generiše /robots.txt.
//
// Namerno je SVE dozvoljeno za obilazak, iako većina ruta ne treba da se
// indeksira. Razlog je čest nesporazum: `Disallow` ne znači "ne indeksiraj",
// nego "ne otvaraj". Ako se ruta zabrani ovde, robot je nikad ne otvori, pa
// nikad ne pročita ni `noindex` sa te stranice — i ona može da ostane u
// rezultatima kao goli link. Zato se izbacivanje iz rezultata radi `noindex`-om
// (v. layout-e u app/(tabs), app/izborni, app/deli), a ovde se samo pokazuje
// gde je sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
