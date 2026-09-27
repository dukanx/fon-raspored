"""Testovi za scrape_kalendar na snimku prave stranice (školska 2026/27)."""
from pathlib import Path

import scrape_kalendar as sk

HTML = (Path(__file__).parent / "fixtures" / "kalendar_2026_27.html").read_text(encoding="utf-8")


def test_cita_pravi_kalendar():
    year, days, problems = sk.parse(HTML)
    assert problems == []
    assert year == "2026/27"
    assert days["2026-09-28"] == {"tip": "nastava"}  # početak nastave
    assert days["2026-11-07"] == {"tip": "nastava", "napomena": "Onlajn nastava"}
    assert days["2026-11-11"] == {"tip": "neradni"}  # Dan primirja
    assert days["2026-11-16"]["tip"] == "kolokvijumi"
    assert days["2027-01-11"] == {"tip": "ispitni_rok", "napomena": "Januarski ispitni rok"}
    assert days["2027-02-24"]["tip"] == "bez_nastave"


def test_dani_bez_podataka_se_preskacu():
    _, days, _ = sk.parse(HTML)
    assert "2026-09-27" not in days  # pre početka školske godine
    assert all(d["tip"] in sk.TYPES.values() for d in days.values())


def test_promenjena_stranica_daje_problem():
    _, _, problems = sk.parse("<html><body><p>nema kalendara</p></body></html>")
    assert problems
