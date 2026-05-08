"""
Parser za datume prijave iz PDF zaglavlja — kolokvijumi i ispiti.

Ulaz:  PDF fajl (lokalni path ili URL)
Izlaz: JSON sa tipom, imenom roka, datumima prijave i reklamacije

Upotreba:
  python3 parse_rok.py LetnjiKolPrvi.pdf
  python3 parse_rok.py januarski_ispit.pdf
"""

import re
import json
import sys
import urllib.request
import tempfile
import os

import fitz  # pymupdf


# ── Regex paterni ──────────────────────────────────────────────────────────────

RE_DATE_RANGE = re.compile(
    r"(\d{1,2})\.\s*и\s*(\d{1,2})\.\s*(\d{2})\.(\d{4})\.?\s*године",
    re.IGNORECASE,
)
RE_DATE_SINGLE = re.compile(
    r"(\d{1,2})\.(\d{2})\.(\d{4})\.?\s*године",
    re.IGNORECASE,
)
RE_SEMESTER = re.compile(
    r"У\s+(ЛЕТЊЕМ|ЗИМСКОМ|LETЊEM|ZIMSKOM)\s+СЕМЕСТРУ\s+(\d{4}/\d{2,4})",
    re.IGNORECASE,
)
RE_KOL_WEEK = re.compile(
    r"(ПРВО[JЈ]|ДРУГО[JЈ])\s+КОЛОКВИЈУМСКО[JЈ]\s+НЕДЕЉИ",
    re.IGNORECASE,
)
RE_ISP_ROK = re.compile(
    r"У\s+(\w+)\s+ИСПИТНОМ\s+РОКУ",
    re.IGNORECASE,
)
RE_YEAR = re.compile(r"(\d{4}/\d{2,4})")

WEEK_MAP = {"ПРВО": 1, "ДРУГО": 2}

ROK_MAP = {
    "ЈАНУАРСКОМ": "Januarski", "ФЕБРУАРСКОМ": "Februarski",
    "ЈУНСКОМ": "Junski",      "ЈУЛСКОМ": "Julski",
    "СЕПТЕМБАРСКОМ": "Septembarski", "ОКТОБАРСКОМ": "Oktobarski",
    "JANUARSKOM": "Januarski", "FEBRUARSKOM": "Februarski",
    "JUNSKOM": "Junski",       "JULSKOM": "Julski",
    "SEPTEMBARSKI": "Septembarski", "OKTOBARSKI": "Oktobarski",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def fmt_date(day: str, month: str, year: str) -> str:
    return f"{int(day):02d}.{int(month):02d}.{year}."


def extract_text(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages)


def download_pdf(url: str) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    urllib.request.urlretrieve(url, tmp.name)
    return tmp.name


# ── Detekcija tipa i parsiranje ────────────────────────────────────────────────

def detect_and_parse(text: str) -> dict:
    is_kol = bool(RE_KOL_WEEK.search(text))
    is_isp = bool(RE_ISP_ROK.search(text))

    result = {
        "tip": None,
        "rok": None,
        "school_year": None,
        "prijava_datumi": [],
        "reklamacija_datum": None,
    }

    if is_kol:
        result["tip"] = "kolokvijum"

        m = RE_SEMESTER.search(text)
        if m:
            tip = "Letnji" if "ЛЕТ" in m.group(1).upper() else "Zimski"
            result["school_year"] = m.group(2)
            m2 = RE_KOL_WEEK.search(text)
            if m2:
                key = m2.group(1).upper()[:4]
                week = WEEK_MAP.get(key, "?")
                sem_label = "letnji" if tip == "Letnji" else "zimski"
                result["rok"] = f"{'Prvi' if week == 1 else 'Drugi'} {sem_label} kolokvijum {m.group(2)}"

    elif is_isp:
        result["tip"] = "ispit"

        m = RE_ISP_ROK.search(text)
        if m:
            key = m.group(1).upper()
            result["rok"] = ROK_MAP.get(key, m.group(1).capitalize() + "ski")

        m = RE_YEAR.search(text)
        if m:
            result["school_year"] = m.group(1)

    else:
        result["tip"] = "nepoznat"

    for line in text.splitlines():
        if "е-студент" in line or "e-student" in line.lower():
            m = RE_DATE_RANGE.search(line)
            if m:
                d1, d2, month, year = m.groups()
                result["prijava_datumi"] = [fmt_date(d1, month, year), fmt_date(d2, month, year)]
            else:
                m = RE_DATE_SINGLE.search(line)
                if m:
                    result["prijava_datumi"] = [fmt_date(*m.groups())]

        if "рекламац" in line.lower():
            m = RE_DATE_SINGLE.search(line)
            if m:
                result["reklamacija_datum"] = fmt_date(*m.groups())

    return result


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Upotreba: python3 parse_rok.py <path_do_pdf_ili_url>")
        sys.exit(1)

    src = sys.argv[1]
    tmp_file = None

    try:
        if src.startswith("http://") or src.startswith("https://"):
            print(f"Preuzimanje: {src}", file=sys.stderr)
            tmp_file = download_pdf(src)
            path = tmp_file
        else:
            path = src

        text = extract_text(path)
        data = detect_and_parse(text)
        print(json.dumps(data, ensure_ascii=False, indent=2))

    finally:
        if tmp_file and os.path.exists(tmp_file):
            os.unlink(tmp_file)


if __name__ == "__main__":
    main()
