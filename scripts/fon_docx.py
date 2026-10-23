"""
Čitanje FON-ovih Word (.docx) fajlova: raspored nastave, kolokvijumi i ispiti.

FON raspored obično objavljuje kao PDF (fon_parser, fon_exam_parser). Za zimski
2026/27 je i raspored nastave i kolokvijume objavio samo kao Word, pa ga
update_nastava i check_fon tada čitaju ovde. Samo standardna biblioteka: .docx
je zip sa word/document.xml.

Raspored: jedan pasus je jedan termin, a polja (predmet, P/V, grupe, vreme,
sala) su razdvojena tabovima. Pretvaraju se u iste linije koje daje PDF, pa
termine parsira postojeći fon_parser.parse_schedule_lines.

Grupe: tabela Grupa | Stud. program | Od prezimena | Do prezimena, za 2-4.
godinu ćirilicom. Aplikacija poredi prezimena latinicom, pa se prevodi.
"""

import re
import zipfile
from xml.etree import ElementTree as ET

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

_CYR = dict(zip(
    "абвгдђежзијклмнопрстћуфхцчш",
    ["a", "b", "v", "g", "d", "đ", "e", "ž", "z", "i", "j", "k", "l", "m", "n",
     "o", "p", "r", "s", "t", "ć", "u", "f", "h", "c", "č", "š"],
))
_CYR.update({"љ": "lj", "њ": "nj", "џ": "dž"})

_TIME_RE = re.compile(r"\d{1,2}:\d{2}-\d{1,2}:\d{2}")


def to_latin(text):
    out = []
    for ch in text:
        lat = _CYR.get(ch.lower())
        if lat is None:
            out.append(ch)
        elif ch.isupper():
            out.append(lat[0].upper() + lat[1:])
        else:
            out.append(lat)
    return "".join(out)


def _root(path):
    with zipfile.ZipFile(path) as z:
        return ET.fromstring(z.read("word/document.xml"))


def _paragraph_text(p):
    parts = []
    for n in p.iter():
        if n.tag == _W + "t":
            parts.append(n.text or "")
        elif n.tag == _W + "tab":
            parts.append("\t")
    return "".join(parts)


def text(path):
    """Ceo tekst, pasus po red (zaglavlje roka sa datumima prijave, v. parse_rok)."""
    return "\n".join(_paragraph_text(p) for p in _root(path).iter(_W + "p"))


def table_rows(path):
    """Redovi svih tabela kao liste teksta ćelija; pasusi u ćeliji su spojeni razmakom."""
    for row in _root(path).iter(_W + "tr"):
        yield [
            " ".join(_paragraph_text(p).strip() for p in c.iter(_W + "p")).strip()
            for c in row.findall(_W + "tc")
        ]


def extract_lines(path):
    """Linije rasporeda u obliku koji očekuje fon_parser.parse_schedule_lines."""
    lines = []
    for p in _root(path).iter(_W + "p"):
        fields = [f.strip() for f in _paragraph_text(p).split("\t") if f.strip()]
        if fields:
            lines.append(" ".join(fields))
    return lines


def count_time_lines(lines):
    """Koliko linija ima vreme termina. Služi kao provera: svaka takva linija
    mora da postane jedan unos, inače je format fajla promenjen."""
    return sum(1 for line in lines if _TIME_RE.search(line))


def _marker(name):
    name = to_latin(name.strip())
    return "A-" if name == "A" else name


def parse_groups(path):
    """{ "A1": {"program": "ISiT", "range": "A- - Veljković"} }, isto kao PDF."""
    groups = {}
    for cells in table_rows(path):
        if len(cells) < 3:
            continue
        gid = re.sub(r"\s+", "", to_latin(cells[0]))
        if not re.match(r"^[A-Z]\d+$", gid):
            continue  # zaglavlje ili prazan red
        program = " ".join(to_latin(cells[1]).split())
        frm = _marker(cells[2])
        to = _marker(cells[3]) if len(cells) > 3 else ""
        if not frm or frm.lower() == "svi":
            range_str = "Svi"
        elif to:
            range_str = f"{frm} - {to}"
        else:
            range_str = frm
        groups[gid] = {"program": program, "range": range_str}
    return groups
