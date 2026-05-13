# FON Raspored

Personalizovani pregled rasporeda nastave, ispita i kolokvijuma za Fakultet organizacionih nauka (FON).

**https://fon-raspored-five.vercel.app/**

## Funkcionalnosti

- **Raspored nastave** — filtriran po godini, programu i grupi; pregled po danima
- **Skrivanje termina** — swipe na mobilnom ili klik na termin ga sakriva iz rasporeda; bira se koji termini su relevantni; čuva se u localStorage
- **Ispiti i kolokvijumi** — lista i kalendarski prikaz; prikazuju se samo predmeti koje student sluša
- **Izborni i preneseni predmeti** — poseban tok pri onboardingu za dodavanje izbornih i prenesenih predmeta, koji se potom prate u ispitima i kolokvijumima
- **Notifikacija o prijavi** — baner na stranici ispita/kolokvijuma koji se prikazuje kada se bliži ili otvori period prijave; sadrži datume prijave i reklamacija; može se odbaciti za sesiju
- **Onboarding** — pri prvom posetu student bira godinu, program i grupu; aplikacija pamti izbor
- **Dark/light mode**
- **Export u iCal** — raspored se može uvesti u Google Calendar, Apple Calendar i sl.
- **Automatsko ažuriranje** — GitHub Actions svake noći proverava FON sajt za nove PDF rasporede i automatski ih parsira i upisuje

## Struktura projekta

```
app/
  page.tsx              # Onboarding (izbor grupe, izbornih i prenesenih predmeta)
  raspored/page.tsx     # Nedeljni raspored nastave (sa opcijom skrivanja termina)
  rokovi/page.tsx       # Ispiti i kolokvijumi (sa banerom o prijavi)
  izborni/              # Tok za izbor izbornih predmeta
  preneseni/            # Tok za izbor prenesenih predmeta

public/data/
  1god.json             # Raspored po godinama
  2god.json
  3god.json
  4god.json
  rokovi.json           # Ispitni rokovi i kolokvijumi (automatski ažurirano)

scripts/
  check_fon.py          # Scraper — proverava FON sajt za nove PDF-ove, poziva merge_rok.py
  merge_rok.py          # Orkestracija: pokreće parse_rok.py + fon_exam_parser.py, upisuje u rokovi.json
  fon_exam_parser.py    # Parser — PDF tabela termina → JSON (pdfplumber)
  parse_rok.py          # Parser — datumi prijave i reklamacije iz PDF zaglavlja (pymupdf)
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

`merge_rok.py` je glavna skripta za ručno parsiranje — automatski detektuje tip (ispit/kolokvijum), parsira i datume prijave i termine, i upisuje u `rokovi.json`:

```bash
pip install pdfplumber pymupdf

# Parsiranje i upis u rokovi.json
python scripts/merge_rok.py januar.pdf
python scripts/merge_rok.py kol.pdf --rokovi public/data/rokovi.json

# Dry run (samo prikaz, bez upisivanja)
python scripts/merge_rok.py januar.pdf --dry-run

# Prisiljavanje naziva roka
python scripts/merge_rok.py januar.pdf --rok "Januarski ispitni rok 2025/26"
```

Za samo parsiranje termina (bez upisivanja u `rokovi.json`):

```bash
# Ispitni rok
python scripts/fon_exam_parser.py --pdf januar.pdf --tip ispit --rok "Januarski ispitni rok" --output out.json

# Kolokvijum
python scripts/fon_exam_parser.py --pdf kol.pdf --tip kolokvijum --rok "Prvi zimski kolokvijum" --output out.json
```

## Verzije

### v1.0 — Raspored nastave
Onboarding, nedeljni raspored filtriran po grupi, dark/light mode, export u iCal.

### v2.0 — Ispiti i kolokvijumi
Nova stranica `/rokovi` sa listom i kalendarskim prikazom ispita i kolokvijuma, filtriranim po odabranim predmetima. PDF parser (`fon_exam_parser.py`) za konverziju FON rasporeda u JSON.

### v2.1 — Automatizacija
GitHub Actions workflow koji svake noći proverava FON sajt, detektuje nove PDF-ove, parsira ih i automatski ažurira `rokovi.json`.

### v2.2 — Skrivanje termina
Opcija sakrivanja pojedinačnih termina iz nedeljnog rasporeda — swipe na mobilnom ili klik. Izbor se čuva u localStorage po grupi.

### v2.3 — Prijava ispita i kolokvijuma
Parser za datume prijave i reklamacija iz PDF zaglavlja (`parse_rok.py`). Baner na stranici `/rokovi` koji automatski obaveštava kada se otvori period prijave; može se odbaciti za sesiju.

---

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [pdfplumber](https://github.com/jsvine/pdfplumber) — parsiranje PDF rasporeda
- GitHub Actions — automatsko ažuriranje podataka
