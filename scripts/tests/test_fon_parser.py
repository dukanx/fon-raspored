"""Testovi za fon_parser (raspored nastave).

Fokus je na stitch_wrapped_subjects — popravci za predmete čiji se naziv prelomi
u dve linije oko data-reda (npr. OIKT "Osnove informaciono komunikacionih
tehnologija" na prvoj godini zimski). Testira se i da spajanje NE gazi normalne
jednolinijske unose (regresija koja bi pogodila letnje PDF-ove).

Sintetičke linije umesto PDF fixtura — layout je stabilan, a bug je u logici
spajanja linija, ne u čitanju PDF-a.
"""
import fon_parser as parser

# Grupe za razrešavanje prečica/šifri (expand_groups filtrira na postojeće).
GROUPS = {
    "A1": {"program": "ISiT"},
    "A2": {"program": "ISiT"},
    "A3": {"program": "ISiT"},
}

# OIKT: naziv prelomljen oko data-reda (prefix | data | suffix).
WRAPPED_OIKT = [
    "Osnove informaciono komunikacionih",
    "P A1,A2,A3 10:15-12:00 Amfiteatar 2",
    "tehnologija",
]

NORMAL_ENTRY = "Matematika 1 P A1,A2 08:15-10:00 Amfiteatar 1"


def test_stitch_recovers_wrapped_subject():
    """Tri reda (prefix, data, suffix) -> jedan spojen red sa punim nazivom."""
    out = parser.stitch_wrapped_subjects(WRAPPED_OIKT)
    assert out == [
        "Osnove informaciono komunikacionih tehnologija P A1,A2,A3 10:15-12:00 Amfiteatar 2"
    ]


def test_stitch_noop_on_normal_lines():
    """Normalan jednolinijski unos ostaje netaknut — bez lažnog spajanja."""
    lines = ["Ponedeljak", NORMAL_ENTRY, "Utorak"]
    assert parser.stitch_wrapped_subjects(lines) == lines


def test_parse_recovers_oikt_entry():
    """Kroz ceo parser: prelomljeni OIKT se izvuče kao potpun unos."""
    lines = ["Ponedeljak", *WRAPPED_OIKT]
    entries = parser.parse_schedule_lines(lines, GROUPS)

    assert len(entries) == 1
    e = entries[0]
    assert e["subject"] == "Osnove informaciono komunikacionih tehnologija"
    assert e["type"] == "Predavanje"
    assert e["type_short"] == "P"
    assert e["groups"] == ["A1", "A2", "A3"]
    assert e["start"] == "10:15"
    assert e["end"] == "12:00"
    assert e["room"] == "Amfiteatar 2"
    assert e["day"] == "Ponedeljak"


def test_parse_normal_entry_unaffected():
    """Normalan unos u istoj listi kao prelomljeni — oba se ispravno parsiraju."""
    lines = ["Ponedeljak", *WRAPPED_OIKT, NORMAL_ENTRY]
    entries = parser.parse_schedule_lines(lines, GROUPS)

    subjects = {e["subject"] for e in entries}
    assert subjects == {
        "Osnove informaciono komunikacionih tehnologija",
        "Matematika 1",
    }
    mat = next(e for e in entries if e["subject"] == "Matematika 1")
    assert mat["groups"] == ["A1", "A2"]
    assert mat["start"] == "08:15"
    assert mat["room"] == "Amfiteatar 1"
