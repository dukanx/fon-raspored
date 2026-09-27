# FON Raspored

Personalizovani pregled rasporeda nastave, ispita i kolokvijuma za Fakultet organizacionih nauka (FON).

**https://fon-raspored-five.vercel.app/**

## Funkcionalnosti

- **Raspored nastave** - filtriran po godini, programu i grupi; lista ili nedeljni prikaz; na desktopu ravnopravan prekidač između Rasporeda i Rokova
- **Skrivanje termina** - swipe na mobilnom ili klik na termin ga sakriva iz rasporeda (i iz Rokova); bira se koji termini su relevantni; čuva se u localStorage, uz mogućnost vraćanja
- **Ispiti i kolokvijumi** - lista i kalendarski prikaz; prikazuju se samo predmeti koje student sluša; aplikacija se pri otvaranju sama postavlja na Raspored ili Rokove u zavisnosti da li je u toku/blizu stvaran ispitni period
- **Kalendar aktivnosti** - kalendar u Rokovima je obojen po FON kalendaru aktivnosti: ispitni rokovi, kolokvijumske nedelje, neradni dani i dani bez nastave, uz oznaku za onlajn nastavu
- **Sopstveni događaji u Rokovima** - dodavanje, izmena i brisanje ličnih ispita/kolokvijuma/dogovora koji nisu na FON sajtu (npr. dogovor sa profesorom), sa sopstvenim datumom, vremenom i salom
- **Rokovi kroz oba semestra** - septembarski i oktobarski rok mešaju predmete oba semestra; aplikacija pamti izbor po semestru i (u letnjem) nudi dodavanje zimskih predmeta radi ponavljanja u septembru
- **Promena semestra** - kad se objavi raspored za novi semestar, aplikacija podseća studenta da ponovo izabere predmete, a kad se promeni grupa (npr. ISiT grupe u zimskom su po prezimenu, a u letnjem po modulu) sama nađe novu po modulu i prezimenu; na početku nove školske godine vraća studenta na izbor godine, uz zapamćeno prezime
- **Čekamo raspored** - između kraja ispitnog roka i objave novog rasporeda početna jasno kaže da raspored još nije objavljen, umesto da prikazuje stari, i nudi uključivanje notifikacija da student sazna čim izađe
- **Obavezni i izborni po modulu** - pri izboru predmeta čekirani su samo obavezni predmeti za studentov modul, po planu sa sajta modula; ako FON još nije objavio raspored nekog izbornog bloka, aplikacija to napomene
- **Izborni, preneseni i drugosemestralni predmeti** - tok pri onboardingu za izbor izbornih predmeta, dodavanje prenesenih predmeta iz prethodnih godina i štikliranje predmeta iz drugog semestra (radi tačnih rokova); sve se kasnije može menjati i iz Izmena taba ("Moji predmeti"), ne samo pri onboardingu
- **Izmena rasporeda** - ručno biranje termina (predavanje/vežbe) za prenesene predmete ili alternativnog termina za tekući predmet, uz AI predlog termina bez preklapanja (Groq/Llama)
- **Onboarding tur** - posle prvog izbora predmeta, kratak multi-slajd vodič kroz glavne funkcije (Izmena tab, skrivanje, info o predmetu, deljenje, izvoz, rokovi, notifikacije); ako korisnik ima prenesene predmete, dodatni slajd ga upućuje da im ručno podesi termin
- **Glass dizajn** - responzivni "liquid glass" UI, mobilni donji navbar i jasnije razdvojene akcije za raspored, rokove i izmenu termina
- **Notifikacija o prijavi** - baner na stranici ispita/kolokvijuma koji se prikazuje kada se bliži ili otvori period prijave; sadrži datume prijave i reklamacija; može se odbaciti za sesiju
- **Push notifikacije (PWA)** - aplikacija se može instalirati na home screen (iOS 16.4+, Android, desktop) i primati Web Push obaveštenja: kada scraper doda nov ispitni/kolokvijumski rok, i na dan početka i na dan kraja prijave (u 10h, sa linkom ka eStudentu)
- **Offline rad** - posle prve posete raspored i rokovi se učitavaju i bez interneta; service worker čuva ljusku aplikacije i podatke, a sveže podatke uvek prvo traži sa mreže kad je veza dostupna
- **Onboarding** - pri prvom posetu student bira godinu, program i grupu; aplikacija pamti izbor
- **Dark/light mode**
- **Export u sliku i iCal** - raspored ili rokovi se mogu sačuvati kao PNG slika ili uvesti u Google Calendar, Apple Calendar i sl.
- **Deljenje putem linka** - dugme „Podeli" pravi link (`/deli`) sa enkodiranom grupom i izborom predmeta, uz opciju da pošiljalac uključi i prenesene/drugosemestralne predmete; ko ga otvori dobija taj raspored posle potvrde, bez onboardinga
- **Automatsko ažuriranje** - GitHub Actions svaki dan proverava ispite, kolokvijume i kalendar aktivnosti, a u mesecima kad se objavljuje raspored nastave proverava ga na svakih 30 minuta; posle automatske provere podataka izmene se objavljuju same

