#!/usr/bin/env python3
"""
Orkestrator za ažuriranje rasporeda nastave (public/data/{1,2,3,4}god.json).

Čita FON stranicu sa rasporedom, pronalazi PDF-ove za izabrani semestar
(po TEKSTU linka, ne po imenu fajla — pa radi i kad se ime/datum promeni),
skida ih, parsira preko fon_parser i upisuje god.json — uz sigurnosnu proveru
da regeneracija ne izgubi predmete/grupe.

Pokretanje:
  python scripts/update_nastava.py                # auto semestar po mesecu
  python scripts/update_nastava.py --semester letnji
  python scripts/update_nastava.py --years 4 --force
"""

import argparse
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
import fon_parser  # noqa: E402

DATA_DIR = SCRIPTS_DIR.parent / "public" / "data"
PAGE_URL = "https://oas.fon.bg.ac.rs/raspored-nastave/"
ROMAN = {"IV": 4, "III": 3, "II": 2, "I": 1}
UA = {"User-Agent": "Mozilla/5.0 (fon-raspored bot)"}


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=60).read()
    return data if binary else data.decode("utf-8", "replace")


def auto_semester():
    # mart–septembar -> letnji, ostalo -> zimski
    return "letnji" if 3 <= date.today().month <= 9 else "zimski"


def academic_year(html):
    m = re.search(r"[Шш]колск\w*\s+годин\w*\s+(\d{4}/\d{2})", html)
    return m.group(1) if m else ""


def _azurirano_date(text):
    """Vraća (mesec, dan) iz '(ажурирано DD.MM.)' ili (0,0) ako nema."""
    m = re.search(r"ажурирано\s*(\d{1,2})\.(\d{1,2})", text)
    return (int(m.group(2)), int(m.group(1))) if m else (0, 0)


def resolve_pdfs(html, semester):
    """Vraća {year: {'raspored': url, 'grupe': url}} za dati semestar."""
    soup = BeautifulSoup(html, "html.parser")
    anchors = [
        (" ".join(a.get_text().split()), a["href"])
        for a in soup.find_all("a", href=True)
        if a["href"].lower().endswith(".pdf")
    ]

    sched = {}  # year -> (date_key, url)
    grupe = {}
    for text, href in anchors:
        if semester not in href.lower():
            continue
        # preskoči nedeljne/online izmene i staru akreditaciju
        if "акредитација" in text or "online" in href.lower() \
                or "недељи" in text or " до " in f" {text} ":
            continue

        m = re.search(r"Распоред наставе за (IV|III|II|I) годину", text)
        if m:
            y = ROMAN[m.group(1)]
            dkey = _azurirano_date(text)
            # „najnoviji ažurirano datum pobeđuje"; bez datuma -> (0,0)
            if y not in sched or dkey > sched[y][0]:
                sched[y] = (dkey, href)

        g = re.search(r"Групе за слушање наставе за (IV|III|II|I) годину", text)
        if g:
            grupe[ROMAN[g.group(1)]] = href

    return {
        y: {"raspored": sched[y][1], "grupe": grupe.get(y)}
        for y in sched
    }


def build_year(raspored_url, grupe_url, year, semester_str):
    """Skine PDF-ove i vrati parsiran dict (kao fon_parser)."""
    with tempfile.TemporaryDirectory() as td:
        rp = Path(td) / "raspored.pdf"
        rp.write_bytes(fetch(raspored_url, binary=True))
        groups = {}
        if grupe_url:
            gp = Path(td) / "grupe.pdf"
            gp.write_bytes(fetch(grupe_url, binary=True))
            groups = fon_parser.parse_groups_pdf(str(gp))
        lines = fon_parser.extract_all_lines(str(rp))
        entries = fon_parser.parse_schedule_lines(lines, groups or None)
    return {
        "semester": semester_str,
        "year": year,
        "groups": groups,
        "entries": entries,
    }


def load_existing(path):
    import json
    if path.exists():
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


def check_meta_coverage(results):
    """Upozori na predmete iz rasporeda koji nemaju unos u subjects-meta.json.

    Ne-fatalno: takvi predmeti u aplikaciji default padaju na "čekiran" i nemaju
    ESPB/link. Kad se pojave, pokreni scripts/scrape_subjects_meta.py da ih dopuni.
    (Status flip postojećeg predmeta ovo NE hvata — za to pun re-scrape.)
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
                f.write("Nemaju ESPB/status/link — pokreni "
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
    args = ap.parse_args()

    semester = args.semester or auto_semester()
    years = [int(y) for y in args.years.split(",") if y.strip()]

    print(f"Semestar: {semester} | godine: {years}", file=sys.stderr)
    html = fetch(PAGE_URL)
    ay = academic_year(html)
    semester_str = f"{'Letnji' if semester == 'letnji' else 'Zimski'} {ay}".strip()
    pdfs = resolve_pdfs(html, semester)

    results = {}
    all_problems = {}
    for y in years:
        if y not in pdfs:
            all_problems[y] = ["nije pronađen raspored na stranici"]
            continue
        print(f"--- {y}. god ---", file=sys.stderr)
        print(f"  raspored: {pdfs[y]['raspored'].split('/')[-1]}", file=sys.stderr)
        print(f"  grupe:    {(pdfs[y]['grupe'] or '???').split('/')[-1]}", file=sys.stderr)
        res = build_year(pdfs[y]["raspored"], pdfs[y]["grupe"], y, semester_str)
        compare_path = DATA_DIR / (
            f"{y}god-{semester}.json" if args.archive_only else f"{y}god.json"
        )
        problems = check_regression(res, compare_path)
        n_subj = len({e["subject"] for e in res["entries"]})
        print(f"  -> stavki={len(res['entries'])} grupa={len(res['groups'])} predmeta={n_subj}",
              file=sys.stderr)
        results[y] = res
        if problems:
            all_problems[y] = problems

    if all_problems and not args.force:
        print("\nSIGURNOSNA PROVERA NEUSPEŠNA — ništa nije upisano:", file=sys.stderr)
        for y, probs in sorted(all_problems.items()):
            for p in probs:
                print(f"  [{y}. god] {p}", file=sys.stderr)
        print("\nProveri PDF-ove ručno ili pokreni sa --force ako je promena namerna.",
              file=sys.stderr)
        sys.exit(1)

    import json
    for y, res in results.items():
        payload = json.dumps(res, ensure_ascii=False, indent=2)
        # Arhiva po semestru — kroz akademsku godinu se nakupe i letnji i zimski,
        # pa mešani Sep/Okt rokovi mogu da nude predmete oba semestra.
        archive = DATA_DIR / f"{y}god-{semester}.json"
        archive.write_text(payload, encoding="utf-8")
        print(f"Upisano: {archive}", file=sys.stderr)
        if not args.archive_only:
            path = DATA_DIR / f"{y}god.json"
            path.write_text(payload, encoding="utf-8")
            print(f"Upisano: {path}", file=sys.stderr)

    check_meta_coverage(results)


if __name__ == "__main__":
    main()
