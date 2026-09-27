#!/usr/bin/env python3
"""FON kalendar aktivnosti -> public/data/kalendar.json.

Stranica https://oas.fon.bg.ac.rs/kalendar-aktivnosti/ ima po jednu tabelu za
svaki mesec školske godine. Svaki dan je obojen klasom (vrsta dana), a neki
imaju i napomenu u `title` ("Onlajn nastava", "Januarski ispitni rok"...).
Kalendar u Rokovima od toga boji dane.

Izlaz:
    {"skolska_godina": "2026/27",
     "dani": {"2026-11-07": {"tip": "nastava", "napomena": "Onlajn nastava"}, ...}}

Pokretanje:
    cd scripts && python scrape_kalendar.py
Izlazni kod 1 ako stranica ne izgleda kako očekujemo (tada se ništa ne upisuje).
"""
import calendar
import json
import re
import sys
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
from fon_docx import to_latin  # noqa: E402

URL = "https://oas.fon.bg.ac.rs/kalendar-aktivnosti/"
OUT = SCRIPTS_DIR.parent / "public" / "data" / "kalendar.json"

# Klasa ćelije -> vrsta dana (legenda na vrhu stranice).
TYPES = {
    "green": "nastava",
    "red": "neradni",
    "orange": "bez_nastave",
    "yellow": "ispitni_rok",
    "light-blue": "kolokvijumi",
}
MONTHS = {
    "septembar": 9, "oktobar": 10, "novembar": 11, "decembar": 12, "januar": 1,
    "februar": 2, "mart": 3, "april": 4, "maj": 5, "jun": 6, "jul": 7, "avgust": 8,
}
# Napomena koja znači da za dan nema podataka.
NOT_COVERED = "nije obuhvaćeno"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (fon-raspored bot)"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")


def parse(html):
    """(školska godina, {datum: {tip, napomena?}}, lista problema)."""
    soup = BeautifulSoup(html, "html.parser")
    text = " ".join(soup.get_text(" ").split())
    m = re.search(r"Календар активности (\d{4}/\d{2})", text)
    school_year = m.group(1) if m else ""
    problems = [] if school_year else ["nije nađena školska godina u naslovu"]

    days = {}
    tables = soup.find_all("table", class_="month-table")
    if len(tables) < 12:
        problems.append(f"očekivano bar 12 meseci, nađeno {len(tables)}")
    for t in tables:
        head = to_latin(" ".join(t.find("thead").find("td").get_text().split())).lower()
        hm = re.match(r"(\w+) (\d{4})", head)
        if not hm or hm.group(1) not in MONTHS:
            problems.append(f"nepoznat naslov meseca '{head}'")
            continue
        month, year = MONTHS[hm.group(1)], int(hm.group(2))
        numbers = []
        for td in t.find("tbody").find_all("td"):
            num = re.match(r"\d+", td.get_text(" ", strip=True))
            if not num:
                continue
            day = int(num.group())
            numbers.append(day)
            kind = next((TYPES[c] for c in td.get("class", []) if c in TYPES), None)
            note = to_latin(td.get("title", "").strip())
            if not kind or NOT_COVERED in note.lower():
                continue  # pre početka godine ili van kalendara: nema podataka
            entry = {"tip": kind}
            if note:
                entry["napomena"] = note
            days[f"{year}-{month:02d}-{day:02d}"] = entry
        expected = list(range(1, calendar.monthrange(year, month)[1] + 1))
        if numbers != expected:
            problems.append(f"{head}: dani nisu 1..{expected[-1]} redom")

    if len(days) < 300:
        problems.append(f"premalo obeleženih dana ({len(days)})")
    return school_year, dict(sorted(days.items())), problems


def main():
    school_year, days, problems = parse(fetch(URL))
    if problems:
        print("Kalendar nije upisan, stranica ne izgleda kako očekujemo:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(1)
    out = {"skolska_godina": school_year, "dani": days}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {}
    for d in days.values():
        counts[d["tip"]] = counts.get(d["tip"], 0) + 1
    print(f"{school_year}: {len(days)} dana {counts} -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
