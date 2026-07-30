# FON Raspored

Personalizovani pregled rasporeda nastave, ispita i kolokvijuma za Fakultet organizacionih nauka (FON).

**https://fon-raspored-five.vercel.app/**

## Funkcionalnosti

- **Raspored nastave** — filtriran po godini, programu i grupi; pregled po danima
- **Skrivanje termina** — swipe na mobilnom ili klik na termin ga sakriva iz rasporeda; bira se koji termini su relevantni; čuva se u localStorage
- **Ispiti i kolokvijumi** — lista i kalendarski prikaz; prikazuju se samo predmeti koje student sluša
- **Rokovi kroz oba semestra** — septembarski i oktobarski rok mešaju predmete oba semestra; aplikacija pamti izbor po semestru i (u letnjem) nudi dodavanje zimskih predmeta radi ponavljanja u septembru
- **Promena semestra** — kad se objavi raspored za novi semestar, aplikacija podseća studenta da ponovo izabere predmete (kredencijali ostaju), pa raspored i rokovi ostaju tačni
- **Izborni i preneseni predmeti** — poseban tok pri onboardingu za dodavanje izbornih i prenesenih predmeta, koji se potom prate u ispitima i kolokvijumima
- **Glass dizajn** — responzivni “liquid glass” UI, mobilni donji navbar i jasnije razdvojene akcije za raspored, rokove i izmenu termina
- **Notifikacija o prijavi** — baner na stranici ispita/kolokvijuma koji se prikazuje kada se bliži ili otvori period prijave; sadrži datume prijave i reklamacija; može se odbaciti za sesiju
- **Push notifikacije (PWA)** — aplikacija se može instalirati na home screen (iOS 16.4+, Android, desktop) i primati Web Push obaveštenja: kada scraper doda nov ispitni/kolokvijumski rok, i na dan početka i na dan kraja prijave (u 10h, sa linkom ka eStudentu)
- **Onboarding** — pri prvom posetu student bira godinu, program i grupu; aplikacija pamti izbor
- **Dark/light mode**
- **Export u iCal** — raspored se može uvesti u Google Calendar, Apple Calendar i sl.
- **Automatsko ažuriranje** — GitHub Actions svaki dan proverava FON sajt za nove PDF rasporede i automatski ih parsira i upisuje

## Struktura projekta

```
app/
  page.tsx              # Onboarding (izbor grupe, izbornih i prenesenih predmeta)
  (tabs)/
    layout.tsx          # Layout za tabove sa zajedničkom navigacijom
    raspored/page.tsx   # Nedeljni raspored nastave (lista/sedmica + export)
    rokovi/page.tsx     # Rokovi (ispiti/kolokvijumi, kalendar/lista + notifikacije)
    preneseni/page.tsx  # Izmena rasporeda i dodavanje termina prenesenih predmeta
  izborni/              # Tok za izbor izbornih predmeta
  manifest.ts           # PWA manifest (instalacija na home screen)
  actions.ts            # Server akcije — upis/brisanje push pretplata (Upstash Redis)

components/
  BottomNav.tsx         # Mobilni donji navbar za glavne tabove
  NotificationBell.tsx  # Dugme za uključivanje notifikacija + iOS uputstvo

public/
  sw.js                 # Service worker — prima Web Push i prikazuje notifikaciju
  icon-192.png          # Ikonice za PWA manifest
  icon-512.png
  data/
    1god.json           # Raspored po godinama
    2god.json
    3god.json
    4god.json
    rokovi.json         # Ispitni rokovi i kolokvijumi (automatski ažurirano)

scripts/
  check_fon.py          # Scraper — proverava FON sajt za nove PDF-ove, poziva merge_rok.py
  merge_rok.py          # Orkestracija: pokreće parse_rok.py + fon_exam_parser.py, upisuje u rokovi.json
  fon_exam_parser.py    # Parser — PDF tabela termina → JSON (pdfplumber)
  parse_rok.py          # Parser — datumi prijave i reklamacije iz PDF zaglavlja (pymupdf)
  fon_parser.py         # Parser rasporeda NASTAVE (PDF → god.json), širi grupe-prečice
  update_nastava.py     # Orkestrator — nađe PDF-ove na FON sajtu, parsira, upiše god.json
  send_push.mjs         # Slanje Web Push notifikacija (novi rokovi + podsetnici za prijavu)
  known_pdfs.json       # Lista već viđenih PDF URL-ova

  tests/                # pytest testovi parsera + PDF fixtures (golden + strukturne provere)

.github/workflows/
  ci.yml                # CI — lint/typecheck/build (Node) + pytest (Python) na PR/push
  check-fon.yml         # Dnevna automatizacija ispita/kolokvijuma (scraping + notifikacije)
  update-nastava.yml    # Ručni workflow — regeneriše raspored nastave (god.json)
```

## Lokalni razvoj

```bash
npm install
npm run dev
```

