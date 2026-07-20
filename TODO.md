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

- [ ] **Deljenje rasporeda putem linka** — URL sa enkodiranim parametrima (godina, program, grupa, izborni predmeti) kako bi student mogao da podeli tačno svoj raspored
- [ ] **Napomene po predmetima** — mogućnost dodavanja kratkih beleški na svaki predmet u rasporedu (npr. "doneti laptop", "ispit u januaru")


---

## Poboljsanje rokova
- [ ] Export ispitnog roka u ICS (Google Calendar, Outlook)


---

## Tehničko

- [ ] Unit testovi za `lib/schedule.ts` — pokriti logiku normalizacije ćirilice, range matching i detekciju izbornih predmeta
- [ ] Skeleton loading stanja na `/raspored` i `/preneseni` za sporije konekcije
- [ ] Bolje rukovanje greškom kada prezime ne odgovara nijednoj grupi — jasna poruka korisniku sa sugestijom
- [ ] Audit i čišćenje `localStorage`/`sessionStorage` ključeva — dokumentovati šta se čuva i kada se briše. *(Delimično urađeno: ključevi vezani za semestar + reset na promenu semestra dokumentovani u `docs/rokovi-semestar-flip.md`; ostaje pun audit svih ključeva.)*
- [ ] Poboljšati tipove — smanjiti `any` i neeksplicitne tipove tamo gde postoje

---

## Admin i podaci

- [ ] **Ručna ispravka slepljenih naziva predmeta** — neki FON ispitni PDF-ovi (npr. junski) imaju izgubljene razmake u nazivu (`Poslovniinformacionisistemi`, `Poslovnopravo`). U izvoru nema razmaka pa se ne mogu razdvojiti automatski. Plan: mapa `slepljeno -> tačno` (npr. `scripts/subject_fixes.json`) koja se primenjuje pri parsiranju; dopunjava se ručno kako se uoče novi slučajevi. (Datum/vreme/sala su tačni — ovo je samo naziv.)
- [ ] **Admin panel** — interfejs za ručno ažuriranje JSON fajlova sa rasporedom (upload novog semestra bez deploy-a)
- [ ] **Automatska detekcija promene semestra** — web scraping ili praćenje FON sajta za nove rasporede; pošto su fajlovi PDF, istražiti pipeline: scraper skida PDF → Python skripta parsira i generiše JSON → fajl se automatski ažurira

---

## Daleka budućnost

- [ ] **Mobilna aplikacija** — native app sa svim funkcionalnostima + push notifikacije za podsetnike
- [ ] **FON hub** — agregacija FON sajta (novosti, obaveštenja, dokumenti) u jedan interfejs; zahteva scraping više izvora
