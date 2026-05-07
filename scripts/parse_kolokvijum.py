"""
Parser za PDF raspored kolokvijumskih nedjelja sa FON-a.

Ulaz:  PDF fajl (lokalni path ili URL)
Izlaz: JSON sa info o prijavi i datumima

Primer strukture PDF zaglavlja:
  РАСПОРЕД ПОЛАГАЊА ПРЕДИСПИТНИХ ОБАВЕЗА У ПРВОЈ КОЛОКВИЈУМСКОЈ НЕДЕЉИ
  У ЛЕТЊЕМ СЕМЕСТРУ 2025/26
  Пријава предиспитних обавеза
  Пријава за полагање ... биће омогућена путем система е-студент 05. и 06. 05.2026.године.
  Рекламације ... 07.05.2026. године ...
"""

import re
import json
import sys
import urllib.request
import tempfile
import os
from pathlib import Path

import fitz  # pymupdf


# ── Regex paterni ──────────────────────────────────────────────────────────────

# "01. и 03. 05.2026.године" → (01, 03, 05, 2026)
RE_DATE_RANGE = re.compile(
    r"(\d{1,2})\.\s*и\s*(\d{1,2})\.\s*(\d{2})\.(\d{4})\.?\s*године",
    re.IGNORECASE,
)

# "07.05.2026. године" → (07, 05, 2026)
RE_DATE_SINGLE = re.compile(
    r"(\d{1,2})\.(\d{2})\.(\d{4})\.?\s*године",
    re.IGNORECASE,
)

# Naslov: "У ЛЕТЊЕМ СЕМЕСТРУ 2025/26" ili "У ЗИМСКОМ СЕМЕСТРУ 2025/26"
RE_SEMESTER = re.compile(
    r"У\s+(ЛЕТЊЕМ|ЗИМСКОМ|LETЊEM|ZIMSKOM)\s+СЕМЕСТРУ\s+(\d{4}/\d{2,4})",
    re.IGNORECASE,
)

# "PRVOJ/DRUGOJ KOLOKVIJUMSKOJ NEDJELJI" (ćirilica)
RE_WEEK = re.compile(
    r"(ПРВО[JЈ]|ДРУГО[JЈ])\s+КОЛОКВИЈУМСКО[JЈ]\s+НЕДЕЉИ",
    re.IGNORECASE,
)

WEEK_MAP = {
    "ПРВО": 1, "PRVOJ": 1,
    "ДРУГО": 2, "DRUGOJ": 2,
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


# ── Parser ─────────────────────────────────────────────────────────────────────

def parse(text: str) -> dict:
    result = {
        "semestar": None,
        "kolokvijumska_nedjelja": None,
        "prijava_datumi": [],       # dani kada je otvorena prijava
        "reklamacija_datum": None,  # rok za reklamacije
        "raw_prijava": None,
        "raw_reklamacija": None,
    }

    # Semestar
    m = RE_SEMESTER.search(text)
    if m:
        tip = "Letnji" if "ЛЕТ" in m.group(1).upper() else "Zimski"
        result["semestar"] = f"{tip} semestar {m.group(2)}"

    # Koja kolokvijumska nedjelja
    m = RE_WEEK.search(text)
    if m:
        key = m.group(1).upper()[:5]
        result["kolokvijumska_nedjelja"] = WEEK_MAP.get(key)

    # Pronađi rečenicu sa prijavom
    for line in text.splitlines():
        if "е-студент" in line or "e-student" in line.lower():
            result["raw_prijava"] = line.strip()
            # "05. и 06. 05.2026.године"
            m = RE_DATE_RANGE.search(line)
            if m:
                d1, d2, month, year = m.groups()
                result["prijava_datumi"] = [
                    fmt_date(d1, month, year),
                    fmt_date(d2, month, year),
                ]
            else:
                # Možda samo jedan datum
                m = RE_DATE_SINGLE.search(line)
                if m:
                    result["prijava_datumi"] = [fmt_date(*m.groups())]

        if "рекламацij" in line.lower() or "reklamacij" in line.lower():
            result["raw_reklamacija"] = line.strip()
            m = RE_DATE_SINGLE.search(line)
            if m:
                result["reklamacija_datum"] = fmt_date(*m.groups())

    return result


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Upotreba: python3 parse_kolokvijum.py <path_do_pdf_ili_url>")
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
        data = parse(text)
        print(json.dumps(data, ensure_ascii=False, indent=2))

    finally:
        if tmp_file and os.path.exists(tmp_file):
            os.unlink(tmp_file)


if __name__ == "__main__":
    main()
