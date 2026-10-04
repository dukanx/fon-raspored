# TODO


## Redosled posle CDN gašenja požara (dogovoreno 2026-10-02)

Pozadina: početkom semestra Vercel Hobby CDN zahtevi su išli ka limitu od 1M/30 dana.
Urađeno: bez prefetch-a ka /izborni (link i onboarding), `Cache-Control` za /data (10 min),
manifest i favicon, ikonice cache-first u SW, Vercel Analytics iza `NEXT_PUBLIC_ENABLE_ANALYTICS`.

1. [x] **Push ne sme da stigne pre svežih podataka.** Od kad /data ima `max-age=600`,
   ko je otvorio aplikaciju u 10 min pre objave, na klik vidi staro. `notify-nastava.yml`
   i `check-fon.yml` sad čekaju da sajt servira nove podatke, pa još 10 min.
2. [ ] **Cloudflare Web Analytics** - nalog i sajt napravljeni (2026-10-03), token je
   upisan u app/layout.tsx (javan je, nije u env-u). Posle deploy-a proveriti prelaze između
   tabova (beacon dira pushState, a `@vercel/analytics/react` je zbog toga lomio navigaciju);
   ako se nešto čudno ponaša, `spa: false`. Od dana deploy-a kreće brojanje za sponzore.
3. [ ] **Praćenje CDN potrošnje** - prosek treba da bude ispod ~33K zahteva dnevno.
   Odluka ~2026-10-10, sa brojevima posle ispravke prefetch-a /izborni (bila najveća
   stavka). Ako nije ispod, plan B je Cloudflare kao CDN ispred sajta: domen na Cloudflare
   DNS, pravila keša (posebno /data), uz rizik da loše podešavanje obori sajt; Vercel ne
   preporučuje proxy ispred sebe. Tek posle toga Vercel Pro.
4. [x] **`reconcileSemester` samo unapred** - v. "Tehničko".
5. [x] **Dupli favicon** - sad samo jedan `<link rel="icon">`, i to naša ikonica kalendara
   umesto FON-ovog loga.
6. [ ] **Sponzori** - tek posle 2-4 nedelje brojeva iz Cloudflare-a.
   - Pre nego što sponzor ode uživo: Vercel Pro (Hobby ne dozvoljava reklame ni sponzore,
     donacije su izričito dozvoljene), ugovor ili račun, porez proveriti sa knjigovođom.
   - Kandidati: Levi9, EY, Saga New Frontier Group (FON Hakaton), Telekom Srbija,
     Orion Innovation, Sixentix, ITum, NALED, Propulzija; FONIS preko C2S kao posrednik.
   - Ponuda: jedna kartica "Sponzor" po semestru, nikad u notifikacijama, bez FON logoa
     ni "partner FON-a". Kartica: `SponsorCard` iz JSON-a sa od-do datumom, `rel="sponsored"`.
7. [ ] **Rokovi bez podele na Ispite/Kolokvijume** - nedelja od 2026-10-05, na posebnoj
   grani, pre kolokvijumske nedelje (po FON kalendaru od 2026-11-16). V. "Planirano".

Odustali: tačkica na feedback ikonici za "Častiš kafu?" (prenapadno; donacija ostaje u
feedback prozoru).

## Nije hitno (dogovoreno 2026-10-03)

