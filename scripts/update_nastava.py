#!/usr/bin/env python3
"""
Orkestrator za ažuriranje rasporeda nastave (public/data/{1,2,3,4}god.json).

Čita FON stranicu sa rasporedom, pronalazi fajlove za izabrani semestar
(po TEKSTU linka, ne po imenu fajla - pa radi i kad se ime/datum promeni),
skida ih, parsira i upisuje god.json - uz sigurnosnu proveru da regeneracija
ne izgubi predmete/grupe. PDF čita fon_parser; kad za godinu nema PDF-a, a ima
Word (.docx), čita ga fon_docx.

Pokretanje:
  python scripts/update_nastava.py                # auto semestar po mesecu
  python scripts/update_nastava.py --semester letnji
  python scripts/update_nastava.py --years 4 --force
  python scripts/update_nastava.py --check        # samo: ima li šta novo na FON-u
"""

import argparse
import hashlib
import os
import re
import sys
import tempfile
import urllib.request
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

DATA_DIR = SCRIPTS_DIR.parent / "public" / "data"
PAGE_URL = "https://oas.fon.bg.ac.rs/raspored-nastave/"
ROMAN = {"IV": 4, "III": 3, "II": 2, "I": 1}
UA = {"User-Agent": "Mozilla/5.0 (fon-raspored bot)"}
# Linkovi iz kojih je napravljen objavljeni raspored (v. check_updated).
KNOWN_PATH = SCRIPTS_DIR / "known_nastava.json"


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=60).read()
    return data if binary else data.decode("utf-8", "replace")


# Otisak (sha256) svakog skinutog fajla, po URL-u. Pamti se u known_nastava.json,
# da bi se prepoznalo i kad FON pregazi fajl na istoj adresi.
_DIGESTS = {}


def download(url):
    data = fetch(url, binary=True)
    _DIGESTS[url] = hashlib.sha256(data).hexdigest()
    return data


def digest(url):
    """sha256 fajla sa adrese (skida ga ako već nije skinut)."""
    if url not in _DIGESTS:
        download(url)
    return _DIGESTS[url]


def auto_semester():
    # mart-septembar -> letnji, ostalo -> zimski
    return "letnji" if 3 <= date.today().month <= 9 else "zimski"


def academic_year(html):
    m = re.search(r"[Шш]колск\w*\s+годин\w*\s+(\d{4}/\d{2})", html)
    return m.group(1) if m else ""


def _azurirano_date(text):
    """Vraća (mesec, dan) iz '(ажурирано DD.MM.)' ili (0,0) ako nema."""
    m = re.search(r"ажурирано\s*(\d{1,2})\.(\d{1,2})", text)
    return (int(m.group(2)), int(m.group(1))) if m else (0, 0)


def resolve_files(html, semester):
    """Vraća {year: {'raspored': url, 'grupe': url}} za dati semestar.

    PDF ima prednost. Word (.docx) se uzima samo kad za tu godinu nema PDF-a,
    pa kad FON objavi i PDF, automatski se prelazi na njega."""
    soup = BeautifulSoup(html, "html.parser")
    anchors = [
        (" ".join(a.get_text().split()), a["href"])
        for a in soup.find_all("a", href=True)
        if a["href"].lower().endswith((".pdf", ".docx"))
    ]

    sched = {}  # year -> ((je_pdf, ažurirano), url)
    grupe = {}  # year -> (je_pdf, url)
    for text, href in anchors:
        if semester not in href.lower():
            continue
        # preskoči nedeljne/online izmene i staru akreditaciju
        if "акредитација" in text or "online" in href.lower() \
                or "недељи" in text or " до " in f" {text} ":
            continue
        is_pdf = href.lower().endswith(".pdf")

        m = re.search(r"Распоред наставе за (IV|III|II|I) годину", text)
        if m:
            y = ROMAN[m.group(1)]
            # PDF pobeđuje Word, a među istim formatom najnoviji "ažurirano"
            # datum; bez datuma -> (0,0)
            key = (is_pdf, _azurirano_date(text))
            if y not in sched or key > sched[y][0]:
                sched[y] = (key, href)

        g = re.search(r"Групе за слушање наставе за (IV|III|II|I) годину", text)
        if g:
            y = ROMAN[g.group(1)]
            if y not in grupe or (is_pdf and not grupe[y][0]):
                grupe[y] = (is_pdf, href)

    return {
        y: {"raspored": sched[y][1], "grupe": grupe[y][1] if y in grupe else None}
        for y in sched
    }


