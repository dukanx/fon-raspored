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


ROOMS_NOISE = {"СЕМЕСТРУ", "SEMESTR", "SEMESTER", "ЛЕТЊИ", "ЗИМСКИ", "ЛЕТЊЕМ",
               "2025/26", "2024/25", "2026/27"}

# Poznati nazivi kolona u zaglavlju
_ISPIT_HEADER_KEYS  = {"Predmet", "Datum", "Od", "Do", "Sale", "Napom."}
_KOL_HEADER_KEYS    = {"Predmet", "Datum", "Od", "Do", "Sale"}


def _detect_columns(rows, required_keys):
    """Vraća {naziv_kolone: x0} iz header reda koji sadrži sve required_keys."""
    for _, row in rows.items():
        text_set = {w["text"] for w in row}
        if required_keys.issubset(text_set):
            return {w["text"]: w["x0"] for w in row if w["text"] in required_keys}
    return {}


def to_iso(datum_str):
    m = re.match(r"(\d{2})[/-](\d{2})[/-](\d{4})", datum_str)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""

def parse_rooms(words):
    """
    Spaja sale u čitljive nazive.
    ["Amfiteatar", "1", "Amfiteatar", "2"] -> ["Amfiteatar 1", "Amfiteatar 2"]
    """
    rooms = []
    i = 0
    while i < len(words):
        w = words[i]
        if w in ROOMS_NOISE:
            i += 1
            continue
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
    Kolone: Predmet | [P/U] | Datum | Od | Do | Sale | [Napomena]
    Pozicije kolona se auto-detektuju iz header reda; ako nema headera,
    koriste se hardkodirani fallback offsets.
    """
    entries = []
    cols = {}  # popunjava se sa prve strane

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            rows = extract_rows(page)

            # Detekcija kolona jednom — sa prve stranice koja ima header
            if not cols:
                cols = _detect_columns(rows, _ISPIT_HEADER_KEYS)

            # Izveди granice iz detektovanih kolona (ili fallback)
            x_datum = cols.get("Datum", 271)
            x_od    = cols.get("Od",    338)
            x_do    = cols.get("Do",    378)
            x_sale  = cols.get("Sale",  418)
            x_napom = cols.get("Napom.", 740)
            # Predmet je sve levo od Datuma
            x_pred_max = x_datum - 3
            # P/U kolona između predmeta i datuma
            x_pu_min = x_pred_max - 2
            x_pu_max = x_datum + 3

            pending_subject = []

            for _, row in rows.items():
                texts = [w["text"] for w in row]

                if not texts:
                    continue
                if texts[0] in ("Predmet", "U", "P."):
                    continue
                if re.match(r"^[UNI VERZITE T]+$", " ".join(texts)):
                    continue

                datum_words = words_in_range(row, x_datum - 5, x_od - 3)
                datum_str = datum_words[0] if datum_words else None

                if datum_str and re.match(r"\d{2}[/\-]\d{2}[/\-]\d{4}", datum_str):
                    predmet_words = words_in_range(row, 0, x_pred_max)
                    if predmet_words:
                        pending_subject = predmet_words
                    subject = " ".join(pending_subject)

                    tip_words = words_in_range(row, x_pu_min, x_pu_max)
                    tip = tip_words[0] if tip_words else ""

                    od_words = words_in_range(row, x_od - 3, x_do - 3)
                    od = od_words[0] if od_words else ""

                    do_words = words_in_range(row, x_do - 3, x_sale - 3)
                    do_ = do_words[0] if do_words else ""

                    sale_words = words_in_range(row, x_sale, x_napom)
                    rooms = parse_rooms(sale_words)

                    note_words = words_in_range(row, x_napom, 9999)
                    note = " ".join(note_words)

                    date_iso = to_iso(datum_str)

                    if subject and date_iso:
                        entries.append({
                            "subject": subject,
                            "type": tip,
                            "date": date_iso,
                            "start": od,
                            "end": do_,
                            "rooms": rooms,
                            "note": note,
                        })
                        pending_subject = []

                else:
                    cont_sale = words_in_range(row, x_sale, x_napom)
                    if cont_sale and entries and not words_in_range(row, 0, x_pred_max):
                        entries[-1]["rooms"] += parse_rooms(cont_sale)
                        continue
                    cont = words_in_range(row, 0, x_pred_max)
                    if cont and pending_subject is not None:
                        pending_subject.extend(cont)

    return entries


def parse_kolokvijum(pdf_path):
    """
    Parsira PDF sa kolokvijumom.
    Kolone: Predmet | Datum | Od | Do | Sale | [Napom.]
    Pozicije kolona se auto-detektuju iz header reda; fallback na hardkodirane vrednosti.
    """
    entries = []
    cols = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            rows = extract_rows(page)

            if not cols:
                cols = _detect_columns(rows, _KOL_HEADER_KEYS)

            x_datum = cols.get("Datum", 241)
            x_od    = cols.get("Od",    315)
            x_do    = cols.get("Do",    355)
            x_sale  = cols.get("Sale",  395)
            x_pred_max = x_datum - 3
            # Napom. nije obavezan header u kolokvijum PDF-ovima
            x_napom = cols.get("Napom.", 715)

            pending_subject = []
            pending_rooms = []

            for _, row in rows.items():
                texts = [w["text"] for w in row]

                if not texts:
                    continue
                if texts[0] in ("Predmet", "Datum", "Od", "Do", "Sale", "Napom."):
                    continue

                datum_words = words_in_range(row, x_datum - 5, x_od - 3)
                datum_str = datum_words[0] if datum_words else None

                if datum_str and re.match(r"\d{2}[/\-]\d{2}[/\-]\d{4}", datum_str):
                    predmet_words = words_in_range(row, 0, x_pred_max)
                    if predmet_words:
                        pending_subject = predmet_words
                    subject = " ".join(pending_subject)

                    od_words = words_in_range(row, x_od - 3, x_do - 3)
                    od = od_words[0] if od_words else ""

                    do_words = words_in_range(row, x_do - 3, x_sale - 3)
                    do_ = do_words[0] if do_words else ""

                    sale_words = words_in_range(row, x_sale, x_napom + 50)
                    rooms = parse_rooms(sale_words) or pending_rooms

                    note_words = words_in_range(row, x_napom, 9999)
                    note = " ".join(note_words)

                    date_iso = to_iso(datum_str)

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
                        pending_rooms = []

                else:
                    cont_sale = words_in_range(row, x_sale, x_napom + 50)
                    if cont_sale and entries and not words_in_range(row, 0, x_pred_max):
                        entries[-1]["rooms"] += parse_rooms(cont_sale)
                        continue
                    cont = words_in_range(row, 0, x_pred_max)
                    if cont:
                        pending_subject.extend(cont)
                        pre_datum_sale = words_in_range(row, x_sale, x_napom + 50)
                        if pre_datum_sale:
                            pending_rooms = parse_rooms(pre_datum_sale)

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