- [x] **Detaljni baner "Raspored je izmenjen"** (urađeno 2026-10-04, lib/izmene.ts) - pamtiti raspored GRUPE (ne samo čekirane
  predmete, da čekiranje ne pali baner) kad ga student vidi, pa pri sledećoj FON-ovoj izmeni
  pokazati tačne promene za njegove predmete ("Matematika 1 (P), pon 08:15: Amfiteatar 3 ->
  Amfiteatar 1") uz "ako si izvezao u kalendar ili sačuvao sliku, uradi ponovo". Za studente
  bez notifikacija. Sada postoji samo jednokratni opšti baner za izmenu od 2. nedelje
  (`izmena2NedSeen`, ističe 2026-10-12) - posle toga ga obrisati.
- [ ] **Oznaka "po planu: letnji/zimski"** na izboru predmeta, kad je predmet u planu modula
  studenta u drugom semestru nego što ga FON drži (npr. Napredne .NET tehnologije: za SI
  letnji, a FON ga drži zimi za D4-D7 zajedno sa TEP-om). Sad `planStatus` tiho uzme drugi
  semestar i piše samo "izborni", pa zbunjuje.
- [ ] **"Predmeti bez meta" se proverava pre osvežavanja meta** - update_nastava ispiše
  upozorenje pre koraka `scrape_subjects_meta.py` u update-nastava.yml, pa summary prijavi
  predmete kojima meta posle stigne. Proveriti posle tog koraka.
- [ ] **GitHub Actions verzije** - `actions/checkout@v4` i `actions/setup-python@v5` su na
  Node 20 (zastareo), a `ubuntu-latest` prelazi na Ubuntu 26 od 2026-10-19. Podići verzije u
  svim workflow-ima i proveriti da prođu.
- [ ] **AI druga provera rasporeda ispita** - eksperiment na grani `eksperiment/ai-provera-slika`:
  Groq qwen3.8-27b čita sliku strane, ali na celim PDF-ovima izmišlja sale i kvari nazive
  (19 i 32 lažne razlike na 2 PDF-a, $0.45). Ako se radi: jači model za slike (Claude, GPT,
  Gemini, novi ključ), isti eval, i tek uz malo lažnih uzbuna u check-fon kao issue.
  Pre eval-a proveriti cenu i keširati odgovore.


## Planirano

- [ ] **Rokovi bez podele na Ispiti/Kolokvijumi** - jedan prikaz za sve, jer kalendar sad boji
  ispitne rokove i kolokvijumske nedelje, a retko se poklapaju u vremenu. Šta sve visi o tabu
  (`Tab` u rokovi/page.tsx):
  - automatski izbor taba po datumu (efekat oko `setTab`) postaje nepotreban
  - sopstveni događaji čuvaju `tab` u localStorage-u - prikazati sve, polje ostaviti zbog starih zapisa
  - ICS i PNG izvoz (naziv fajla, filter po tipu, picker meseca/roka)
  - baner prijave ("Predispitne obaveze" / "Ispiti")
  - u kalendaru su boje po predmetu, pa treba mala oznaka ispit ili kolokvijum na terminu
  - **Loše strane:** lista postaje duža i mešana; u septembru i oktobru se preklapaju
    septembarski/oktobarski rok i kolokvijumi novog semestra (v. "oba semestra" logiku), pa
    baš tada bude najgušće; ko gleda samo ispite gubi brz filter. Moguće rešenje: jedan
    prikaz, a filter (Sve / Ispiti / Kolokvijumi) kao mali chip umesto tabova.
- [ ] **Organizacija junskog i julskog roka** - isti predmet je i u junskom i u julskom roku;
  student bira u kom roku polaže koji. Ima smisla tek kad scraper povuče oba roka (maj/jun),
  pa se odlučuje tada. Dve varijante, druga se gradi na prvoj:
  - **Pregled:** za svaki predmet oba datuma jedan pored drugog, izbor "jun / jul" (mehanika
    kao postojeće skrivanje termina, vraća se ako padne), i broj dana između izabranih ispita.
  - **Predlog po težini:** kratak upitnik (lak / srednji / težak po predmetu, jedan klik), pa
    deterministički algoritam bira kombinaciju jun/jul tako da teški ispiti imaju najviše dana
    pripreme pre sebe. Samo predlog, student ga menja; uvek i potpuno ručno poređanje.
  - AI sloj ne: matematika datuma ostaje u kodu.
- [x] **Export ispita/kolokvijuma u iCal** - `downloadICS()` u rokovi/page.tsx
- [x] **Export ispita/kolokvijuma kao slika** - `downloadPNG()`, PNG sa pickerom (mesec/ceo rok)


## Funkcionalnosti

- [x] **Deljenje rasporeda putem linka** - dugme „Podeli" na `/raspored` generiše `/deli?s=` stateless link (godina/grupa/izbor predmeta u base64url); primalac dobija ekran potvrde. Obim v1: samo predmeti (extras/beleške se ne dele)
- [x] **Napomene po predmetima** - beleška po predmetu u panelu na `/raspored` (localStorage `fon_note_<predmet>`, auto-expand textarea)
- [x] **FON kalendar aktivnosti u Rokovima** - boje dana (ispitni rok, kolokvijumske nedelje, neradni dani), obaveštenje postojećim korisnicima, prevlačenje meseca
- [x] **Donacije** - "Častiš kafu?" (Buy Me a Coffee) u feedback prozoru


## Tehničko

- [x] Unit testovi za `lib/schedule.ts` - normalizacija ćirilice, range matching, detekcija izbornih (+ `lib/subjects.ts`, `lib/storage.ts`); Vitest u CI (`npm test`)
- [x] Skeleton loading stanja - Raspored, Izmena i izbor predmeta; Rokovi ga ne trebaju (kalendar se iscrta odmah)
- [x] Prezime bez grupe - prvo se sama proba samo poslednja reč ("Ime Prezime"), pa poruka sa savetom (samo prezime, sa ili bez kvačica) i izbor grupe direktno
- [x] Audit i čišćenje `localStorage`/`sessionStorage` ključeva - svi `fon_*` ključevi centralizovani u tipizovanom `lib/storage.ts` (jedan izvor istine, SSR-safe); sva pozivna mesta migrirana
- [x] Tipovi - `strict` uključen, nijedan `any` u kodu (provereno 2026-10-03)
- [x] **`reconcileSemester` samo unapred** - stariji semestar (zastareo god.json iz keša,
  `max-age=600`) više ne briše izbor predmeta; samo noviji. Testovi u `lib/semester.test.ts`.
- [ ] **Scraper pada tiho - mora glasno.** `check_fon.py` nema nijedan `sys.exit` ni `raise`
  (provereno grepom), pa svaki otkaz završi kao zelen GitHub Actions run:
  - sajt se ne otvori → `check_fon.py:67-69` odštampa grešku i uradi `continue`
  - FON promeni sajt pa linkovi ne odgovaraju obrascu → nula PDF-ova → poruka
    „Nema novih PDF-ova." - ista ona koju daje i uredan prolaz kad stvarno nema ništa novo
  - greške se skupe u listu `errors` i samo se odštampaju

  Testovi ovo ne hvataju i ne mogu: `scripts/tests/fixtures/` su dva sačuvana PDF-a sa
  golden JSON-om, pa provera odgovara na pitanje „da li parser i dalje ume ono što je umeo".
  Čuvaju od toga da MI pokvarimo parser; ništa ne čuva od toga da FON promeni svoj sajt.

  - [x] **Nenulti izlaz** kad nijedna stranica iz `PAGES` nije dohvaćena, i kad se nađe
    nula PDF linkova a `known_pdfs.json` nije prazan (dakle ranije ih je bilo).
    Workflow tad pada, a GitHub na pao zakazani workflow šalje mejl - to je uzbuna.
    Prvi prolaz ikad (prazan `known_pdfs.json`) i uredan prolaz bez novih PDF-ova
    namerno NE pucaju.
  - [x] **Nepročitan PDF otvara GitHub issue** (2026-10-03). PDF koji je skinut, a parser
    ga nije pročitao (greška ili nula termina), ranije je samo ostajao u logu zelenog run-a
    i pokušavao se svaki dan; septembarski 2025/26 je tako danima tiho padao. Sad check_fon.py
    piše razlog u `greske_citanja.json`, a check-fon.yml otvara issue po PDF-u.
  - [ ] **„Mrtvi čovek"** - javi ako duže od N dana nema uspešnog prolaza. Namerno
    odloženo: rešenje sa heartbeat fajlom u repou traži commit na svaki prolaz, dakle
    **commit i Vercel redeploy svaki dan** samo da bi se upisao datum. Ne isplati se.
    Pravo mesto za ovo je spoljni pinger (`cron-job.org`, v. uputstvo na dnu) koji
    okida workflow i sam se žali kad izostane odgovor - jer izostanak run-a se iznutra
    ionako ne može detektovati (v. otkaz runner-a 2026-08-06/07).

  - [ ] **AI kao rezervni parser** - kad parser ne prepozna PDF (FON promeni format), AI
    čita PDF i vraća termine po strogoj JSON šemi; rezultat ide kroz `validate_data.py` kao
    i sada. Eval već postoji: PDF-ovi i tačan JSON u `scripts/tests/fixtures/`. AI ovde ima
    smisla (nestrukturisan ulaz), za razliku od predloga termina, gde je algoritam pobedio
    (v. `scripts/eval-predlog.ts`).

  - [x] **Sale iz PDF-a su se cepale i curele u susedni termin** (2026-10-03). Spisak sala
    ili naziv prelomljen u više redova je u PDF-u vertikalno centriran, pa ga čitanje po
    koordinatama reči nije znalo kom terminu da pripiše ("Amfiteatar" i "3" odvojeno, sale
    iz susednog reda). fon_exam_parser sad prvo čita ćelije tabele (`_parse_tables`), a
    koordinate su rezerva za PDF bez linija tabele. Na fixture PDF-ovima 34 razlike, sve
    proverene na slici strane; golden JSON-ovi regenerisani.

  Postojeća delimična zaštita: `check_fon.py` - PDF koji se isparsira u nula unosa
  ne upisuje se kao poznat, pa se pokušava ponovo. Pokriva promenu formata PDF-a, ne i
  promenu sajta.


## Admin i podaci

- [x] **Slepljeni nazivi predmeta** (`Poslovniinformacionisistemi`) - `merge_rok.py` ih
  automatski ispravlja po nazivima iz rasporeda nastave (`canonicalize_subjects`). Ostaju
  slepljeni samo predmeti kojih nema u nastavi; za njih bi trebala ručna mapa.
- [x] **Automatska detekcija novog rasporeda nastave** - `update-nastava.yml` (v. "Tok automatizacije")
- [ ] **Admin panel** - interfejs za ručno ažuriranje JSON fajlova sa rasporedom (upload novog semestra bez deploy-a)


## Daleka budućnost

- [ ] **Mobilna aplikacija** - native app sa svim funkcionalnostima + push notifikacije za podsetnike
- [ ] **FON hub** - agregacija FON sajta (novosti, obaveštenja, dokumenti) u jedan interfejs; zahteva scraping više izvora


## Tok automatizacije

```
1) check-fon.yml  -  svaki dan (cron 10:07/11:07/12:07 po Beogradu)
   |
   v
   check_fon.py (scraper)
   |  otvori FON: raspored-kolokvijuma + raspored-ispita
   |  za svaki PDF koji NIJE u known_pdfs.json:
   |     skini → parsiraj → merge_rok.py (kanonski nazivi po nastavi) → rokovi.json
   |  ako ima novih → zapiši ih u pending_notify.json (nije u repou)
   v
   scrape_kalendar.py → kalendar.json (ako padne: stari ostaje + GitHub issue)
   v
   commit + push (rokovi.json, known_pdfs.json, kalendar.json)
   v
   ako ima novih rokova: čekaj da sajt servira novi rokovi.json, pa još 10 min (keš browsera)
   v
   send_push.mjs new        → "Novi raspored…" svima (iz pending_notify.json)
   send_push.mjs reminders  → podsetnik ako prijava nekog roka počinje/ističe danas
                              (dedup preko Upstash: jednom dnevno)
   [koraci za notifikacije rade samo ako su secrets podešeni → HAS_PUSH]

2) update-nastava.yml  -  na 30 min u sep/okt/feb/mar, i ručno
   |  --check: ima li na FON-u noviji semestar ili nova verzija objavljenog
   |  ako ima: update_nastava.py → fon_parser.py → 1god..4god.json, osveži plan modula,
   |  validate_data.py
   v
   provera prošla → objava direktno na main → pokrene notify-nastava.yml
   provera pala  → PR sa izveštajem; upozorenja → GitHub issue

3) notify-nastava.yml  -  posle objave god.json na main
   nov semestar → "Objavljen je raspored"; isti semestar sa novim predmetima → "Ponovo je
   objavljen"; samo ispravke → ništa. Čeka da sajt servira novu verziju, pa još 10 min.

4) osvezi-plan.yml  -  ponedeljkom ~7:17
   plan.json + subjects-meta.json sa FON sajta; posle provere objava sama, ako padne GitHub mejl
```

Gde se šta čuva:
- `public/data/rokovi.json` - ispiti/kolokvijumi + `prijava_datumi` po roku
- `public/data/{1..4}god.json` - raspored nastave (izvor izbornih predmeta); `god-{sem}.json` arhiva po semestru
- `public/data/kalendar.json` - FON kalendar aktivnosti (boje dana u Rokovima)
- `public/data/plan.json`, `subjects-meta.json` - plan modula i podaci o predmetima
- `scripts/known_pdfs.json`, `scripts/known_nastava.json` - već viđeni PDF-ovi (da zna šta je „novo")
- Upstash Redis - pretplate (`push:subs`) + dedup markeri (`sent:<datum>:<tag>` za podsetnike, `sent:<tag>` za nastavu)


## Uputstvo: cron-job.org (ako zatreba pouzdaniji cron)

GitHub cron ume da kasni ili preskoči run. Ako to postane problem, `cron-job.org` može
da okida `check-fon.yml` (a usput služi i kao "mrtvi čovek", v. "Tehničko").

### 1. Napravi GitHub token (PAT)

`GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token`

- **Repository access:** `Only select repositories → dukanx/fon-raspored`
- **Permissions:** `Repository → Actions: Read and write`
- **Expiration:** po želji (npr. 1 godina)

Sačuvaj generisani token (`github_pat_...`) - prikazaće se samo jednom. Token je tajna:
ne ide u repo, koristi se samo unutar `cron-job.org`.

### 2. Napravi posao na cron-job.org

Napravi nalog na `cron-job.org` i klikni **Create cronjob**.

- **URL:** `https://api.github.com/repos/dukanx/fon-raspored/actions/workflows/check-fon.yml/dispatches`
- **Schedule:** svaki dan u **10:00**, a u podešavanjima naloga timezone `Europe/Belgrade`
- **Request method:** `POST`
- **Request body:** `{"ref":"main"}`
- **Headers:**

```txt
Accept: application/vnd.github+json
Authorization: Bearer github_pat_TVOJ_TOKEN
X-GitHub-Api-Version: 2022-11-28
```

Ako je sve dobro podešeno, GitHub vraća `HTTP 204`, što `cron-job.org` prikaže kao `OK`.
Provera: **Run now** u `cron-job.org`, pa novi run u GitHub Actions.

### 3. (Opciono) smanji GitHub cron

Kad `cron-job.org` pouzdano okida u 10h, GitHub cron pokušaji su samo rezerva: mogu da
ostanu kako jesu ili samo jedan. Dedup sprečava duple notifikacije u oba slučaja.
