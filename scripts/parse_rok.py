"""
Parser za datume prijave iz PDF zaglavlja - kolokvijumi i ispiti.

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
# Tekst se pre traženja prevodi u latinicu i spaja u jedan red (v. _ravno): FON
# zaglavlje piše i ćirilicom i latinicom, a red ume da prelomi usred rečenice.

MESECI = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust",
          "septembar", "oktobar", "novembar", "decembar"]
# Genitiv u datumu ("08-10. decembra 2025") -> broj meseca.
_MESEC_GEN_BROJ = {
    "januara": 1, "februara": 2, "marta": 3, "aprila": 4, "maja": 5, "juna": 6,
    "jula": 7, "avgusta": 8, "septembra": 9, "oktobra": 10, "novembra": 11, "decembra": 12,
}
_MESEC_GEN = "(" + "|".join(_MESEC_GEN_BROJ) + ")"

_DATUM = r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
# "od 05.06. 2026.(petak) do 08.06.2026.", "od 07.02.2026.do 11.02.2026." i
# "od petka 17.4.2026. do ponedeljka 20.4.2026."
RE_PRIJAVA_OD_DO = re.compile(r"\bod\s+(?:\w+\s+)?" + _DATUM + r".*?\bdo\s*(?:\w+\s+)?" + _DATUM, re.IGNORECASE)
# "5. i 8. 06.2026."
RE_PRIJAVA_I = re.compile(r"(\d{1,2})\.\s*i\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})", re.IGNORECASE)
# "od 08-10. decembra 2025"
RE_PRIJAVA_MESEC = re.compile(r"(\d{1,2})\s*-\s*(\d{1,2})\.?\s*" + _MESEC_GEN + r"\s+(\d{4})", re.IGNORECASE)
RE_DATUM = re.compile(_DATUM)
# "u četvrtak, 11 decembra 2025."
RE_DATUM_MESEC = re.compile(r"(\d{1,2})\.?\s+" + _MESEC_GEN + r"\s+(\d{4})", re.IGNORECASE)

RE_KOL_WEEK = re.compile(r"(prvoj|drugoj)\s+kolokvijumskoj\s+nedelji", re.IGNORECASE)
RE_SEMESTER = re.compile(r"u\s+(zimskom|letnjem)\s+semestru\s+(?:školske\s+)?(\d{4})/(\d{2,4})", re.IGNORECASE)
# Dodatni rokovi: "novembarsko-decembarski", "Martovsko-aprilski".
RE_ISP_DODATNI = re.compile(r"(\w+sko-\w+ski)\b[^.]{0,60}?ispitni\s+rok", re.IGNORECASE)
# "u JUNSKOM ispitnom roku", i FON-ove greške "isitnom", "septembarskomispitnom".
RE_ISP_U_ROKU = re.compile(r"u\s+(\w+?)skom\s*i\w{1,3}tnom\s+roku", re.IGNORECASE)
# "Januarski ispitni rok 2025/2026"
RE_ISP_ROK = re.compile(r"(\w+?)ski\s+ispitni\s+rok", re.IGNORECASE)
RE_YEAR = re.compile(r"(\d{4})/(\d{2,4})")

# ── Helpers ────────────────────────────────────────────────────────────────────

def fmt_date(day, month, year) -> str:
    return f"{int(day):02d}.{int(month):02d}.{year}."


def _ravno(text: str) -> str:
    """Latinica, jedan red, bez višestrukih razmaka."""
    import fon_docx
    return " ".join(fon_docx.to_latin(text).split())


def _skolska(pocetak: str, kraj: str) -> str:
    """"2025/2026" i "2025/26" -> "2025/26"."""
    return f"{pocetak}/{kraj[-2:]}"


def _naziv_roka(text: str) -> str | None:
    """"Januarski", "Septembarski", "Novembarsko-decembarski"... ili None."""
    m = RE_ISP_DODATNI.search(text)
    if m:
        return m.group(1).capitalize()
    for regex in (RE_ISP_U_ROKU, RE_ISP_ROK):
        for m in regex.finditer(text):
            koren = m.group(1).lower()
            if koren in MESECI:
                return koren.capitalize() + "ski"
    return None


def _prijava(text: str) -> list[str]:
    """Datumi prijave (prvi i poslednji dan, ili jedan) iz prve rečenice o
    e-studentu ili roku za prijavu u kojoj ih ima. E-student se pominje i bez
    datuma ("putem e-studenta, maksimalno 3 ispita"), pa se ide redom."""
    for m in re.finditer(r"e-\s*student|rok za prijavu", text, re.IGNORECASE):
        deo = text[m.end():m.end() + 250]
        if (d := RE_PRIJAVA_OD_DO.search(deo)):
            return [fmt_date(*d.groups()[:3]), fmt_date(*d.groups()[3:])]
        if (d := RE_PRIJAVA_I.search(deo)):
            d1, d2, mes, god = d.groups()
            return [fmt_date(d1, mes, god), fmt_date(d2, mes, god)]
        if (d := RE_PRIJAVA_MESEC.search(deo)):
            d1, d2, mes, god = d.groups()
            broj = _MESEC_GEN_BROJ[mes.lower()]
            return [fmt_date(d1, broj, god), fmt_date(d2, broj, god)]
        if (d := RE_DATUM.search(deo)):
            return [fmt_date(*d.groups())]
    return []


def _reklamacija(text: str) -> str | None:
    m = re.search(r"reklamacij", text, re.IGNORECASE)
    if not m:
        return None
    deo = text[m.end():m.end() + 150]
    kandidati = []
    if (d := RE_DATUM.search(deo)):
        kandidati.append((d.start(), fmt_date(*d.groups())))
    if (d := RE_DATUM_MESEC.search(deo)):
        dan, mes, god = d.groups()
        kandidati.append((d.start(), fmt_date(dan, _MESEC_GEN_BROJ[mes.lower()], god)))
    return min(kandidati)[1] if kandidati else None


def extract_text(pdf_path: str) -> str:
    # Word: FON je kolokvijume za zimski 2026/27 objavio samo kao .docx.
    if pdf_path.lower().endswith(".docx"):
        import fon_docx
        return fon_docx.text(pdf_path)
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
    t = _ravno(text)
    result = {
        "tip": "nepoznat",
        "rok": None,
        "school_year": None,
        "prijava_datumi": _prijava(t),
        "reklamacija_datum": _reklamacija(t),
    }
    if (y := RE_YEAR.search(t)):
        result["school_year"] = _skolska(*y.groups())

    if (nedelja := RE_KOL_WEEK.search(t)):
        result["tip"] = "kolokvijum"
        if (sem := RE_SEMESTER.search(t)):
            godina = _skolska(sem.group(2), sem.group(3))
            result["school_year"] = godina
            redni = "Prvi" if nedelja.group(1).lower() == "prvoj" else "Drugi"
            sem_label = "zimski" if sem.group(1).lower() == "zimskom" else "letnji"
            result["rok"] = f"{redni} {sem_label} kolokvijum {godina}"
    elif (naziv := _naziv_roka(t)):
        result["tip"] = "ispit"
        result["rok"] = naziv
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
