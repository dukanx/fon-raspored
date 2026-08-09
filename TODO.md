# TODO


## Sledeći korak

Ako bude trebalo pouzdanije zakazivanje od GitHub cron-a, možeš da koristiš `cron-job.org`.

### 1. Napravi GitHub token (PAT)

Idi na:

`GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token`

Podesi:

- **Repository access:** `Only select repositories → dukanx/fon-raspored`
- **Permissions:** `Repository → Actions: Read and write`
- **Expiration:** po želji (npr. 1 godina)

Sačuvaj generisani token (`github_pat_...`) — prikazaće se samo jednom.

---

### 2. Napravi posao na cron-job.org

Napravi nalog na `cron-job.org` i klikni **Create cronjob**.

#### URL

```txt
https://api.github.com/repos/dukanx/fon-raspored/actions/workflows/check-fon.yml/dispatches


#### Schedule

Podesi izvršavanje svaki dan u **10:00**.

U podešavanjima naloga obavezno postavi timezone na:

```txt
Europe/Belgrade
```

da bi vreme bilo tačno po lokalnom vremenu.

---

### 3. Request settings

U sekciji **Advanced / Request settings** podesi:

#### Request method

```txt
POST
```

#### Request body

```json
{"ref":"main"}
```

#### Headers

```txt
Accept: application/vnd.github+json
Authorization: Bearer github_pat_TVOJ_TOKEN
X-GitHub-Api-Version: 2022-11-28
```

Ako je sve dobro podešeno, GitHub vraća:

```txt
HTTP 204
```

što će `cron-job.org` prikazati kao uspešan run (`OK`).

Nakon toga ćeš videti workflow run u GitHub Actions.

---

### 4. (Opciono) smanji GitHub cron

Pošto `cron-job.org` pouzdano okida workflow u 10h, postojeći GitHub cron pokušaji postaju manje bitni.

Možeš:

* da ih ostaviš kako jesu
* ili da ostaviš samo jedan backup pokušaj

Na primer:

```cron
0 7 11 * * *
```

Dedup logika već sprečava duple notifikacije, tako da oba pristupa rade bez problema.

---

## Napomena

GitHub token je tajna:

* ne ide u repo
* ne commit-uje se
* koristi se samo unutar `cron-job.org`

Najlakša provera je:

1. klik na **Run now** u `cron-job.org`
2. proveri da li se pojavio novi run u GitHub Actions

```
```


## Tok automatizacije

Dve odvojene automatizacije:

```
1) check-fon.yml  —  AUTOMATSKI svaki dan (cron 10:07/11:07/12:07 + cron-job.org)
   |                  (radi i scraping i notifikacije)
   v
   check_fon.py (scraper)
   |  otvori FON: raspored-kolokvijuma + raspored-ispita
   |  za svaki PDF koji NIJE u known_pdfs.json:
   |     skini → parsiraj → dopiši u rokovi.json → upiši URL u known_pdfs.json
   |  ako ima novih → zapiši ih u pending_notify.json
   v
   commit + push (rokovi.json, known_pdfs.json)
   v
   send_push.mjs new        → ako pending_notify.json postoji: "Novi raspored…" svima
   send_push.mjs reminders  → ako neki rok ima prijavu (početak/kraj) == DANAS: podsetnik
                              (dedup preko Upstash: jednom dnevno)
   [koraci za notifikacije rade samo ako su secrets podešeni → HAS_PUSH]

2) update-nastava.yml  —  RUČNO (Run workflow), ~4x godišnje
   |
   v
   update_nastava.py → nađe PDF-ove na raspored-nastave → fon_parser.py
   → regeneriše 1god..4god.json (uz sigurnosnu proveru) → otvori Pull Request
