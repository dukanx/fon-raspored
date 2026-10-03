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


def bez_precrtanog(page):
    """Strana bez precrtanih slova. FON izmenu termina označava tako što stari
    termin precrta, a novi upiše ispod; precrtano je otkazano i ne sme u podatke.
    Precrtavanje je tanka vodoravna crta preko sredine slova (podvlačenje je
    ispod slova, a ivice tabele između redova, pa ih ovo ne hvata)."""
    crte = [(o["x0"], o["x1"], (o["top"] + o["bottom"]) / 2)
            for o in page.lines + page.rects
            if o["bottom"] - o["top"] < 1.5 and o["x1"] - o["x0"] > 2]
    if not crte:
        return page

    def precrtano(c):
        if c.get("object_type") != "char":
            return False
        sredina = (c["x0"] + c["x1"]) / 2
        h = c["bottom"] - c["top"]
        return any(x0 <= sredina <= x1 and c["top"] + 0.3 * h <= y <= c["bottom"] - 0.3 * h
                   for x0, x1, y in crte)

    return page.filter(lambda o: not precrtano(o))


def extract_rows(page):
    """Grupiše reči po redovima (y koordinata, zaokružena na 3px)."""
    words = bez_precrtanog(page).extract_words(x_tolerance=2, y_tolerance=3)
    rows = defaultdict(list)
    for w in words:
        rows[round(w["top"] / 3) * 3].append(w)
    return {y: sorted(rows[y], key=lambda w: w["x0"]) for y in sorted(rows.keys())}


ROOMS_NOISE = {"СЕМЕСТРУ", "SEMESTR", "SEMESTER", "ЛЕТЊИ", "ЗИМСКИ", "ЛЕТЊЕМ",
               "2025/26", "2024/25", "2026/27"}

# Datum u tabeli: DD/MM/YYYY, DD-MM-YYYY ili DD.MM.YYYY
DATE_RE = re.compile(r"\d{2}[/.\-]\d{2}[/.\-]\d{4}")
# P/U marker (P = pismeni, U = usmeni); latinica i ćirilica, uz opcionu tačku ili
# kosu crtu - u zaglavlju se pojavljuje kao "P/" (drugi red je "U").
PU_RE = re.compile(r"^[PUПУ][./]?$")

# Logičke kolone -> mogući nazivi u zaglavlju. FON menja nazive kroz
# akreditacije/rokove ("Napomena" vs "Napom.", "Sale" vs "Sala"), pa hvatamo varijante.
_COL_SYNONYMS = {
    "predmet":  {"Predmet"},
    "datum":    {"Datum"},
    "od":       {"Od"},
    "do":       {"Do"},
    "sale":     {"Sale", "Sala"},
    "napomena": {"Napomena", "Napom.", "Napom", "Napomene"},
}
# Bez ovih kolona red nije validno zaglavlje (Napomena i P/U su opcioni)
_REQUIRED_COLS = {"predmet", "datum", "od", "do", "sale"}

# Fallback X-pozicije zaglavlja kad detekcija ne uspe (stari layout ispita/kolokvijuma)
_ISPIT_FALLBACK = {"predmet": 29, "datum": 281, "od": 345, "do": 385, "sale": 418, "napomena": 745}
_KOL_FALLBACK   = {"predmet": 28, "datum": 227, "od": 296, "do": 334, "sale": 372, "napomena": 720}


def _detect_columns(rows):
    """Pronađi red zaglavlja i vrati {logička_kolona: x0}.
    Tolerantno na varijante naziva; vraća {} ako nijedan red nema sve obavezne kolone."""
    for _, row in rows.items():
        found = {}
        for w in row:
            for col, names in _COL_SYNONYMS.items():
                if col not in found and w["text"] in names:
                    found[col] = w["x0"]
        if _REQUIRED_COLS.issubset(found):
            return found
    return {}


def _bounds(cols):
    """(lo, hi) X-granice po koloni.

    Desne kolone (od/do/sale) se cepaju na sredinama između susednih zaglavlja -
    vrednosti u PDF-u počinju ~7px levo od naziva, pa sredina pouzdano hvata bez
    obzira na pomeraj kolona. Napomena počinje na svom zaglavlju (uz malu marginu).
    Leva strana (predmet + P/U) se NE računa odavde - sidri se direktno na datum-token,
    jer je kolona Predmet široka i sredina bi sekla duge nazive."""
    datum, od, do, sale = cols["datum"], cols["od"], cols["do"], cols["sale"]
    note = cols.get("napomena")
    note_lo = (note - 5) if note is not None else 9999
    return {
        "datum_x":  datum,
        "date_hi":  (datum + od) / 2,          # datum-token je levo od ovoga
        "subj_hi":  datum - 15,                # nastavak naziva predmeta je levo od ovoga
        "pu_min":   datum - 45,                # P/U marker nije levlje od ovoga
        "od":       ((datum + od) / 2, (od + do) / 2),
        "do":       ((od + do) / 2,    (do + sale) / 2),
        "sale":     ((do + sale) / 2,  note_lo),
        "note_lo":  note_lo,
    }