def next_semester(published):
    """Semestar posle objavljenog: 'Letnji 2025/26' -> ('zimski', '2026/27'),
    'Zimski 2026/27' -> ('letnji', '2026/27'). None za nepoznat format."""
    m = re.match(r"^(Zimski|Letnji)\s+(\d{4})/\d{2}$", published.strip(), re.I)
    if not m:
        return None
    start = int(m.group(2))
    if m.group(1).lower() == "letnji":
        return "zimski", f"{start + 1}/{(start + 2) % 100:02d}"
    return "letnji", f"{start}/{(start + 1) % 100:02d}"


def _upload_month(href):
    """(godina, mesec) iz WordPress putanje .../uploads/YYYY/MM/..., ili None."""
    m = re.search(r"/uploads/(\d{4})/(\d{2})/", href)
    return (int(m.group(1)), int(m.group(2))) if m else None


def _fresh_files(html, kind, ay, years):
    """Fajlovi semestra za sve tražene godine, ili None ako nešto fali ili je
    staro. Stranica mora da kaže da je školska godina `ay`, a fajlovi ne smeju
    biti uploadovani pre te školske godine (kad putanja ima datum)."""
    if academic_year(html) != ay:
        return None
    start = int(ay[:4])
    # Najraniji mesec kad može biti uploadovan fajl za taj semestar.
    earliest = (start, 6) if kind == "zimski" else (start, 11)
    files = resolve_files(html, kind)
    for y in years:
        if y not in files:
            return None
        uploaded = _upload_month(files[y]["raspored"])
        if uploaded and uploaded < earliest:
            return None
    return {y: files[y] for y in years}


def check_new(html, published, years):
    """Da li FON nudi semestar noviji od objavljenog? Vraća 'zimski'/'letnji' ili None.

    Nije dovoljno da stranica ima fajlove tog semestra: prošlogodišnji zimski
    mogu da stoje na stranici i posle letnjeg, pa bi bili parsirani kao nov
    semestar i otišao bi lažan push. Zato se traži i školska godina (v.
    _fresh_files). Traže se rasporedi za sve tražene godine, da se ne bi
    objavio samo deo.
    """
    nxt = next_semester(published)
    if not nxt:
        return None
    kind, ay = nxt
    return kind if _fresh_files(html, kind, ay, years) else None


def _current(published):
    """'Zimski 2026/27' -> ('zimski', '2026/27')."""
    m = re.match(r"^(Zimski|Letnji)\s+(\d{4}/\d{2})$", published.strip(), re.I)
    return (m.group(1).lower(), m.group(2)) if m else None


def files_snapshot(files, hashes=None):
    """Oblik koji se čuva u known_nastava.json (ključevi godina su stringovi).
    Uz `hashes` ({url: sha256}) čuva i otisak sadržaja svakog fajla."""
    out = {}
    for y, f in sorted(files.items()):
        entry = {"raspored": f["raspored"], "grupe": f["grupe"]}
        if hashes is not None:
            for key in ("raspored", "grupe"):
                if f[key] in hashes:
                    entry[f"{key}_sha"] = hashes[f[key]]
        out[str(y)] = entry
    return out


def check_updated(html, published, years, known, digest_fn=None):
    """Da li je FON ponovo objavio već objavljeni semestar (npr. dopuna sa
    izbornim predmetima, ili izmena sala i termina)? Poredi linkove sa onima iz
    kojih je napravljen objavljeni raspored (known_nastava.json), a uz
    `digest_fn` (url -> sha256) i sadržaj, pa vidi i fajl pregažen na istoj
    adresi. Vraća semestar ili None."""
    cur = _current(published)
    if not cur:
        return None
    kind, ay = cur
    files = _fresh_files(html, kind, ay, years)
    if not files:
        return None
    if known.get("semester") != published:
        return None  # bez zapisa o objavljenom semestru ne znamo šta je novo
    known_files = known.get("files", {})
    now = files_snapshot(files)
    for y, links in now.items():
        old = known_files.get(y, {})
        if any(links[k] != old.get(k) for k in ("raspored", "grupe")):
            return kind
        if digest_fn is None:
            continue
        for key in ("raspored", "grupe"):
            # Bez sačuvanog otiska (stariji zapis) nema sa čim da se poredi.
            if links[key] and old.get(f"{key}_sha") and digest_fn(links[key]) != old[f"{key}_sha"]:
                return kind
    return None


def check(html, published, years, known, digest_fn=None):
    """'zimski'/'letnji' ako ima šta da se parsira (nov semestar ili nova
    verzija objavljenog), inače None."""
    return check_new(html, published, years) or check_updated(html, published, years, known, digest_fn)


