import { NextRequest, NextResponse } from 'next/server'
import { toLatin } from '@/lib/schedule'

// Termine bira algoritam (lib/predlog.ts), AI samo prepričava zašto su dobri,
// prirodnim jezikom (padeži, red reči). Bira kod jer je tačniji: v.
// scripts/eval-predlog.ts. Kad ova ruta ne odgovori, aplikacija ostaje na
// razlogu po šablonu.
export async function POST(req: NextRequest) {
  const { predmet, cinjenice } = await req.json()

  const prompt = `Student dodaje predmet "${predmet}" u raspored. Za njega su već izabrani termini, uz
tačne činjenice o svakom:
${cinjenice}

Prepričaj ove činjenice prirodno, u jednoj ili dve kratke rečenice.
- Samo prepričaj. NE dodaji objašnjenja ni posledice kojih nema u činjenicama
  (npr. "omogućava pripremu", "zahtevniji predmet", "logičan nastavak").
- Nazive predmeta piši BEZ navodnika i u pravom padežu ("posle Matematike 3").
- Bezlično, bez prvog lica i obraćanja, bez uvoda. Srpski, ekavica, latinica.

Primer.
Činjenice: Predavanje u sredu 12:15: slobodno, odmah posle predmeta „Matematika 3“. Vežbe u ponedeljak 10:15: slobodno, jedini čas tog dana.
Odgovor: Predavanje u sredu 12:15 je slobodno i nadovezuje se na Matematiku 3, a vežbe u ponedeljak 10:15 su slobodne i jedini čas tog dana.`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    // gpt-oss pre odgovora kratko "razmišlja", pa mu treba više tokena nego
    // što je sam odgovor. Groq je llama-3.3-70b-versatile ukinuo.
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      max_completion_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const content: string | undefined = data.choices?.[0]?.message?.content?.trim()
  if (!response.ok || !content) {
    // U Vercel logu se vidi pravi uzrok (ključ, limit, ukinut model...).
    console.error('Groq greška', response.status, data.error?.code, data.error?.message)
    return NextResponse.json({ razlog: null })
  }
  // Model ume da ubaci ćirilično slovo u latinični tekst ("predmetа").
  return NextResponse.json({ razlog: toLatin(content) })
}
