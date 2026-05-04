# FON Raspored

Personalizovani pregled rasporeda nastave, ispita i kolokvijuma za Fakultet organizacionih nauka (FON).

**https://fon-raspored-five.vercel.app/**

## Funkcionalnosti

- **Raspored nastave** — filtriran po godini, programu i grupi; pregled po danima
- **Ispiti i kolokvijumi** — lista i kalendarski prikaz; prikazuju se samo predmeti koje student sluša
- **Onboarding** — pri prvom posetu student bira godinu, program i grupu; aplikacija pamti izbor
- **Dark/light mode**
- **Export u iCal** — raspored se može uvesti u Google Calendar, Apple Calendar i sl.
- **Automatsko ažuriranje** — GitHub Actions svake noći proverava FON sajt za nove PDF rasporede i automatski ih parsira i upisuje

## Struktura projekta

```
app/
  page.tsx              # Onboarding (izbor grupe)
  raspored/page.tsx     # Nedeljni raspored nastave
  rokovi/page.tsx       # Ispiti i kolokvijumi
  izborni/              # Izborni predmeti
  preneseni/            # Preneseni predmeti

public/data/
  1god.json             # Raspored po godinama
  2god.json
  3god.json
  4god.json
  rokovi.json           # Ispitni rokovi i kolokvijumi (automatski ažurirano)

scripts/
  check_fon.py          # Scraper — proverava FON sajt za nove PDF-ove
  fon_exam_parser.py    # Parser — PDF → JSON (pdfplumber)
  known_pdfs.json       # Lista već viđenih PDF URL-ova

.github/workflows/
  check-fon.yml         # Dnevna automatizacija
```

## Lokalni razvoj

```bash
npm install
npm run dev
```

Aplikacija se otvara na [http://localhost:3000](http://localhost:3000).

## Automatizacija rasporeda ispita

GitHub Actions workflow (`check-fon.yml`) se pokreće svaki dan u ponoć i:

1. Scrape-uje [raspored-kolokvijuma](https://oas.fon.bg.ac.rs/raspored-kolokvijuma/) i [raspored-ispita](https://oas.fon.bg.ac.rs/raspored-ispita/)
2. Za svaki novi PDF (koji nije u `known_pdfs.json`) — skida ga i parsira
3. Rezultat merge-uje u `public/data/rokovi.json`
4. Commit-uje i push-uje promene

### Ručno parsiranje PDF-a

```bash
pip install pdfplumber

# Ispitni rok
python scripts/fon_exam_parser.py --pdf januar.pdf --tip ispit --rok "Januarski ispitni rok"

# Kolokvijum
python scripts/fon_exam_parser.py --pdf kol.pdf --tip kolokvijum --rok "Prvi zimski kolokvijum"

# Sa upisom u fajl
python scripts/fon_exam_parser.py --pdf januar.pdf --tip ispit --rok "Januarski" --output out.json
```

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [pdfplumber](https://github.com/jsvine/pdfplumber) — parsiranje PDF rasporeda
- GitHub Actions — automatsko ažuriranje podataka