## Struktura projekta

```
app/
  page.tsx            # Onboarding (godina, program, grupa) + nalepi deljeni link
  izborni/page.tsx     # Izbor izbornih/prenesenih/drugosemestralnih predmeta (pri onboardingu i kasnije, iz "Moji predmeti")
  deli/page.tsx        # Primena deljenog rasporeda sa /deli?s=... linka
  actions.ts           # Server akcije - upis/brisanje push pretplata (Upstash Redis)
  manifest.ts          # PWA manifest (instalacija na home screen)
  api/
    preneseni/route.ts # AI predlog termina za prenesene predmete (Groq/Llama)
  (tabs)/
    layout.tsx         # Layout za tabove - donji navbar + first-run popup-ovi
    raspored/page.tsx  # Nedeljni raspored (lista/sedmica), export, deljenje, onboarding tur
    rokovi/page.tsx    # Rokovi (ispiti/kolokvijumi, kalendar/lista), sopstveni događaji, notifikacije
    preneseni/page.tsx # Izmena rasporeda - dodavanje termina, skriveni termini, "Moji predmeti"

components/
  OfflineNotice.tsx       # Kartica kad podaci nisu keširani, a nema veze
  BottomNav.tsx           # Mobilni donji navbar za glavne tabove
  NotificationBell.tsx    # Dugme za uključivanje notifikacija + iOS uputstvo
  NotificationIntro.tsx   # Prvi-put modal koji pita za notifikacije u instaliranoj PWA
  AppTour.tsx             # Generički multi-slajd popup (koristi ga onboarding tur)
  FirstRunOverlays.tsx    # Orkestrira first-run popup-ove (trenutno: notifikacije)
  Tutorial.tsx            # Story-carousel walkthrough - izgrađen, privremeno isključen
  InstallPrompt.tsx       # Uputstvo za instalaciju PWA na home screen
  WaitingForSchedule.tsx  # Početna dok novi raspored nije objavljen (notifikacije, instalacija)
  FeedbackButton.tsx      # Plutajuće dugme - šalje poruku na mejl preko Resend-a
  BlurText.tsx            # Animacija teksta pri učitavanju (naslov na onboardingu)

lib/
  storage.ts       # Jedan izvor istine za sve localStorage/sessionStorage ključeve
  schedule.ts      # Učitavanje i filtriranje rasporeda po grupi/godini/semestru
  share.ts         # Encode/decode za deljenje rasporeda putem linka
  semester.ts      # Detekcija promene semestra i resetovanje izbora predmeta
  subjects.ts      # Mapiranje programa u smer (IST/MiO) i podrazumevani izbor predmeta
  rokDefault.ts    # Bira default tab (Raspored/Rokovi) po stvarnim datumima rokova
  season.ts        # Da li se čeka raspored: kraj poslednjeg roka vs. objavljeni semestar
  waiting.ts       # Odluka pri ulasku u aplikaciju (tab + period čekanja), zajednička za strane
  plan.ts          # Obavezan/izborni po planu modula, nepotpuni izborni blokovi
  kalendar.ts      # Vrste dana iz FON kalendara aktivnosti i njihove boje
  theme.ts, date.ts, types.ts, push.ts, shareOrDownload.ts

public/
  sw.js                  # Service worker - prima Web Push i prikazuje notifikaciju
  icon-192.png           # Ikonice za PWA manifest
  icon-512.png
  data/
    1god.json-4god.json               # Raspored po godinama, trenutno aktivan semestar
    1god-zimski.json / -letnji.json    # Arhiva po semestru (za rokove koji mešaju oba)
    subjects-meta.json                 # Status (obavezan/izborni), ESPB i katedra po predmetu
    plan.json                          # Plan studija po modulu: obavezni predmeti i izborni blokovi
    kalendar.json                      # FON kalendar aktivnosti: vrsta svakog dana školske godine
    rokovi.json                        # Ispitni rokovi i kolokvijumi (automatski ažurirano)

scripts/
  check_fon.py          # Scraper - proverava FON sajt za nove PDF-ove, poziva merge_rok.py
  merge_rok.py          # Orkestracija: pokreće parse_rok.py + fon_exam_parser.py, upisuje u rokovi.json
  fon_exam_parser.py    # Parser - PDF tabela termina → JSON (pdfplumber)
  parse_rok.py          # Parser - datumi prijave i reklamacije iz PDF zaglavlja (pymupdf)
  fon_parser.py         # Parser rasporeda NASTAVE (PDF → god.json), širi grupe-prečice
  fon_docx.py           # Rezervno čitanje rasporeda i grupa iz Word (.docx) fajlova
  update_nastava.py     # Orkestrator - nađe fajlove na FON sajtu, parsira, upiše god.json
  validate_data.py      # Provera rasporeda pre objave (greške blokiraju, upozorenja idu u issue)
  scrape_plan.py        # Plan studija po modulima sa sajta → plan.json
  scrape_kalendar.py    # FON kalendar aktivnosti → kalendar.json
  known_nastava.json    # Linkovi i otisci fajlova iz kojih je napravljen objavljeni raspored
  send_push.mjs         # Slanje Web Push notifikacija (novi rokovi + podsetnici za prijavu)
  known_pdfs.json       # Lista već viđenih PDF URL-ova

  tests/                # pytest testovi parsera + PDF fixtures (golden + strukturne provere)

.github/workflows/
  ci.yml                # CI - lint/typecheck/build (Node) + pytest (Python) na PR/push
  check-fon.yml         # Dnevna automatizacija ispita/kolokvijuma i kalendara aktivnosti
  update-nastava.yml    # Raspored nastave: provera na 30 min u sezoni, provera podataka, objava
  notify-nastava.yml    # Notifikacija kad izađe nov semestar ili dopuna sa novim predmetima
  osvezi-plan.yml       # Nedeljno osvežavanje plana modula i podataka o predmetima
```

