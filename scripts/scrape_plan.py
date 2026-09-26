#!/usr/bin/env python3
"""Plan studija po modulima sa oas.fon.bg.ac.rs -> public/data/plan.json.

Stranica svakog modula ima tabelu po godini: predmet, u kom semestru se
sluša i da li je obavezan ili izborni blok ("Izborni predmet X (više…)", čiji
spisak predmeta je u popup-u na istoj stranici). Izbor predmeta (/izborni) iz
ovoga zna šta je za baš taj modul obavezno. Status sa stranice predmeta to ne
može: tamo piše npr. "Obavezan predmet/Izborni predmet", jer je predmet na
jednom modulu obavezan, a na drugom izborni.

Plan se menja retko (nova akreditacija), pa se pokreće ručno:
    cd scripts && python scrape_plan.py
Pa pregledaj `git diff public/data/plan.json` pre commit-a.
"""
import json
import sys
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
from fon_docx import to_latin  # noqa: E402

OUT = SCRIPTS_DIR.parent / "public" / "data" / "plan.json"
BASE = "https://oas.fon.bg.ac.rs/"

# Ključ = naziv modula kako ga FON piše u tabelama grupa (program u god.json).
MODULES = {
    "ISiT": {
        "Informacione tehnologije": "informacioni-sistemi-i-tehnologije/informacione-tehnologije/",
        "Informacioni sistemi": "informacioni-sistemi-i-tehnologije/informacioni-sistemi/",
        "Informaciono inženjerstvo": "informacioni-sistemi-i-tehnologije/informaciono-inzenjerstvo/",
        "Poslovna analitika": "informacioni-sistemi-i-tehnologije/poslovna-analitika/",
        "Softversko inženjerstvo": "informacioni-sistemi-i-tehnologije/softversko-inzenjerstvo/",
        "Tehnologije elektronskog poslovanja": "informacioni-sistemi-i-tehnologije/tehnologije-elektronskog-poslovanja/",
    },
    "MiO": {
        "Finansijski menadžment": "menadzment-i-organizacija/finansijski-menadzment/",
        "Lin organizacija poslovanja": "menadzment-i-organizacija/lin-organizacija-poslovanja/",
        "Marketing menadžment i komunikacije": "menadzment-i-organizacija/marketing-menadzment-i-komunikacije/",
        "Menadžment kvaliteta i standardizacija": "menadzment-i-organizacija/menadzment-kvaliteta-i-standardizacija/",
        "Operacioni menadžment": "menadzment-i-organizacija/operacioni-menadzment/",
        "Projektni menadžment": "menadzment-i-organizacija/projektni-menadzment/",
    },
}

SKIP = ("пракс", "завршни")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (fon-raspored bot)"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")


def clean(text):
    # FON ponegde piše dugu crtu ("... – osnovni koncepti"), a raspored običnu.
    text = to_latin(text).replace("\u2013", "-").replace("\u2014", "-")
    return " ".join(text.split())


def parse_module(html):
    """{godina: {"zimski"|"letnji": {"obavezni": [...], "izborni": [...], "blokovi": [[...], ...]}}}.

    `izborni` su svi predmeti iz izbornih blokova, a `blokovi` iste predmete
    grupišu po bloku ("Izborni predmet SI 1" -> njegove opcije). Po blokovima
    aplikacija vidi da FON još nije objavio raspored nekog izbornog bloka."""
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find(class_="entry-content") or soup
    plan = {}
    for year, table in enumerate(content.find_all("table")[:4], 1):
        sems = {"zimski": {"obavezni": set(), "izborni": set(), "blokovi": []},
                "letnji": {"obavezni": set(), "izborni": set(), "blokovi": []}}
        for row in table.find_all("tr")[1:]:
            tds = row.find_all("td")
            if len(tds) < 4:
                continue
            label = " ".join(tds[1].get_text().split())
            if any(s in label.lower() for s in SKIP):
                continue
            sem = "zimski" if tds[2].get_text(strip=True) else "letnji" if tds[3].get_text(strip=True) else None
            if not sem:
                continue
            link = tds[1].find("a", href=True)
            if link and link["href"].startswith("#popmake-"):
                popup = soup.find(id=link["href"][1:])
                options = {clean(a.get_text()) for a in popup.find_all("a")} if popup else set()
                options = {o for o in options if o}
                sems[sem]["izborni"] |= options
                if options:
                    sems[sem]["blokovi"].append(sorted(options))
            else:
                sems[sem]["obavezni"].add(clean(label))
        plan[str(year)] = {
            s: {k: (v if k == "blokovi" else sorted(v)) for k, v in lists.items()}
            for s, lists in sems.items()
        }
    return plan


def main():
    out = {}
    for program, modules in MODULES.items():
        for name, path in modules.items():
            plan = parse_module(fetch(BASE + path))
            if len(plan) != 4:
                sys.exit(f"{name}: očekivane 4 tabele (godine), nađeno {len(plan)} - stranica promenjena?")
            out[name] = {"program": program, "godine": plan}
            n = sum(len(v) for y in plan.values() for s in y.values() for v in s.values())
            print(f"{name}: {n} stavki", file=sys.stderr)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"-> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