def build_year(raspored_url, grupe_url, year, semester_str):
    """Skine fajlove i vrati (parsiran dict kao fon_parser, lista problema)."""
    # Ovde, ne na vrhu: --check ne treba pdfplumber, pa ga workflow
    # instalira tek kad ima šta da se parsira.
    import fon_parser
    problems = []
    with tempfile.TemporaryDirectory() as td:
        if raspored_url.lower().endswith(".docx"):
            import fon_docx
            groups = {}
            if grupe_url:
                gp = Path(td) / "grupe.docx"
                gp.write_bytes(download(grupe_url))
                groups = fon_docx.parse_groups(str(gp))
            rp = Path(td) / "raspored.docx"
            rp.write_bytes(download(raspored_url))
            lines = fon_docx.extract_lines(str(rp))
            entries = fon_parser.parse_schedule_lines(lines, groups or None)
            # Word je rezervni put: ako ijedna linija sa vremenom nije postala
            # termin, FON je promenio format i radije ne upisujemo ništa.
            expected = fon_docx.count_time_lines(lines)
            if len(entries) != expected:
                problems.append(f"Word: {expected} linija sa vremenom, a {len(entries)} termina")
            if any(not e["groups"] for e in entries):
                problems.append("Word: ima termina bez ijedne poznate grupe")
        else:
            rp = Path(td) / "raspored.pdf"
            rp.write_bytes(download(raspored_url))
            groups = {}
            if grupe_url and grupe_url.lower().endswith(".pdf"):
                gp = Path(td) / "grupe.pdf"
                gp.write_bytes(download(grupe_url))
                groups = fon_parser.parse_groups_pdf(str(gp))
            elif grupe_url:
                import fon_docx
                gp = Path(td) / "grupe.docx"
                gp.write_bytes(download(grupe_url))
                groups = fon_docx.parse_groups(str(gp))
            lines = fon_parser.extract_all_lines(str(rp))
            entries = fon_parser.parse_schedule_lines(lines, groups or None)
    return {
        "semester": semester_str,
        "year": year,
        "groups": groups,
        "entries": entries,
    }, problems


def load_existing(path):
    import json
    if path and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def check_regression(new, compare_path):
    """Vraća listu problema (prazno = OK) poredeći sa postojećim fajlom."""
    problems = []
    if not new["entries"]:
        problems.append("0 stavki u rasporedu")
    old = load_existing(compare_path)
    if old:
        old_subj = {e["subject"] for e in old["entries"]}
        new_subj = {e["subject"] for e in new["entries"]}
        if len(new_subj) < len(old_subj):
            lost = sorted(old_subj - new_subj)
            problems.append(
                f"manje predmeta nego ranije ({len(new_subj)} < {len(old_subj)}); "
                f"izgubljeni primeri: {lost[:5]}"
            )
        if len(new["groups"]) < len(old.get("groups", {})):
            problems.append(
                f"manje grupa nego ranije ({len(new['groups'])} < {len(old['groups'])})"
            )
    return problems


def compare_path_for(year, semester):
    """Sa čim se poredi novi raspored u sigurnosnoj proveri: sa arhivom istog
    semestra, ili sa god.json ako je u njemu taj semestar. Pri prelasku sa
    letnjeg na zimski god.json je letnji, a zimski ima drugačiji broj predmeta,
    pa bi poređenje sa njim odbilo ispravan raspored. None = nema s čim."""
    archive = DATA_DIR / f"{year}god-{semester}.json"
    if archive.exists():
        return archive
    current = DATA_DIR / f"{year}god.json"
    old = load_existing(current)
    if old and old.get("semester", "").lower().startswith(semester):
        return current
    return None


def check_meta_coverage(results):
    """Upozori na predmete iz rasporeda koji nemaju unos u subjects-meta.json.

    Ne-fatalno: takvi predmeti u aplikaciji default padaju na "čekiran" i nemaju
    ESPB/link. Kad se pojave, pokreni scripts/scrape_subjects_meta.py da ih dopuni.
    (Status flip postojećeg predmeta ovo NE hvata - za to pun re-scrape.)
    """
    import json
    meta_path = DATA_DIR / "subjects-meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    subjects = {e["subject"] for res in results.values() for e in res["entries"]}
    missing = sorted(s for s in subjects if s not in meta)
    if missing:
        print(f"\nPAŽNJA: {len(missing)} predmeta bez meta (ESPB/status/link):",
              file=sys.stderr)
        for s in missing:
            print(f"  - {s}", file=sys.stderr)
        print("  -> pokreni: python scripts/scrape_subjects_meta.py", file=sys.stderr)
    else:
        print("Meta pokrivenost: OK (svi predmeti imaju unos).", file=sys.stderr)

    # U GitHub Actions: napiši vidljiv blok na Summary stranicu run-a (ne samo
    # u log koraka koji se mora ručno raširiti).
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            if missing:
                f.write(f"### ⚠️ {len(missing)} predmeta bez meta\n\n")
                f.write("Nemaju ESPB/status/link - pokreni "
                        "`python scripts/scrape_subjects_meta.py`:\n\n")
                for s in missing:
                    f.write(f"- {s}\n")
            else:
                f.write("### ✅ Meta pokrivenost OK\n\nSvi predmeti imaju unos.\n")