## Lokalni razvoj

```bash
npm install
npm run dev
```

Aplikacija se otvara na [http://localhost:3000](http://localhost:3000).

## Testovi i CI

Na svaki push i Pull Request pokreće se `ci.yml` sa dva job-a:

- **build** - `npm run lint`, `tsc --noEmit`, `npm test` (Vitest) i `next build` (da se ne merge-uje kod koji ne prolazi lint/typecheck/test/build)
- **python-tests** - `pytest` nad parserima (raspored nastave iz PDF-a i Word-a, ispiti/kolokvijumi, kalendar aktivnosti) i provera podataka u `public/data` (`validate_data.py`)

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

GitHub Actions workflow (`check-fon.yml`) se pokreće svaki dan oko 10:00 po Beogradu (tri pokušaja, `7 8,9,10 * * *` UTC, jer GitHub cron ume da preskoči pokretanje) i:

1. Scrape-uje [raspored-kolokvijuma](https://oas.fon.bg.ac.rs/raspored-kolokvijuma/) i [raspored-ispita](https://oas.fon.bg.ac.rs/raspored-ispita/)
2. Za svaki novi PDF (koji nije u `known_pdfs.json`) - skida ga i parsira
3. Rezultat merge-uje u `public/data/rokovi.json`
4. Commit-uje i push-uje promene
5. Šalje push notifikacije (`send_push.mjs`): za svaki nov rok, i podsetnik na dan početka i kraja prijave
6. Osvežava kalendar aktivnosti (`scrape_kalendar.py` → `kalendar.json`); ako stranica ne izgleda kako se očekuje, zadržava stari kalendar i otvara issue

> Koraci za slanje notifikacija se izvršavaju samo ako su podešeni secrets (vidi „Push notifikacije" ispod); u suprotnom se preskaču i scraping radi kao i ranije.

PDF se po potrebi može parsirati i ručno (`merge_rok.py` detektuje tip, izvlači termine i datume prijave, i upisuje u `rokovi.json`).

## Raspored nastave

Raspored nastave (`1god.json`-`4god.json`) se objavljuje nekoliko puta godišnje, uz povremene dopune i ispravke. U septembru, oktobru, februaru i martu `update-nastava.yml` na svakih 30 minuta brzo proverava stranicu [raspored-nastave](https://oas.fon.bg.ac.rs/raspored-nastave/): da li je objavljen semestar noviji od trenutnog, ili su se promenili fajlovi objavljenog (pamte se linkovi i otisak sadržaja). Za proveru nove školske godine gleda se i naslov stranice, da prošlogodišnji fajlovi ne bi bili objavljeni kao novi.

Kad ima nečeg novog, fajlovi se parsiraju: PDF preko `fon_parser.py`, a kad FON objavi samo Word, preko `fon_docx.py`. Pre objave se osveže plan modula i podaci o predmetima, pa `validate_data.py` proveri rezultat. Ako je sve u redu, raspored se objavljuje sam, a notifikacija ide za nov semestar i za dopunu sa novim predmetima (ne i za izmene sala i termina). Ako provera nađe grešku u čitanju, ništa se ne objavljuje, nego se otvara Pull Request sa izveštajem; čudnosti u samim FON podacima (npr. opsezi prezimena koji se preklapaju) objavljuju se, uz GitHub issue. Plan modula i podaci o predmetima osvežavaju se i jednom nedeljno (`osvezi-plan.yml`), da izmene plana usred semestra ne bi čekale sledeći raspored.

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

## Feedback

Plutajuće dugme u aplikaciji šalje poruku na mejl preko [Resend](https://resend.com).

| Promenljiva | Gde | Opis |
|---|---|---|
| `RESEND_API_KEY` | Vercel | API ključ sa resend.com |
| `FEEDBACK_EMAIL` | Vercel | Mejl na koji stiže feedback |
| `RESEND_FROM_EMAIL` | Vercel (opciono) | Pošiljalac, npr. `FON Raspored <feedback@tvojdomen.com>`. Bez ovoga koristi se Resend-ov sandbox pošiljalac (`onboarding@resend.dev`), koji radi bez verifikacije domena. |

## AI predlog termina

U Izmeni, kad student dodaje termin za preneseni predmet, može da zatraži predlog - model dobija trenutni raspored i dostupne termine (sa naznakom preklapanja) i vraća predavanje/vežbe bez preklapanja ili sa najmanje pauza, uz kratko obrazloženje.

| Promenljiva | Gde | Opis |
|---|---|---|
| `GROQ_API_KEY` | Vercel | API ključ za [Groq](https://groq.com) (`llama-3.3-70b-versatile`) |

## Verzije

### v1.0 - Raspored nastave
Onboarding, nedeljni raspored filtriran po grupi, dark/light mode, export u iCal.

### v2.0 - Ispiti i kolokvijumi
Nova stranica `/rokovi` sa listom i kalendarskim prikazom ispita i kolokvijuma, filtriranim po odabranim predmetima. PDF parser (`fon_exam_parser.py`) za konverziju FON rasporeda u JSON.

### v2.1 - Automatizacija
GitHub Actions workflow koji svake noći proverava FON sajt, detektuje nove PDF-ove, parsira ih i automatski ažurira `rokovi.json`.

### v2.2 - Skrivanje termina
Opcija sakrivanja pojedinačnih termina iz nedeljnog rasporeda - swipe na mobilnom ili klik. Izbor se čuva u localStorage po grupi.

### v2.3 - Prijava ispita i kolokvijuma
Parser za datume prijave i reklamacija iz PDF zaglavlja (`parse_rok.py`). Baner na stranici `/rokovi` koji automatski obaveštava kada se otvori period prijave; može se odbaciti za sesiju.

### v2.4 - Push notifikacije (PWA)
Aplikacija je sada PWA (manifest + service worker) i može se instalirati na home screen. Web Push notifikacije (VAPID, pretplate u Upstash Redis) za nove ispitne/kolokvijumske rokove i podsetnike na dan početka i kraja prijave (u 10h, sa linkom ka eStudentu). Radi na iOS-u (16.4+, instalirano), Androidu i desktopu. Slanje iz `send_push.mjs` u okviru dnevnog GitHub Actions workflow-a.

### v2.5 - Automatizacija rasporeda nastave
Parser rasporeda nastave (`fon_parser.py`) + orkestrator (`update_nastava.py`) i ručni workflow koji regeneriše `god.json` sa FON sajta, sa sigurnosnom proverom i PR-om za pregled. Rešava ranije „tihe rupe" (izborni i projektni predmeti koji su ispadali pri parsiranju).

### v2.6 - Glass dizajn
Redizajn aplikacije u “liquid glass” stilu: frosted paneli i dugmad, novi mobilni donji navbar, kompaktniji mobilni prikaz rasporeda, širi i čitljiviji desktop prikazi za raspored i rokove, usklađene akcije za export/sliku/kalendar i bolji tok za prenesene predmete (ručno dodavanje sakriveno dok nije potrebno).

### v2.7 - Rokovi kroz oba semestra i promena semestra
Septembarski i oktobarski rok mešaju predmete oba semestra. Aplikacija akumulira izbor predmeta po semestru i (u letnjem) nudi dodavanje zimskih predmeta koji se polažu u septembru, pa se prikazuju i ponavljanja iz prethodnog semestra. Pri promeni semestra resetuje izbor predmeta i podseća studenta da izabere ponovo (kredencijali ostaju), uz detekciju otpornu na re-objavu istog rasporeda. Popravljen i parser koji je ispuštao predmete sa nazivom prelomljenim u dva reda (npr. Osnove IKT).

### v2.8 - Sopstveni događaji u Rokovima
Dodavanje, izmena i brisanje ličnih ispita/kolokvijuma/dogovora direktno u kalendaru Rokova, odvojeno od onih sa FON sajta. Svaki ima sopstveni tip, datum, vreme, salu i napomenu; skriveni događaji automatski ističu kad im prođe datum.

### v2.9 - Deljenje uključuje prenesene i drugosemestralne predmete
Link za deljenje (`/deli`) sad opciono nosi i prenesene termine, predmete iz prethodnih godina i iz drugog semestra - pošiljalac bira da li da ih uključi pre slanja. Ranije je link nosio samo tekuće izborne predmete, pa je raspored primaoca mogao da ispadne prazan ako je pošiljalac sve svoje predmete preneo iz ranijih godina.

### v2.10 - Pametan default tab
Aplikacija se pri otvaranju sama postavlja na Raspored ili Rokove, u zavisnosti od toga da li je u toku ili se bliži stvaran ispitni period - po pravim datumima iz `rokovi.json`, ne po pretpostavljenom akademskom kalendaru. Susedni rokovi (npr. julski→septembarski→oktobarski) se tretiraju kao jedna ispitna sezona.

### v2.11 - Ravnopravna desktop navigacija i Moji predmeti
Na desktopu, Raspored i Rokovi sad imaju ravnopravan prekidač umesto asimetrične "nazad" hijerarhije. Izbor izbornih predmeta više nije samo jednokratni onboarding korak - dostupan je i kasnije, kao "Moji predmeti" u Izmena tabu.

### v2.13 - Offline rad
Service worker sada kešira ljusku aplikacije, hashovane resurse i `public/data/*.json`, pa raspored i rokovi rade i bez interneta posle prve posete. Podaci idu network-first (keš samo kad veza padne) da izbor predmeta ne bi bio pogrešno resetovan zastarelim `god.json`-om. Uz to: kartica „Nema interneta" umesto beskonačnog učitavanja kad podaci nikad nisu keširani, i tema se postavlja pre prvog iscrtavanja pa nema belog bljeska pri učitavanju.

### v2.12 - Onboarding tur
Posle prvog izbora predmeta, kratak multi-slajd vodič (isti vizuelni stil kao popup za notifikacije, bez screenshotova) kroz Izmenu, skrivanje termina, info o predmetu, deljenje, izvoz, rokove i notifikacije. Ako korisnik ima prenesene predmete kojima treba ručno podesiti termin, dodatni slajd ga upućuje na Izmenu - bitan je pa se ne može slučajno preskočiti.

### v2.14 - Čekamo raspored i nova školska godina
Između kraja ispitnog roka i objave novog rasporeda početna kaže da raspored još nije objavljen i nudi notifikacije, umesto da prikazuje stari. Na početku nove školske godine stari korisnik se vraća na izbor godine uz zapamćeno prezime. ISiT studenti od 2. godine biraju modul, pa aplikacija pri prelasku na letnji semestar sama nađe novu grupu. Izbor predmeta čekira samo obavezne predmete po planu modula i napominje kad izborni još nisu objavljeni. Zimski 2026/27, koji je FON objavio samo u Word-u, čita se rezervnim parserom za `.docx`.

### v2.15 - Automatska objava rasporeda nastave
Raspored nastave se proverava na svakih 30 minuta u sezoni objave i objavljuje sam posle automatske provere podataka, uključujući nov semestar i dopune. Prepoznaje se i kad FON pregazi fajl na istoj adresi. Notifikacija ide i za dopunu sa novim predmetima, a aplikacija tada pita studenta za nove predmete umesto da ih sama prikaže.

### v2.16 - Kalendar aktivnosti u Rokovima
Kalendar u Rokovima je obojen po FON kalendaru aktivnosti (ispitni rokovi, kolokvijumske nedelje, neradni dani, dani bez nastave, onlajn nastava), uz legendu. Kalendar se osvežava svakog dana sa FON sajta.

---

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [pdfplumber](https://github.com/jsvine/pdfplumber) - parsiranje PDF rasporeda
- [Beautiful Soup](https://www.crummy.com/software/BeautifulSoup/) - čitanje FON stranica (linkovi, plan modula, kalendar aktivnosti)
- [web-push](https://github.com/web-push-libs/web-push) + VAPID - Web Push notifikacije
- [Upstash Redis](https://upstash.com) - čuvanje push pretplata
- GitHub Actions - CI (lint/typecheck/test/build + pytest) i automatsko ažuriranje podataka
- [Vitest](https://vitest.dev) - unit testovi za `lib/` logiku
- [pytest](https://pytest.org) - testovi parsera (golden + strukturne provere)