def to_iso(datum_str):
    m = re.match(r"(\d{2})[/.\-](\d{2})[/.\-](\d{4})", datum_str)
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


# --- Čitanje preko ćelija tabele ---------------------------------------------
# FON tabele imaju linije, pa pdfplumber zna ivice ćelija. To rešava ono što
# koordinate reči ne mogu: spisak sala ili naziv prelomljen u više redova je
# vertikalno centriran, pa je deo iznad, a deo ispod reda sa datumom, i
# koordinatama se ne zna kom terminu pripada. Manja tolerancija vraća razmake
# koje podrazumevana guta ("0809" -> "08 09").
TABLE_SETTINGS = {"text_x_tolerance": 1.5}
# Zaglavlje P/U kolone je u dva reda ("P." pa "U").
PU_HEADER_RE = re.compile(r"^[PП][./]?\s*[UУ]$")


def _cell(c):
    return " ".join((c or "").split())


def _table_columns(row):
    """{logička_kolona: indeks ćelije} ako je red zaglavlje tabele, inače None."""
    found = {}
    for i, c in enumerate(row):
        t = _cell(c)
        for col, names in _COL_SYNONYMS.items():
            if col not in found and t in names:
                found[col] = i
        if "pu" not in found and PU_HEADER_RE.match(t):
            found["pu"] = i
    return found if _REQUIRED_COLS.issubset(found) else None


def _parse_tables(pdf_path, with_type):
    """Termini iz ćelija tabele; [] ako PDF nema tabelu sa prepoznatim zaglavljem."""
    entries = []
    cols = None  # zaglavlje važi i za nastavak tabele na sledećim stranama
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in bez_precrtanog(page).extract_tables(TABLE_SETTINGS):
                for row in table:
                    header = _table_columns(row)
                    if header:
                        cols = header
                        continue
                    if not cols or len(row) <= max(cols.values()):
                        continue
                    subject = _cell(row[cols["predmet"]])
                    date_iso = to_iso(_cell(row[cols["datum"]]))
                    if not (subject and date_iso):
                        continue
                    entry = {"subject": subject}
                    if with_type:
                        entry["type"] = _cell(row[cols["pu"]]) if "pu" in cols else ""
                    entry.update({
                        "date": date_iso,
                        "start": _cell(row[cols["od"]]),
                        "end": _cell(row[cols["do"]]),
                        "rooms": parse_rooms(_cell(row[cols["sale"]]).split()),
                        "note": _cell(row[cols["napomena"]]) if "napomena" in cols else "",
                    })
                    entries.append(entry)
    return entries


def _is_header_row(texts):
    """Red zaglavlja tabele (sadrži 'Datum' i 'Sale'/'Sala')."""
    tset = set(texts)
    return "Datum" in tset and bool({"Sale", "Sala"} & tset)


