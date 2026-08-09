import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Next od ovoga generiše /sitemap.xml.
//
// Samo početna. Ostale rute (`/raspored`, `/rokovi`, `/preneseni`, `/izborni`,
// `/deli`) su personalizovane na klijentu i bez identiteta u localStorage-u se
// samo vrate na `/`. Robotu bi izgledale kao pet praznih kopija početne, što
// razblažuje sajt umesto da ga ojača. Zato jedna stranica koja stvarno ima
// sadržaj, a ostale nose `noindex`.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