def main():
    ap = argparse.ArgumentParser(description="Ažurira raspored nastave (god.json) sa FON sajta.")
    ap.add_argument("--semester", choices=["letnji", "zimski"], default=None,
                    help="Semestar (default: auto po mesecu)")
    ap.add_argument("--years", default="1,2,3,4", help="Godine, npr. '4' ili '1,2,3,4'")
    ap.add_argument("--force", action="store_true",
                    help="Upiši i pored regresije (preskače sigurnosnu proveru)")
    ap.add_argument("--archive-only", action="store_true",
                    help="Upiši samo god-{semestar}.json arhivu; ne diraj god.json (backfill)")
    ap.add_argument("--check", action="store_true",
                    help="Samo proveri ima li šta novo na FON-u (nov semestar ili nova "
                         "verzija objavljenog); ispiše 'zimski'/'letnji' na stdout ako ima")
    args = ap.parse_args()

    years = [int(y) for y in args.years.split(",") if y.strip()]

    import json
    if args.check:
        published = json.loads((DATA_DIR / "1god.json").read_text(encoding="utf-8"))["semester"]
        known = load_existing(KNOWN_PATH) or {}
        found = check(fetch(PAGE_URL), published, years, known, digest)
        print(f"Objavljen: {published} | za parsiranje: {found or 'ništa'}", file=sys.stderr)
        if found:
            print(found)
        return

    semester = args.semester or auto_semester()

    print(f"Semestar: {semester} | godine: {years}", file=sys.stderr)
    html = fetch(PAGE_URL)
    ay = academic_year(html)
    semester_str = f"{'Letnji' if semester == 'letnji' else 'Zimski'} {ay}".strip()
    files = resolve_files(html, semester)

    results = {}
    all_problems = {}
    for y in years:
        if y not in files:
            all_problems[y] = ["nije pronađen raspored na stranici"]
            continue
        print(f"--- {y}. god ---", file=sys.stderr)
        print(f"  raspored: {files[y]['raspored'].split('/')[-1]}", file=sys.stderr)
        print(f"  grupe:    {(files[y]['grupe'] or '???').split('/')[-1]}", file=sys.stderr)
        res, problems = build_year(files[y]["raspored"], files[y]["grupe"], y, semester_str)
        problems += check_regression(res, compare_path_for(y, semester))
        n_subj = len({e["subject"] for e in res["entries"]})
        print(f"  -> stavki={len(res['entries'])} grupa={len(res['groups'])} predmeta={n_subj}",
              file=sys.stderr)
        results[y] = res
        if problems:
            all_problems[y] = problems

    if all_problems and not args.force:
        print("\nSIGURNOSNA PROVERA NEUSPEŠNA - ništa nije upisano:", file=sys.stderr)
        for y, probs in sorted(all_problems.items()):
            for p in probs:
                print(f"  [{y}. god] {p}", file=sys.stderr)
        print("\nProveri fajlove ručno ili pokreni sa --force ako je promena namerna.",
              file=sys.stderr)
        sys.exit(1)

    for y, res in results.items():
        payload = json.dumps(res, ensure_ascii=False, indent=2)
        # Arhiva po semestru - kroz akademsku godinu se nakupe i letnji i zimski,
        # pa mešani Sep/Okt rokovi mogu da nude predmete oba semestra.
        archive = DATA_DIR / f"{y}god-{semester}.json"
        archive.write_text(payload, encoding="utf-8")
        print(f"Upisano: {archive}", file=sys.stderr)
        if not args.archive_only:
            path = DATA_DIR / f"{y}god.json"
            path.write_text(payload, encoding="utf-8")
            print(f"Upisano: {path}", file=sys.stderr)

    # Zapamti iz kojih linkova je napravljen objavljeni raspored, da bi --check
    # prepoznao kad FON okači novu verziju istog semestra.
    if not args.archive_only and results:
        known = load_existing(KNOWN_PATH) or {}
        if known.get("semester") != semester_str:
            known = {"semester": semester_str, "files": {}}
        known["files"].update(files_snapshot({y: files[y] for y in results}, _DIGESTS))
        KNOWN_PATH.write_text(json.dumps(known, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Upisano: {KNOWN_PATH}", file=sys.stderr)

    check_meta_coverage(results)


if __name__ == "__main__":
    main()
