# TODO — FON Raspored

## Funkcionalnosti

- [ ] **Deljenje rasporeda putem linka** — URL sa enkodiranim parametrima (godina, program, grupa, izborni predmeti) kako bi student mogao da podeli tačno svoj raspored
- [ ] **Napomene po predmetima** — mogućnost dodavanja kratkih beleški na svaki predmet u rasporedu (npr. "doneti laptop", "ispit u januaru")
- [ ] **PWA podrška** — manifest, service worker, offline prikaz poslednjeg rasporeda

---

## Veliki update: Ispitni i kolokvijumski rokovi

- [ ] Prikaz ispitnog roka po godini/programu (analogno trenutnom rasporedu)
- [ ] Prikaz kolokvijumskog roka
- [ ] Integracija sa postojećim izgledom (nova ruta ili tab unutar `/raspored`)
- [ ] Export ispitnog roka u ICS (Google Calendar, Outlook)
- [ ] Automatsko isticanje predmeta iz ispitnog roka koji student ima u svom rasporedu

---

## Tehničko

- [ ] Unit testovi za `lib/schedule.ts` — pokriti logiku normalizacije ćirilice, range matching i detekciju izbornih predmeta
- [ ] Skeleton loading stanja na `/raspored` i `/preneseni` za sporije konekcije
- [ ] Bolje rukovanje greškom kada prezime ne odgovara nijednoj grupi — jasna poruka korisniku sa sugestijom
- [ ] Audit i čišćenje `localStorage`/`sessionStorage` ključeva — dokumentovati šta se čuva i kada se briše
- [ ] Poboljšati tipove — smanjiti `any` i neeksplicitne tipove tamo gde postoje

---

## Admin i podaci

- [ ] **Admin panel** — interfejs za ručno ažuriranje JSON fajlova sa rasporedom (upload novog semestra bez deploy-a)
- [ ] **Automatska detekcija promene semestra** — web scraping ili praćenje FON sajta za nove rasporede; pošto su fajlovi PDF, istražiti pipeline: scraper skida PDF → Python skripta parsira i generiše JSON → fajl se automatski ažurira

---

## Daleka budućnost

- [ ] **Mobilna aplikacija** — native app sa svim funkcionalnostima + push notifikacije za podsetnike
- [ ] **FON hub** — agregacija FON sajta (novosti, obaveštenja, dokumenti) u jedan interfejs; zahteva scraping više izvora

