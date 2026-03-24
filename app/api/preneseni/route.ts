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
2. PRIORITET: Uvek prvo pokušaj da nađeš termine koji imaju oznaku (SLOBODNO).
3. Ako nema slobodnih termina, odaberi termin sa oznakom (PREKLAPANJE), ali pazi da žrtvuješ predavanja umesto vežbi ako je moguće, ili biraj logično.

Odgovori TAČNO u ovom formatu, bez ikakvih dodatnih reči ili objašnjenja u prvim dvema linijama:
Predavanje: [kopiraj termin tačno iz liste iznad]
Vežbe: [kopiraj termin tačno iz liste iznad]
Razlog: [jedna rečenica objašnjenja zašto je to najbolji izbor i, ako postoji preklapanje, jasno navedi koji predmet se menja]`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content ?? 'Nije moguće generisati preporuku trenutno.'
  return NextResponse.json({ preporuka: text })
}
