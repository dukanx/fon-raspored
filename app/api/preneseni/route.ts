import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { trenutniRaspored, dostupnaPredavanja, dostupneVezbe, predmet } = await req.json()

  const prompt = `Student ima sledeći raspored:
${trenutniRaspored}

Prenosi predmet "${predmet}".

Dostupna predavanja (P) - svi termini su već provereni i NE PREKLAPAJU se sa rasporedom:
${dostupnaPredavanja || 'Nema slobodnih termina'}

Dostupne vežbe (V) - svi termini su već provereni i NE PREKLAPAJU se sa rasporedom:
${dostupneVezbe || 'Nema slobodnih termina'}

PRAVILA:
1. Smeš da biraš SAMO termine koji su navedeni u listama iznad, ništa drugo
2. Termin se preklapa ako je isti dan i isto vreme kao bilo koji termin u rasporedu
3. Biraj termine koji se NE PREKLAPAJU

Odgovori TAČNO u ovom formatu, bez ikakvih dodatnih reči ili objašnjenja u prvim dvema linijama:
Predavanje: [kopiraj tačno iz liste iznad]
Vežbe: [kopiraj tačno iz liste iznad]
Razlog: [jedna rečenica]`

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