def _parse(pdf_path, fallback, with_type):
    """Rezervno čitanje po koordinatama reči, za PDF bez linija tabele.

    with_type=True izdvaja P/U kolonu (pismeni/usmeni) - postoji samo kod ispita.

    Strategija:
      • kolone se auto-detektuju iz zaglavlja (tolerantno na varijante naziva),
        uz fallback na stari layout;
      • datum se prepoznaje regexom levo od kolone 'Od' (ne fiksnim opsegom),
        a predmet i P/U se sidre na poziciju samog datuma - otporno na pomeraj
        kolona i na to što vrednosti počinju levo od svojih zaglavlja;
      • od/do/sale se čitaju preko sredina između susednih zaglavlja.
    """
    entries = []

    with pdfplumber.open(pdf_path) as pdf:
        pages_rows = [extract_rows(page) for page in pdf.pages]

    # Detekcija kolona jednom - sa prve strane koja ima zaglavlje
    cols = {}
    for rows in pages_rows:
        cols = _detect_columns(rows)
        if cols:
            break
    b = _bounds(cols or fallback)

    # Svi redovi u jednom nizu - radi pogleda unapred i preko granica strana
    flat = [row for rows in pages_rows for row in rows.values()]

    def find_date(row):
        return next((w for w in row
                     if w["x0"] < b["date_hi"] and DATE_RE.match(w["text"])), None)

    def own_predmet(row, date_w):
        """Reči naziva na samom datum-redu (levo od datuma, bez P/U markera)."""
        left = [w for w in row if w["x0"] < date_w["x0"]]
        if with_type and left and PU_RE.match(left[-1]["text"]) \
                and left[-1]["x0"] >= b["pu_min"]:
            left = left[:-1]
        return [w["text"] for w in left]

    pending_subject = []   # nakupljeni prefiks (linije naziva iznad datum-reda)
    pending_rooms = []
    # Parsiranje kreće tek od zaglavlja (preskače uvodnu prozu sa datumima).
    # Ako PDF uopšte nema zaglavlje, parsiramo sve (oslonac na fallback).
    started = not bool(cols)

    for i, row in enumerate(flat):
        texts = [w["text"] for w in row]
        if not texts:
            continue

        # Zaglavlje aktivira parsiranje i resetuje akumulirani naziv
        if _is_header_row(texts):
            started = True
            pending_subject = []
            pending_rooms = []
            continue

        if not started:
            continue

        date_w = find_date(row)

        if date_w:
            tip = ""
            left = [w for w in row if w["x0"] < date_w["x0"]]
            if with_type and left and PU_RE.match(left[-1]["text"]) \
                    and left[-1]["x0"] >= b["pu_min"]:
                tip = left[-1]["text"]
                left = left[:-1]

            # Naziv = nakupljeni prefiks (linije iznad) + naziv na samom datum-redu
            subject = " ".join(pending_subject + [w["text"] for w in left])

            lo, hi = b["od"]
            od = next((w["text"] for w in row if lo <= w["x0"] < hi), "")
            lo, hi = b["do"]
            do_ = next((w["text"] for w in row if lo <= w["x0"] < hi), "")
            lo, hi = b["sale"]
            sale_words = [w["text"] for w in row if lo <= w["x0"] < hi]
            rooms = parse_rooms(sale_words) or pending_rooms
            note = " ".join(w["text"] for w in row if w["x0"] >= b["note_lo"])
            date_iso = to_iso(date_w["text"])

            if subject and date_iso:
                entry = {"subject": subject}
                if with_type:
                    entry["type"] = tip
                entry.update({"date": date_iso, "start": od, "end": do_,
                              "rooms": rooms, "note": note})
                entries.append(entry)
            pending_subject = []
            pending_rooms = []
            continue

        # Nije datum-red → nastavak sala ili nastavak naziva predmeta
        lo, hi = b["sale"]
        cont_sale = [w["text"] for w in row if lo <= w["x0"] < hi]
        left_words = [w for w in row if w["x0"] < b["subj_hi"]]

        if cont_sale and entries and not left_words:
            entries[-1]["rooms"] += parse_rooms(cont_sale)
            continue

        # Usamljeni P/U marker (drugi red 'P/U' zaglavlja) ili prazno - preskoči
        if not left_words or (len(left_words) == 1 and PU_RE.match(left_words[0]["text"])):
            continue

        # Dvoredni naziv: pogledaj sledeći datum-red. Ako on NEMA svoj naziv, ovaj
        # red je njegov prefiks (linija iznad); inače je rep (linija ispod) prethodnog.
        nxt = next((flat[j] for j in range(i + 1, len(flat)) if find_date(flat[j])), None)
        nxt_borrows = nxt is not None and not own_predmet(nxt, find_date(nxt))

        if nxt_borrows:
            pending_subject.extend(w["text"] for w in left_words)
            if cont_sale:                       # kolokvijum: sale u redu pre datuma
                pending_rooms = parse_rooms(cont_sale)
        elif entries:
            entries[-1]["subject"] += " " + " ".join(w["text"] for w in left_words)
        else:
            pending_subject.extend(w["text"] for w in left_words)

    return entries


def parse_ispit(pdf_path):
    """
    Parsira PDF sa ispitnim rokom.
    Kolone: Predmet | [P/U] | Datum | Od | Do | Sale | [Napomena]
    """
    return _parse_tables(pdf_path, with_type=True) or _parse(pdf_path, _ISPIT_FALLBACK, with_type=True)


def parse_kolokvijum(pdf_path):
    """
    Parsira PDF sa kolokvijumom.
    Kolone: Predmet | Datum | Od | Do | Sale | [Napom.]
    """
    return _parse_tables(pdf_path, with_type=False) or _parse(pdf_path, _KOL_FALLBACK, with_type=False)


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
