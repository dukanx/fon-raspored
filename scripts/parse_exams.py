#!/usr/bin/env python3
"""
FON Ispit/Kolokvijum Parser
Korišćenje:
  python fon_exam_parser.py --pdf feb.pdf --tip ispit --rok "Februarski 2025/26" --output feb.json
  python fon_exam_parser.py --pdf kol.pdf --tip kolokvijum --rok "Prvi zimski 2025/26" --output kol.json
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("Greška: pdfplumber nije instaliran.")
    print("Pokreni: pip install pdfplumber")
    sys.exit(1)


def extract_rows(page):
    """Grupiše reči po redovima (y koordinata, zaokružena na 3px)."""
    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    rows = defaultdict(list)
    for w in words:
        rows[round(w["top"] / 3) * 3].append(w)
    return {y: sorted(rows[y], key=lambda w: w["x0"]) for y in sorted(rows.keys())}


def words_in_range(row, x_min, x_max):
    """Vraća reči iz reda u zadatom X opsegu."""
    return [w["text"] for w in row if x_min <= w["x0"] < x_max]


def parse_rooms(words):
    """
    Spaja sale u čitljive nazive.
    ["Amfiteatar", "1", "Amfiteatar", "2"] -> ["Amfiteatar 1", "Amfiteatar 2"]
    """
    rooms = []
    i = 0
    while i < len(words):
        w = words[i]
        if w in ("Amfiteatar", "Čitaonica", "Citaonica"):
            if i + 1 < len(words) and re.match(r"^\d+$", words[i + 1]):
                rooms.append(f"{w} {words[i+1]}")
                i += 2
            else:
                rooms.append(w)
                i += 1
        else:
            rooms.append(w)
            i += 1
    return rooms


def parse_ispit(pdf_path):
    """
    Parsira PDF sa ispitnim rokom.
    Kolone: Predmet | P/U | Datum | Od | Do | Sale | Napomena
    X pozicije: predmet<250, tip~251, datum~271, od~338, do~378, sale>=418, napomena>=740
    """
    entries = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            rows = extract_rows(page)
            pending_subject = []  # Predmet može biti višeredan

            for _, row in rows.items():
                texts = [w["text"] for w in row]

                # Preskoči header i prazne redove
                if not texts:
                    continue
                if texts[0] in ("Predmet", "U", "P."):
                    continue
                if re.match(r"^[UNI VERZITE T]+$", " ".join(texts)):
                    continue

                # Proveri da li red ima datum (x~271)
                datum_words = words_in_range(row, 265, 330)
                datum_str = datum_words[0] if datum_words else None

                if datum_str and re.match(r"\d{2}/\d{2}/\d{4}", datum_str):
                    # Ovo je podatkovni red
                    predmet_words = words_in_range(row, 0, 250)
                    if predmet_words:
                        pending_subject = predmet_words
                    subject = " ".join(pending_subject)

                    tip_words = words_in_range(row, 248, 265)
                    tip = tip_words[0] if tip_words else ""

                    od_words = words_in_range(row, 330, 375)
                    od = od_words[0] if od_words else ""

                    do_words = words_in_range(row, 375, 415)
                    do_ = do_words[0] if do_words else ""

                    sale_words = words_in_range(row, 415, 740)
                    rooms = parse_rooms(sale_words)

                    note_words = words_in_range(row, 740, 9999)
                    note = " ".join(note_words)

                    # Konvertuj datum u ISO format
                    date_iso = ""
                    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", datum_str)
                    if m:
                        date_iso = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"

                    if subject and date_iso:
                        entries.append({
                            "subject": subject,
                            "type": tip,   # P = pismeni, U = usmeni
                            "date": date_iso,
                            "start": od,
                            "end": do_,
                            "rooms": rooms,
                            "note": note,
                        })
                        pending_subject = []

                else:
                    # Red koji nastavlja naziv predmeta
                    cont = words_in_range(row, 0, 250)
                    if cont and pending_subject is not None:
                        pending_subject.extend(cont)

    return entries


def parse_kolokvijum(pdf_path):
    """
    Parsira PDF sa kolokvijumom.
    Kolone: Predmet | Datum | Od | Do | Sale | Napom.
    X pozicije: predmet<225, datum~227, od~295, do~333, sale>=370, napom>=715
    """
    entries = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            rows = extract_rows(page)
            pending_subject = []

            for _, row in rows.items():
                texts = [w["text"] for w in row]

                if not texts:
                    continue
                if texts[0] in ("Predmet", "Datum", "Od", "Do", "Sale", "Napom."):
                    continue

                datum_words = words_in_range(row, 220, 295)
                datum_str = datum_words[0] if datum_words else None

                if datum_str and re.match(r"\d{2}/\d{2}/\d{4}", datum_str):
                    predmet_words = words_in_range(row, 0, 220)
                    if predmet_words:
                        pending_subject = predmet_words
                    subject = " ".join(pending_subject)

                    od_words = words_in_range(row, 290, 332)
                    od = od_words[0] if od_words else ""

                    do_words = words_in_range(row, 332, 370)
                    do_ = do_words[0] if do_words else ""

                    sale_words = words_in_range(row, 370, 715)
                    rooms = parse_rooms(sale_words)

                    note_words = words_in_range(row, 715, 9999)
                    note = " ".join(note_words)

                    date_iso = ""
                    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", datum_str)
                    if m:
                        date_iso = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"

                    if subject and date_iso:
                        entries.append({
                            "subject": subject,
                            "date": date_iso,
                            "start": od,
                            "end": do_,
                            "rooms": rooms,
                            "note": note,
                        })
                        pending_subject = []

                else:
                    cont = words_in_range(row, 0, 220)
                    if cont:
                        pending_subject.extend(cont)

    return entries


def main():
    parser = argparse.ArgumentParser(
        description="Parsira FON ispitni rok ili kolokvijum iz PDF-a u JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Primeri:
  python fon_exam_parser.py --pdf feb.pdf --tip ispit --rok "Februarski 2025/26" --output feb.json
  python fon_exam_parser.py --pdf kol.pdf --tip kolokvijum --rok "Prvi zimski 2025/26" --output kol.json
        """
    )
    parser.add_argument("--pdf",    required=True,  help="PDF fajl")
    parser.add_argument("--tip",    required=True,  choices=["ispit", "kolokvijum"])
    parser.add_argument("--rok",    required=False, default="", help="Naziv roka")
    parser.add_argument("--output", required=False, help="Izlazni JSON fajl")

    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Greška: fajl '{args.pdf}' ne postoji.")
        sys.exit(1)

    print(f"Parsiranje: {pdf_path.name} ({args.tip}) ...", file=sys.stderr)

    if args.tip == "ispit":
        entries = parse_ispit(str(pdf_path))
    else:
        entries = parse_kolokvijum(str(pdf_path))

    print(f"Pronađeno {len(entries)} unosa.", file=sys.stderr)

    result = {
        "rok": args.rok,
        "tip": args.tip,
        "entries": entries,
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"Sačuvano u: {args.output}", file=sys.stderr)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()