Aplikacija se otvara na [http://localhost:3000](http://localhost:3000).

## Testovi i CI

Na svaki push i Pull Request pokreće se `ci.yml` sa dva job-a:

- **build** — `npm run lint`, `tsc --noEmit`, `npm test` (Vitest) i `next build` (da se ne merge-uje kod koji ne prolazi lint/typecheck/test/build)
- **python-tests** — `pytest` nad parserima (raspored nastave + ispiti/kolokvijumi)

Vitest pokriva čistu logiku u `lib/` (kolokacija predmeta po smeru, opsezi prezimena / srpska kolacija, detekcija izbornih). Testovi su kolocirani kao `lib/*.test.ts`:

```bash
npm test          # jednokratno
npm run test:watch
```

Python testovi (`scripts/tests/`) rade nad realnim FON PDF-ovima sačuvanim kao fixtures:

```bash
cd scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest
```

Testovi kombinuju **golden** poređenje (izlaz parsera vs. sačuvani `*.expected.json`) i **strukturne** provere (ISO datumi, `HH:MM` vremena, P/U samo kod ispita itd.). Kad je promena u parseru namerna, regeneriši golden fajlove pa pregledaj diff:

```bash
cd scripts && python tests/update_golden.py
```

## Automatizacija rasporeda ispita

GitHub Actions workflow (`check-fon.yml`) se pokreće svaki dan u 10:00 po Beogradu (`0 8 * * *` UTC) i:

1. Scrape-uje [raspored-kolokvijuma](https://oas.fon.bg.ac.rs/raspored-kolokvijuma/) i [raspored-ispita](https://oas.fon.bg.ac.rs/raspored-ispita/)
2. Za svaki novi PDF (koji nije u `known_pdfs.json`) — skida ga i parsira
3. Rezultat merge-uje u `public/data/rokovi.json`
4. Commit-uje i push-uje promene
5. Šalje push notifikacije (`send_push.mjs`): za svaki nov rok, i podsetnik na dan početka i kraja prijave

> Koraci za slanje notifikacija se izvršavaju samo ako su podešeni secrets (vidi „Push notifikacije" ispod); u suprotnom se preskaču i scraping radi kao i ranije.

PDF se po potrebi može parsirati i ručno (`merge_rok.py` detektuje tip, izvlači termine i datume prijave, i upisuje u `rokovi.json`).

## Raspored nastave

Raspored nastave (`1god.json`–`4god.json`) menja se ~4× godišnje, pa se ne skida dnevno nego po potrebi: `update_nastava.py` pronalazi aktuelne PDF-ove na [raspored-nastave](https://oas.fon.bg.ac.rs/raspored-nastave/) (po tekstu linka, bira najnoviju verziju), parsira ih (`fon_parser.py`, uz širenje grupa-prečica tipa „ISIT, svi") i regeneriše `god.json`. Pokreće se ručnim GitHub Actions workflow-om (`update-nastava.yml`) koji uz sigurnosnu proveru (broj predmeta/grupa ne sme da padne) otvara Pull Request sa promenama.

## Push notifikacije

Pretplate korisnika se čuvaju u [Upstash Redis](https://upstash.com), a slanje ide preko Web Push protokola sa VAPID ključevima (`web-push`). Aplikacija mora biti dodata na home screen da bi notifikacije radile na iOS-u (16.4+); na Androidu i desktopu rade direktno.

Potrebne promenljive okruženja:

| Promenljiva | Gde | Opis |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel + GitHub Secrets | Javni VAPID ključ (koristi ga i browser) |
| `VAPID_PRIVATE_KEY` | Vercel + GitHub Secrets | Privatni VAPID ključ |
| `VAPID_SUBJECT` | GitHub Secrets | `mailto:` adresa kontakta |
| `UPSTASH_REDIS_REST_URL` | Vercel + GitHub Secrets | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel + GitHub Secrets | Upstash REST token |

VAPID ključevi se generišu sa `npx web-push generate-vapid-keys`.

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

### v2.4 — Push notifikacije (PWA)
Aplikacija je sada PWA (manifest + service worker) i može se instalirati na home screen. Web Push notifikacije (VAPID, pretplate u Upstash Redis) za nove ispitne/kolokvijumske rokove i podsetnike na dan početka i kraja prijave (u 10h, sa linkom ka eStudentu). Radi na iOS-u (16.4+, instalirano), Androidu i desktopu. Slanje iz `send_push.mjs` u okviru dnevnog GitHub Actions workflow-a.

### v2.5 — Automatizacija rasporeda nastave
Parser rasporeda nastave (`fon_parser.py`) + orkestrator (`update_nastava.py`) i ručni workflow koji regeneriše `god.json` sa FON sajta, sa sigurnosnom proverom i PR-om za pregled. Rešava ranije „tihe rupe" (izborni i projektni predmeti koji su ispadali pri parsiranju).

### v2.6 — Glass dizajn
Redizajn aplikacije u “liquid glass” stilu: frosted paneli i dugmad, novi mobilni donji navbar, kompaktniji mobilni prikaz rasporeda, širi i čitljiviji desktop prikazi za raspored i rokove, usklađene akcije za export/sliku/kalendar i bolji tok za prenesene predmete (ručno dodavanje sakriveno dok nije potrebno).

### v2.7 — Rokovi kroz oba semestra i promena semestra
Septembarski i oktobarski rok mešaju predmete oba semestra. Aplikacija akumulira izbor predmeta po semestru i (u letnjem) nudi dodavanje zimskih predmeta koji se polažu u septembru, pa se prikazuju i ponavljanja iz prethodnog semestra. Pri promeni semestra resetuje izbor predmeta i podseća studenta da izabere ponovo (kredencijali ostaju), uz detekciju otpornu na re-objavu istog rasporeda. Popravljen i parser koji je ispuštao predmete sa nazivom prelomljenim u dva reda (npr. Osnove IKT).

---

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [pdfplumber](https://github.com/jsvine/pdfplumber) — parsiranje PDF rasporeda
- [web-push](https://github.com/web-push-libs/web-push) + VAPID — Web Push notifikacije
- [Upstash Redis](https://upstash.com) — čuvanje push pretplata
- GitHub Actions — CI (lint/typecheck/test/build + pytest) i automatsko ažuriranje podataka
- [Vitest](https://vitest.dev) — unit testovi za `lib/` logiku
- [pytest](https://pytest.org) — testovi parsera (golden + strukturne provere)