```

Gde se šta čuva:
- `public/data/rokovi.json` — ispiti/kolokvijumi + `prijava_datumi` po roku
- `public/data/{1..4}god.json` — raspored nastave (izvor izbornih predmeta)
- `scripts/known_pdfs.json` — već viđeni PDF-ovi (da zna šta je „novo")
- Upstash Redis — pretplate (`push:subs`) + dedup marker (`sent:<datum>:<tag>`)

## Redosled rada (dogovoreno)

1. **Deljenje rasporeda putem linka** (share) — vidi „Funkcionalnosti"
2. **Export ispita/kolokvijuma u iCal**
3. **Unit testovi za `lib/schedule.ts`** — vidi „Tehničko"
4. **Organizacija ispitnih rokova (jun/jul)** — vidi „Planirano"

## Planirano

- [ ] **Organizacija ispitnih rokova (jun/jul)** — isti predmet je obično i u junskom i u julskom roku; student bira u kom roku polaže koji, da rasporedi pripremu.
  - **Ručni izbor:** sakrij/izaberi termin po predmetu; sakriveni se mogu vratiti (ako padne, vraća drugi rok). Mehanika kao postojeće skrivanje termina (localStorage).
  - **Pametni predlog (bez AI):** opcioni unos težine / dana pripreme po predmetu → deterministički algoritam predlaže koje u prvi a koje u drugi rok, maksimalno razmaknuto. Uvek mora postojati i opcija za potpuno samostalno poređanje.
  - **AI sloj (kasnije, opciono):** Groq objašnjava predlog / hvata neodređene želje. Matematika datuma OSTAJE u kodu (LLM je nepouzdan za to).
  - Aktivira se tek kad scraper povuče i junski i julski rok.
- [ ] **Export ispita/kolokvijuma u iCal** — kao za raspored nastave
- [ ] **Export ispita/kolokvijuma kao slika** — kao za raspored nastave


# TODO — FON Raspored

## Funkcionalnosti

- [x] **Deljenje rasporeda putem linka** — dugme „Podeli" na `/raspored` generiše `/deli?s=` stateless link (godina/grupa/izbor predmeta u base64url); primalac dobija ekran potvrde. Obim v1: samo predmeti (extras/beleške se ne dele)
- [x] **Napomene po predmetima** — beleška po predmetu u panelu na `/raspored` (localStorage `fon_note_<predmet>`, auto-expand textarea)


---

## Poboljsanje rokova
- [ ] Export ispitnog roka u ICS (Google Calendar, Outlook)


---

## Tehničko

- [x] Unit testovi za `lib/schedule.ts` — normalizacija ćirilice, range matching, detekcija izbornih (+ `lib/subjects.ts`, `lib/storage.ts`); Vitest u CI (`npm test`)
- [ ] Skeleton loading stanja na `/raspored` i `/preneseni` za sporije konekcije
- [ ] Bolje rukovanje greškom kada prezime ne odgovara nijednoj grupi — jasna poruka korisniku sa sugestijom
- [x] Audit i čišćenje `localStorage`/`sessionStorage` ključeva — svi `fon_*` ključevi centralizovani u tipizovanom `lib/storage.ts` (jedan izvor istine, SSR-safe); sva pozivna mesta migrirana
- [ ] Poboljšati tipove — smanjiti `any` i neeksplicitne tipove tamo gde postoje
- [ ] **Scraper pada tiho — mora glasno.** `check_fon.py` nema nijedan `sys.exit` ni `raise`
  (provereno grepom), pa svaki otkaz završi kao zelen GitHub Actions run:
  - sajt se ne otvori → `check_fon.py:67-69` odštampa grešku i uradi `continue`
  - FON promeni sajt pa linkovi ne odgovaraju obrascu → nula PDF-ova → poruka
    „Nema novih PDF-ova." — ista ona koju daje i uredan prolaz kad stvarno nema ništa novo
  - greške se skupe u listu `errors` i samo se odštampaju

  Testovi ovo ne hvataju i ne mogu: `scripts/tests/fixtures/` su dva sačuvana PDF-a sa
  golden JSON-om, pa provera odgovara na pitanje „da li parser i dalje ume ono što je umeo".
  Čuvaju od toga da MI pokvarimo parser; ništa ne čuva od toga da FON promeni svoj sajt.

  Plan:
  1. nenulti izlaz kad nijedna stranica iz `PAGES` nije dohvaćena, i kad se na stranici
     nađe nula PDF linkova (a `known_pdfs.json` nije prazan — dakle ranije ih je bilo)
  2. „mrtvi čovek": ako duže od N dana nema uspešnog prolaza, javi (notifikacija ili
     issue), jer izostanak run-a niko ne primeti — v. otkaz runner-a 2026-08-06/07

  Postojeća delimična zaštita: `check_fon.py:124` — PDF koji se isparsira u nula unosa
  ne upisuje se kao poznat, pa se pokušava ponovo. Pokriva promenu formata PDF-a, ne i
  promenu sajta.

---

## Admin i podaci

- [ ] **Ručna ispravka slepljenih naziva predmeta** — neki FON ispitni PDF-ovi (npr. junski) imaju izgubljene razmake u nazivu (`Poslovniinformacionisistemi`, `Poslovnopravo`). U izvoru nema razmaka pa se ne mogu razdvojiti automatski. Plan: mapa `slepljeno -> tačno` (npr. `scripts/subject_fixes.json`) koja se primenjuje pri parsiranju; dopunjava se ručno kako se uoče novi slučajevi. (Datum/vreme/sala su tačni — ovo je samo naziv.)
- [ ] **Admin panel** — interfejs za ručno ažuriranje JSON fajlova sa rasporedom (upload novog semestra bez deploy-a)
- [ ] **Automatska detekcija promene semestra** — web scraping ili praćenje FON sajta za nove rasporede; pošto su fajlovi PDF, istražiti pipeline: scraper skida PDF → Python skripta parsira i generiše JSON → fajl se automatski ažurira

---

## Daleka budućnost

- [ ] **Mobilna aplikacija** — native app sa svim funkcionalnostima + push notifikacije za podsetnike
- [ ] **FON hub** — agregacija FON sajta (novosti, obaveštenja, dokumenti) u jedan interfejs; zahteva scraping više izvora
