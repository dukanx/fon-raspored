import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { trenutniRaspored, dostupnaPredavanja, dostupneVezbe, predmet } = await req.json()

  const prompt = `Student ima sledeći raspored:
${trenutniRaspored}

Prenosi predmet "${predmet}".

Dostupna predavanja (P) sa naznakom da li su slobodna ili menjaju postojeći predmet:
${dostupnaPredavanja || 'Nema dostupnih termina'}

Dostupne vežbe (V) sa naznakom da li su slobodne ili menjaju postojeći predmet:
${dostupneVezbe || 'Nema dostupnih termina'}

PRAVILA:
1. Smeš da biraš SAMO termine koji su navedeni u listama iznad, ništa drugo.
2. PRIORITET: Uvek prvo pokušaj da nađeš termine koji imaju oznaku (SLOBODNO). Nakon toga, rangiraj tako da nema pauza između termina ako je moguće.
3. Nakon rangiranja slobodnih termina tako da nema pauza izmedju, rangiraj ih po vremenu: 10:15-12:00 je bolje od 08:15-10:00, a 12:15-14:00 je bolje od 14:15-16:00. i tako dalje, ali ovo je sekundarno u odnosu na izbegavanje pauza.
4. Ako nema slobodnih termina, odaberi termin sa oznakom (PREKLAPANJE), ali pazi da žrtvuješ predavanja umesto vežbi ako je moguće, ili biraj logično.

5. Razlog piši bezlično, o terminima, ne o sebi. Zabranjeno je prvo lice i
obraćanje ("izabrao sam", "preporučujem", "predlažem ti", "odlučio sam").
Umesto "Izabrao sam ovaj termin jer nema pauze" piši "Ovaj termin nema pauzu do
sledeće nastave". Bez uvoda i bez pozdrava.

Odgovori TAČNO u ovom formatu, bez ikakvih dodatnih reči ili objašnjenja u prvim dvema linijama:
Predavanje: [kopiraj termin tačno iz liste iznad]
Vežbe: [kopiraj termin tačno iz liste iznad]
Razlog: [jedna bezlična rečenica zašto je to najbolji izbor i, ako postoji preklapanje, jasno navedi koji predmet se menja]`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    // gpt-oss pre odgovora kratko "razmišlja", pa mu treba više tokena nego
    // što je sam odgovor (3 reda). Groq je llama-3.3-70b-versatile ukinuo.
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      max_completion_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const content: string | undefined = data.choices?.[0]?.message?.content
  if (!response.ok || !content) {
    // U Vercel logu se vidi pravi uzrok (ključ, limit, ukinut model...).
    console.error('Groq greška', response.status, data.error?.code, data.error?.message)
    return NextResponse.json({ preporuka: 'Nije moguće generisati preporuku trenutno.' })
  }
  const text = content.split('\n').map(l => l.trim()).filter(Boolean).join('\n')
  return NextResponse.json({ preporuka: text })
}
