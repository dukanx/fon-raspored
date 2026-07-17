#!/usr/bin/env python3
"""
FON Raspored Parser
Korišćenje:
  python fon_parser.py --raspored raspored.pdf --grupe grupe.pdf --output raspored.json
  python fon_parser.py --raspored raspored.pdf --grupe grupe.pdf  # ispisuje JSON u terminal
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


DAYS = {"Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak"}

SKIP_LINES = {
    "FAKULTET ORGANIZACIONIH NAUKA",
    "RASPORED NASTAVE",
    "GRUPE STUDENATA",
    "ZA SLUŠANJE NASTAVE",
    "ČETVRTA GODINA",
    "Četvrta godina",
}


# ---------------------------------------------------------------------------
# PDF text extraction - dva pristupa
# ---------------------------------------------------------------------------

def extract_lines_by_words(page):
    """
    Gradi linije iz pozicija reči.
    Radi i kad PDF nema razmake između reči (kao letnji raspored).
    Kolone u rasporedu su na fiksnim X pozicijama:
      - naziv predmeta: x < 260
      - P/V:            x ~ 270
      - grupe:          x ~ 290
      - vreme:          x ~ 430
      - sala:           x ~ 500+
    """
    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    if not words:
        return []

    # Grupiši reči po redu (y koordinata, zaokružena na 2px)
    rows = defaultdict(list)
    for w in words:
        row_key = round(w["top"] / 2) * 2
        rows[row_key].append(w)

    lines = []
    for y in sorted(rows.keys()):
        row = sorted(rows[y], key=lambda w: w["x0"])

        # Podeli reči u kolone prema X poziciji
        subject_words = []
        type_word = None
        group_words = []
        time_word = None
        room_words = []

        for w in row:
            x = w["x0"]
            t = w["text"]

            if x < 260:
                subject_words.append(t)
            elif 260 <= x < 290:
                # Obično P ili V
                type_word = t
            elif 290 <= x < 420:
                group_words.append(t)
            elif 420 <= x < 490:
                time_word = t
            else:
                room_words.append(t)

        # Rekonstruiši liniju
        parts = []
        if subject_words:
            parts.append(" ".join(subject_words))
        if type_word:
            parts.append(type_word)
        if group_words:
            parts.append(" ".join(group_words))
        if time_word:
            parts.append(time_word)
        if room_words:
            parts.append(" ".join(room_words))

        if parts:
            lines.append(" ".join(parts))

    return lines


def extract_all_lines(pdf_path):
    """Izvlači sve linije iz svih stranica PDF-a."""
    all_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_lines = extract_lines_by_words(page)
            all_lines.extend(page_lines)
    return all_lines


# ---------------------------------------------------------------------------
# Parsiranje rasporeda
# ---------------------------------------------------------------------------

# Regex za jednu stavku rasporeda
# Primer: "Mikroservisna arhitektura IS P D1,D2,D3 14:15-16:00 19"
ENTRY_RE = re.compile(
    r"^(.+?)\s+(P|V)\s+"                  # naziv + tip
    r"(.+?)"                             # grupe (uklj. prečice npr. 'D-Akrd.2024 ISIT,svi')
    r"\s+(\d{1,2}:\d{2}-\d{1,2}:\d{2})"   # vreme
    r"\s*(.*)$"                          # sala (opciono — može preći u sledeći red)
)

# Ključne reči za prepoznavanje MiO (menadžment) smera; sve ostalo je ISIT.
_MIO_KEYWORDS = ("menadžment", "marketing", "organizacij", "finansij",
                 "kvalitet", "projektni", "operacioni")


def _is_mio(program):
    p = (program or "").lower()
    return any(k in p for k in _MIO_KEYWORDS)


def expand_groups(raw, groups_dict=None):
    """
    Pretvara string grupa u listu šifri.
    - normalne šifre: 'D1,D2, D3'            -> ['D1','D2','D3']
    - prečice:        'D-Akrd.2024 ISIT,svi' -> sve ISIT šifre te godine
                      'C-Akred2024Mio,svi'   -> sve MiO šifre te godine
                      '...,svi' (bez naznake) -> sve šifre te godine
    Vraća samo šifre oblika X<broj> koje postoje u groups_dict (ako je dat).
    """
    valid = set(groups_dict) if groups_dict else None
    low = raw.lower()

    if "svi" in low:
        if groups_dict:
            if "isit" in low:
                codes = [g for g, i in groups_dict.items() if not _is_mio(i.get("program"))]
            elif "mio" in low:
                codes = [g for g, i in groups_dict.items() if _is_mio(i.get("program"))]
            else:
                codes = list(groups_dict.keys())
            return sorted(codes)
        return []  # prečica bez liste grupa — ne možemo razrešiti

    codes = [g.strip() for g in raw.split(",") if g.strip()]
    codes = [c for c in codes if re.match(r"^[A-Z]\d+$", c)]
    if valid is not None:
        codes = [c for c in codes if c in valid]
    return codes


# Data-red bez naziva: počinje sa "P "/"V " i ima vreme — znak da se dug naziv
# predmeta prelio u red iznad/ispod. Primer: "P A1,A2,A3 10:15-12:00 Amfiteatar 2"
_SUBJECTLESS_DATA_RE = re.compile(r"^(P|V)\s+.+\d{1,2}:\d{2}-\d{1,2}:\d{2}")
_TIME_RE = re.compile(r"\d{1,2}:\d{2}")


def _is_subject_fragment(line):
    """Red koji liči na (deo) naziva predmeta: bez vremena, bez P/V+grupa, ima slova."""
    if not line or line in DAYS:
        return False
    if _TIME_RE.search(line):
        return False
    if re.match(r"^(P|V)\s+[A-Z]\d", line):
        return False
    if any(skip in line for skip in SKIP_LINES):
        return False
    if re.match(r"^\d+$", line):
        return False
    return bool(re.search(r"[A-Za-zČĆŽŠĐčćžšđ]", line))


def stitch_wrapped_subjects(lines):
    """
    Spaja naziv predmeta prelomljen u dve linije oko data-reda. Layout (3 reda):
      'Osnove informaciono komunikacionih' | 'P A1,A2,A3 10:15-12:00 Amf 2' | 'tehnologija'
    -> 'Osnove informaciono komunikacionih tehnologija P A1,A2,A3 10:15-12:00 Amf 2'
    """
    lines = [l.strip() for l in lines]
    n = len(lines)
    consumed = [False] * n
    replaced = {}

    for i, line in enumerate(lines):
        if not _SUBJECTLESS_DATA_RE.match(line):
            continue
        prefix = lines[i - 1] if i > 0 and not consumed[i - 1] and _is_subject_fragment(lines[i - 1]) else ""
        suffix = lines[i + 1] if i + 1 < n and _is_subject_fragment(lines[i + 1]) else ""
        subject = " ".join(p for p in (prefix, suffix) if p).strip()
        if not subject:
            continue
        merged = f"{subject} {line}"
        if ENTRY_RE.match(merged):
            if prefix:
                consumed[i - 1] = True
            if suffix:
                consumed[i + 1] = True
            replaced[i] = merged

    return [replaced.get(i, lines[i]) for i in range(n) if not consumed[i]]


def parse_schedule_lines(lines, groups_dict=None):
    """Parsira linije u listu unosa. groups_dict služi za širenje prečica grupa."""
    lines = stitch_wrapped_subjects(lines)

    entries = []
    current_day = None
    pending = None        # za prelom vremena u sledeći red (string)
    pending_entry = None  # unos kome sala nedostaje, čeka salu iz sledećeg reda

    def flush_room(line):
        """Ako čekamo salu, a red liči na salu — dodeli je i vrati True."""
        nonlocal pending_entry
        if pending_entry is None:
            return False
        looks_like_room = (
            line not in DAYS
            and not re.search(r"\d{2}:\d{2}", line)
            and not ENTRY_RE.match(line)
            and len(line) <= 15
        )
        if looks_like_room:
            pending_entry["room"] = line.strip()
            entries.append(pending_entry)
            pending_entry = None
            return True
        # nije sala — sačuvaj unos bez sale i nastavi normalnu obradu reda
        entries.append(pending_entry)
        pending_entry = None
        return False

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            continue

        # Prvo razreši eventualnu salu iz prethodnog (nepotpunog) unosa.
        if pending_entry is not None and flush_room(line):
            continue

        # Preskoči prazne i header linije
        if any(skip in line for skip in SKIP_LINES):
            continue
        if re.match(r"^(Letnji|Zimski|zimski|školske|Četvrta\s|četvrta\s|Četvrta$|četvrta$)", line):
            continue
        if re.match(r"^\d+$", line):
            continue
        if re.match(r"^[A-ZČŠŽĐ\s]+$", line) and len(line) > 15:
            # Sve caps header
            continue

        # Dan u sedmici
        if line in DAYS:
            current_day = line
            pending = None
            continue

        if current_day is None:
            continue

        # Pokušaj da spoji sa prethodnom linijom ako je vreme bilo podeljeno.
        # Ako se prethodni red završava na "-" (npr. "08:15-"), spoji BEZ razmaka
        # da vreme ostane "08:15-10:00".
        if pending and re.match(r"^\d{2}:\d{2}", line):
            sep = "" if pending.rstrip().endswith("-") else " "
            line = pending.rstrip() + sep + line
            pending = None

        m = ENTRY_RE.match(line)
        if m:
            subject  = m.group(1).strip()
            stype    = m.group(2).strip()
            groups   = expand_groups(m.group(3).strip(), groups_dict)
            time_str = m.group(4).strip()
            room     = m.group(5).strip()

            start, end = time_str.split("-")

            entry = {
                "day":        current_day,
                "subject":    subject,
                "type":       "Predavanje" if stype == "P" else "Vežbe",
                "type_short": stype,
                "groups":     groups,
                "start":      start,
                "end":        end,
                "room":       room,
            }
            if room:
                entries.append(entry)
            else:
                pending_entry = entry  # sala verovatno u sledećem redu
            pending = None
        else:
            # Možda je vreme prešlo u sledeći red — sačuvaj
            if re.search(r"\d{2}:\d{2}-$", line) or (
                re.search(r"(P|V)\s+[A-Z]\d", line) and not re.search(r"\d{2}:\d{2}", line)
            ):
                pending = line
            else:
                pending = None

    if pending_entry is not None:
        entries.append(pending_entry)

    return entries


# ---------------------------------------------------------------------------
# Parsiranje lista grupa (kraći PDF)
# ---------------------------------------------------------------------------

GROUP_LINE_RE = re.compile(
    r"^(D\d+)\s+(.+?)\s{2,}(.+)$"
)


def parse_groups_pdf(pdf_path):
    """
    Parsira PDF sa listom grupa studenata koristeći pozicije reči.
    Vraća dict: { "D1": { "program": "...", "range": "..." }, ... }
    Radi za sve godine (A/B/C/D grupe).
    """
    from collections import defaultdict
    groups = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=2, y_tolerance=3)

            # Grupiši reči po redu (y zaokružen na 4px)
            rows = defaultdict(list)
            for w in words:
                rows[round(w["top"] / 4) * 4].append(w)

            pending_prefix = None   # slovo grupe čekamo broj
            pending_program = []    # program reči sa prethodnog reda
            pending_from = ""
            pending_to = ""

            for y in sorted(rows.keys()):
                row = sorted(rows[y], key=lambda w: w["x0"])
                texts = [w["text"] for w in row]
                xs    = [w["x0"]   for w in row]

                # Red koji počinje sa grupnim prefiksom (B/C/D na x<105)
                if texts and texts[0] in ("A","B","C","D","E") and xs[0] < 140:
                    # Sačuvaj prethodni ako postoji
                    if pending_prefix:
                        _save_group(groups, pending_prefix, pending_program, pending_from, pending_to)

                    pending_prefix  = texts[0]
                    pending_program = []
                    pending_from    = ""
                    pending_to      = ""

                    # Ostale reči na ovom redu
                    # Ostale reči na ovom redu
                    for t, x in zip(texts[1:], xs[1:]):
                        if x >= 415:           # Do prezimena
                            pending_to = t
                        elif x >= 295:         # Od prezimena
                            if pending_from:
                                pending_to = t  # Ako već imamo "od", ovo je "do"
                            else:
                                pending_from = t
                        else:                  # Program naziv
                            pending_program.append(t)

                # Red koji sadrži samo broj (broj grupe, ispod prefiksa)
                elif len(texts) == 1 and re.match(r"^\d+$", texts[0]) and pending_prefix:
                    full_id = pending_prefix + texts[0]
                    _save_group(groups, full_id, pending_program, pending_from, pending_to)
                    pending_prefix  = None
                    pending_program = []
                    pending_from    = ""
                    pending_to      = ""

                # Red koji je nastavak naziva programa (samo reči na x<335, nema prefiksa)
                elif pending_prefix is None and texts and xs[0] < 335 and xs[0] > 140:
                    skip = {"Grupa","prog./","Stud.","grupa","Od","Do","prezimena",
                            "GRUPE","STUDENATA","ZA","SLUŠANJE","NASTAVE","GODINE",
                            "ČETVRTA","TREĆA","DRUGA","PRVA","GODINA"}
                    cont = [t for t,x in zip(texts,xs) if x < 335 and t not in skip]
                    if cont and groups:
                        last_key = sorted(groups.keys())[-1]
                        groups[last_key]["program"] += " " + " ".join(cont)

            # Poslednji pending
            if pending_prefix and pending_program:
                _save_group(groups, pending_prefix, pending_program, pending_from, pending_to)

    return groups


def _save_group(groups, gid_or_prefix, program_words, from_n, to_n):
    gid = gid_or_prefix if re.match(r"^[A-Z]\d+$", gid_or_prefix) else gid_or_prefix

    SKIP = {"Grupa","prog./","Stud.","grupa","Od","Do","prezimena",
            "GRUPE","STUDENATA","ZA","SLUŠANJE","NASTAVE","GODINE"}

    # Program reči su samo "pravo" ime programa — reči koje nisu prezimena
    # Prezimena počinju velikim slovom i sadrže samo slova
    # "A-" i "Š-" su opseg markeri, ne deo programa
    clean_program = []
    extra_from = []
    for w in program_words:
        if w in SKIP:
            continue
        if re.match(r'^[A-ZŠĐČĆŽ][a-zšđčćž]+$', w) and clean_program:
            # Reč koja izgleda kao prezime nakon što smo već dobili naziv programa
            extra_from.append(w)
        elif w in ('A-', 'Š-') or re.match(r'^[A-ZŠĐČĆŽ]-$', w):
            # Opseg marker
            extra_from.append(w)
        else:
            clean_program.append(w)

    program = " ".join(clean_program)

    # Ako je "od" bilo u program rečima, rekonstruiši
    if extra_from:
        from_n = " ".join(extra_from)
    else:
        from_n = from_n or "Svi"

    if from_n.lower() in ("svi", "sви", "avi", "аvi"):
        range_str = "Svi"
    elif to_n:
        range_str = f"{from_n} - {to_n}"
    else:
        range_str = from_n

    if program:
        groups[gid] = {"program": program, "range": range_str}


# ---------------------------------------------------------------------------
# Filtriranje po grupi
# ---------------------------------------------------------------------------

def filter_by_group(entries, group_id):
    """Vraća samo unose koji sadrže traženu grupu."""
    return [e for e in entries if group_id in e["groups"]]


def print_schedule(entries, group_id=None):
    """Štampa raspored u čitljivom formatu."""
    label = f"Raspored za grupu {group_id}" if group_id else "Ceo raspored"
    print(f"\n{'='*60}")
    print(label)
    print('='*60)

    current_day = None
    for e in entries:
        if e["day"] != current_day:
            current_day = e["day"]
            print(f"\n{current_day}:")
        grupe = ", ".join(e["groups"])
        print(
            f"  {e['start']}-{e['end']}  "
            f"[{e['type_short']}]  "
            f"{e['subject']:<50}  "
            f"Sala: {e['room']}"
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Parsira FON raspored nastave iz PDF-a u JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Primeri:
  python fon_parser.py --raspored raspored.pdf --grupe grupe.pdf --output raspored.json
  python fon_parser.py --raspored raspored.pdf --grupe grupe.pdf --grupa D3
  python fon_parser.py --raspored raspored.pdf --output raspored.json
        """
    )
    parser.add_argument("--raspored", required=True, help="PDF fajl sa rasporedima")
    parser.add_argument("--grupe",    required=False, help="PDF fajl sa listom grupa")
    parser.add_argument("--output",   required=False, help="Izlazni JSON fajl (opciono)")
    parser.add_argument("--godina",   required=False, default="4", help="Godina (default: 4)")
    parser.add_argument("--semestar", required=False, default="", help="Naziv semestra (npr. 'Letnji 2025/26')")
    parser.add_argument("--grupa",    required=False, help="Filtriraj po grupi (npr. D3) i prikaži u terminalu")
    parser.add_argument("--verbose",  action="store_true", help="Prikaži detalje parsiranja")

    args = parser.parse_args()

    # Proveri da li fajlovi postoje
    raspored_path = Path(args.raspored)
    if not raspored_path.exists():
        print(f"Greška: fajl '{args.raspored}' ne postoji.")
        sys.exit(1)

    # Grupe parsiramo prvo — trebaju za širenje prečica grupa u rasporedu.
    groups = {}
    if args.grupe:
        grupe_path = Path(args.grupe)
        if not grupe_path.exists():
            print(f"Upozorenje: fajl '{args.grupe}' ne postoji, grupe će biti prazne.", file=sys.stderr)
        else:
            print(f"Učitavam grupe: {grupe_path.name} ...", file=sys.stderr)
            groups = parse_groups_pdf(str(grupe_path))
            print(f"Pronađeno {len(groups)} grupa.", file=sys.stderr)

    # Ekstraktuj i parsiraj raspored
    print(f"Učitavam raspored: {raspored_path.name} ...", file=sys.stderr)
    lines = extract_all_lines(str(raspored_path))

    if args.verbose:
        print(f"Ekstraktovano {len(lines)} linija.", file=sys.stderr)

    entries = parse_schedule_lines(lines, groups or None)
    print(f"Pronađeno {len(entries)} stavki u rasporedu.", file=sys.stderr)

    # Rezultat
    result = {
        "semester": args.semestar,
        "year":     int(args.godina),
        "groups":   groups,
        "entries":  entries,
    }

    # Prikaz u terminalu ako je tražena konkretna grupa
    if args.grupa:
        filtered = filter_by_group(entries, args.grupa)
        print_schedule(filtered, args.grupa)
        print(f"\nUkupno: {len(filtered)} stavki za grupu {args.grupa}")

    # Zapis u fajl
    if args.output:
        output_path = Path(args.output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"\nSačuvano u: {output_path}", file=sys.stderr)
    elif not args.grupa:
        # Ako nema ni --output ni --grupa, ispiši JSON
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
