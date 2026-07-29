# Prevrtanje semestra — tri rupe pri flipu

Kontekst: app čuva studentov izbor predmeta u `localStorage`, po grupi. Kad FON
objavi novi raspored, pipeline pregazi `god.json` i **semestar se prevrne**
(npr. `Letnji 2025/26` → `Zimski 2026/27`). Grupni ID (`A5`, `D4`...) se pritom
može poklopiti sa starim, pa se stari izbor "zalepi" za novi semestar.

Dva filtera se ponašaju suprotno kad naiđu na **nepoznat** predmet:

- **Raspored = fail-open**: nepoznat predmet se *prikaže*.
  `base = saved ? all.filter(e => checked[e.subject] !== false) : all`
  → `checked["Novi predmet"]` je `undefined`, `!== false` je `true` → prikaže se.
- **Rokovi = fail-closed**: nepoznat predmet se *sakrije*.
  `if (userSubjects && !userSubjects.has(e.subject)) return false`
  → nema ga u setu → sakriven.

Zbog te asimetrije, ustajali `localStorage` tiho **krije** termine u rokovima.
Ispod su tri konkretne rupe i kako su rešene.

---

## Rupa 1 — Ustajala mapa predmeta (`fon_subjects_${group}`)

**Problem.** Posle flipa, `fon_subjects_${group}` sadrži nazive predmeta *starog*
semestra. Rokovi filter (fail-closed) sakrije svaki termin čiji predmet nije u tom
setu — dakle sve nove predmete.

**Primer.**
Marko je u letnjem 2025/26, grupa `A5`. Sačuvano:
```
fon_subjects_A5 = { "Matematika 2": true, "Principi programiranja": true }
```
U oktobru app pređe na `Zimski 2026/27`. Grupa `A5` i dalje postoji (drugi opseg
prezimena, ali isti ID). Marko sad sluša "Baze podataka", "Operativni sistemi"...
- Raspored: prikaže nove predmete (fail-open) — izgleda OK.
- Rokovi: za januarski rok `userSubjects = {"Matematika 2","Principi programiranja"}`,
  pa se "Baze podataka" **ne pojavi** iako Marko ima ispit. Tiho sakriveno.

**Rešeno.** `izborni` poredi `data.semester` sa `fon_saved_semester`. Na flip:
```
localStorage.removeItem(`fon_subjects_${group}`)   // -> userSubjects postaje null
```
`userSubjects === null` znači rokovi prelaze u fail-open (prikaži sve) dok Marko
ponovo ne izabere predmete. Bezbedno prelazno stanje: bolje višak nego manjak.

---

## Rupa 2 — Ustajali izbor drugog semestra (`fon_other_sem_${group}`)

**Problem.** Picker "Predmeti iz drugog semestra" (za Sep/Okt rok) upisuje izbor u
`fon_other_sem_${group}`. Posle flipa taj izbor pripada *pogrešnom* semestru i
visi kao šum u uniji `userSubjects`.

**Primer.**
U letnjem 2025/26 Marko u pickeru štiklira zimski predmet "Baze podataka 2"
(ponavlja ga u septembru):
```
fon_other_sem_A5 = ["Baze podataka 2"]
```
Dođe zimski 2026/27. Sad "Baze podataka 2" možda uopšte nije relevantna (položio ju
je, ili je to sad njegov redovan predmet). Stari unos i dalje ulazi u filter i
prikazuje termine koje Marko ne želi.

**Primer 2 (labela).** Picker izvodi "drugi semestar" iz `data.semester`
(`Letnji…` → nudi `zimski`, `Zimski…` → nudi `letnji`). Ako se stari izbor ne
obriše, u zimskom bi mešao letnje odabране predmete sa novim kontekstom.

**Rešeno.** Na isti flip:
```
localStorage.removeItem(`fon_other_sem_${group}`)
```

---

## Rupa 3 — Istorija raste zauvek (`fon_subjects_history`)

**Problem.** `fon_subjects_history = { [semester]: string[] }` akumulira izbor po
semestru da bi mešani Sep/Okt rok mogao da unira oba semestra. Bez orezivanja, tu
zauvek ostaju predmeti od pre više godina i doveka se pojavljuju u rok-filteru.

