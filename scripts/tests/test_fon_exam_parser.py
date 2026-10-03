"""Testovi za fon_exam_parser na realnim FON PDF-ovima.

Dve vrste provera:
  1. Golden test - izlaz parsera mora da se poklopi sa sačuvanim .expected.json.
     Hvata regresije: ako se parser promeni i izlaz se razlikuje, test pada.
     Kad je promena namerna, regeneriši golden fajlove (vidi update_golden.py).
  2. Strukturne provere - opšta pravila koja moraju da važe nezavisno od PDF-a
     (ISO datum, HH:MM vremena, ne-prazan naziv, P/U samo kod ispita, itd.).
"""
import json
import re
from pathlib import Path

import pytest

import fon_exam_parser as parser

FIXTURES = Path(__file__).parent / "fixtures"

DATE_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")


def _load_golden(name):
    with open(FIXTURES / f"{name}.expected.json", encoding="utf-8") as f:
        return json.load(f)


CASES = [
    ("ispit_feb", parser.parse_ispit, True),
    ("kolokvijum_drugi_zimski", parser.parse_kolokvijum, False),
]


@pytest.mark.parametrize("name, parse_fn, with_type", CASES)
def test_matches_golden(name, parse_fn, with_type):
    """Izlaz parsera mora da se poklopi sa sačuvanim golden JSON-om."""
    actual = parse_fn(str(FIXTURES / f"{name}.pdf"))
    expected = _load_golden(name)
    assert actual == expected


@pytest.mark.parametrize("name, parse_fn, with_type", CASES)
def test_structure(name, parse_fn, with_type):
    """Strukturna pravila koja moraju da važe za svaki PDF, ne samo ove fixture."""
    entries = parse_fn(str(FIXTURES / f"{name}.pdf"))

    assert len(entries) > 0, "parser nije izvukao nijedan unos"

    for e in entries:
        assert e["subject"].strip(), f"prazan naziv predmeta: {e}"
        assert DATE_ISO_RE.match(e["date"]), f"datum nije ISO (YYYY-MM-DD): {e}"
        assert TIME_RE.match(e["start"]), f"start nije HH:MM: {e}"
        assert TIME_RE.match(e["end"]), f"end nije HH:MM: {e}"
        assert isinstance(e["rooms"], list), f"rooms nije lista: {e}"
        assert isinstance(e["note"], str), f"note nije string: {e}"

        if with_type:
            assert e["type"] in {"P", "U", "П", "У"}, f"neo\u010dekivan P/U tip: {e}"
        else:
            assert "type" not in e, f"kolokvijum ne sme da ima 'type': {e}"


def test_to_iso():
    """Konverzija datuma u ISO za sve podržane separatore."""
    assert parser.to_iso("06/03/2026") == "2026-03-06"
    assert parser.to_iso("06.03.2026") == "2026-03-06"
    assert parser.to_iso("06-03-2026") == "2026-03-06"
    assert parser.to_iso("nije datum") == ""


def test_parse_rooms_amfiteatar():
    """Amfiteatar/Čitaonica se spajaju sa brojem; šum se preskače."""
    assert parser.parse_rooms(["Amfiteatar", "1", "Amfiteatar", "2"]) == [
        "Amfiteatar 1",
        "Amfiteatar 2",
    ]
    assert parser.parse_rooms(["19", "СЕМЕСТРУ", "13"]) == ["19", "13"]
    # Čitaonica bez broja iza sebe ostaje sama; Amfiteatar guta broj.
    assert parser.parse_rooms(["Čitaonica", "Amfiteatar", "1"]) == [
        "Čitaonica",
        "Amfiteatar 1",
    ]


def test_precrtan_termin_se_ne_cita():
    """FON izmenu termina označava precrtavanjem starog i upisom novog ispod.
    Precrtano je otkazano: parser mora da vrati samo novi datum, vreme i salu."""
    entries = parser.parse_ispit(str(FIXTURES / "ispit_okt_precrtano.pdf"))
    by = {(e["subject"], e["date"]): e for e in entries}

    analiza = by[("Analiza podataka", "2026-09-17")]  # bio 18. 9. u 16:00, sala 19
    assert (analiza["start"], analiza["rooms"]) == ("18:00", ["06"])
    assert ("Analiza podataka", "2026-09-18") not in by

    bio = by[("Biostatistika", "2026-09-07")]  # bilo 16:15-18:15
    assert (bio["start"], bio["end"]) == ("18:30", "20:30")


def test_crvena_izmena_ima_prednost():
    """Novu vrednost FON piše crvenom; staru ponekad zaboravi da precrta. U ćeliji
    sa crvenim tekstom važi samo crveno."""
    entries = parser.parse_ispit(str(FIXTURES / "ispit_sept_crveno.pdf"))
    fmr = [e for e in entries if e["subject"] == "Finansijski menadžment i računovodstvo"
           and e["type"] == "U"]
    assert [(e["date"], e["rooms"]) for e in fmr] == [("2026-09-05", ["Amfiteatar 5"])]  # crno 04/09 nije precrtano
