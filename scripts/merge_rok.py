"""
Merge skripta: parsira PDF i upisuje rezultat u rokovi.json.

Pokreće parse_rok.py (metapodaci: prijava/reklamacija) i
fon_exam_parser.py (termini: predmet/datum/sala), pa spaja u rokovi.json.

Upotreba:
  python3 merge_rok.py <pdf_fajl>
  python3 merge_rok.py <pdf_fajl> --rokovi ../../public/data/rokovi.json
  python3 merge_rok.py <pdf_fajl> --rok "Januarski ispitni rok"   # prisili naziv

Matching: traži rok u JSON-u koji ima isti tip i čiji naziv sadrži
ključnu reč iz parsiranog naziva (npr. "Januarski" → "Januarski ispitni rok").
Ako nije pronađen, kreira novi unos.
"""

import sys
import json
import re
import argparse
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
ROKOVI_DEFAULT = SCRIPTS_DIR.parent / "public" / "data" / "rokovi.json"

# Importuj parsere iz istog direktorijuma
sys.path.insert(0, str(SCRIPTS_DIR))
import parse_rok as pr
import fon_exam_parser as fep


def normalize(s: str) -> str:
    """Ukloni godinu, interpunkciju, lowercase — za fuzzy matching."""
    s = re.sub(r"\d{4}/\d{2,4}", "", s)
    s = re.sub(r"[^a-zšđčćžA-ZŠĐČĆŽ ]", "", s)
    return " ".join(s.lower().split())


def find_matching_rok(data: list, tip: str, parsed_rok: str) -> int | None:
    """
    Vraća index roka u listi koji odgovara tipu i imenu.
    Proba exact match, pa substring match u oba smera.
    """
    norm_parsed = normalize(parsed_rok)

    for i, r in enumerate(data):
        if r["tip"] != tip:
            continue
        norm_existing = normalize(r["rok"])
        # Exact (po normalizaciji)
        if norm_existing == norm_parsed:
            return i
        # Substring u oba smera (npr. "januarski" ⊂ "januarski ispitni rok")
        key = norm_parsed.split()[0] if norm_parsed else ""
        if key and key in norm_existing:
            return i
        if norm_parsed in norm_existing or norm_existing in norm_parsed:
            return i

    return None


def main():
    parser = argparse.ArgumentParser(description="Parsira PDF rok i upisuje u rokovi.json.")
    parser.add_argument("pdf", help="PDF fajl")
    parser.add_argument("--rokovi", default=str(ROKOVI_DEFAULT), help="Path do rokovi.json")
    parser.add_argument("--rok", default=None, help="Prisili naziv roka (override auto-detect)")
    parser.add_argument("--dry-run", action="store_true", help="Samo prikaži šta bi se promenilo")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Greška: '{args.pdf}' ne postoji.")
        sys.exit(1)

    rokovi_path = Path(args.rokovi)
    if not rokovi_path.exists():
        print(f"Greška: '{args.rokovi}' ne postoji.")
        sys.exit(1)

    # ── 1. Parsiranje metapodataka (prijava/reklamacija) ───────────────────────
    print(f"[1/3] Parsiranje metapodataka: {pdf_path.name}", file=sys.stderr)
    text = pr.extract_text(str(pdf_path))
    meta = pr.detect_and_parse(text)

    if meta["tip"] == "nepoznat":
        print("Greška: nije prepoznat tip PDF-a (ni kolokvijum ni ispit).")
        sys.exit(1)

    tip = meta["tip"]
    rok_name = args.rok or meta["rok"] or pdf_path.stem
    print(f"  tip: {tip}, rok: {rok_name}", file=sys.stderr)
    if meta["prijava_datumi"]:
        print(f"  prijava: {', '.join(meta['prijava_datumi'])}", file=sys.stderr)
    if meta["reklamacija_datum"]:
        print(f"  reklamacija: {meta['reklamacija_datum']}", file=sys.stderr)

    # ── 2. Parsiranje termina (predmet/datum/sala) ─────────────────────────────
    print(f"[2/3] Parsiranje termina ({tip}) ...", file=sys.stderr)
    if tip == "ispit":
        entries = fep.parse_ispit(str(pdf_path))
    else:
        entries = fep.parse_kolokvijum(str(pdf_path))
    print(f"  pronađeno {len(entries)} unosa.", file=sys.stderr)

    # ── 3. Merge u rokovi.json ─────────────────────────────────────────────────
    print(f"[3/3] Upisivanje u {rokovi_path.name} ...", file=sys.stderr)
    with open(rokovi_path, encoding="utf-8") as f:
        data: list = json.load(f)

    idx = find_matching_rok(data, tip, rok_name)

    new_entry = {
        "rok": rok_name,
        "tip": tip,
        "entries": entries,
    }
    if meta["prijava_datumi"]:
        new_entry["prijava_datumi"] = meta["prijava_datumi"]
    if meta["reklamacija_datum"]:
        new_entry["reklamacija_datum"] = meta["reklamacija_datum"]

    if idx is not None:
        existing_rok = data[idx]["rok"]
        print(f"  Match: '{existing_rok}' (index {idx}) — ažuriranje.", file=sys.stderr)
        data[idx] = new_entry
        data[idx]["rok"] = existing_rok  # sačuvaj originalni naziv iz JSON-a
    else:
        print(f"  Nije nađen match — kreiranje novog unosa '{rok_name}'.", file=sys.stderr)
        data.append(new_entry)

    if args.dry_run:
        print("\n[DRY RUN] Rezultat (nije sačuvano):")
        print(json.dumps(new_entry, ensure_ascii=False, indent=2))
        return

    with open(rokovi_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Sačuvano.", file=sys.stderr)
    print(f"\nGotovo: {len(entries)} unosa u '{rok_name}'.")


if __name__ == "__main__":
    main()
