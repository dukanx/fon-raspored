"""Testovi za fon_docx na pravim FON Word fajlovima (zimski 2026/27).

  1. Golden test - raspored i grupe moraju da se poklope sa sačuvanim
     .expected.json (regeneriše se sa update_golden.py kad je promena namerna).
  2. Strukturne provere - svaka linija sa vremenom postaje termin, svaki
     termin ima grupu koja postoji, grupe su latinicom.
"""
import json
import re
from pathlib import Path

import pytest

import fon_docx
import fon_parser

DIR = Path(__file__).parent / "fixtures" / "nastava_docx"
YEARS = [1, 2, 3, 4]
CYRILLIC = re.compile(r"[Ѐ-ӿ]")


def _parse(y):
    groups = fon_docx.parse_groups(str(DIR / f"grupe_{y}god_zimski_2026.docx"))
    lines = fon_docx.extract_lines(str(DIR / f"raspored_{y}god_zimski_2026.docx"))
    return groups, lines, fon_parser.parse_schedule_lines(lines, groups)


@pytest.mark.parametrize("y", YEARS)
def test_matches_golden(y):
    groups, _, entries = _parse(y)
    with open(DIR / f"{y}god_zimski_2026.expected.json", encoding="utf-8") as f:
        expected = json.load(f)
    assert groups == expected["groups"]
    assert entries == expected["entries"]


@pytest.mark.parametrize("y", YEARS)
def test_every_time_line_becomes_entry(y):
    _, lines, entries = _parse(y)
    assert len(entries) == fon_docx.count_time_lines(lines) > 0


@pytest.mark.parametrize("y", YEARS)
def test_entries_have_known_groups(y):
    groups, _, entries = _parse(y)
    for e in entries:
        assert e["groups"], e
        assert set(e["groups"]) <= set(groups), e
        assert e["day"] in fon_parser.DAYS
        assert re.match(r"^\d{2}:\d{2}$", e["start"]) and re.match(r"^\d{2}:\d{2}$", e["end"])


@pytest.mark.parametrize("y", YEARS)
def test_groups_are_latin(y):
    groups, _, _ = _parse(y)
    assert groups
    for gid, g in groups.items():
        assert re.match(r"^[A-D]\d+$", gid)
        assert not CYRILLIC.search(g["program"] + g["range"]), (gid, g)


def test_to_latin():
    assert fon_docx.to_latin("Љубић Њежић Џајић") == "Ljubić Nježić Džajić"
    assert fon_docx.to_latin("Сви") == "Svi"
    assert fon_docx.to_latin("A1 ISiT") == "A1 ISiT"


def test_range_markers():
    groups = fon_docx.parse_groups(str(DIR / "grupe_2god_zimski_2026.docx"))
    # "А" bez crte na početku liste postaje "A-", ćirilica ide u latinicu.
    assert groups["B1"]["range"] == "A- - Vukas"
    groups = fon_docx.parse_groups(str(DIR / "grupe_3god_zimski_2026.docx"))
    assert groups["C3"]["range"] == "Ječmenica - Lj-"
    assert groups["C11"]["range"] == "Svi"
