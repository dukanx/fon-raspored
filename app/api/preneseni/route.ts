import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { trenutniRaspored, dostupnaPredavanja, dostupneVezbe, predmet } = await req.json()

  const prompt = `Student ima sledeći raspored:
${trenutniRaspored}

Prenosi predmet "${predmet}".

Dostupna predavanja (P):
${dostupnaPredavanja || 'Nema dostupnih predavanja.'}

Dostupne vežbe (V):
${dostupneVezbe || 'Nema dostupnih vežbi.'}

Predloži najbolje termine bez preklapanja sa postojećim rasporedom.
Ako postoje i P i V, preporuči po jedan termin za oba tipa.
Ako postoji samo jedan tip, preporuči samo taj tip.

PRAVILO: Termin se PREKLAPA ako je isti dan i isto vreme kao bilo koji termin u rasporedu iznad.
Odaberi termine koji se NE PREKLAPAJU sa rasporedom.

Ako nema dostupnih termina, odgovori sa terminima koji se preklapaju, ali objasni zašto su najbolji mogući izbor.

Odgovori TAČNO u ovom formatu, bez dodatnog teksta:
Predavanje: [dan] [vreme] Sala [sala] (Grupe: [grupe])
Vežbe: [dan] [vreme] Sala [sala] (Grupe: [grupe])
Razlog: [ukratko objašnjenje zašto]`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content ?? 'Nije moguće generisati preporuku trenutno.'
  return NextResponse.json({ preporuka: text })
}