**Primer.**
Posle 3 godine korišćenja:
```
fon_subjects_history = {
  "Zimski 2024/25": ["Sociologija"],       // 1. godina, davno položeno
  "Letnji 2024/25": ["Psihologija"],
  "Zimski 2025/26": ["Menadžment"],
  "Letnji 2025/26": ["Matematika 2"],
}
```
Kad 2027. dođe septembarski rok, "Sociologija" (1. godina) se i dalje uklapa u
filter i prikazuje se, iako je Marko odavno položio i više je ne polaže.

**Zašto prošla godina MORA da ostane.** Septembarski/oktobarski rok pripada
*staroj* školskoj godini (npr. Sep/Okt 2027 = ispiti za 2026/27), a app je tad već
prešao u novu (`Zimski 2027/28`). Ako obrišemo prošlu godinu, izgubimo baš predmete
koji su relevantni za taj rok.

**Rešeno.** Pri potvrdi izbora, orezuj na **tekuću + prošlu** školsku godinu:
```
const ayStart = (s) => parseInt(s.match(/(\d{4})\/\d{2}/)?.[1] ?? '', 10)
const current = ayStart(semester)          // "Zimski 2026/27" -> 2026
for (const key of Object.keys(hist))
  if (ayStart(key) < current - 1) delete hist[key]   // < 2025 se briše
```
Rezultat za primer iznad, po potvrdi u `Zimski 2026/27`:
- obriše se: `Zimski 2024/25`, `Letnji 2024/25` (godina 2024 < 2025)
- ostaje: `Zimski 2025/26`, `Letnji 2025/26`, + novi `Zimski 2026/27`

---

---

## Reset na flip + "Nov semestar" popup

Umesto da samo krpimo ustajali `localStorage`, na **pravi** flip resetujemo izbor
predmeta i eksplicitno tražimo od studenta da izabere ponovo (raspored se stvarno
promenio). Kredencijali (grupa/prezime/smer) i istorija OSTAJU.

Sva logika je u [`lib/semester.ts`](../lib/semester.ts):

- `reconcileSemester(sem, group)` — ako se `sem` razlikuje od `fon_saved_semester`:
  obriše `fon_subjects_${group}` + `fon_other_sem_${group}`, upiše novi
  `fon_saved_semester`, i digne `fon_flip_pending`. Vraća `true` na flip.
- `isFlipPending(sem)` / `acknowledgeFlip()` — kontrola popupa.

**Detekcija je po `semester` STRINGU** (`"Zimski 2026/27"`), ne po sadržaju PDF-a:

- FON objavi original pa nedelju dana kasnije izmeni raspored → string **isti** →
  **nema** lažnog flipa. ✓
- Letnji→Zimski ili nova školska godina → string se menja → flip. ✓

**Popup** (`raspored`, ekran na koji svi padnu): "Nov semestar — proveri predmete",
sa CTA *Izaberi predmete* (→ `izborni`) i *Kasnije* (zatvori). Pokaže se **jednom
po flipu** — `fon_flip_pending` preživi reload dok ga `acknowledgeFlip()` ne obriše
(na CTA, na "Kasnije", ili kad student potvrdi izbor u `izborni`). Dok ne izabere,
filteri su fail-open (prikaži sve) — ništa se ne krije.

`izborni` zove isti `reconcileSemester` (fallback za direktnu navigaciju), a
`handleConfirm` zove `acknowledgeFlip()`.

---

## Picker "drugi semestar" — samo u letnjem

Picker se prikazuje **samo kad je aktivan letnji** (uvek nudi zimske predmete).
Razlog: mešani Sep/Okt rok uvek padne dok je app u letnjem i traži zimske
predmete (ponavljanja). U zimskom je picker suvišan (jan/feb je čisto zimski) i
samo zbunjuje. Novajlija koji uđe u maju i dalje može da doda zimske za septembar
— to je i bila glavna vrednost pickera; istorija to ne pokriva jer nije bio
aktivan zimus.

---

## Preostala ograničenja (svesno prihvaćena)

1. **U zimskom semestru `god-letnji.json` je prošlogodišnji letnji** (osveži se
   tek u martu) — ali picker se u zimskom ionako ne prikazuje, pa nije problem.

2. **Sinhrono čitanje `localStorage` pre `fetch`.** Persist-efekat za
   `otherSelected` upiše `[]` pre nego što `fetch` stigne; async čitanje u
   `.then()` bi videlo pregaženu vrednost. Zato se `fon_subjects_*` i
   `fon_other_sem_*` čitaju sinhrono na početku efekta.
